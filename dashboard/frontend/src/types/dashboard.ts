// Venture OS Dashboard — All Types

export interface Project {
  id: string;
  name: string;
  displayName: string;
  stage: 'idea' | 'dev' | 'uat' | 'prod';
  stack: string[];
  health: 'green' | 'amber' | 'red';
  currentPhase: string;
  phaseProgress: number;
  lastCommit: { message: string; hash: string; age: string };
  description: string;
  burn?: number;
  revenue?: number;
  legalFlags: string[];
  nextActions: string[];
  color: string;
  repo?: string;
}

export interface AgentDispatch {
  id: string;
  agent: string;
  icon: string;
  project: string;
  tools: string[];
  status: 'thinking' | 'executing' | 'verifying' | 'done';
  phase: 'IDENTIFY' | 'DISPATCH' | 'LOOKUP' | 'EXECUTE' | 'VERIFY' | 'OUTPUT';
  timestamp: number;
  message: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  role: string;
  description: string;
  file: string;
  lastUpdated: string; // ISO date
  tools: string[];
  linkedAgents: string[];
}

export interface ToolStatus {
  id: string;
  name: string;
  shortName: string;
  callCount: number;
  lastCall: number;
  active: boolean;
  configured: 'ready' | 'needs-key' | 'needs-auth' | 'unknown';
  envVar?: string; // e.g. BRAVE_API_KEY
  authUrl?: string; // e.g. OAuth flow URL
  consoleType?: 'sql'; // tools with a console open a workbench on click (e.g. supabase, snowflake)
}

export interface MemoryEntry {
  id: string;
  type: 'decision' | 'learning' | 'context' | 'recall';
  direction: 'in' | 'out';
  content: string;
  project?: string;
  timestamp: number;
}

export interface GitCommit {
  id: string;
  repo: string;
  repoColor: string;
  message: string;
  timestamp: number;
  hash: string;
}

export interface BrainNode {
  id: string;
  label: string;
  group: 'wiki' | 'concepts' | 'learnings' | 'agents' | 'other';
  connections: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

export interface BrainEdge {
  source: string;
  target: string;
  firing: boolean;
  fireProgress: number;
}

export interface Notification {
  id: string;
  type: 'drift' | 'conflict' | 'legal' | 'capacity' | 'memory';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  project?: string;
}

export interface SessionEvent {
  id: string;
  type: 'edit' | 'commit' | 'dispatch' | 'memory' | 'tool' | 'push';
  label: string;
  detail?: string;
  timestamp: number;
  project?: string;
}

export interface Learning {
  id: string;
  /** The behavioral rule — how the agent's thinking changed */
  rule: string;
  /** The raw insight/fact that produced this learning */
  content: string;
  domain: 'market' | 'technical' | 'legal' | 'gtm' | 'pattern';
  project: string;
  timestamp: number;
  /** IDs of memory entries that contributed to this learning */
  sourceMemoryIds: string[];
  /** Whether this learning has been argued/debated by the user */
  status: 'active' | 'argued' | 'revised' | 'rejected';
}

export interface CalendarSlot {
  date: string;
  dayLabel: string;
  load: number;
  items: string[];
}

export interface FileActivity {
  path: string;
  repo: string;
  repoColor: string;
  size: number;
  lastModified: number;
  changes: number;
}

export type CenterView = 'constellation' | 'brain' | 'procedures' | 'files';

export interface Document {
  id: string;
  path: string;
  filename: string;
  language: string;
  content: string;
  timestamp: number;
}

export interface DashboardState {
  // Data
  projects: Project[];
  agents: AgentDispatch[];
  tools: ToolStatus[];
  memories: MemoryEntry[];
  gitCommits: GitCommit[];
  brainNodes: BrainNode[];
  brainEdges: BrainEdge[];
  notifications: Notification[];
  sessionEvents: SessionEvent[];
  learnings: Learning[];
  terminalLines: string[];
  calendarSlots: CalendarSlot[];
  fileActivities: FileActivity[];
  documents: Document[];
  // UI state
  selectedProject: string | null;
  selectedBrainNode: string | null;
  centerView: CenterView;
  commandPaletteOpen: boolean;
  scoreboardOpen: boolean;
  /** Per-session chat — keyed by sessionId */
  chatSessions: Record<string, SessionChatState>;
  chatInput: string;
  chatAuth: string | null;
  // Legacy compat — derived from chatSessions['session-0']
  chatMessages: ChatMessage[];
  chatThinking: boolean;
  chatStatus: 'idle' | 'thinking' | 'streaming' | 'done';
  chatThinkingStart: number | null;
  activeDocumentId: string | null;
  rightPanelTab: 'memory' | 'documents' | 'editor';
  agentCounts: Record<string, number>;
  projectCounts: Record<string, number>;
  /** Auto-memory index loaded from /api/memory/index */
  memoryIndex: MemoryIndex | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'memory';
  content: string;
  timestamp: number;
  /** For memory messages: which memory file / operation this refers to */
  memoryRef?: string;
  /** For memory messages: direction of the operation */
  memoryAction?: 'recall' | 'remember' | 'read' | 'write' | 'resume';
}

export interface MemoryIndexEntry {
  file: string;
  name: string;
  description: string;
  type: string;
  updatedAt: number;
  preview: string;
}

export interface MemoryIndex {
  entries: MemoryIndexEntry[];
  indexContent: string;
  dir: string;
  fetchedAt: number;
}

/** Per-session chat state — each fork gets its own message list + status */
export interface SessionChatState {
  messages: ChatMessage[];
  thinking: boolean;
  status: 'idle' | 'thinking' | 'streaming' | 'done';
  thinkingStart: number | null;
  /** Sibling summaries — what other forks are doing */
  siblingUpdates: { sessionId: string; summary: string; timestamp: number }[];
}

export interface DashboardActions {
  selectProject: (id: string | null) => void;
  selectBrainNode: (id: string | null) => void;
  setCenterView: (view: CenterView) => void;
  toggleCommandPalette: () => void;
  toggleScoreboard: () => void;
  sendChatMessage: (msg: string, sessionId?: string) => void;
  stopResponse: (sessionId?: string) => void;
  editMessage: (messageId: string, sessionId?: string) => string | null;
  getSessionChat: (sessionId: string) => SessionChatState;
  dismissNotification: (id: string) => void;
  addTerminalLine: (line: string) => void;
  setActiveDocument: (id: string | null) => void;
  setRightPanelTab: (tab: 'memory' | 'documents' | 'editor') => void;
  forkChat: (parentSessionId: string, label: string) => string;
}

// White-label configuration
export interface DashboardConfig {
  instanceName: string;
  owner: string;
  bridgeUrl: string;
  features: Record<string, boolean>;
  projectIds: string[];
}
