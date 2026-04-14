// Mirror of bridge/types.ts — kept in sync manually
// These types define the WebSocket protocol between frontend and bridge

export type ClientMessage =
  | { type: "start"; prompt: string; cwd?: string }
  | { type: "follow_up"; prompt: string }
  | { type: "permission_response"; id: string; allowed: boolean }
  | { type: "interrupt" };

export type ServerMessage =
  | { type: "claude_message"; message: unknown }
  | { type: "permission_request"; id: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool_event"; toolName: string; input: unknown; sessionId: string; timestamp: number }
  | { type: "fs_event"; event: string; path: string; timestamp: number }
  | { type: "error"; message: string }
  | { type: "session_end"; cost?: number; usage?: unknown };
