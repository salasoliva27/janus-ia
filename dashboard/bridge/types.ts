// Venture OS Bridge — WebSocket Message Protocol

// Client -> Server messages
export type ClientMessage =
  | { type: "start"; prompt: string; cwd?: string }
  | { type: "follow_up"; prompt: string }
  | { type: "permission_response"; id: string; allowed: boolean }
  | { type: "interrupt" };

// Server -> Client messages
export type ServerMessage =
  | { type: "claude_message"; message: unknown }
  | { type: "permission_request"; id: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool_event"; toolName: string; input: unknown; sessionId: string; timestamp: number }
  | { type: "fs_event"; event: string; path: string; timestamp: number }
  | { type: "error"; message: string }
  | { type: "session_end"; cost?: number; usage?: unknown };

// Permission handling
export interface PermissionResult {
  behavior: "allow" | "deny";
  message?: string;
}

export interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

// Type guard for ClientMessage validation (T-01-01 mitigation)
const CLIENT_MESSAGE_TYPES = new Set(["start", "follow_up", "permission_response", "interrupt"]);

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
    default:
      return false;
  }
}
