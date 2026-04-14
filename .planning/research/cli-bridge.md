# CLI-to-Web Bridge: Claude Code in a Web UI

**Researched:** 2026-04-13
**Confidence:** HIGH (official docs + multiple open-source implementations verified)

---

## Executive Summary

There are two viable approaches to wrapping Claude Code in a web UI. The **recommended approach** is using the official TypeScript Agent SDK (`@anthropic-ai/claude-agent-sdk`), which spawns Claude Code as a subprocess internally and exposes a clean async generator API. The fallback is raw `child_process` spawning with `--output-format stream-json`. Multiple open-source projects already do this (Claudito, claude-code-webui, CloudCLI), confirming the pattern works.

---

## Approach 1: TypeScript Agent SDK (RECOMMENDED)

The official SDK handles subprocess lifecycle, stdin/stdout piping, and message parsing internally. You get typed messages via async iteration.

### Installation

```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Core Pattern

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Create a query - SDK spawns claude subprocess internally
const q = query({
  prompt: "Your user message here",
  options: {
    cwd: "/path/to/project",
    model: "claude-sonnet-4-6",
    permissionMode: "acceptEdits",    // or "bypassPermissions" for full auto
    allowedTools: ["Bash", "Read", "Edit"],
    includePartialMessages: true,      // streaming token-by-token
    persistSession: true,              // save session for resume
  }
});

// Stream messages as they arrive
for await (const message of q) {
  switch (message.type) {
    case "system":
      // Init event: tools, model, cwd, mcp_servers
      break;
    case "assistant":
      // Full assistant turn (includes tool_use content blocks)
      // message.message.content is array of text/tool_use blocks
      break;
    case "result":
      // Final result: message.result, message.total_cost_usd, message.usage
      break;
  }
}
```

### Multi-Turn Conversations

```typescript
// Send follow-up messages without spawning a new process
await q.streamInput(
  (async function* () {
    yield {
      type: "user" as const,
      session_id: "",
      message: { role: "user", content: "Follow-up message" },
      parent_tool_use_id: null
    };
  })()
);

// Continue iterating for responses
for await (const message of q) {
  // handle responses...
}
```

### Session Resume

```typescript
import { listSessions, query } from "@anthropic-ai/claude-agent-sdk";

const sessions = await listSessions({ dir: "/path/to/project", limit: 10 });

const q = query({
  prompt: "Continue where we left off",
  options: {
    resume: sessions[0].sessionId,
    cwd: "/path/to/project"
  }
});
```

### Permission Handling

```typescript
const q = query({
  prompt: "Build the feature",
  options: {
    // Custom permission callback - this is how you wire approve/deny in UI
    canUseTool: async (toolName, input, options) => {
      // Send to frontend via WebSocket, wait for user response
      const userDecision = await askUserViaWebSocket(toolName, input);
      return userDecision; // { behavior: "allow" } or { behavior: "deny", message: "reason" }
    }
  }
});
```

### Key Message Types

| Type | When | Key Fields |
|------|------|------------|
| `system` (subtype: `init`) | Session start | `tools`, `model`, `cwd`, `mcp_servers` |
| `assistant` | Each assistant turn | `message.content` (text + tool_use blocks) |
| `result` | Session end | `result`, `total_cost_usd`, `usage`, `subtype` (success/error) |

---

## Approach 2: Raw CLI with stream-json (FALLBACK)

Use this only if the SDK doesn't meet a specific need (e.g., you need hook events, or want maximum control).

### Spawning

```typescript
import { spawn } from "child_process";

const claude = spawn("claude", [
  "-p", userMessage,
  "--output-format", "stream-json",
  "--input-format", "stream-json",
  "--verbose",
  "--include-partial-messages",
  "--bare",                          // skip MCP/hooks for faster startup
  "--allowedTools", "Bash,Read,Edit",
  "--dangerously-skip-permissions",  // or use --permission-mode
], {
  cwd: projectDir,
  env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
  stdio: ["pipe", "pipe", "pipe"],
});
```

### Parsing NDJSON Output

```typescript
import { createInterface } from "readline";

const rl = createInterface({ input: claude.stdout });

rl.on("line", (line) => {
  try {
    const event = JSON.parse(line);
    
    switch (event.type) {
      case "system":
        if (event.subtype === "init") {
          // Session initialized
        } else if (event.subtype === "api_retry") {
          // API retry with event.retry_delay_ms
        }
        break;
        
      case "assistant":
        // Full assistant message with content blocks
        for (const block of event.message?.content || []) {
          if (block.type === "text") {
            ws.send(JSON.stringify({ type: "text", content: block.text }));
          } else if (block.type === "tool_use") {
            ws.send(JSON.stringify({ type: "tool_call", name: block.name, input: block.input }));
          }
        }
        break;
        
      case "stream_event":
        // Token-by-token streaming (when --include-partial-messages)
        if (event.event?.delta?.type === "text_delta") {
          ws.send(JSON.stringify({ type: "token", text: event.event.delta.text }));
        }
        break;
        
      case "result":
        ws.send(JSON.stringify({ type: "done", result: event.result, cost: event.total_cost_usd }));
        break;
    }
  } catch (e) {
    // Non-JSON line, ignore or log
  }
});
```

### Sending Follow-Up Messages (stream-json input)

```typescript
// Write JSON messages to stdin for multi-turn
claude.stdin.write(JSON.stringify({
  type: "user",
  message: { role: "user", content: "Next message" }
}) + "\n");
```

---

## WebSocket Bridge Architecture

### Recommended Architecture

```
Browser (React)
    |
    | WebSocket (ws://)
    v
Bridge Server (Node.js + ws)
    |
    | TypeScript SDK (query())
    v
Claude Code subprocess
    |
    | stdin/stdout (managed by SDK)
    v
Claude API + local tools (Bash, Read, Edit)
```

### Bridge Server Implementation

```typescript
import { WebSocketServer } from "ws";
import { query } from "@anthropic-ai/claude-agent-sdk";

const wss = new WebSocketServer({ port: 3100 });

// Map of active sessions: ws -> Query
const sessions = new Map<WebSocket, ReturnType<typeof query>>();

wss.on("connection", (ws) => {
  ws.on("message", async (raw) => {
    const msg = JSON.parse(raw.toString());
    
    switch (msg.type) {
      case "start": {
        const q = query({
          prompt: msg.prompt,
          options: {
            cwd: msg.projectDir || process.cwd(),
            permissionMode: "acceptEdits",
            allowedTools: ["Bash", "Read", "Edit"],
            includePartialMessages: true,
            persistSession: true,
            canUseTool: async (toolName, input) => {
              // Forward permission request to frontend
              ws.send(JSON.stringify({ type: "permission_request", toolName, input }));
              // Wait for response (use a promise + event listener pattern)
              return waitForPermissionResponse(ws, toolName);
            }
          }
        });
        
        sessions.set(ws, q);
        
        // Stream all messages to client
        (async () => {
          try {
            for await (const message of q) {
              ws.send(JSON.stringify(message));
            }
          } catch (err) {
            ws.send(JSON.stringify({ type: "error", message: err.message }));
          }
        })();
        break;
      }
      
      case "follow_up": {
        const q = sessions.get(ws);
        if (q) {
          await q.streamInput((async function* () {
            yield {
              type: "user" as const,
              session_id: "",
              message: { role: "user", content: msg.prompt },
              parent_tool_use_id: null
            };
          })());
        }
        break;
      }
      
      case "permission_response": {
        // Resolve the pending permission promise
        resolvePermission(ws, msg.toolName, msg.allowed);
        break;
      }
      
      case "interrupt": {
        const q = sessions.get(ws);
        if (q) await q.interrupt();
        break;
      }
    }
  });
  
  ws.on("close", () => {
    const q = sessions.get(ws);
    if (q) q.close();
    sessions.delete(ws);
  });
});
```

---

## Existing Open-Source Implementations

| Project | Stack | Bridge Method | Notes |
|---------|-------|--------------|-------|
| [claudito](https://github.com/comfortablynumb/claudito) | Express + React + xterm.js | child_process + WebSocket | Most mature. PID tracking, concurrent agent limits, PTY support. Has worker/reviewer loop. |
| [claude-code-webui](https://github.com/sugyan/claude-code-webui) | TypeScript (Deno/Node) | CLI spawning + streaming | Simpler. Auto-detects claude path. Session history. |
| [CloudCLI](https://github.com/siteboon/claudecodeui) | Web UI | CLI wrapper | File explorer, git explorer, shell terminal integrated. |
| [opcode](https://github.com/winfunc/opcode) | Desktop GUI | CLI bridge | Electron-based. Custom agents, background agents. |
| [CodePilot](https://github.com/op7418/CodePilot) | Electron + Next.js | Multi-model | Not Claude-specific but supports Claude Code CLI. |
| [cui](https://github.com/wbopan/cui) | Web UI | Agent SDK | Built on @anthropic-ai/claude-agent-sdk directly. |

**Key learning from Claudito** (most relevant):
- Uses PTY (pseudo-terminal) via `node-pty` for terminal emulation alongside structured output
- Tracks PIDs in `~/.claudito/pids.json` for cleanup on crash/restart
- Limits concurrent agents (default 3) with queue
- Parses tool invocations from stream to render diffs, syntax-highlighted code, file trees
- WebSocket message types: `agent_message`, `agent_status`, `agent_waiting` (for permission)

---

## Critical Gotchas

### 1. Process Lifecycle Management
**Problem:** Claude Code subprocess can hang, crash, or become orphaned.
**Solution:**
- Track PIDs. On server start, clean orphans.
- Set `maxTurns` and `maxBudgetUsd` to prevent runaway sessions.
- Handle SIGTERM/SIGINT to kill child processes.
- Use `--bare` flag to skip MCP/hooks discovery (faster startup, fewer failure modes).

```typescript
process.on("SIGTERM", () => {
  for (const q of sessions.values()) q.close();
  process.exit(0);
});
```

### 2. Backpressure on WebSocket
**Problem:** Claude streams tokens faster than the browser can render.
**Solution:** Buffer and batch token deltas. Send at most every 50ms.

```typescript
let buffer = "";
let flushTimer: NodeJS.Timeout | null = null;

function bufferToken(text: string) {
  buffer += text;
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      ws.send(JSON.stringify({ type: "tokens", text: buffer }));
      buffer = "";
      flushTimer = null;
    }, 50);
  }
}
```

### 3. Permission Prompt Deadlocks
**Problem:** Claude asks for permission, but UI doesn't show it or user doesn't respond.
**Solution:**
- Use `canUseTool` callback (SDK) or `--permission-prompt-tool` (CLI) instead of relying on stdin prompts.
- Add timeouts to permission requests (auto-deny after 60s).
- Use `--permission-mode acceptEdits` or `bypassPermissions` to reduce prompts.

### 4. stdin/stdout Mixing with stderr
**Problem:** Claude Code writes debug/error info to stderr, structured output to stdout.
**Solution:** Always capture stderr separately. Never mix streams.

```typescript
claude.stderr.on("data", (data) => {
  console.error("[claude stderr]", data.toString());
});
```

### 5. Long-Running Sessions and Memory
**Problem:** Claude Code sessions accumulate context. Long sessions = high memory + API costs.
**Solution:**
- Use `--max-turns` to cap session length.
- Use `--max-budget-usd` to cap costs.
- Monitor `result.total_cost_usd` and `result.usage` from result messages.
- Consider starting fresh sessions with `--continue` for long workflows.

### 6. Concurrent Sessions
**Problem:** Each Claude Code instance is a separate subprocess consuming memory + API quota.
**Solution:** Limit concurrent sessions (Claudito defaults to 3). Queue additional requests.

### 7. The `--bare` Flag
**Use it.** It skips auto-discovery of hooks, skills, plugins, MCP servers, auto memory, and CLAUDE.md. This means:
- Faster startup (significant for web UI where users expect instant response)
- Predictable behavior (no surprise MCP servers or hooks from user config)
- You control exactly what's available via `--allowedTools`, `--mcp-config`, etc.

### 8. Authentication
Claude Code CLI must be authenticated before the bridge server starts. Options:
- `ANTHROPIC_API_KEY` env var (simplest for server deployment)
- `claude auth login --console` (for API billing)
- `claude setup-token` for long-lived OAuth tokens in CI/scripts

---

## Recommended Architecture for This Project

Use **TypeScript Agent SDK** as the bridge layer. Reasons:

1. **Typed messages** -- no manual NDJSON parsing, no guessing message shapes
2. **Multi-turn built-in** -- `streamInput()` handles follow-ups without respawning
3. **Permission callbacks** -- `canUseTool` maps directly to UI approve/deny flow
4. **Session management** -- `listSessions`, resume, fork all built-in
5. **Maintained by Anthropic** -- will track CLI changes automatically

### Minimal Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Vite | Standard, fast |
| WebSocket | `ws` (npm) | Lightweight, battle-tested, no Socket.IO overhead |
| Bridge | Node.js + `@anthropic-ai/claude-agent-sdk` | Official SDK, typed |
| Process | Managed by SDK | No manual child_process needed |

### Data Flow

```
User types message in React UI
  -> WebSocket send({ type: "start", prompt: "..." })
  -> Bridge calls query({ prompt })
  -> SDK spawns claude subprocess
  -> Claude streams responses
  -> SDK yields typed messages via async generator
  -> Bridge forwards each message over WebSocket
  -> React renders: text tokens, tool calls, diffs, permission dialogs
  -> User approves/denies tool
  -> Bridge resolves canUseTool promise
  -> Claude continues
  -> result message arrives
  -> Session ID stored for resume
```

### File Structure

```
bridge/
  server.ts          -- WebSocket server + SDK query orchestration
  permissions.ts     -- canUseTool callback + pending promise map
  session-store.ts   -- track active sessions, cleanup
  types.ts           -- shared message types for WS protocol
frontend/
  components/
    Chat.tsx         -- message list + input
    ToolCall.tsx     -- render tool invocations (file diffs, bash output)
    PermissionDialog.tsx -- approve/deny tool use
  hooks/
    useClaudeSocket.ts   -- WebSocket connection + message handling
  stores/
    sessionStore.ts      -- active session state
```

---

## Sources

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) -- official flags, --output-format, --input-format
- [Run Claude Code Programmatically (Headless)](https://code.claude.com/docs/en/headless) -- SDK usage, bare mode, examples
- [TypeScript Agent SDK](https://code.claude.com/docs/en/agent-sdk/typescript) -- query(), message types, streaming
- [Claudito](https://github.com/comfortablynumb/claudito) -- Express + React + WebSocket + PTY bridge
- [claude-code-webui](https://github.com/sugyan/claude-code-webui) -- simpler TypeScript CLI wrapper
- [CloudCLI](https://github.com/siteboon/claudecodeui) -- web UI with file/git explorer
- [ttyd](https://tsl0922.github.io/ttyd/) -- reference architecture for terminal-over-WebSocket
- [xterm.js](https://xtermjs.org/) -- terminal emulator for web (used by Claudito)
- [stream-json input format issue](https://github.com/anthropics/claude-code/issues/24594) -- documents undocumented bidirectional streaming
