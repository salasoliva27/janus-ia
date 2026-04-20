// Agent registry — pluggable CLI-based coding agents.
// Each adapter describes how to spawn the underlying CLI for a fresh turn or
// a continuation, plus any env/credential requirements.

export interface AgentStartSpec {
  prompt: string;
  continueId: string | null;
  attachments?: string[]; // absolute paths of uploaded files, optional
}

export interface AgentSpawn {
  cli: string;
  args: string[];
  /** Extra env vars to set or override for the child process */
  envPatch?: Record<string, string>;
  /** Env vars to explicitly unset before spawn (e.g. ANTHROPIC_API_KEY for claude's OAuth) */
  envUnset?: string[];
  /** How the child emits progress — stream-json is Claude-style structured; text is plain stdout. */
  outputFormat: "stream-json" | "text";
}

export interface AgentAdapter {
  id: string;            // stable identifier — stored with the session file
  label: string;         // display name in the picker
  cli: string;           // path-resolvable CLI command (e.g. "claude")
  envVarRequired?: string; // env var that must be set for the adapter to be usable
  authMethod: "oauth" | "api-key";
  /** Build the spawn recipe for either a fresh turn or a continuation */
  buildSpawn(spec: AgentStartSpec): AgentSpawn;
}

// ── Claude Code ──────────────────────────────────────
// Uses the Anthropic subscription via OAuth. We strip ANTHROPIC_API_KEY so
// claude picks up the logged-in credentials instead of a raw API key.
const claudeAdapter: AgentAdapter = {
  id: "claude",
  label: "Claude Code",
  cli: "claude",
  authMethod: "oauth",
  buildSpawn({ prompt, continueId, attachments }) {
    const finalPrompt = attachments && attachments.length > 0
      ? `${prompt}\n\n[Attached files — open with the Read tool]\n${attachments.map(a => `  - ${a}`).join("\n")}`
      : prompt;
    const args = [
      "-p", finalPrompt,
      "--model", "claude-opus-4-7",
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
const codexAdapter: AgentAdapter = {
  id: "codex",
  label: "Codex (OpenAI)",
  cli: "codex",
  envVarRequired: "OPENAI_API_KEY",
  authMethod: "api-key",
  buildSpawn({ prompt, continueId, attachments }) {
    const args: string[] = continueId
      ? ["exec", "resume", continueId]
      : ["exec"];
    if (attachments && attachments.length > 0) {
      for (const p of attachments) { args.push("--image", p); }
    }
    args.push(prompt);
    return { cli: "codex", args, outputFormat: "text" };
  },
};

// ── Google Gemini CLI ────────────────────────────────
// Uses `gemini -p` for headless mode with --approval-mode yolo to mirror
// Claude's --dangerously-skip-permissions so the dashboard can operate agentically.
const geminiAdapter: AgentAdapter = {
  id: "gemini",
  label: "Gemini CLI",
  cli: "gemini",
  envVarRequired: "GEMINI_API_KEY",
  authMethod: "api-key",
  buildSpawn({ prompt, continueId: _continueId, attachments }) {
    // Gemini CLI doesn't expose a direct --continue flag in the stable surface;
    // it remembers conversation state across interactive sessions but headless
    // turns are stateless. We append the last turn summary instead when needed.
    const finalPrompt = attachments && attachments.length > 0
      ? `${prompt}\n\n[Attached files — open them for context]\n${attachments.map(a => `  - ${a}`).join("\n")}`
      : prompt;
    const args = [
      "-p", finalPrompt,
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
}

export function listAgentAvailability(): AgentAvailability[] {
  return AGENTS.map(a => {
    if (!a.envVarRequired) {
      return { id: a.id, label: a.label, envVar: null, available: true, authMethod: a.authMethod };
    }
    const present = typeof process.env[a.envVarRequired] === "string" && process.env[a.envVarRequired]!.length > 0;
    return {
      id: a.id,
      label: a.label,
      envVar: a.envVarRequired,
      available: present,
      authMethod: a.authMethod,
      reason: present ? undefined : `Missing ${a.envVarRequired}`,
    };
  });
}
