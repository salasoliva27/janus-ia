import express from "express";
import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { ClientMessage, ServerMessage } from "./types.js";
import { isValidClientMessage } from "./types.js";
import { SessionManager } from "./session-manager.js";
import { PermissionManager } from "./permissions.js";
import { startWatchers, stopWatchers, broadcastInitialLearnings } from "./file-watcher.js";
import type { FSWatcher } from "chokidar";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

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

  // Graph data from real filesystem
  app.get("/api/graph", (_req, res) => {
    try {
      const data = buildGraphFromFs();
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Detect active ports
  app.get("/api/ports", async (_req, res) => {
    try {
      const { execSync } = await import("node:child_process");
      const out = execSync("ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null", { encoding: "utf-8", timeout: 3000 });
      const ports: number[] = [];
      for (const m of out.matchAll(/:(\d+)\s/g)) {
        const p = parseInt(m[1]);
        if (p >= 3000 && p <= 9999 && !ports.includes(p)) ports.push(p);
      }
      res.json({ ports: ports.sort((a, b) => a - b) });
    } catch {
      res.json({ ports: [] });
    }
  });

  // Calendar API — proxy Google Calendar events
  app.get("/api/calendar/events", async (_req, res) => {
    try {
      // Try Google Calendar MCP via Claude session (executes tool call)
      // For now, return from environment if available, or use MCP direct
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
      const timeMax = new Date(timeMin);
      timeMax.setDate(timeMax.getDate() + 28); // 4 weeks ahead

      // Try fetching from Google Calendar API directly if token is available
      const token = process.env.GOOGLE_CALENDAR_TOKEN;
      if (token) {
        const gcalUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=50`;
        const resp = await fetch(gcalUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json() as { items?: unknown[] };
          res.json({ events: data.items || [], source: "google" });
          return;
        }
      }

      // Fallback: return empty (frontend will use calendarSlots)
      res.json({ events: [], source: "local" });
    } catch (err) {
      res.status(500).json({ error: String(err), events: [] });
    }
  });

  // File API — read files for the editor
  app.get("/api/file", (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath || !filePath.startsWith("/workspaces/")) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const stat = fs.statSync(filePath);
      res.json({ path: filePath, content, size: stat.size, modified: stat.mtimeMs });
    } catch (err) {
      res.status(404).json({ error: `File not found: ${filePath}` });
    }
  });

  // File API — write files from the editor
  app.post("/api/file", (req, res) => {
    const { path: filePath, content } = req.body;
    if (!filePath || typeof filePath !== "string" || !filePath.startsWith("/workspaces/")) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    if (typeof content !== "string") {
      res.status(400).json({ error: "Content must be a string" });
      return;
    }
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
      res.json({ ok: true, path: filePath, size: content.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // File API — list directory
  app.get("/api/files", (req, res) => {
    const dirPath = (req.query.path as string) || "/workspaces/janus-ia/dashboard/frontend/src";
    if (!dirPath.startsWith("/workspaces/")) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const items = entries.map(e => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDir: e.isDirectory(),
      })).sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      res.json({ path: dirPath, items });
    } catch {
      res.status(404).json({ error: "Directory not found" });
    }
  });

  // Calendar API — proxy to Google Calendar (fallback to empty)
  app.get("/api/calendar/events", async (_req, res) => {
    try {
      // Try Google Calendar MCP — if not available, return empty
      // The CalendarPanel frontend gracefully falls back to local calendarSlots data
      res.json({ events: [] });
    } catch {
      res.json({ events: [] });
    }
  });

  // File API — move/rename
  app.post("/api/file/move", (req, res) => {
    const { from, to } = req.body;
    if (!from || !to || !from.startsWith("/workspaces/") || !to.startsWith("/workspaces/")) {
      res.status(400).json({ error: "Invalid paths" });
      return;
    }
    try {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.renameSync(from, to);
      res.json({ ok: true, from, to });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
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

  // SPA fallback — serve index.html for non-API routes (Express 5 syntax)
  if (fs.existsSync(frontendDist)) {
    app.get("/{*splat}", (_req, res) => {
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

    // Send initial learnings to this client
    broadcastInitialLearnings((msg) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    });

    const sessionManager = new SessionManager(ws);

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
      const sid = ('sessionId' in msg ? msg.sessionId : undefined) || "session-0";

      switch (msg.type) {
        case "start": {
          console.log(`[ws:${sid}] session start requested:`, msg.prompt.slice(0, 80));
          // Get or create session
          let session = sessionManager.getSession(sid);
          if (session) {
            session.close();
          }
          session = sessionManager.createSession(sid);
          session.start(msg.prompt, msg.cwd || "/workspaces/janus-ia").catch((err) => {
            console.error(`[ws:${sid}] session error:`, err);
          });
          break;
        }
        case "follow_up": {
          console.log(`[ws:${sid}] follow-up requested:`, msg.prompt.slice(0, 80));
          const session = sessionManager.getSession(sid);
          if (session) {
            session.followUp(msg.prompt).catch((err) => {
              console.error(`[ws:${sid}] follow-up error:`, err);
            });
          }
          break;
        }
        case "permission_response": {
          console.log(`[ws:${sid}] permission response:`, msg.id, msg.allowed);
          // Permission handling is per-session now via the session's own manager
          break;
        }
        case "interrupt": {
          console.log(`[ws:${sid}] interrupt requested`);
          const session = sessionManager.getSession(sid);
          if (session) {
            session.interrupt().catch((err) => {
              console.error(`[ws:${sid}] interrupt error:`, err);
            });
          }
          break;
        }
        case "fork": {
          console.log(`[ws] fork requested: ${msg.parentSessionId} -> ${msg.newSessionId} (${msg.forkLabel})`);
          const forked = sessionManager.forkSession(
            msg.parentSessionId, msg.newSessionId, msg.forkLabel, msg.forkMessageIndex
          );
          if (forked) {
            // Send session_start for the new session
            ws.send(JSON.stringify({
              type: "session_start",
              auth: "subscription",
              sessionId: msg.newSessionId,
            } satisfies ServerMessage));
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      console.log("[ws] client disconnected");
      sessionManager.closeAll();
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
      broadcastInitialLearnings(broadcast);
      ensureHookConfig(port);
      resolve(server);
    });
  });
}

interface GraphNode {
  id: string;
  label: string;
  group: string;
  links: string[];
}

function buildGraphFromFs(): { nodes: GraphNode[]; edges: { source: string; target: string }[] } {
  const root = "/workspaces/janus-ia";
  const nodes: GraphNode[] = [];
  const seen = new Set<string>();

  function addNode(id: string, label: string, group: string, links: string[]) {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, label, group, links });
  }

  // Scan agents
  const agentsDir = path.join(root, "agents", "core");
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir)) {
      if (f.endsWith(".md")) {
        const name = f.replace(".md", "");
        addNode(`a-${name}`, name, "agents", []);
      }
    }
  }
  const domainDir = path.join(root, "agents", "domain");
  if (fs.existsSync(domainDir)) {
    for (const f of fs.readdirSync(domainDir)) {
      if (f.endsWith(".md")) {
        const name = f.replace(".md", "");
        addNode(`a-${name}`, name, "agents", []);
      }
    }
  }

  // Scan projects from PROJECTS.md or projects/ dirs
  for (const stage of ["dev", "uat", "prod"]) {
    const dir = path.join(root, "projects", stage);
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".md")) {
          const name = f.replace(".md", "");
          const links = [`a-developer`];
          addNode(`w-${name}`, name, "wiki", links);
        }
      }
    }
  }

  // Scan learnings
  const learningsDir = path.join(root, "learnings");
  if (fs.existsSync(learningsDir)) {
    for (const f of fs.readdirSync(learningsDir)) {
      if (f.endsWith(".md")) {
        const name = f.replace(".md", "");
        addNode(`l-${name}`, name, "learnings", []);
      }
    }
  }

  // Scan concepts
  const conceptsDir = path.join(root, "concepts");
  if (fs.existsSync(conceptsDir)) {
    for (const f of fs.readdirSync(conceptsDir)) {
      if (f.endsWith(".md")) {
        const name = f.replace(".md", "");
        addNode(`c-${name}`, name, "concepts", []);
      }
    }
  }

  // Scan memory files (persistent learnings)
  const memoryDir = path.join(os.homedir(), ".claude", "projects", "-workspaces-janus-ia", "memory");
  if (fs.existsSync(memoryDir)) {
    for (const f of fs.readdirSync(memoryDir)) {
      if (f === "MEMORY.md" || !f.endsWith(".md")) continue;
      const name = f.replace(".md", "");
      try {
        const content = fs.readFileSync(path.join(memoryDir, f), "utf-8");
        // Parse frontmatter
        const typeMatch = content.match(/^type:\s*(\w+)/m);
        const nameMatch = content.match(/^name:\s*(.+)/m);
        const descMatch = content.match(/^description:\s*(.+)/m);
        const memType = typeMatch?.[1] || "memory";
        const group = memType === "feedback" ? "learnings"
          : memType === "user" ? "concepts"
          : memType === "project" ? "wiki"
          : memType === "reference" ? "learnings"
          : "learnings";

        // Use frontmatter for the label — prefer description for sessions, name for others
        const rawName = nameMatch?.[1]?.trim() || "";
        const desc = descMatch?.[1]?.trim() || "";
        const isSessionSlug = /^[Ss]ession.20\d{2}/.test(rawName) || rawName.startsWith("session_");
        let label = (isSessionSlug && desc) ? desc : (rawName || desc || name.replace(/_/g, " "));
        // Truncate long labels for readability
        if (label.length > 50) label = label.slice(0, 47) + "...";

        // Auto-link to projects/concepts mentioned in content
        const links: string[] = [];
        const lc = content.toLowerCase();
        for (const n of nodes) {
          if (n.group === "wiki" && lc.includes(n.label.toLowerCase())) {
            links.push(n.id);
          }
        }
        // Link feedback/user memories to relevant agents
        if (memType === "feedback" && lc.includes("ui")) links.push("a-ux");
        if (memType === "feedback" && lc.includes("deploy")) links.push("a-deploy");
        if (lc.includes("legal") || lc.includes("compliance")) links.push("a-legal");
        if (lc.includes("security")) links.push("a-security");
        if (lc.includes("supabase")) links.push("c-supabase-shared");
        if (lc.includes("playwright")) links.push("a-ux");

        addNode(`m-${name}`, label, group, links.filter(l => seen.has(l)));
      } catch { /* skip */ }
    }
  }

  // Parse [[links]] from files to build edges
  for (const n of nodes) {
    const labelFile = n.label.replace(/ /g, "_") + ".md";
    const possiblePaths = [
      path.join(root, "agents", "core", `${n.label}.md`),
      path.join(root, "agents", "domain", `${n.label}.md`),
      path.join(root, "learnings", `${n.label}.md`),
      path.join(root, "concepts", `${n.label}.md`),
      path.join(memoryDir, labelFile),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, "utf-8");
          const wikiLinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
          for (const link of wikiLinks) {
            const target = link.slice(2, -2).split("/").pop() || "";
            // Try to match to an existing node
            const match = nodes.find(
              nn => nn.label === target || nn.id === target || nn.label === target.replace(/-/g, " ")
            );
            if (match && match.id !== n.id && !n.links.includes(match.id)) {
              n.links.push(match.id);
            }
          }
        } catch { /* skip unreadable files */ }
        break;
      }
    }
  }

  // Build edges from links
  const edges: { source: string; target: string }[] = [];
  const edgeSet = new Set<string>();
  for (const n of nodes) {
    for (const t of n.links) {
      const key = [n.id, t].sort().join("--");
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ source: n.id, target: t });
      }
    }
  }

  return { nodes, edges };
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
