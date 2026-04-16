import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { WebSocket } from "ws";
import type { ServerMessage } from "./types.js";

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

function sessionFile(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(SESSIONS_DIR, `${safe}.json`);
}

function loadPersistedSession(sessionId: string): {
  claudeSessionId: string | null;
  conversationLog: string[];
} {
  try {
    const raw = fs.readFileSync(sessionFile(sessionId), "utf-8");
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
): void {
  try {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    const payload = {
      sessionId,
      claudeSessionId,
      conversationLog: conversationLog.slice(-50),
      lastPrompt: lastPrompt.slice(0, 500),
      updatedAt: Date.now(),
    };
    fs.writeFileSync(sessionFile(sessionId), JSON.stringify(payload, null, 2));
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

  constructor(
    private ws: WebSocket,
    _permissionManager: unknown,
    private sessionId: string = "session-0",
  ) {
    const persisted = loadPersistedSession(sessionId);
    this.claudeSessionId = persisted.claudeSessionId;
    this.conversationLog = persisted.conversationLog;
    if (this.claudeSessionId) {
      console.log(`[session:${sessionId}] resumed claude id: ${this.claudeSessionId}`);
    }
  }

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

    const args = [
      "-p", fullPrompt,
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--disable-slash-commands",
    ];

    // Continue previous session if we have one
    if (this.claudeSessionId) {
      args.push("--continue", this.claudeSessionId);
    }

    console.log(`[session:${this.sessionId}] spawning claude CLI...`);

    // Strip ANTHROPIC_API_KEY so claude CLI uses OAuth subscription
    const cleanEnv = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;

    this.send({
      type: "session_start",
      auth: "subscription",
      sessionId: this.sessionId,
    });

    // Log user message
    this.conversationLog.push(`User: ${prompt}`);
    this.lastPrompt = prompt;
    // Persist immediately so a crash mid-turn doesn't lose the user's message
    persistSession(this.sessionId, this.claudeSessionId, this.conversationLog, prompt);

    const proc = spawn("claude", args, {
      cwd: safeCwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: cleanEnv,
    });

    this.process = proc;
    let buffer = "";
    let assistantBuffer = "";

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

        try {
          const event = JSON.parse(trimmed);
          const text = this.handleStreamEvent(event);
          if (text) assistantBuffer += text;
        } catch {
          if (trimmed.length > 0) {
            this.send({ type: "claude_message", message: trimmed, sessionId: this.sessionId });
            assistantBuffer += trimmed;
          }
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
      console.log(`[session:${this.sessionId}] process exited with code ${code}`);
      this.clearTimeout();
      this.process = null;

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          const text = this.handleStreamEvent(event);
          if (text) assistantBuffer += text;
        } catch {
          if (buffer.trim().length > 0) {
            this.send({ type: "claude_message", message: buffer.trim(), sessionId: this.sessionId });
            assistantBuffer += buffer.trim();
          }
        }
        buffer = "";
      }

      // Log assistant response
      if (assistantBuffer) {
        this.conversationLog.push(`Assistant: ${assistantBuffer}`);
      }

      // Persist after the turn completes (claudeSessionId now settled)
      persistSession(this.sessionId, this.claudeSessionId, this.conversationLog, this.lastPrompt);

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
        if (event.session_id) {
          this.claudeSessionId = event.session_id;
          console.log(`[session:${this.sessionId}] claude id:`, this.claudeSessionId);
          // Persist the claude id as soon as we have it — survives crashes mid-turn
          persistSession(this.sessionId, this.claudeSessionId, this.conversationLog, this.lastPrompt);
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
