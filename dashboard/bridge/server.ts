import express from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "./types.js";
import { isValidClientMessage } from "./types.js";
import { ClaudeSession } from "./claude-session.js";
import { PermissionManager } from "./permissions.js";
import { startWatchers, stopWatchers } from "./file-watcher.js";
import type { FSWatcher } from "chokidar";
import fs from "node:fs";
import path from "node:path";

export function startServer(port: number): Promise<http.Server> {
  const app = express();
  app.use(express.json());

  // Serve frontend static files in production
  const frontendDist = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "frontend", "dist");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
  }

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Hook receiver — broadcasts tool events to all WS clients
  app.post("/hooks/post-tool-use", (req, res) => {
    const { tool_name, tool_input, session_id } = req.body;
    broadcast({
      type: "tool_event",
      toolName: tool_name || "unknown",
      input: tool_input || {},
      sessionId: session_id || "",
      timestamp: Date.now(),
    });
    res.json({});
  });

  // SPA fallback — serve index.html for non-API routes
  if (fs.existsSync(frontendDist)) {
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  function broadcast(data: ServerMessage): void {
    const payload = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  wss.on("connection", (ws) => {
    console.log("[ws] client connected");

    const permissionManager = new PermissionManager();
    const session = new ClaudeSession(ws, permissionManager);

    ws.on("message", (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(raw));
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" } satisfies ServerMessage));
        return;
      }

      if (!isValidClientMessage(parsed)) {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message shape" } satisfies ServerMessage));
        return;
      }

      const msg: ClientMessage = parsed;
      switch (msg.type) {
        case "start":
          console.log("[ws] session start requested:", msg.prompt.slice(0, 80));
          // T-01-05: close existing session before starting new one
          session.close();
          // Run async, do not await — it streams continuously
          session.start(msg.prompt, msg.cwd || "/workspaces/venture-os").catch((err) => {
            console.error("[ws] session error:", err);
          });
          break;
        case "follow_up":
          console.log("[ws] follow-up requested:", msg.prompt.slice(0, 80));
          session.followUp(msg.prompt).catch((err) => {
            console.error("[ws] follow-up error:", err);
          });
          break;
        case "permission_response":
          console.log("[ws] permission response:", msg.id, msg.allowed);
          permissionManager.resolve(msg.id, msg.allowed);
          break;
        case "interrupt":
          console.log("[ws] interrupt requested");
          session.interrupt().catch((err) => {
            console.error("[ws] interrupt error:", err);
          });
          break;
      }
    });

    ws.on("close", () => {
      console.log("[ws] client disconnected");
      permissionManager.rejectAll();
      session.close();
    });
  });

  // Graceful shutdown
  let watchers: FSWatcher[] = [];
  function shutdown() {
    console.log("\n[bridge] shutting down...");
    stopWatchers(watchers).catch(() => {});
    wss.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000);
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Export broadcast for use by other modules
  (server as any).broadcast = broadcast;
  (server as any).wss = wss;

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`[bridge] listening on port ${port}`);
      watchers = startWatchers(broadcast);
      ensureHookConfig(port);
      resolve(server);
    });
  });
}

function ensureHookConfig(port: number): void {
  const configDir = path.join(path.dirname(new URL(import.meta.url).pathname), "..", ".claude");
  const configPath = path.join(configDir, "settings.json");
  const hookUrl = `http://localhost:${port}/hooks/post-tool-use`;

  const desired = {
    hooks: {
      PostToolUse: [
        {
          matcher: "",
          hooks: [{ type: "http", url: hookUrl }],
        },
      ],
    },
  };

  try {
    if (fs.existsSync(configPath)) {
      const existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const existingUrl = existing?.hooks?.PostToolUse?.[0]?.hooks?.[0]?.url;
      if (existingUrl === hookUrl) return;
    }
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(desired, null, 2) + "\n");
    console.log(`[bridge] hook config written to ${configPath}`);
  } catch (err) {
    console.warn("[bridge] failed to write hook config:", err);
  }
}
