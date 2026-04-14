import { query } from "@anthropic-ai/claude-agent-sdk";
import type { WebSocket } from "ws";
import type { ServerMessage } from "./types.js";
import { PermissionManager } from "./permissions.js";

// T-01-06: Only allow cwd within workspace
const WORKSPACE_ROOT = "/workspaces/venture-os";

function isValidCwd(cwd: string): boolean {
  return cwd.startsWith(WORKSPACE_ROOT);
}

export class ClaudeSession {
  private activeQuery: ReturnType<typeof query> | null = null;

  constructor(
    private ws: WebSocket,
    private permissionManager: PermissionManager,
  ) {}

  async start(prompt: string, cwd: string): Promise<void> {
    // T-01-06: Validate cwd
    const safeCwd = isValidCwd(cwd) ? cwd : WORKSPACE_ROOT;

    // Close any existing session first (T-01-05)
    this.close();

    this.activeQuery = query({
      prompt,
      options: {
        cwd: safeCwd,
        permissionMode: "default",
        includePartialMessages: true,
        persistSession: true,
        canUseTool: (toolName, input, opts) =>
          this.permissionManager.request(
            this.ws,
            toolName,
            input as Record<string, unknown>,
            opts.toolUseID,
          ),
      },
    });

    try {
      for await (const message of this.activeQuery) {
        if (this.ws.readyState !== 1 /* OPEN */) break;

        const outMsg: ServerMessage = { type: "claude_message", message };

        this.ws.send(JSON.stringify(outMsg));

        // Check for result message to send session_end
        if (
          typeof message === "object" &&
          message !== null &&
          "type" in message &&
          (message as any).type === "result"
        ) {
          const resultMsg = message as any;
          const endMsg: ServerMessage = {
            type: "session_end",
            cost: resultMsg.total_cost_usd,
            usage: resultMsg.usage,
          };
          this.ws.send(JSON.stringify(endMsg));
        }
      }
    } catch (err: any) {
      const errMsg: ServerMessage = {
        type: "error",
        message: err?.message ?? "Unknown error",
      };
      if (this.ws.readyState === 1) {
        this.ws.send(JSON.stringify(errMsg));
      }
    }
  }

  async followUp(prompt: string): Promise<void> {
    if (!this.activeQuery) {
      const errMsg: ServerMessage = {
        type: "error",
        message: "No active session to send follow-up to",
      };
      this.ws.send(JSON.stringify(errMsg));
      return;
    }

    await this.activeQuery.streamInput(
      (async function* () {
        yield {
          type: "user" as const,
          session_id: "",
          message: { role: "user" as const, content: prompt },
          parent_tool_use_id: null,
        };
      })(),
    );
  }

  async interrupt(): Promise<void> {
    if (this.activeQuery) {
      await this.activeQuery.interrupt();
    }
  }

  close(): void {
    if (this.activeQuery) {
      this.activeQuery.close();
      this.activeQuery = null;
    }
  }
}
