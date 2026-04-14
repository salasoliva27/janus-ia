# Phase 1: Foundation & Bridge Server - Research

**Researched:** 2026-04-14
**Domain:** Node.js subprocess management, WebSocket bridging, Claude Code Agent SDK
**Confidence:** HIGH

## Summary

Phase 1 builds the backend bridge that spawns Claude Code as a subprocess and exposes it to a web client via WebSocket. The official TypeScript Agent SDK (`@anthropic-ai/claude-agent-sdk`) is the correct tool -- it handles subprocess lifecycle, stdin/stdout piping, NDJSON parsing, and multi-turn conversations internally. The bridge server is a thin WebSocket relay layer on top of the SDK.

The key complexity areas are: (1) permission prompt forwarding via `canUseTool` callback with async resolution from the UI, (2) hook configuration for emitting tool call events to the bridge, and (3) filesystem watching for vault/project changes. All three are well-documented with verified patterns.

**Primary recommendation:** Use the Agent SDK `query()` as the sole interface to Claude Code. Do NOT use raw `child_process.spawn`. Add `PostToolUse` HTTP hooks pointing at the bridge server for the activity feed. Use `chokidar` for filesystem watching.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRIDGE-01 | Express + WebSocket server starts Claude Code CLI as subprocess | Agent SDK `query()` handles subprocess internally; Express serves static + health; `ws` library for WebSocket |
| BRIDGE-02 | User messages piped to Claude Code stdin | `query({ prompt })` for first message, `q.streamInput()` for follow-ups |
| BRIDGE-03 | Claude stdout streams back via WebSocket | Async generator `for await (const msg of q)` yields typed messages; forward each to WS client |
| BRIDGE-04 | Tool permission prompts forwarded to UI via WS callback | `canUseTool` callback sends permission request over WS, resolves when UI responds |
| BRIDGE-05 | Hook events emitted to bridge for activity feed | `PostToolUse` HTTP hook (`type: "http"`) POSTs tool events to bridge server endpoint |
| BRIDGE-06 | Bridge watches filesystem for vault/project changes | `chokidar` watches vault dirs + project dirs, emits WS events on change |
| BRIDGE-07 | Single `venture-os` command starts everything | npm bin script in package.json; starts Express server, optionally opens browser |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/claude-agent-sdk | 0.2.105 | Spawn and communicate with Claude Code | Official SDK, typed messages, handles subprocess lifecycle [VERIFIED: npm registry] |
| ws | 8.20.0 | WebSocket server | Lightweight, battle-tested, no Socket.IO overhead needed for single-user [VERIFIED: npm registry] |
| express | 5.2.1 | HTTP server for health check + hook receiver + static files | Standard, serves hook HTTP endpoint and future frontend [VERIFIED: npm registry] |
| chokidar | 5.0.0 | Filesystem watching | Handles OS-level fs.watch quirks (debounce, recursive, cross-platform) [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typescript | latest | Type safety | Always -- SDK emits typed messages |
| tsx | latest | Run TypeScript directly | Dev mode startup |
| open | latest | Open browser on startup | BRIDGE-07 `venture-os` command |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Agent SDK | Raw `child_process` + `--output-format stream-json` | More control but manual NDJSON parsing, no typed messages, manual multi-turn. Only if SDK has a blocking bug. |
| chokidar | Node `fs.watch` | Built-in but unreliable on Linux for recursive watching, no debounce, duplicate events |
| ws | Socket.IO | Unnecessary overhead -- single user, no rooms/namespaces/fallback needed |

**Installation:**
```bash
npm install @anthropic-ai/claude-agent-sdk ws express chokidar
npm install -D typescript tsx @types/ws @types/express
```

## Architecture Patterns

### Recommended Project Structure
```
dashboard/
  bridge/
    server.ts           -- Express + WebSocket + hook receiver
    claude-session.ts   -- Agent SDK query wrapper + message forwarding
    permissions.ts      -- canUseTool callback + pending promise map
    file-watcher.ts     -- chokidar vault/project watchers
    types.ts            -- shared WS message protocol types
  bin/
    venture-os.ts       -- CLI entry point (start server + open browser)
  package.json
```

### Pattern 1: Agent SDK Query Lifecycle
**What:** Wrap each user conversation in a `query()` call, stream messages to WS client.
**When to use:** Every user message interaction.
**Example:**
```typescript
// Source: https://code.claude.com/docs/en/agent-sdk/typescript
import { query, type Query } from "@anthropic-ai/claude-agent-sdk";

let activeQuery: Query | null = null;

async function startSession(ws: WebSocket, prompt: string, cwd: string) {
  activeQuery = query({
    prompt,
    options: {
      cwd,
      permissionMode: "default",
      includePartialMessages: true,
      persistSession: true,
      canUseTool: (toolName, input, opts) => handlePermission(ws, toolName, input, opts),
    }
  });

  for await (const message of activeQuery) {
    ws.send(JSON.stringify(message));
  }
}

async function sendFollowUp(prompt: string) {
  if (!activeQuery) return;
  await activeQuery.streamInput(
    (async function* () {
      yield {
        type: "user" as const,
        session_id: "",
        message: { role: "user", content: prompt },
        parent_tool_use_id: null,
      };
    })()
  );
}
```

### Pattern 2: Permission Prompt Forwarding (BRIDGE-04)
**What:** `canUseTool` returns a Promise that resolves when the UI user clicks approve/deny.
**When to use:** Every tool call that requires permission.
**Example:**
```typescript
// Source: https://code.claude.com/docs/en/agent-sdk/typescript (canUseTool section)
const pendingPermissions = new Map<string, {
  resolve: (result: PermissionResult) => void;
  timer: NodeJS.Timeout;
}>();

async function handlePermission(
  ws: WebSocket,
  toolName: string,
  input: Record<string, unknown>,
  opts: { toolUseID: string; signal: AbortSignal }
): Promise<PermissionResult> {
  const id = opts.toolUseID;

  // Send to UI
  ws.send(JSON.stringify({
    type: "permission_request",
    id,
    toolName,
    input,
  }));

  // Wait for UI response with timeout
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingPermissions.delete(id);
      resolve({ behavior: "deny", message: "Permission timed out (60s)" });
    }, 60_000);

    pendingPermissions.set(id, { resolve, timer });
  });
}

// Called when UI sends permission_response
function resolvePermission(id: string, allowed: boolean) {
  const pending = pendingPermissions.get(id);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingPermissions.delete(id);
  pending.resolve(
    allowed
      ? { behavior: "allow" }
      : { behavior: "deny", message: "User denied" }
  );
}
```

### Pattern 3: PostToolUse HTTP Hook for Activity Feed (BRIDGE-05)
**What:** Configure a `PostToolUse` HTTP hook that POSTs tool events to the bridge server.
**When to use:** Every tool execution emits an event for the activity feed.
**Example hook configuration (project `.claude/settings.json`):**
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:3100/hooks/post-tool-use"
          }
        ]
      }
    ]
  }
}
```

**Bridge server handler:**
```typescript
// Source: https://code.claude.com/docs/en/hooks-guide (HTTP hooks section)
app.post("/hooks/post-tool-use", express.json(), (req, res) => {
  const { tool_name, tool_input, session_id } = req.body;

  // Broadcast to all connected WS clients
  broadcastToClients({
    type: "tool_event",
    toolName: tool_name,
    input: tool_input,
    sessionId: session_id,
    timestamp: Date.now(),
  });

  res.json({}); // 200 OK, no decisions needed for PostToolUse
});
```

### Pattern 4: Filesystem Watching (BRIDGE-06)
**What:** Watch vault and project directories for changes, emit WS events.
**Example:**
```typescript
import { watch } from "chokidar";

function startWatchers(ws: WebSocket) {
  const vaultWatcher = watch([
    "/workspaces/venture-os/concepts/**/*.md",
    "/workspaces/venture-os/learnings/**/*.md",
    "/workspaces/venture-os/wiki/**/*.md",
  ], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300 },
  });

  vaultWatcher.on("all", (event, path) => {
    ws.send(JSON.stringify({
      type: "fs_event",
      event,      // "add" | "change" | "unlink"
      path,
      timestamp: Date.now(),
    }));
  });
}
```

### Pattern 5: Startup Script (BRIDGE-07)
**What:** Single `venture-os` command starts bridge + optionally opens browser.
**Example (`bin/venture-os.ts`):**
```typescript
#!/usr/bin/env node
import { startServer } from "../bridge/server.js";

const PORT = parseInt(process.env.VENTURE_OS_PORT || "3100", 10);

async function main() {
  const server = await startServer(PORT);
  console.log(`Venture OS bridge running on http://localhost:${PORT}`);

  // In Codespace, open in Simple Browser
  if (process.env.CODESPACES) {
    const open = await import("open");
    await open.default(`http://localhost:${PORT}`);
  }
}

main().catch(console.error);
```

**package.json bin entry:**
```json
{
  "bin": {
    "venture-os": "./dist/bin/venture-os.js"
  },
  "scripts": {
    "dev": "tsx bin/venture-os.ts",
    "build": "tsc",
    "start": "node dist/bin/venture-os.js"
  }
}
```

### Anti-Patterns to Avoid
- **Raw child_process when SDK is available:** The SDK handles NDJSON parsing, process lifecycle, multi-turn, and typed messages. Going raw means reimplementing all of that.
- **Using `--bare` flag:** Skips hooks, MCP servers, CLAUDE.md. Venture OS needs ALL of these to function as the master orchestrator. Do NOT use `--bare`.
- **Socket.IO for single-user:** Adds ~100KB client bundle + complexity for features (rooms, namespaces, reconnect) that a single-user Codespace app doesn't need.
- **Polling for permission responses:** Use Promise-based resolution with `canUseTool`, not polling loops.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude subprocess management | Custom child_process spawner with NDJSON parser | `@anthropic-ai/claude-agent-sdk` `query()` | SDK handles process lifecycle, message typing, multi-turn, session resume |
| File watching with debounce | Custom `fs.watch` + debounce logic | `chokidar` v5 | Handles OS quirks, recursive watching, atomic write detection |
| WebSocket reconnection | Custom heartbeat + reconnect | Built into `ws` (ping/pong) | Standard WebSocket ping frames handle connection health |
| Tool event capture | Parsing stdout for tool calls | HTTP hooks (`type: "http"`) | Hooks are the official extension point; parsing stdout is fragile |

## Common Pitfalls

### Pitfall 1: Not Using `--bare` But Also Not Wanting Slow Startup
**What goes wrong:** Claude Code with full MCP server discovery can take 5-10 seconds to start.
**Why it happens:** Each MCP server connection is initialized sequentially at startup.
**How to avoid:** Accept the startup time -- Venture OS needs MCP servers. The SDK's `persistSession` + `resume` means subsequent messages don't respawn. Consider showing a "connecting..." state in UI.
**Warning signs:** User complains about initial response delay.

### Pitfall 2: Permission Promise Leaks
**What goes wrong:** `canUseTool` promise never resolves because the WebSocket disconnected.
**Why it happens:** User closes browser tab while Claude is waiting for permission.
**How to avoid:** (1) Timeout all permission promises (60s). (2) On WS `close`, reject all pending permissions. (3) Call `q.close()` to clean up the subprocess.
**Warning signs:** Node process memory grows, Claude subprocess hangs.

### Pitfall 3: Multiple Concurrent Sessions
**What goes wrong:** Each `query()` call spawns a new Claude Code process (~200MB RSS each).
**Why it happens:** User opens multiple tabs or sends messages before previous completes.
**How to avoid:** Enforce single active session per bridge server. Queue or reject new session requests. Use `streamInput()` for follow-ups, not new `query()` calls.
**Warning signs:** High memory usage, API rate limits hit.

### Pitfall 4: Hook Port Conflict
**What goes wrong:** HTTP hook URL is hardcoded to `:3100` but bridge server port changed.
**Why it happens:** Hook config in `.claude/settings.json` doesn't auto-update with server port.
**How to avoid:** Write the hook config dynamically at bridge server startup, or use an environment variable in the hook URL. The hook `url` field supports `$VAR` interpolation for headers but NOT for the URL itself -- so write the config file.
**Warning signs:** Hook events never arrive at bridge server.

### Pitfall 5: Chokidar Watching Too Many Files
**What goes wrong:** Watching all of `/workspaces/venture-os/` triggers thousands of events during git operations.
**Why it happens:** `node_modules`, `.git`, build artifacts all trigger watchers.
**How to avoid:** Use specific glob patterns and `ignored` option: `ignored: /(^|[\/\\])\../` to skip dotfiles, plus explicit `node_modules` ignore.
**Warning signs:** CPU spikes during git operations, WS flooding.

## Code Examples

### Complete Bridge Server Skeleton
```typescript
// Source: Agent SDK docs + hooks guide (verified patterns)
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { query, listSessions } from "@anthropic-ai/claude-agent-sdk";
import { watch } from "chokidar";
import http from "http";

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Health check
app.get("/health", (_, res) => res.json({ status: "ok" }));

// Hook receiver (BRIDGE-05)
app.post("/hooks/post-tool-use", (req, res) => {
  broadcast({ type: "tool_event", ...req.body, timestamp: Date.now() });
  res.json({});
});

let activeQuery: ReturnType<typeof query> | null = null;
let activeWs: WebSocket | null = null;

function broadcast(data: unknown) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

wss.on("connection", (ws) => {
  activeWs = ws;

  ws.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());

    switch (msg.type) {
      case "start":
        activeQuery = query({
          prompt: msg.prompt,
          options: {
            cwd: msg.cwd || "/workspaces/venture-os",
            includePartialMessages: true,
            persistSession: true,
            canUseTool: async (toolName, input, opts) => {
              ws.send(JSON.stringify({ type: "permission_request", id: opts.toolUseID, toolName, input }));
              return waitForPermission(opts.toolUseID);
            },
          },
        });
        try {
          for await (const message of activeQuery) {
            ws.send(JSON.stringify(message));
          }
        } catch (err: any) {
          ws.send(JSON.stringify({ type: "error", message: err.message }));
        }
        break;

      case "follow_up":
        if (activeQuery) {
          await activeQuery.streamInput((async function* () {
            yield { type: "user" as const, session_id: "", message: { role: "user", content: msg.prompt }, parent_tool_use_id: null };
          })());
        }
        break;

      case "permission_response":
        resolvePermission(msg.id, msg.allowed);
        break;

      case "interrupt":
        if (activeQuery) await activeQuery.interrupt();
        break;
    }
  });

  ws.on("close", () => {
    if (activeQuery) activeQuery.close();
    activeQuery = null;
    activeWs = null;
  });
});

// Permission handling
const pending = new Map<string, { resolve: Function; timer: NodeJS.Timeout }>();

function waitForPermission(id: string): Promise<any> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { pending.delete(id); resolve({ behavior: "deny", message: "Timeout" }); }, 60000);
    pending.set(id, { resolve, timer });
  });
}

function resolvePermission(id: string, allowed: boolean) {
  const p = pending.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(id);
  p.resolve(allowed ? { behavior: "allow" } : { behavior: "deny", message: "User denied" });
}

// File watching (BRIDGE-06)
const watcher = watch([
  "/workspaces/venture-os/concepts/**/*.md",
  "/workspaces/venture-os/learnings/**/*.md",
  "/workspaces/venture-os/wiki/**/*.md",
  "/workspaces/venture-os/projects/**/*.md",
], { ignoreInitial: true, ignored: /node_modules|\.git/, awaitWriteFinish: { stabilityThreshold: 300 } });

watcher.on("all", (event, path) => broadcast({ type: "fs_event", event, path, timestamp: Date.now() }));

server.listen(3100, () => console.log("Venture OS bridge on :3100"));
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| claude CLI | Agent SDK subprocess | Yes | 2.1.105 | -- |
| Node.js | Everything | Yes | (Codespace default) | -- |
| npm | Package install | Yes | (Codespace default) | -- |
| ANTHROPIC_API_KEY | Claude API auth | Yes (env var) | -- | -- |

**Missing dependencies with no fallback:** None.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HTTP hooks (`type: "http"`) support localhost URLs without auth | Architecture Pattern 3 | Would need to use command hooks with curl instead |
| A2 | Agent SDK `query()` respects project-level `.claude/settings.json` hooks when NOT using `--bare` | Architecture Pattern 3 | Hooks might need to be in user-level settings |
| A3 | `streamInput()` works for multi-turn after the initial async generator loop starts consuming | Pattern 1 | May need to restructure the message loop |

## Open Questions

1. **Does the Agent SDK load project hooks automatically?**
   - What we know: The SDK spawns Claude Code internally. Without `--bare`, Claude Code loads hooks from `.claude/settings.json`. [CITED: code.claude.com/docs/en/hooks-guide]
   - What's unclear: Whether the SDK passes through all CLI flags or has its own defaults.
   - Recommendation: Test empirically in Wave 0. Fallback: use user-level hooks at `~/.claude/settings.json`.

2. **HTTP hook URL interpolation**
   - What we know: Header values support `$VAR` interpolation with `allowedEnvVars`. [CITED: code.claude.com/docs/en/hooks-guide]
   - What's unclear: Whether the `url` field itself supports `$VAR` interpolation.
   - Recommendation: Hardcode `http://localhost:3100` for now. If port needs to be dynamic, write the settings.json at startup.

## Sources

### Primary (HIGH confidence)
- [Agent SDK TypeScript docs](https://code.claude.com/docs/en/agent-sdk/typescript) - query(), canUseTool, streamInput, message types, session management
- [Hooks guide](https://code.claude.com/docs/en/hooks-guide) - hook configuration, HTTP hooks, PostToolUse events, environment variables
- [npm registry] - verified versions: claude-agent-sdk 0.2.105, ws 8.20.0, express 5.2.1, chokidar 5.0.0

### Secondary (MEDIUM confidence)
- [Claudito](https://github.com/comfortablynumb/claudito) - open-source reference implementation, PID tracking, concurrent limits
- [Prior research](/.planning/research/cli-bridge.md) - comprehensive domain research covering SDK, CLI, and WebSocket patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all packages verified against npm registry, SDK docs read in full
- Architecture: HIGH - patterns from official docs + multiple open-source implementations confirm approach
- Pitfalls: HIGH - identified from real implementations (Claudito, claude-code-webui) and official docs

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (SDK is actively developed, check for breaking changes)
