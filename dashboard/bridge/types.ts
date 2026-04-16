// Venture OS Bridge — WebSocket Message Protocol

// Client -> Server messages
export type ClientMessage =
  | { type: "start"; prompt: string; cwd?: string; sessionId?: string }
  | { type: "follow_up"; prompt: string; sessionId?: string }
  | { type: "permission_response"; id: string; allowed: boolean; sessionId?: string }
  | { type: "interrupt"; sessionId?: string }
  | { type: "fork"; parentSessionId: string; newSessionId: string; forkLabel: string; forkMessageIndex: number };

// Server -> Client messages
export type ServerMessage =
  | { type: "claude_message"; message: unknown; sessionId?: string }
  | { type: "permission_request"; id: string; toolName: string; input: Record<string, unknown>; sessionId?: string }
  | { type: "tool_event"; toolName: string; input: unknown; sessionId: string; timestamp: number }
  | { type: "fs_event"; event: string; path: string; timestamp: number }
  | { type: "learning_update"; learning: { id: string; rule: string; content: string; domain: string; project: string; timestamp: number; sourceMemoryIds: string[]; status: string } }
  | { type: "error"; message: string; sessionId?: string }
  | { type: "session_end"; cost?: number; usage?: unknown; sessionId?: string }
  | { type: "session_start"; auth: "subscription" | "api_key" | "unknown"; sessionId?: string }
  | { type: "sibling_summary"; sessionId: string; siblingId: string; summary: string };

// Permission handling
export interface PermissionResult {
  behavior: "allow" | "deny";
  message?: string;
}

export interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

// Type guard for ClientMessage validation
const CLIENT_MESSAGE_TYPES = new Set(["start", "follow_up", "permission_response", "interrupt", "fork"]);

export function isValidClientMessage(data: unknown): data is ClientMessage {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  if (typeof msg.type !== "string" || !CLIENT_MESSAGE_TYPES.has(msg.type)) return false;

  switch (msg.type) {
    case "start":
      return typeof msg.prompt === "string";
    case "follow_up":
      return typeof msg.prompt === "string";
    case "permission_response":
      return typeof msg.id === "string" && typeof msg.allowed === "boolean";
    case "interrupt":
      return true;
    case "fork":
      return typeof msg.parentSessionId === "string"
        && typeof msg.newSessionId === "string"
        && typeof msg.forkLabel === "string"
        && typeof msg.forkMessageIndex === "number";
    default:
      return false;
  }
}
