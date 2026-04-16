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

const WORKSPACE_ROOT = "/workspaces/janus-ia";
const UPLOADS_DIR = path.join(WORKSPACE_ROOT, "dump", "uploads");
const THEMES_DIR = path.join(os.homedir(), ".claude", "projects", "-workspaces-janus-ia", "themes");

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

export function startServer(port: number): Promise<http.Server> {
  const app = express();
  // Raise the JSON body limit — chat uploads arrive as base64, and a ~10MB
  // PDF becomes ~14MB base64. 30MB gives comfortable headroom.
  app.use(express.json({ limit: "30mb" }));

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

  // SQL Console API — execute read queries against configured data tools.
  // Supabase: uses Management API /database/query (needs SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF).
  // Snowflake: returns a not-wired error (wiring deferred to phase 4).
  app.post("/api/sql/execute", async (req, res) => {
    const { tool, query } = req.body || {};
    if (typeof query !== "string" || !query.trim()) {
      res.status(400).json({ ok: false, error: "Missing query" });
      return;
    }
    if (tool !== "supabase" && tool !== "snowflake") {
      res.status(400).json({ ok: false, error: `Unknown tool: ${tool}` });
      return;
    }

    if (tool === "snowflake") {
      const need = ["SNOWFLAKE_ACCOUNT", "SNOWFLAKE_USER", "SNOWFLAKE_PASSWORD"];
      const missing = need.filter(k => !process.env[k]);
      if (missing.length) {
        res.status(400).json({
          ok: false,
          error: `Missing Snowflake env vars: ${missing.join(", ")} — open the Key Vault to add them.`,
        });
        return;
      }
      try {
        const t0 = Date.now();
        const { default: snowflake } = await import("snowflake-sdk");
        const conn = snowflake.createConnection({
          account: process.env.SNOWFLAKE_ACCOUNT!,
          username: process.env.SNOWFLAKE_USER!,
          password: process.env.SNOWFLAKE_PASSWORD!,
          warehouse: process.env.SNOWFLAKE_WAREHOUSE,
          database: process.env.SNOWFLAKE_DATABASE,
          schema: process.env.SNOWFLAKE_SCHEMA,
          role: process.env.SNOWFLAKE_ROLE,
        });
        await new Promise<void>((resolve, reject) => {
          conn.connect(err => (err ? reject(err) : resolve()));
        });
        const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
          conn.execute({
            sqlText: query,
            complete: (err, _stmt, rowData) => (err ? reject(err) : resolve((rowData ?? []) as Record<string, unknown>[])),
          });
        });
        await new Promise<void>(resolve => {
          conn.destroy(() => resolve());
        });
        const elapsed = Date.now() - t0;
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        res.json({ ok: true, rows, columns, rowCount: rows.length, elapsed });
      } catch (err) {
        const e = err as { message?: string; code?: string | number };
        res.status(500).json({ ok: false, error: e?.message ? `${e.message}${e.code ? ` (code ${e.code})` : ""}` : String(err) });
      }
      return;
    }

    try {
      const token = process.env.SUPABASE_ACCESS_TOKEN;
      const ref = process.env.SUPABASE_PROJECT_REF;
      if (!token) {
        res.status(400).json({ ok: false, error: "SUPABASE_ACCESS_TOKEN not set — open the Key Vault to add it." });
        return;
      }
      if (!ref) {
        res.status(400).json({ ok: false, error: "SUPABASE_PROJECT_REF not set — open the Key Vault to add it." });
        return;
      }

      const t0 = Date.now();
      const resp = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });
      const elapsed = Date.now() - t0;
      const text = await resp.text();
      let body: unknown;
      try { body = JSON.parse(text); } catch { body = text; }

      if (!resp.ok) {
        res.status(resp.status).json({ ok: false, error: body, elapsed });
        return;
      }
      // Management API returns an array of rows for SELECT, or [] / empty for DDL.
      const rows = Array.isArray(body) ? body : [];
      const columns = rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : [];
      res.json({ ok: true, rows, columns, rowCount: rows.length, elapsed });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Credentials test — validates a credential entry against its provider's API.
  // Accepts { entryId, fields: { envVar: value } }. Values missing in the body
  // fall back to process.env so "already set" credentials can still be tested.
  app.post("/api/credentials/test", async (req, res) => {
    const { entryId, fields } = (req.body || {}) as { entryId?: string; fields?: Record<string, string> };
    if (!entryId || typeof entryId !== "string") {
      res.status(400).json({ ok: false, error: "Missing entryId" });
      return;
    }
    const resolve = (envVar: string): string | undefined => {
      const v = fields?.[envVar];
      if (typeof v === "string" && v.trim()) return v.trim();
      const env = process.env[envVar];
      return env && env.trim() ? env.trim() : undefined;
    };
    const missing = (names: string[]): string[] => names.filter(n => !resolve(n));

    try {
      switch (entryId) {
        case "anthropic": {
          const miss = missing(["ANTHROPIC_API_KEY"]);
          if (miss.length) return void res.json({ ok: false, error: `Missing: ${miss.join(", ")}` });
          const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
            headers: { "x-api-key": resolve("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01" },
          });
          const body = await r.text();
          if (!r.ok) return void res.json({ ok: false, status: r.status, error: `Anthropic /v1/models returned ${r.status}`, details: body.slice(0, 500) });
          return void res.json({ ok: true, message: "Anthropic API key valid." });
        }
        case "openai": {
          const miss = missing(["OPENAI_API_KEY"]);
          if (miss.length) return void res.json({ ok: false, error: `Missing: ${miss.join(", ")}` });
          const r = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${resolve("OPENAI_API_KEY")}` },
          });
          const body = await r.text();
          if (!r.ok) return void res.json({ ok: false, status: r.status, error: `OpenAI /v1/models returned ${r.status}`, details: body.slice(0, 500) });
          return void res.json({ ok: true, message: "OpenAI API key valid." });
        }
        case "github": {
          const miss = missing(["GITHUB_TOKEN"]);
          if (miss.length) return void res.json({ ok: false, error: `Missing: ${miss.join(", ")}` });
          const r = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${resolve("GITHUB_TOKEN")}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "janus-credentials-test",
            },
          });
          const body = await r.text();
          if (!r.ok) return void res.json({ ok: false, status: r.status, error: `GitHub /user returned ${r.status}`, details: body.slice(0, 500) });
          let login = "unknown";
          try { login = (JSON.parse(body) as { login?: string }).login || "unknown"; } catch {}
          return void res.json({ ok: true, message: `GitHub token valid (user: ${login}).` });
        }
        case "brave": {
          const miss = missing(["BRAVE_API_KEY"]);
          if (miss.length) return void res.json({ ok: false, error: `Missing: ${miss.join(", ")}` });
          const r = await fetch("https://api.search.brave.com/res/v1/web/search?q=test&count=1", {
            headers: { "X-Subscription-Token": resolve("BRAVE_API_KEY")!, Accept: "application/json" },
          });
          const body = await r.text();
          if (!r.ok) return void res.json({ ok: false, status: r.status, error: `Brave search returned ${r.status}`, details: body.slice(0, 500) });
          return void res.json({ ok: true, message: "Brave Search key valid." });
        }
        case "firecrawl": {
          const miss = missing(["FIRECRAWL_API_KEY"]);
          if (miss.length) return void res.json({ ok: false, error: `Missing: ${miss.join(", ")}` });
          const r = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", {
            headers: { Authorization: `Bearer ${resolve("FIRECRAWL_API_KEY")}` },
          });
          const body = await r.text();
          if (!r.ok) return void res.json({ ok: false, status: r.status, error: `Firecrawl credit check returned ${r.status}`, details: body.slice(0, 500) });
          return void res.json({ ok: true, message: "Firecrawl key valid." });
        }
        case "supabase-project": {
          const miss = missing(["SUPABASE_URL", "SUPABASE_ANON_KEY"]);
          if (miss.length) return void res.json({ ok: false, error: `Missing: ${miss.join(", ")}` });
          const url = resolve("SUPABASE_URL")!.replace(/\/+$/, "");
          const anon = resolve("SUPABASE_ANON_KEY")!;
          const r = await fetch(`${url}/rest/v1/`, {
            headers: { apikey: anon, Authorization: `Bearer ${anon}` },
          });
          if (!r.ok && r.status !== 404) {
            const body = await r.text();
            return void res.json({ ok: false, status: r.status, error: `Supabase REST returned ${r.status}`, details: body.slice(0, 500) });
          }
          // Optional: service-role key — if provided, test it too via same endpoint.
          const sr = resolve("SUPABASE_SERVICE_ROLE_KEY");
          if (sr) {
            const r2 = await fetch(`${url}/rest/v1/`, { headers: { apikey: sr, Authorization: `Bearer ${sr}` } });
            if (!r2.ok && r2.status !== 404) {
              const body2 = await r2.text();
              return void res.json({ ok: false, status: r2.status, error: `Service role key rejected (${r2.status})`, details: body2.slice(0, 500) });
            }
          }
          return void res.json({ ok: true, message: "Supabase project URL + keys valid." });
        }
        case "supabase-mgmt": {
          const miss = missing(["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_REF"]);
          if (miss.length) return void res.json({ ok: false, error: `Missing: ${miss.join(", ")}` });
          const r = await fetch(`https://api.supabase.com/v1/projects/${resolve("SUPABASE_PROJECT_REF")}`, {
            headers: { Authorization: `Bearer ${resolve("SUPABASE_ACCESS_TOKEN")}` },
          });
          const body = await r.text();
          if (!r.ok) return void res.json({ ok: false, status: r.status, error: `Supabase Management returned ${r.status}`, details: body.slice(0, 500) });
          return void res.json({ ok: true, message: "Supabase management token + project ref valid." });
        }
        case "google-calendar": {
          const miss = missing(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"]);
          if (miss.length) return void res.json({ ok: false, error: `Missing: ${miss.join(", ")}` });
          const r = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: resolve("GOOGLE_CLIENT_ID")!,
              client_secret: resolve("GOOGLE_CLIENT_SECRET")!,
              refresh_token: resolve("GOOGLE_REFRESH_TOKEN")!,
              grant_type: "refresh_token",
            }),
          });
          const body = await r.text();
          if (!r.ok) return void res.json({ ok: false, status: r.status, error: `Google token refresh returned ${r.status}`, details: body.slice(0, 500) });
          return void res.json({ ok: true, message: "Google OAuth refresh token valid." });
        }
        case "whatsapp-send": {
          const miss = missing(["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_BUSINESS_ACCOUNT_ID"]);
          if (miss.length) return void res.json({ ok: false, error: `Missing: ${miss.join(", ")}` });
          const r = await fetch(`https://graph.facebook.com/v20.0/${resolve("WHATSAPP_BUSINESS_ACCOUNT_ID")}?fields=id,name`, {
            headers: { Authorization: `Bearer ${resolve("WHATSAPP_ACCESS_TOKEN")}` },
          });
          const body = await r.text();
          if (!r.ok) return void res.json({ ok: false, status: r.status, error: `Meta Graph returned ${r.status}`, details: body.slice(0, 500) });
          return void res.json({ ok: true, message: "WhatsApp send credentials valid." });
        }
        default:
          return void res.json({
            ok: false,
            error: `No automatic test wired for "${entryId}". Ask in chat to verify this one manually.`,
          });
      }
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Memory API — exposes auto-memory index so chat can show "what's loaded"
  app.get("/api/memory/index", (_req, res) => {
    try {
      const memDir = path.join(os.homedir(), ".claude", "projects", "-workspaces-janus-ia", "memory");
      if (!fs.existsSync(memDir)) {
        res.json({ entries: [], indexContent: "", dir: memDir });
        return;
      }

      const indexPath = path.join(memDir, "MEMORY.md");
      const indexContent = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf-8") : "";

      const entries: Array<{
        file: string;
        name: string;
        description: string;
        type: string;
        updatedAt: number;
        preview: string;
      }> = [];

      for (const f of fs.readdirSync(memDir)) {
        if (f === "MEMORY.md" || !f.endsWith(".md")) continue;
        try {
          const full = path.join(memDir, f);
          const stat = fs.statSync(full);
          const raw = fs.readFileSync(full, "utf-8");

          // Parse frontmatter between --- blocks
          const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
          const fm = fmMatch?.[1] || "";
          const body = fmMatch?.[2] || raw;

          const nameMatch = fm.match(/^name:\s*(.+)$/m);
          const descMatch = fm.match(/^description:\s*(.+)$/m);
          const typeMatch = fm.match(/^type:\s*(\w+)/m);

          const preview = body.trim().slice(0, 240);
          entries.push({
            file: f,
            name: nameMatch?.[1]?.trim() || f.replace(/\.md$/, ""),
            description: descMatch?.[1]?.trim() || "",
            type: typeMatch?.[1]?.trim() || "memory",
            updatedAt: stat.mtimeMs,
            preview,
          });
        } catch { /* skip unreadable files */ }
      }

      // Most recent first
      entries.sort((a, b) => b.updatedAt - a.updatedAt);

      res.json({ entries, indexContent, dir: memDir });
    } catch (err) {
      res.status(500).json({ error: String(err), entries: [] });
    }
  });

  // Memory API — read full content of a specific memory file
  app.get("/api/memory/file", (req, res) => {
    try {
      const name = (req.query.name as string) || "";
      // Only allow bare filenames, no slashes
      if (!name || name.includes("/") || name.includes("..") || !name.endsWith(".md")) {
        res.status(400).json({ error: "Invalid memory file name" });
        return;
      }
      const memDir = path.join(os.homedir(), ".claude", "projects", "-workspaces-janus-ia", "memory");
      const full = path.join(memDir, name);
      if (!fs.existsSync(full)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const content = fs.readFileSync(full, "utf-8");
      res.json({ name, content });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Session API — expose persisted dashboard-session state (so frontend can show continuity)
  app.get("/api/session/:id", (req, res) => {
    try {
      const id = req.params.id.replace(/[^a-zA-Z0-9_-]/g, "_");
      const file = path.join(
        os.homedir(),
        ".claude",
        "projects",
        "-workspaces-janus-ia",
        "dashboard-sessions",
        `${id}.json`,
      );
      if (!fs.existsSync(file)) {
        res.json({ persisted: false });
        return;
      }
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      res.json({
        persisted: true,
        claudeSessionId: data.claudeSessionId || null,
        updatedAt: data.updatedAt || 0,
        turnCount: Array.isArray(data.conversationLog) ? data.conversationLog.length : 0,
      });
    } catch {
      res.json({ persisted: false });
    }
  });

  // Chat file upload — stores files under dump/uploads/ so Claude's Read tool can consume them
  app.post("/api/chat/upload", (req, res) => {
    try {
      const { name, type, data } = (req.body || {}) as { name?: string; type?: string; data?: string };
      if (!name || typeof data !== "string") {
        res.status(400).json({ ok: false, error: "Missing name or data" });
        return;
      }
      const clean = safeFileName(name);
      const filename = `${Date.now()}-${clean}`;
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const full = path.join(UPLOADS_DIR, filename);
      // Accept either base64 ("data:...;base64,XXX" or bare base64) or plain text
      let buf: Buffer;
      if (data.startsWith("data:")) {
        const commaIdx = data.indexOf(",");
        buf = Buffer.from(data.slice(commaIdx + 1), "base64");
      } else {
        // Heuristic: if it decodes cleanly as base64 assume base64, else treat as text
        try { buf = Buffer.from(data, "base64"); if (buf.length === 0) throw new Error(); }
        catch { buf = Buffer.from(data, "utf-8"); }
      }
      fs.writeFileSync(full, buf);
      res.json({ ok: true, path: full, filename, size: buf.length, type: type || "" });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // Custom theme extraction — runs `claude -p` with a locked JSON-response prompt
  // against uploaded brand assets and saves the result as a named theme preset.
  app.post("/api/theme/extract", async (req, res) => {
    try {
      const { paths, hint } = (req.body || {}) as { paths?: string[]; hint?: string };
      if (!Array.isArray(paths) || paths.length === 0) {
        res.status(400).json({ ok: false, error: "No file paths provided" });
        return;
      }
      // Basic path safety: must live under the uploads dir
      for (const p of paths) {
        if (typeof p !== "string" || !p.startsWith(UPLOADS_DIR)) {
          res.status(400).json({ ok: false, error: `Invalid path: ${p}` });
          return;
        }
      }

      const fileList = paths.map(p => `- ${p}`).join("\n");
      const prompt = `You are a brand-to-theme extractor. Analyse the attached asset(s) and return ONLY a single JSON object — no prose, no code fence, no markdown.

Files:
${fileList}
${hint ? `\nHint from user: ${hint}` : ""}

Use the Read tool to open each file. For images: identify the dominant brand color and a complementary accent. For PDFs/docs: extract any brand color hexes or explicit guidelines. For screenshots: read the chrome/background vs accent contrast.

Return exactly this shape:
{
  "name": "<short 1–3 word theme name based on brand>",
  "mode": "light" | "dark",
  "primaryHue": <number 0–360>,
  "accentHue": <number 0–360>,
  "chroma": <number 0.05–0.25>,
  "rationale": "<one sentence on why you picked these>"
}

Do not include anything except the JSON object.`;

      const { spawn } = await import("node:child_process");
      const cleanEnv = { ...process.env };
      delete cleanEnv.ANTHROPIC_API_KEY;
      const proc = spawn(
        "claude",
        ["-p", prompt, "--output-format", "text", "--dangerously-skip-permissions", "--disable-slash-commands"],
        { cwd: WORKSPACE_ROOT, env: cleanEnv },
      );
      let stdout = "", stderr = "";
      proc.stdout?.on("data", d => { stdout += d.toString(); });
      proc.stderr?.on("data", d => { stderr += d.toString(); });
      const exitCode: number = await new Promise(resolve => {
        const timer = setTimeout(() => { proc.kill("SIGTERM"); resolve(124); }, 90_000);
        proc.on("close", code => { clearTimeout(timer); resolve(code ?? 1); });
      });
      if (exitCode !== 0) {
        res.status(502).json({ ok: false, error: `claude exited ${exitCode}: ${stderr.slice(0, 500)}` });
        return;
      }
      // Extract first top-level JSON object from stdout
      const match = stdout.match(/\{[\s\S]*\}/);
      if (!match) { res.status(502).json({ ok: false, error: "No JSON in model output", raw: stdout.slice(0, 500) }); return; }
      let spec: { name?: string; mode?: string; primaryHue?: number; accentHue?: number; chroma?: number; rationale?: string };
      try { spec = JSON.parse(match[0]); } catch { res.status(502).json({ ok: false, error: "Malformed JSON", raw: match[0].slice(0, 500) }); return; }
      // Validate + clamp
      const name = typeof spec.name === "string" && spec.name.trim() ? spec.name.trim().slice(0, 30) : "Custom";
      const mode: "light" | "dark" = spec.mode === "light" ? "light" : "dark";
      const primaryHue = Math.max(0, Math.min(360, Number(spec.primaryHue) || 240));
      const accentHue = Math.max(0, Math.min(360, Number(spec.accentHue) || primaryHue));
      const chroma = Math.max(0.05, Math.min(0.25, Number(spec.chroma) || 0.14));

      const id = `custom-${Date.now().toString(36)}`;
      const theme = { id, name, mode, primaryHue, accentHue, chroma, rationale: spec.rationale || "", createdAt: Date.now() };
      fs.mkdirSync(THEMES_DIR, { recursive: true });
      fs.writeFileSync(path.join(THEMES_DIR, `${id}.json`), JSON.stringify(theme, null, 2));
      res.json({ ok: true, theme });
    } catch (err) {
      res.status(500).json({ ok: false, error: String(err) });
    }
  });

  // List custom themes — frontend merges these into the theme picker
  app.get("/api/theme/custom", (_req, res) => {
    try {
      if (!fs.existsSync(THEMES_DIR)) { res.json({ themes: [] }); return; }
      const themes: unknown[] = [];
      for (const f of fs.readdirSync(THEMES_DIR)) {
        if (!f.endsWith(".json")) continue;
        try { themes.push(JSON.parse(fs.readFileSync(path.join(THEMES_DIR, f), "utf-8"))); } catch {}
      }
      res.json({ themes });
    } catch (err) {
      res.status(500).json({ themes: [], error: String(err) });
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
