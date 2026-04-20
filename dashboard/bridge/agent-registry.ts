// Agent registry — pluggable CLI-based coding agents.
// Each adapter describes how to spawn the underlying CLI for a fresh turn or
// a continuation, plus any env/credential requirements.

export interface AgentStartSpec {
  prompt: string;
  continueId: string | null;
  attachments?: string[]; // absolute paths of uploaded files, optional
  modelId?: string;       // override the adapter's default model
}

export interface AgentSpawn {
  cli: string;
  args: string[];
  /** Extra env vars to set or override for the child process */
  envPatch?: Record<string, string>;
  /** Env vars to explicitly unset before spawn (e.g. ANTHROPIC_API_KEY for claude's OAuth) */
  envUnset?: string[];
  /** How the child emits progress.
   *  - stream-json: Claude-style event stream (content_block_delta, etc.)
   *  - codex-json:  Codex `exec --json` JSONL (thread.started, item.completed, turn.completed)
   *  - text:        plain stdout lines (Gemini default) */
  outputFormat: "stream-json" | "codex-json" | "text";
}

export interface ModelOption {
  id: string;     // exact CLI model id
  label: string;  // display name
  note?: string;  // tagline ("fastest", "deepest reasoning", etc.)
}

export interface AgentAdapter {
  id: string;            // stable identifier — stored with the session file
  label: string;         // display name in the picker
  cli: string;           // path-resolvable CLI command (e.g. "claude")
  envVarRequired?: string; // env var that must be set for the adapter to be usable
  authMethod: "oauth" | "api-key";
  /** Model catalog — first entry is the default */
  models: ModelOption[];
  defaultModel: string;
  /** Build the spawn recipe for either a fresh turn or a continuation */
  buildSpawn(spec: AgentStartSpec): AgentSpawn;
}

// ── Claude Code ──────────────────────────────────────
// Uses the Anthropic subscription via OAuth. We strip ANTHROPIC_API_KEY so
// claude picks up the logged-in credentials instead of a raw API key.
const claudeModels: ModelOption[] = [
  { id: "claude-opus-4-7",         label: "Opus 4.7",   note: "latest, most capable" },
  { id: "claude-opus-4-6",         label: "Opus 4.6",   note: "prior Opus" },
  { id: "claude-sonnet-4-6",       label: "Sonnet 4.6", note: "balanced, faster" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", note: "fastest, cheapest" },
];
const claudeAdapter: AgentAdapter = {
  id: "claude",
  label: "Claude Code",
  cli: "claude",
  authMethod: "oauth",
  models: claudeModels,
  defaultModel: "claude-opus-4-7",
  buildSpawn({ prompt, continueId, attachments, modelId }) {
    const finalPrompt = attachments && attachments.length > 0
      ? `${prompt}\n\n[Attached files — open with the Read tool]\n${attachments.map(a => `  - ${a}`).join("\n")}`
      : prompt;
    const model = modelId && claudeModels.some(m => m.id === modelId) ? modelId : "claude-opus-4-7";
    const args = [
      "-p", finalPrompt,
      "--model", model,
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--disable-slash-commands",
    ];
    if (continueId) args.push("--resume", continueId);
    return { cli: "claude", args, envUnset: ["ANTHROPIC_API_KEY"], outputFormat: "stream-json" };
  },
};

// ── OpenAI Codex CLI ─────────────────────────────────
// Uses `codex exec` for headless / non-interactive turns. Resume by session id.
const codexModels: ModelOption[] = [
  { id: "gpt-5-codex", label: "GPT-5 Codex", note: "code-specialised default" },
  { id: "gpt-5",       label: "GPT-5",       note: "general reasoning" },
  { id: "o3",          label: "o3",          note: "deeper reasoning" },
  { id: "o3-mini",     label: "o3-mini",     note: "fast reasoning" },
];
const codexAdapter: AgentAdapter = {
  id: "codex",
  label: "Codex (OpenAI)",
  cli: "codex",
  envVarRequired: "OPENAI_API_KEY",
  authMethod: "api-key",
  models: codexModels,
  defaultModel: "gpt-5-codex",
  buildSpawn({ prompt, continueId, attachments, modelId }) {
    const args: string[] = continueId
      ? ["exec", "resume", continueId]
      : ["exec"];
    const model = modelId && codexModels.some(m => m.id === modelId) ? modelId : "gpt-5-codex";
    args.push("--model", model);
    // Parity with Claude's --dangerously-skip-permissions. Jano's Codespace
    // is already the sandbox; extra gating would force Codex to refuse
    // anything that touches the network, filesystem, or subprocess (SQL,
    // curl, MCP stdio, etc.). See the Claude adapter for the same trade-off.
    args.push("--dangerously-bypass-approvals-and-sandbox");
    // --json puts structured events on stdout (thread.started, item.completed,
    // turn.completed). Without it, Codex writes the final agent message to
    // STDERR alongside its exec trace, which our parser can't distinguish from
    // real errors. With --json, stdout is clean JSONL.
    args.push("--json");
    if (attachments && attachments.length > 0) {
      for (const p of attachments) { args.push("--image", p); }
    }
    args.push(prompt);
    return { cli: "codex", args, outputFormat: "codex-json" };
  },
};

// ── Google Gemini CLI ────────────────────────────────
// Uses `gemini -p` for headless mode with --approval-mode yolo to mirror
// Claude's --dangerously-skip-permissions so the dashboard can operate agentically.
const geminiModels: ModelOption[] = [
  { id: "gemini-2.5-pro",   label: "Gemini 2.5 Pro",   note: "most capable" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "fast, cheap" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", note: "prior generation" },
];
const geminiAdapter: AgentAdapter = {
  id: "gemini",
  label: "Gemini CLI",
  cli: "gemini",
  envVarRequired: "GEMINI_API_KEY",
  authMethod: "api-key",
  models: geminiModels,
  defaultModel: "gemini-2.5-pro",
  buildSpawn({ prompt, continueId: _continueId, attachments, modelId }) {
    // Gemini CLI doesn't expose a direct --continue flag in the stable surface;
    // it remembers conversation state across interactive sessions but headless
    // turns are stateless. We append the last turn summary instead when needed.
    const finalPrompt = attachments && attachments.length > 0
      ? `${prompt}\n\n[Attached files — open them for context]\n${attachments.map(a => `  - ${a}`).join("\n")}`
      : prompt;
    const model = modelId && geminiModels.some(m => m.id === modelId) ? modelId : "gemini-2.5-pro";
    const args = [
      "-p", finalPrompt,
      "-m", model,
      "--approval-mode", "yolo",
    ];
    return { cli: "gemini", args, outputFormat: "text" };
  },
};

export const AGENTS: AgentAdapter[] = [claudeAdapter, codexAdapter, geminiAdapter];

export function getAgent(id: string | undefined | null): AgentAdapter {
  if (!id) return claudeAdapter;
  return AGENTS.find(a => a.id === id) || claudeAdapter;
}

export interface AgentAvailability {
  id: string;
  label: string;
  envVar: string | null;
  available: boolean;
  authMethod: AgentAdapter["authMethod"];
  reason?: string; // only set when unavailable
  models: ModelOption[];
  defaultModel: string;
}

export function listAgentAvailability(): AgentAvailability[] {
  return AGENTS.map(a => {
    const base = { id: a.id, label: a.label, authMethod: a.authMethod, models: a.models, defaultModel: a.defaultModel };
    if (!a.envVarRequired) {
      return { ...base, envVar: null, available: true };
    }
    const present = typeof process.env[a.envVarRequired] === "string" && process.env[a.envVarRequired]!.length > 0;
    return {
      ...base,
      envVar: a.envVarRequired,
      available: present,
      reason: present ? undefined : `Missing ${a.envVarRequired}`,
    };
  });
}
