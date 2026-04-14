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
  timestamp: number;
  project?: string;
}

export interface Learning {
  id: string;
  content: string;
  domain: 'market' | 'technical' | 'legal' | 'gtm' | 'pattern';
  project: string;
  timestamp: number;
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

export type CenterView = 'constellation' | 'brain' | 'files';

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
  // UI state
  selectedProject: string | null;
  centerView: CenterView;
  commandPaletteOpen: boolean;
  scoreboardOpen: boolean;
  chatMessages: ChatMessage[];
  chatInput: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface DashboardActions {
  selectProject: (id: string | null) => void;
  setCenterView: (view: CenterView) => void;
  toggleCommandPalette: () => void;
  toggleScoreboard: () => void;
  sendChatMessage: (msg: string) => void;
  dismissNotification: (id: string) => void;
  addTerminalLine: (line: string) => void;
}

// White-label configuration
export interface DashboardConfig {
  instanceName: string;
  owner: string;
  bridgeUrl: string;
  features: Record<string, boolean>;
  projectIds: string[];
}
