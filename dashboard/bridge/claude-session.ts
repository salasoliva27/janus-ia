import { spawn, type ChildProcess } from "node:child_process";
import type { WebSocket } from "ws";
import type { ServerMessage } from "./types.js";

const WORKSPACE_ROOT = "/workspaces/venture-os";

function isValidCwd(cwd: string): boolean {
  return cwd.startsWith(WORKSPACE_ROOT);
}

export class ClaudeSession {
  private process: ChildProcess | null = null;
  private sessionId: string | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private ws: WebSocket,
    _permissionManager: unknown,
  ) {}

  async start(prompt: string, cwd: string): Promise<void> {
    const safeCwd = isValidCwd(cwd) ? cwd : WORKSPACE_ROOT;
    this.close();

    const args = [
      "-p", prompt,
      "--output-format", "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--disable-slash-commands",
    ];

    // Continue previous session if we have one
    if (this.sessionId) {
      args.push("--continue", this.sessionId);
    }

    console.log("[session] spawning claude CLI...");

    // Strip ANTHROPIC_API_KEY so claude CLI uses OAuth subscription
    const cleanEnv = { ...process.env };
    delete cleanEnv.ANTHROPIC_API_KEY;

    this.send({
      type: "session_start",
      auth: "subscription",
    });

    const proc = spawn("claude", args, {
      cwd: safeCwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: cleanEnv,
    });

    this.process = proc;
    let buffer = "";
    let gotOutput = false;

    // Safety timeout — if no output for 120s, kill the process
    this.resetTimeout(proc);

    proc.stdout?.on("data", (chunk: Buffer) => {
      gotOutput = true;
      this.resetTimeout(proc);
      buffer += chunk.toString();

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);
          this.handleStreamEvent(event);
        } catch {
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
        // Forward meaningful errors to UI
        if (text.includes("error") || text.includes("Error") || text.includes("failed")) {
          this.send({ type: "error", message: text });
        }
      }
    });

    proc.on("close", (code) => {
      console.log(`[session] process exited with code ${code}`);
      this.clearTimeout();
      this.process = null;

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          this.handleStreamEvent(event);
        } catch {
          if (buffer.trim().length > 0) {
            this.send({ type: "claude_message", message: buffer.trim() });
          }
        }
        buffer = "";
      }

      this.send({
        type: "session_end",
        cost: undefined,
        usage: undefined,
      });
    });

    proc.on("error", (err) => {
      console.error("[session] spawn error:", err.message);
      this.clearTimeout();
      this.send({ type: "error", message: err.message });
      this.process = null;
    });
  }

  private resetTimeout(proc: ChildProcess) {
    this.clearTimeout();
    this.timeout = setTimeout(() => {
      console.warn("[session] timeout — no output for 120s, killing process");
      proc.kill("SIGTERM");
      this.send({ type: "error", message: "Session timed out (no output for 120s)" });
    }, 120_000);
  }

  private clearTimeout() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private handleStreamEvent(event: any): void {
    switch (event.type) {
      case "system": {
        if (event.session_id) {
          this.sessionId = event.session_id;
          console.log("[session] id:", this.sessionId);
        }
        break;
      }

      case "assistant": {
        const content = event.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              this.send({ type: "claude_message", message: block.text });
            } else if (block.type === "tool_use") {
              this.send({
                type: "tool_event",
                toolName: block.name || "unknown",
                input: block.input || {},
                sessionId: this.sessionId || "",
                timestamp: Date.now(),
              });
            }
          }
        } else if (typeof content === "string") {
          this.send({ type: "claude_message", message: content });
        }
        break;
      }

      case "result": {
        if (event.session_id) {
          this.sessionId = event.session_id;
        }
        break;
      }

      default: {
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
    if (this.sessionId) {
      await this.start(prompt, WORKSPACE_ROOT);
    } else {
      // No prior session — start fresh
      await this.start(prompt, WORKSPACE_ROOT);
    }
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
