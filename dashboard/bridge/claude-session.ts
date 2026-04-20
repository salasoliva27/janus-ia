import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { WebSocket } from "ws";
import type { ServerMessage } from "./types.js";
import { getAgent } from "./agent-registry.js";

const WORKSPACE_ROOT = "/workspaces/janus-ia";
const SESSIONS_DIR = path.join(
  os.homedir(),
  ".claude",
  "projects",
  "-workspaces-janus-ia",
  "dashboard-sessions",
);

function isValidCwd(cwd: string): boolean {
  return cwd.startsWith(WORKSPACE_ROOT);
}

function sessionFile(sessionId: string, agentId: string = "claude"): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  // Keep claude's file at the legacy name for backward compatibility; other
  // agents get their own suffixed file so switching doesn't clobber state.
  const suffix = agentId === "claude" ? "" : `-${agentId}`;
  return path.join(SESSIONS_DIR, `${safe}${suffix}.json`);
}

function loadPersistedSession(sessionId: string, agentId: string = "claude"): {
  claudeSessionId: string | null;
  conversationLog: string[];
} {
  try {
    const raw = fs.readFileSync(sessionFile(sessionId, agentId), "utf-8");
    const parsed = JSON.parse(raw);
    return {
      claudeSessionId: typeof parsed.claudeSessionId === "string" ? parsed.claudeSessionId : null,
      conversationLog: Array.isArray(parsed.conversationLog) ? parsed.conversationLog.slice(-50) : [],
    };
  } catch {
    return { claudeSessionId: null, conversationLog: [] };
  }
}

function persistSession(
  sessionId: string,
  claudeSessionId: string | null,
  conversationLog: string[],
  lastPrompt: string,
  agentId: string = "claude",
): void {
  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    const payload = {
      sessionId,
      agentId,
      claudeSessionId,
      conversationLog: conversationLog.slice(-50),
      lastPrompt: lastPrompt.slice(0, 500),
      updatedAt: Date.now(),
    };
    fs.writeFileSync(sessionFile(sessionId, agentId), JSON.stringify(payload, null, 2));
  } catch (err) {
    console.warn(`[session:${sessionId}] failed to persist:`, err);
  }
}

export class ClaudeSession {
  private process: ChildProcess | null = null;
  private claudeSessionId: string | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private conversationLog: string[] = [];
  private forkContext: string[] | null = null;
  private lastPrompt: string = "";
  private agentId: string = "claude";

  constructor(
    private ws: WebSocket,
    _permissionManager: unknown,
    private sessionId: string = "session-0",
    agentId: string = "claude",
  ) {
    this.agentId = agentId;
    const persisted = loadPersistedSession(sessionId, agentId);
    this.claudeSessionId = persisted.claudeSessionId;
    this.conversationLog = persisted.conversationLog;
    if (this.claudeSessionId) {
      console.log(`[session:${sessionId}/${agentId}] resumed id: ${this.claudeSessionId}`);
    }
  }

  /** Switch agents — reloads persisted state for the new agent. */
  setAgent(agentId: string): void {
    if (agentId === this.agentId) return;
    this.close();
    this.agentId = agentId;
    const persisted = loadPersistedSession(this.sessionId, agentId);
    this.claudeSessionId = persisted.claudeSessionId;
    this.conversationLog = persisted.conversationLog;
    console.log(`[session:${this.sessionId}] switched to agent "${agentId}"`);
  }

  getAgent(): string { return this.agentId; }

  /** Whether a persisted Claude session exists (can --continue on next turn) */
  hasPersistedSession(): boolean {
    return this.claudeSessionId !== null;
  }

  /** Set conversation history from parent session (for forks) */
  setForkContext(history: string[]): void {
    this.forkContext = history;
  }

  /** Get the accumulated conversation log for forking */
  getConversationLog(): string[] {
    return [...this.conversationLog];
  }

  async start(prompt: string, cwd: string): Promise<void> {
    const safeCwd = isValidCwd(cwd) ? cwd : WORKSPACE_ROOT;
    this.close();

    // If this is a forked session, prepend parent context
    let fullPrompt = prompt;
    if (this.forkContext && this.forkContext.length > 0) {
      const contextBlock = this.forkContext.join("\n");
      fullPrompt = `[Previous conversation context — you are continuing from a forked branch]\n${contextBlock}\n[End of context. Continue from here.]\n\n${prompt}`;
      this.forkContext = null; // Only use once
    }

    const adapter = getAgent(this.agentId);
    const spawnSpec = adapter.buildSpawn({
      prompt: fullPrompt,
      continueId: this.claudeSessionId,
    });

    console.log(`[session:${this.sessionId}/${this.agentId}] spawning ${adapter.cli}...`);

    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    for (const key of spawnSpec.envUnset || []) { delete childEnv[key]; }
    if (spawnSpec.envPatch) { Object.assign(childEnv, spawnSpec.envPatch); }

    // Pre-flight: missing-credential guard for adapters that need an API key.
    if (adapter.envVarRequired && !childEnv[adapter.envVarRequired]) {
      this.send({ type: "error", message: `${adapter.label} requires ${adapter.envVarRequired} — open the Key Vault to add it.`, sessionId: this.sessionId });
      return;
    }

    this.send({
      type: "session_start",
      auth: adapter.authMethod === "oauth" ? "subscription" : "api-key",
      sessionId: this.sessionId,
    });

    // Log user message
    this.conversationLog.push(`User: ${prompt}`);
    this.lastPrompt = prompt;
    // Persist immediately so a crash mid-turn doesn't lose the user's message
    persistSession(this.sessionId, this.claudeSessionId, this.conversationLog, prompt, this.agentId);

    const proc = spawn(spawnSpec.cli, spawnSpec.args, {
      cwd: safeCwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnv,
    });

    this.process = proc;
    let buffer = "";
    let assistantBuffer = "";
    const isStreamJson = spawnSpec.outputFormat === "stream-json";

    // Safety timeout — if no output for 120s, kill the process
    this.resetTimeout(proc);

    proc.stdout?.on("data", (chunk: Buffer) => {
      this.resetTimeout(proc);
      buffer += chunk.toString();

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (isStreamJson) {
          try {
            const event = JSON.parse(trimmed);
            const text = this.handleStreamEvent(event);
            if (text) assistantBuffer += text;
          } catch {
            // Fall through — some lines may be plain text even in stream-json mode
            this.send({ type: "claude_message", message: trimmed, sessionId: this.sessionId });
            assistantBuffer += trimmed;
          }
        } else {
          // Plain-text agent: stream each non-empty line as an assistant message
          this.send({ type: "claude_message", message: trimmed, sessionId: this.sessionId });
          assistantBuffer += trimmed + "\n";
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        console.log(`[session:${this.sessionId}:stderr]`, text);
        if (text.includes("error") || text.includes("Error") || text.includes("failed")) {
          this.send({ type: "error", message: text, sessionId: this.sessionId });
        }
      }
    });

    proc.on("close", (code) => {
      console.log(`[session:${this.sessionId}/${this.agentId}] process exited with code ${code}`);
      this.clearTimeout();
      this.process = null;

      // Process remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (isStreamJson) {
          try {
            const event = JSON.parse(trimmed);
            const text = this.handleStreamEvent(event);
            if (text) assistantBuffer += text;
          } catch {
            this.send({ type: "claude_message", message: trimmed, sessionId: this.sessionId });
            assistantBuffer += trimmed;
          }
        } else {
          this.send({ type: "claude_message", message: trimmed, sessionId: this.sessionId });
          assistantBuffer += trimmed;
        }
        buffer = "";
      }

      // Log assistant response
      if (assistantBuffer) {
        this.conversationLog.push(`Assistant: ${assistantBuffer}`);
      }

      // Persist after the turn completes
      persistSession(this.sessionId, this.claudeSessionId, this.conversationLog, this.lastPrompt, this.agentId);

      this.send({
        type: "session_end",
        cost: undefined,
        usage: undefined,
        sessionId: this.sessionId,
      });
    });

    proc.on("error", (err) => {
      console.error(`[session:${this.sessionId}] spawn error:`, err.message);
      this.clearTimeout();
      this.send({ type: "error", message: err.message, sessionId: this.sessionId });
      this.process = null;
    });
  }

  private resetTimeout(proc: ChildProcess) {
    this.clearTimeout();
    this.timeout = setTimeout(() => {
      console.warn(`[session:${this.sessionId}] timeout — no output for 120s, killing process`);
      proc.kill("SIGTERM");
      this.send({ type: "error", message: "Session timed out (no output for 120s)", sessionId: this.sessionId });
    }, 120_000);
  }

  private clearTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private handleStreamEvent(event: any): string | null {
    switch (event.type) {
      case "system": {
        // Only `init` carries the real conversation session_id. Hook events
        // (`hook_started` / `hook_progress` / `hook_response`) carry their own
        // hook UUID, which would corrupt --resume on the next turn.
        if (event.subtype === "init" && event.session_id) {
          this.claudeSessionId = event.session_id;
          console.log(`[session:${this.sessionId}/${this.agentId}] cli id:`, this.claudeSessionId);
          persistSession(this.sessionId, this.claudeSessionId, this.conversationLog, this.lastPrompt, this.agentId);
        }
        return null;
      }

      case "assistant": {
        const content = event.message?.content;
        let text = "";
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              this.send({ type: "claude_message", message: block.text, sessionId: this.sessionId });
              text += block.text;
            } else if (block.type === "tool_use") {
              this.send({
                type: "tool_event",
                toolName: block.name || "unknown",
                input: block.input || {},
                sessionId: this.sessionId,
                timestamp: Date.now(),
              });
            }
          }
        } else if (typeof content === "string") {
          this.send({ type: "claude_message", message: content, sessionId: this.sessionId });
          text = content;
        }
        return text || null;
      }

      case "result": {
        if (event.session_id) {
          this.claudeSessionId = event.session_id;
        }
        return null;
      }

      default: {
        if (event.type === "tool_use" || event.tool_name) {
          this.send({
            type: "tool_event",
            toolName: event.tool_name || event.name || "unknown",
            input: event.input || {},
            sessionId: this.sessionId,
            timestamp: Date.now(),
          });
        }
        return null;
      }
    }
  }

  async followUp(prompt: string): Promise<void> {
    await this.start(prompt, WORKSPACE_ROOT);
  }

  async interrupt(): Promise<void> {
    if (this.process) {
      this.process.kill("SIGINT");
    }
  }

  close(): void {
    this.clearTimeout();
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  private send(msg: ServerMessage): void {
    if (this.ws.readyState === 1 /* OPEN */) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
