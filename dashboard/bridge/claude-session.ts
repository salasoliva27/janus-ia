import { spawn, type ChildProcess } from "node:child_process";
import type { WebSocket } from "ws";
import type { ServerMessage } from "./types.js";

// Spawn Claude Code CLI using the user's subscription (not API key).
// Uses `claude -p --output-format stream-json` for streaming responses.

const WORKSPACE_ROOT = "/workspaces/venture-os";

function isValidCwd(cwd: string): boolean {
  return cwd.startsWith(WORKSPACE_ROOT);
}

export class ClaudeSession {
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;

  constructor(
    private ws: WebSocket,
    // Keep the interface compatible but we don't use permissionManager for CLI mode
    _permissionManager: unknown,
  ) {}

  async start(prompt: string, cwd: string): Promise<void> {
    const safeCwd = isValidCwd(cwd) ? cwd : WORKSPACE_ROOT;
    this.close();

    const args = [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
      // Disable hooks, skills, and session persistence for subprocess —
      // hooks (GSD, claude-mem) cause interference and massive overhead
      "--settings", '{"hooks":{}}',
      "--disable-slash-commands",
      "--no-session-persistence",
    ];

    // If we have a prior session, continue it
    if (this.sessionId) {
      args.push("--continue", this.sessionId);
    }

    console.log("[session] spawning claude CLI...");

    // Strip ANTHROPIC_API_KEY so claude CLI uses OAuth subscription, not API key
    const cleanEnv = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;

    const proc = spawn("claude", args, {
      cwd: safeCwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: cleanEnv,
    });

    this.process = proc;
    let buffer = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();

      // Process complete JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete last line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);
          this.handleStreamEvent(event);
        } catch {
          // Not JSON — send as raw text
          if (trimmed.length > 0) {
            this.send({ type: "claude_message", message: trimmed });
          }
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        console.log("[session:stderr]", text);
      }
    });

    proc.on("close", (code) => {
      console.log(`[session] process exited with code ${code}`);
      this.process = null;
      this.send({
        type: "session_end",
        cost: undefined,
        usage: undefined,
      });
    });

    proc.on("error", (err) => {
      console.error("[session] spawn error:", err.message);
      this.send({ type: "error", message: err.message });
      this.process = null;
    });
  }

  private handleStreamEvent(event: any): void {
    // Claude CLI stream-json events:
    // { type: "system", subtype: "init", session_id: "..." }
    // { type: "assistant", message: { role: "assistant", content: [...] } }
    // { type: "result", result: "...", session_id: "...", cost_usd: ... }

    switch (event.type) {
      case "system": {
        if (event.session_id) {
          this.sessionId = event.session_id;
        }
        // Don't forward system/hook events to chat
        break;
      }

      case "assistant": {
        // Extract text from content blocks
        const content = event.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              this.send({ type: "claude_message", message: block.text });
            }
          }
        } else if (typeof content === "string") {
          this.send({ type: "claude_message", message: content });
        }
        break;
      }

      case "result": {
        // Session complete — text already sent via "assistant" events above,
        // so do NOT re-send event.result (causes duplicate messages).
        if (event.session_id) {
          this.sessionId = event.session_id;
        }
        break;
      }

      default: {
        // Forward tool_use, tool_result etc. as tool events
        if (event.type === "tool_use" || event.tool_name) {
          this.send({
            type: "tool_event",
            toolName: event.tool_name || event.name || "unknown",
            input: event.input || {},
            sessionId: this.sessionId || "",
            timestamp: Date.now(),
          });
        }
        break;
      }
    }
  }

  async followUp(prompt: string): Promise<void> {
    // For follow-ups, start a new session continuing the previous one
    if (this.sessionId) {
      await this.start(prompt, WORKSPACE_ROOT);
    } else {
      this.send({ type: "error", message: "No active session for follow-up" });
    }
  }

  async interrupt(): Promise<void> {
    if (this.process) {
      this.process.kill("SIGINT");
    }
  }

  close(): void {
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
