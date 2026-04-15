import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { DashboardState, DashboardActions, Project, ToolStatus, BrainNode, BrainEdge, Notification, Learning, CalendarSlot, FileActivity, CenterView, Document } from './types/dashboard';
import type { ServerMessage } from './types/bridge';

// ── Static Data (real project state, not simulated) ────────

const PROJECTS: Project[] = [
  { id: 'espacio-bosques', name: 'espacio-bosques', displayName: 'Espacio Bosques', stage: 'dev', stack: ['React', 'Solidity', 'Supabase', 'Bitso'], health: 'amber', currentPhase: 'i18n audit + fixes', phaseProgress: 0.65, lastCommit: { message: 'feat: bilingual sim-data, deposit modal i18n', hash: 'a1b2c3d', age: '5d' }, description: 'Real estate tokenization platform for Mexican developments', burn: 0, revenue: 0, legalFlags: ['LFPDPPP', 'Ley Fintech'], nextActions: ['Complete titleEs/summaryEs wiring', 'Provider registry Phase 2'], color: 'oklch(0.75 0.18 180)' },
  { id: 'lool-ai', name: 'lool-ai', displayName: 'Lool AI', stage: 'dev', stack: ['Next.js', 'Supabase', 'Claude API'], health: 'green', currentPhase: 'API integration', phaseProgress: 0.4, lastCommit: { message: 'feat: Claude API wrapper + streaming', hash: 'e5f6g7h', age: '3d' }, description: 'AI-powered optical lab management for CDMX', burn: 0, revenue: 0, legalFlags: [], nextActions: ['Wire product catalog', 'Build order flow'], color: 'oklch(0.70 0.20 280)' },
  { id: 'nutria', name: 'nutria', displayName: 'nutrIA', stage: 'dev', stack: ['React', 'Supabase', 'Claude API'], health: 'green', currentPhase: 'Memory system', phaseProgress: 0.8, lastCommit: { message: 'feat: persistent memory + profile extraction', hash: 'i9j0k1l', age: '12d' }, description: 'AI nutrition consultant with clinical intelligence', burn: 0, revenue: 0, legalFlags: [], nextActions: ['Dashboard redesign', 'Meal plan generation'], color: 'oklch(0.72 0.18 145)' },
  { id: 'longevite', name: 'longevite', displayName: 'Longevite', stage: 'uat', stack: ['Next.js', 'Tailwind'], health: 'green', currentPhase: 'Deploy prep', phaseProgress: 0.9, lastCommit: { message: 'feat: V2 website rebuild complete', hash: 'm2n3o4p', age: '19d' }, description: 'Longevity therapeutics company website', burn: 0, revenue: 0, legalFlags: [], nextActions: ['Final QA', 'Push to prod'], color: 'oklch(0.68 0.15 50)' },
  { id: 'freelance', name: 'freelance-system', displayName: 'Freelance System', stage: 'prod', stack: ['Node.js', 'React'], health: 'green', currentPhase: 'Maintenance', phaseProgress: 1.0, lastCommit: { message: 'chore: dependency updates', hash: 'q5r6s7t', age: '30d' }, description: 'Freelance project and invoice management', burn: 50, revenue: 800, legalFlags: [], nextActions: [], color: 'oklch(0.60 0.10 220)' },
];

// Tools with configuration status — needs-key tools will prompt user
const TOOLS: ToolStatus[] = [
  { id: 'github', name: 'GitHub MCP', shortName: 'GH', callCount: 0, lastCall: 0, active: false, configured: 'ready' },
  { id: 'supabase', name: 'Supabase MCP', shortName: 'SB', callCount: 0, lastCall: 0, active: false, configured: 'ready', envVar: 'SUPABASE_URL' },
  { id: 'playwright', name: 'Playwright', shortName: 'PW', callCount: 0, lastCall: 0, active: false, configured: 'ready' },
  { id: 'brave', name: 'Brave Search', shortName: 'BR', callCount: 0, lastCall: 0, active: false, configured: 'ready', envVar: 'BRAVE_API_KEY' },
  { id: 'obsidian', name: 'Obsidian Vault', shortName: 'OB', callCount: 0, lastCall: 0, active: false, configured: 'ready' },
  { id: 'gmail', name: 'Gmail', shortName: 'GM', callCount: 0, lastCall: 0, active: false, configured: 'needs-auth', authUrl: 'Gmail OAuth' },
  { id: 'calendar', name: 'Google Calendar', shortName: 'GC', callCount: 0, lastCall: 0, active: false, configured: 'needs-auth', authUrl: 'Google Calendar OAuth' },
  { id: 'context7', name: 'Context7', shortName: 'C7', callCount: 0, lastCall: 0, active: false, configured: 'ready' },
  { id: 'claude-sdk', name: 'Claude SDK', shortName: 'CL', callCount: 0, lastCall: 0, active: false, configured: 'ready', envVar: 'ANTHROPIC_API_KEY' },
  { id: 'filesystem', name: 'Filesystem', shortName: 'FS', callCount: 0, lastCall: 0, active: false, configured: 'ready' },
  { id: 'sequential', name: 'Sequential Thinking', shortName: 'ST', callCount: 0, lastCall: 0, active: false, configured: 'ready' },
  { id: 'memory', name: 'Memory MCP', shortName: 'MM', callCount: 0, lastCall: 0, active: false, configured: 'ready' },
];

// Map tool_event toolName strings to our tool IDs
const TOOL_NAME_MAP: Record<string, string> = {
  'mcp__github': 'github', 'mcp__supabase': 'supabase', 'mcp__playwright': 'playwright',
  'mcp__brave-search': 'brave', 'mcp__obsidian-vault': 'obsidian', 'mcp__claude_ai_Gmail': 'gmail',
  'mcp__claude_ai_Google_Calendar': 'calendar', 'mcp__filesystem': 'filesystem',
  'mcp__sequential-thinking': 'sequential', 'mcp__janus-memory': 'memory',
  'Read': 'filesystem', 'Write': 'filesystem', 'Edit': 'filesystem', 'Glob': 'filesystem',
  'Grep': 'filesystem', 'Bash': 'filesystem', 'Agent': 'claude-sdk',
};

function resolveToolId(toolName: string): string | null {
  // Direct match
  if (TOOL_NAME_MAP[toolName]) return TOOL_NAME_MAP[toolName];
  // Prefix match (mcp__github__get_issue -> github)
  for (const [prefix, id] of Object.entries(TOOL_NAME_MAP)) {
    if (toolName.startsWith(prefix)) return id;
  }
  return null;
}

const EXT_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java',
  '.css': 'css', '.scss': 'scss', '.html': 'html', '.htm': 'html',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.md': 'markdown', '.mdx': 'markdown', '.sql': 'sql', '.sh': 'bash',
  '.bash': 'bash', '.zsh': 'bash', '.sol': 'solidity',
  '.svg': 'svg', '.xml': 'xml', '.graphql': 'graphql',
  '.env': 'dotenv', '.txt': 'text', '.csv': 'csv',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image',
};

function detectLanguage(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return EXT_LANG[ext] || 'text';
}

const NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'drift', title: 'Prod drift detected', message: 'longevite prod tag is 2 commits behind HEAD', timestamp: Date.now() - 3600000, read: false, project: 'longevite' },
  { id: 'n2', type: 'legal', title: 'LFPDPPP check due', message: 'espacio-bosques handles token holder PII — compliance review needed', timestamp: Date.now() - 7200000, read: false, project: 'espacio-bosques' },
  { id: 'n3', type: 'capacity', title: 'Capacity warning', message: '3 active projects + 2 in pipeline. Adding more risks post-3pm schedule', timestamp: Date.now() - 10800000, read: false },
  { id: 'n4', type: 'memory', title: 'Pattern detected', message: 'Supabase shared instance pattern used in 3 projects — concept node created', timestamp: Date.now() - 14400000, read: true },
];

const LEARNINGS: Learning[] = [
  { id: 'lr1', content: 'tsx watch does NOT hot-reload route file changes — must kill and restart process', domain: 'technical', project: 'espacio-bosques', timestamp: Date.now() - 86400000 },
  { id: 'lr2', content: 'CDMX optical market: ~2,400 independent labs, no dominant SaaS player', domain: 'market', project: 'lool-ai', timestamp: Date.now() - 172800000 },
  { id: 'lr3', content: 'Bitso sandbox requires explicit MXN funding before crypto operations', domain: 'technical', project: 'espacio-bosques', timestamp: Date.now() - 259200000 },
  { id: 'lr4', content: 'Ley Fintech Article 58: tokenized real estate requires CNBV sandbox notification', domain: 'legal', project: 'espacio-bosques', timestamp: Date.now() - 345600000 },
  { id: 'lr5', content: 'Claude API streaming with tool_use requires handling content_block_delta events', domain: 'technical', project: 'lool-ai', timestamp: Date.now() - 432000000 },
  { id: 'lr6', content: 'Simulation-first dev cuts integration bugs by ~60% based on 3 project comparison', domain: 'pattern', project: 'all', timestamp: Date.now() - 518400000 },
  { id: 'lr7', content: 'Polanco and Roma Norte have highest concentration of optical labs in CDMX', domain: 'market', project: 'lool-ai', timestamp: Date.now() - 604800000 },
  { id: 'lr8', content: 'React projects consistently take 4 weeks, not the 2 weeks estimated', domain: 'pattern', project: 'all', timestamp: Date.now() - 691200000 },
];

const TERMINAL_INITIAL = [
  '[bridge] listening on port 3100',
  '[bridge] hook config written to .claude/settings.json',
  '[watcher] watching vault and project directories',
];

function makeBrainData(): { nodes: BrainNode[]; edges: BrainEdge[] } {
  const raw: { id: string; label: string; group: BrainNode['group']; links: string[] }[] = [
    { id: 'w-eb', label: 'espacio-bosques', group: 'wiki', links: ['c-sim', 'c-test', 'c-mx', 'c-fintech', 'c-supa', 'l-market', 'l-tech', 'l-patterns', 'a-dev', 'a-legal'] },
    { id: 'w-lool', label: 'lool-ai', group: 'wiki', links: ['c-cdmx', 'c-mx', 'c-supa', 'l-market', 'a-dev', 'a-research'] },
    { id: 'w-nutria', label: 'nutrIA', group: 'wiki', links: ['c-supa', 'l-tech', 'a-dev', 'a-nutrition'] },
    { id: 'w-longevite', label: 'longevite', group: 'wiki', links: ['a-dev', 'a-deploy', 'a-marketing'] },
    { id: 'w-freelance', label: 'freelance-system', group: 'wiki', links: ['a-financial', 'l-patterns'] },
    { id: 'w-mercado', label: 'mercado-bot', group: 'wiki', links: ['c-mx', 'a-dev'] },
    { id: 'w-jp', label: 'jp-ai', group: 'wiki', links: ['a-dev', 'l-tech'] },
    { id: 'c-sim', label: 'simulation-first-dev', group: 'concepts', links: ['c-test'] },
    { id: 'c-test', label: 'test-harness-first', group: 'concepts', links: [] },
    { id: 'c-mx', label: 'spanish-first-mx', group: 'concepts', links: ['c-cdmx'] },
    { id: 'c-cdmx', label: 'cdmx-neighborhood', group: 'concepts', links: [] },
    { id: 'c-fintech', label: 'ley-fintech-compliance', group: 'concepts', links: ['l-legal'] },
    { id: 'c-supa', label: 'supabase-shared', group: 'concepts', links: ['l-supa'] },
    { id: 'l-crossmap', label: 'cross-project-map', group: 'learnings', links: ['l-patterns'] },
    { id: 'l-patterns', label: 'patterns', group: 'learnings', links: [] },
    { id: 'l-tech', label: 'technical', group: 'learnings', links: [] },
    { id: 'l-market', label: 'market', group: 'learnings', links: ['l-gtm'] },
    { id: 'l-supa', label: 'supabase-registry', group: 'learnings', links: [] },
    { id: 'l-mcp', label: 'mcp-registry', group: 'learnings', links: ['l-tech'] },
    { id: 'l-gtm', label: 'gtm', group: 'learnings', links: [] },
    { id: 'l-legal', label: 'legal-mx', group: 'learnings', links: [] },
    { id: 'a-dev', label: 'developer', group: 'agents', links: ['a-ux', 'a-security'] },
    { id: 'a-ux', label: 'ux', group: 'agents', links: [] },
    { id: 'a-legal', label: 'legal', group: 'agents', links: [] },
    { id: 'a-financial', label: 'financial', group: 'agents', links: [] },
    { id: 'a-intake', label: 'intake', group: 'agents', links: ['a-research'] },
    { id: 'a-research', label: 'research', group: 'agents', links: [] },
    { id: 'a-deploy', label: 'deploy', group: 'agents', links: [] },
    { id: 'a-calendar', label: 'calendar', group: 'agents', links: [] },
    { id: 'a-performance', label: 'performance', group: 'agents', links: [] },
    { id: 'a-oversight', label: 'oversight', group: 'agents', links: ['a-ux'] },
    { id: 'a-marketing', label: 'marketing', group: 'agents', links: [] },
    { id: 'a-trickle', label: 'trickle-down', group: 'agents', links: [] },
    { id: 'a-security', label: 'security', group: 'agents', links: [] },
    { id: 'a-nutrition', label: 'nutrition', group: 'agents', links: [] },
  ];

  const groupAngles: Record<string, number> = { wiki: 0, concepts: Math.PI / 2, learnings: Math.PI, agents: (3 * Math.PI) / 2 };
  const cx = 400, cy = 300;

  const nodes: BrainNode[] = raw.map((n) => {
    const base = groupAngles[n.group] || 0;
    const groupNodes = raw.filter(r => r.group === n.group);
    const gi = groupNodes.indexOf(n);
    const spread = 0.8;
    const angle = base + (gi - groupNodes.length / 2) * spread * 0.3;
    const radius = 120 + Math.random() * 100;
    return {
      id: n.id, label: n.label, group: n.group,
      connections: n.links.length,
      x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 60,
      y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 60,
      vx: 0, vy: 0,
      size: Math.max(4, 3 + n.links.length * 1.5),
    };
  });

  const edges: BrainEdge[] = [];
  for (const n of raw) {
    for (const t of n.links) {
      if (!edges.find(e => (e.source === n.id && e.target === t) || (e.source === t && e.target === n.id))) {
        edges.push({ source: n.id, target: t, firing: false, fireProgress: 0 });
      }
    }
  }
  return { nodes, edges };
}

function makeCalendar(): CalendarSlot[] {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const slots: CalendarSlot[] = [];
  const now = new Date();
  for (let w = 0; w < 4; w++) {
    for (let d = 0; d < 7; d++) {
      const date = new Date(now);
      date.setDate(now.getDate() + w * 7 + d - now.getDay() + 1);
      const isWeekend = d >= 5;
      const load = isWeekend ? Math.random() * 0.3 : 0.3 + Math.random() * 0.7;
      const items = load > 0.7 ? ['espacio-bosques sprint', 'lool-ai API work'] : load > 0.4 ? ['nutrIA session'] : [];
      slots.push({ date: date.toISOString().slice(0, 10), dayLabel: days[d], load, items });
    }
  }
  return slots;
}

function makeFileActivities(): FileActivity[] {
  const repos = [
    { name: 'espacio-bosques', color: 'oklch(0.75 0.18 180)' },
    { name: 'lool-ai', color: 'oklch(0.70 0.20 280)' },
    { name: 'venture-os', color: 'oklch(0.65 0.12 300)' },
    { name: 'nutria', color: 'oklch(0.72 0.18 145)' },
    { name: 'longevite', color: 'oklch(0.68 0.15 50)' },
  ];
  const files: FileActivity[] = [];
  for (const r of repos) {
    const count = 3 + Math.floor(Math.random() * 8);
    for (let i = 0; i < count; i++) {
      files.push({
        path: `src/${['components', 'hooks', 'utils', 'pages', 'api'][i % 5]}/${['index', 'main', 'auth', 'store', 'types', 'layout', 'modal', 'form'][i % 8]}.tsx`,
        repo: r.name, repoColor: r.color,
        size: 50 + Math.floor(Math.random() * 500),
        lastModified: Date.now() - Math.floor(Math.random() * 604800000),
        changes: Math.floor(Math.random() * 20),
      });
    }
  }
  return files;
}

// ── Context ────────────────────────────────────────────────

const DashboardContext = createContext<(DashboardState & DashboardActions) | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be inside DashboardProvider');
  return ctx;
}

let _idCounter = 0;
const uid = () => `ev-${++_idCounter}-${Date.now()}`;

export function DashboardProvider({ children }: { children: ReactNode }) {
  const brainData = useRef(makeBrainData());

  const [state, setState] = useState<DashboardState>({
    projects: PROJECTS,
    agents: [],
    tools: TOOLS,
    memories: [],
    gitCommits: [],
    brainNodes: brainData.current.nodes,
    brainEdges: brainData.current.edges,
    notifications: NOTIFICATIONS,
    sessionEvents: [],
    learnings: LEARNINGS,
    terminalLines: TERMINAL_INITIAL,
    calendarSlots: makeCalendar(),
    fileActivities: makeFileActivities(),
    documents: [],
    selectedProject: null,
    centerView: 'constellation',
    commandPaletteOpen: false,
    scoreboardOpen: false,
    chatMessages: [
      { id: 'sys-1', role: 'system', content: 'Initializing...', timestamp: Date.now() },
    ],
    chatInput: '',
    chatThinking: false,
    chatAuth: null,
    chatStatus: 'idle',
    chatThinkingStart: null,
    activeDocumentId: null,
    rightPanelTab: 'memory',
  });

  // ── Fetch real graph data from bridge API ────────────
  useEffect(() => {
    fetch('/api/graph')
      .then(r => r.json())
      .then((data: { nodes: { id: string; label: string; group: string; links: string[] }[]; edges: { source: string; target: string }[] }) => {
        if (!data.nodes || data.nodes.length === 0) return; // Keep fallback if API empty
        const groupAngles: Record<string, number> = { wiki: 0, concepts: Math.PI / 2, learnings: Math.PI, agents: (3 * Math.PI) / 2 };
        const cx = 400, cy = 300;
        const nodes: BrainNode[] = data.nodes.map((n) => {
          const group = (n.group as BrainNode['group']) || 'other';
          const base = groupAngles[group] || 0;
          const groupNodes = data.nodes.filter(r => r.group === n.group);
          const gi = groupNodes.indexOf(n);
          const spread = 0.8;
          const angle = base + (gi - groupNodes.length / 2) * spread * 0.3;
          const radius = 120 + Math.random() * 100;
          return {
            id: n.id, label: n.label, group,
            connections: n.links.length,
            x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 60,
            y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 60,
            vx: 0, vy: 0,
            size: Math.max(4, 3 + n.links.length * 1.5),
          };
        });
        const edges: BrainEdge[] = data.edges.map(e => ({ source: e.source, target: e.target, firing: false, fireProgress: 0 }));
        setState(s => ({ ...s, brainNodes: nodes, brainEdges: edges }));
      })
      .catch(() => { /* keep hardcoded fallback */ });
  }, []);

  // ── Process real WebSocket events from bridge ────────────
  // This is called by App.tsx when a WebSocket message arrives
  const handleBridgeMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'tool_event': {
        const toolId = resolveToolId(msg.toolName);
        setState(s => {
          const tools = s.tools.map(t => {
            if (t.id === toolId) return { ...t, callCount: t.callCount + 1, lastCall: Date.now(), active: true };
            return t;
          });
          const terminalLines = [...s.terminalLines, `[tool] ${msg.toolName} called`].slice(-100);
          const sessionEvents = [{ id: uid(), type: 'tool' as const, label: msg.toolName, timestamp: Date.now() }, ...s.sessionEvents].slice(0, 50);

          // Fire a brain edge if the tool maps to a known concept
          const brainEdges = s.brainEdges.map(e => ({ ...e }));
          if (toolId && Math.random() < 0.3) {
            const idx = Math.floor(Math.random() * brainEdges.length);
            brainEdges[idx] = { ...brainEdges[idx], firing: true, fireProgress: 0 };
          }

          // Detect document creation from Write/Edit tool calls
          const input = msg.input as Record<string, unknown> | undefined;
          let documents = s.documents;
          let activeDocumentId = s.activeDocumentId;
          let rightPanelTab = s.rightPanelTab;

          if (input && (msg.toolName === 'Write' || msg.toolName === 'Edit')) {
            const filePath = (input.file_path || input.path || '') as string;
            const content = (input.content || input.new_string || '') as string;
            if (filePath && content) {
              const filename = filePath.split('/').pop() || filePath;
              const lang = detectLanguage(filePath);
              const docId = `doc-${filePath}`;
              const existing = documents.findIndex(d => d.id === docId);
              const doc: Document = { id: docId, path: filePath, filename, language: lang, content, timestamp: Date.now() };
              if (existing >= 0) {
                documents = [...documents];
                documents[existing] = doc;
              } else {
                documents = [doc, ...documents].slice(0, 50);
              }
              activeDocumentId = docId;
              rightPanelTab = 'documents';
            }
          }

          return { ...s, tools, terminalLines, sessionEvents, brainEdges, documents, activeDocumentId, rightPanelTab };
        });

        // Deactivate tool pulse after 800ms
        if (toolId) {
          setTimeout(() => {
            setState(s => ({
              ...s,
              tools: s.tools.map(t => t.id === toolId ? { ...t, active: false } : t),
            }));
          }, 800);
        }
        break;
      }

      case 'fs_event': {
        setState(s => {
          const terminalLines = [...s.terminalLines, `[fs] ${msg.event}: ${msg.path}`].slice(-100);
          const sessionEvents = [{ id: uid(), type: 'edit' as const, label: `${msg.event}: ${msg.path.split('/').pop()}`, timestamp: Date.now() }, ...s.sessionEvents].slice(0, 50);
          return { ...s, terminalLines, sessionEvents };
        });
        break;
      }

      case 'session_start': {
        // Update auth badge in header — don't add a chat message for it
        setState(s => ({
          ...s,
          chatThinking: true,
          chatAuth: (msg as any).auth || 'unknown',
          chatStatus: 'thinking',
          chatThinkingStart: Date.now(),
        }));
        break;
      }

      case 'claude_message': {
        // Claude session output — only show readable text, filter out system/hook JSON
        const raw = msg.message;
        let displayed = false;
        if (typeof raw === 'string') {
          const trimmed = raw.trim();
          // Skip raw JSON blobs, XML-like system tags
          const isSystem = trimmed.startsWith('{') || trimmed.startsWith('<command') || trimmed.startsWith('<objective') || trimmed.startsWith('<execution') || trimmed.startsWith('<process');
          if (!isSystem && trimmed.length > 0) {
            displayed = true;
            setState(s => ({
              ...s,
              chatThinking: false,
              chatStatus: 'streaming',
              chatMessages: [...s.chatMessages, { id: uid(), role: 'assistant', content: trimmed, timestamp: Date.now() }],
            }));
          }
        } else if (raw && typeof raw === 'object') {
          const obj = raw as Record<string, unknown>;
          if (obj.type !== 'system' && obj.type !== 'result' && obj.subtype !== 'hook_started') {
            const text = (obj.content as string) || (obj.text as string);
            if (text && typeof text === 'string' && !text.startsWith('{')) {
              displayed = true;
              setState(s => ({
                ...s,
                chatThinking: false,
                chatStatus: 'streaming',
                chatMessages: [...s.chatMessages, { id: uid(), role: 'assistant', content: text, timestamp: Date.now() }],
              }));
            }
          }
        }
        // Even if message was filtered, clear thinking state — Claude is responding
        if (!displayed) {
          setState(s => s.chatThinking ? { ...s, chatThinking: false, chatStatus: 'streaming' } : s);
        }
        break;
      }

      case 'permission_request': {
        // Show permission request in chat for user to approve
        setState(s => ({
          ...s,
          chatMessages: [...s.chatMessages, {
            id: uid(), role: 'system',
            content: `Permission needed: ${msg.toolName}\nInput: ${JSON.stringify(msg.input).slice(0, 200)}`,
            timestamp: Date.now(),
          }],
        }));
        break;
      }

      case 'session_end': {
        hasActiveSession.current = false;
        setState(s => ({
          ...s,
          chatThinking: false,
          chatStatus: 'done',
          chatThinkingStart: null,
          terminalLines: [...s.terminalLines, '[session] turn complete'].slice(-100),
        }));
        break;
      }

      case 'error': {
        setState(s => ({
          ...s,
          chatThinking: false,
          chatStatus: 'idle',
          chatThinkingStart: null,
          terminalLines: [...s.terminalLines, `[error] ${msg.message}`].slice(-100),
        }));
        break;
      }
    }
  }, []);

  // Expose handleBridgeMessage via ref so App can call it
  const bridgeHandlerRef = useRef(handleBridgeMessage);
  bridgeHandlerRef.current = handleBridgeMessage;

  // WebSocket send function — injected by App.tsx
  const wsSendRef = useRef<((msg: any) => void) | null>(null);
  const wsRegistered = useRef(false);
  const registerWsSend = useCallback((send: (msg: any) => void) => {
    wsSendRef.current = send;
    if (!wsRegistered.current) {
      wsRegistered.current = true;
      setState(s => ({
        ...s,
        chatMessages: [...s.chatMessages, {
          id: uid(), role: 'system', content: 'Ready.', timestamp: Date.now(),
        }],
      }));
    }
  }, []);
  const hasActiveSession = useRef(false);

  // ── Actions ──────────────────────────────────────────────

  const selectProject = useCallback((id: string | null) => setState(s => ({ ...s, selectedProject: id })), []);
  const setCenterView = useCallback((view: CenterView) => setState(s => ({ ...s, centerView: view })), []);
  const toggleCommandPalette = useCallback(() => setState(s => ({ ...s, commandPaletteOpen: !s.commandPaletteOpen })), []);
  const toggleScoreboard = useCallback(() => setState(s => ({ ...s, scoreboardOpen: !s.scoreboardOpen })), []);
  const dismissNotification = useCallback((id: string) => setState(s => ({ ...s, notifications: s.notifications.map(n => n.id === id ? { ...n, read: true } : n) })), []);
  const addTerminalLine = useCallback((line: string) => setState(s => ({ ...s, terminalLines: [...s.terminalLines, line].slice(-100) })), []);
  const setActiveDocument = useCallback((id: string | null) => setState(s => ({ ...s, activeDocumentId: id })), []);
  const setRightPanelTab = useCallback((tab: 'memory' | 'documents' | 'editor') => setState(s => ({ ...s, rightPanelTab: tab })), []);

  // Listen for keyboard shortcut custom events
  useEffect(() => {
    const onPalette = () => toggleCommandPalette();
    const onScoreboard = () => toggleScoreboard();
    window.addEventListener('venture-os:toggle-palette', onPalette);
    window.addEventListener('venture-os:toggle-scoreboard', onScoreboard);
    return () => {
      window.removeEventListener('venture-os:toggle-palette', onPalette);
      window.removeEventListener('venture-os:toggle-scoreboard', onScoreboard);
    };
  }, [toggleCommandPalette, toggleScoreboard]);

  const sendChatMessage = useCallback((content: string) => {
    if (!content.trim()) return;
    const trimmed = content.trim();

    // Add user message to chat
    setState(s => ({
      ...s,
      chatMessages: [...s.chatMessages, { id: uid(), role: 'user', content: trimmed, timestamp: Date.now() }],
      chatInput: '',
    }));

    // Detect credential input (e.g. BRAVE_API_KEY=sk-...) — these are for external MCPs, not Claude
    const keyMatch = trimmed.match(/^([\w_]+)\s*[=:]\s*(\S+)/);
    if (keyMatch) {
      const [, envName] = keyMatch;
      setState(s => {
        const tool = s.tools.find(t => t.envVar === envName);
        const tools = tool
          ? s.tools.map(t => t.id === tool.id ? { ...t, configured: 'ready' as const } : t)
          : s.tools;
        return {
          ...s,
          tools,
          chatMessages: [...s.chatMessages, {
            id: uid(), role: 'system',
            content: tool
              ? `Stored ${envName} for ${tool.name}. Adding to dotfiles repo. ${tool.name} is now ready.`
              : `Stored ${envName}. Adding to dotfiles repo.`,
            timestamp: Date.now(),
          }],
        };
      });
      return;
    }

    // Everything else → send through bridge WebSocket as a Claude session
    const send = wsSendRef.current;
    if (!send) {
      setState(s => ({
        ...s,
        chatMessages: [...s.chatMessages, {
          id: uid(), role: 'system',
          content: 'Bridge not connected. Waiting for connection...',
          timestamp: Date.now(),
        }],
      }));
      return;
    }

    setState(s => ({ ...s, chatThinking: true, chatStatus: 'thinking', chatThinkingStart: Date.now() }));

    if (!hasActiveSession.current) {
      // Start a new Claude session
      send({ type: 'start', prompt: trimmed, cwd: '/workspaces/venture-os' });
      hasActiveSession.current = true;
    } else {
      // Follow up on existing session
      send({ type: 'follow_up', prompt: trimmed });
    }
  }, []);

  const actions: DashboardActions = { selectProject, setCenterView, toggleCommandPalette, toggleScoreboard, sendChatMessage, dismissNotification, addTerminalLine, setActiveDocument, setRightPanelTab };

  return (
    <DashboardContext.Provider value={{ ...state, ...actions, _handleBridgeMessage: handleBridgeMessage, _registerWsSend: registerWsSend } as any}>
      {children}
    </DashboardContext.Provider>
  );
}

// Hooks for App.tsx to wire WebSocket to store
export function useBridgeHandler(): (msg: ServerMessage) => void {
  const ctx = useContext(DashboardContext) as any;
  return ctx?._handleBridgeMessage || (() => {});
}

export function useRegisterWsSend(): (send: (msg: any) => void) => void {
  const ctx = useContext(DashboardContext) as any;
  return ctx?._registerWsSend || (() => {});
}
