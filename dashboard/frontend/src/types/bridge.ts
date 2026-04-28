// Mirror of bridge/types.ts — kept in sync manually
// These types define the WebSocket protocol between frontend and bridge

export type ClientMessage =
  | { type: "start"; prompt: string; cwd?: string; sessionId?: string; agentId?: string; modelId?: string }
  | { type: "follow_up"; prompt: string; sessionId?: string; agentId?: string; modelId?: string }
  | { type: "permission_response"; id: string; allowed: boolean; sessionId?: string }
  | { type: "interrupt"; sessionId?: string }
  | { type: "fork"; parentSessionId: string; newSessionId: string; forkLabel: string; forkMessageIndex: number }
  | { type: "set_agent"; sessionId?: string; agentId: string; modelId?: string }
  | { type: "set_model"; sessionId?: string; modelId: string };

export type ServerMessage =
  | { type: "claude_message"; message: unknown; sessionId?: string }
  | { type: "permission_request"; id: string; toolName: string; input: Record<string, unknown>; sessionId?: string }
  | { type: "tool_event"; toolName: string; input: unknown; sessionId: string; timestamp: number }
  | { type: "fs_event"; event: string; path: string; timestamp: number }
  | { type: "learning_update"; learning: { id: string; rule: string; content: string; domain: string; project: string; timestamp: number; sourceMemoryIds: string[]; status: string } }
  | { type: "project_update"; projectId: string; updates: { projectId: string; lastCommit?: { hash: string; message: string; age: string }; memoryCount?: number; currentPhase?: string; nextActions?: string[] } }
  | { type: "error"; message: string; sessionId?: string }
  | { type: "session_end"; cost?: number; usage?: unknown; sessionId?: string }
  | { type: "session_start"; auth: string; sessionId?: string }
  | { type: "sibling_summary"; sessionId: string; siblingId: string; summary: string };

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
