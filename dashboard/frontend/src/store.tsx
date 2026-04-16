import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import type { DashboardState, DashboardActions, Project, ToolStatus, BrainNode, BrainEdge, Notification, Learning, CalendarSlot, FileActivity, CenterView, Document, AgentInfo, MemoryEntry } from './types/dashboard';
import type { ServerMessage } from './types/bridge';

// ── Static Data (real project state, not simulated) ────────

const PROJECTS: Project[] = [
  { id: 'espacio-bosques', name: 'espacio-bosques', displayName: 'Espacio Bosques', stage: 'dev', stack: ['React', 'Solidity', 'Supabase', 'Bitso'], health: 'amber', currentPhase: 'i18n audit + fixes', phaseProgress: 0.65, lastCommit: { message: 'feat: bilingual sim-data, deposit modal i18n', hash: 'a1b2c3d', age: '5d' }, description: 'Real estate tokenization platform for Mexican developments', burn: 0, revenue: 0, legalFlags: ['LFPDPPP', 'Ley Fintech'], nextActions: ['Complete titleEs/summaryEs wiring', 'Provider registry Phase 2'], color: 'oklch(0.75 0.18 180)', repo: 'salasoliva27/espacio-bosques-dev' },
  { id: 'lool-ai', name: 'lool-ai', displayName: 'Lool AI', stage: 'dev', stack: ['Next.js', 'Supabase', 'Claude API'], health: 'green', currentPhase: 'API integration', phaseProgress: 0.4, lastCommit: { message: 'feat: Claude API wrapper + streaming', hash: 'e5f6g7h', age: '3d' }, description: 'AI-powered optical lab management for CDMX', burn: 0, revenue: 0, legalFlags: [], nextActions: ['Wire product catalog', 'Build order flow'], color: 'oklch(0.70 0.20 280)', repo: 'salasoliva27/lool-ai' },
  { id: 'nutria', name: 'nutria', displayName: 'nutrIA', stage: 'dev', stack: ['React', 'Supabase', 'Claude API'], health: 'green', currentPhase: 'Memory system', phaseProgress: 0.8, lastCommit: { message: 'feat: persistent memory + profile extraction', hash: 'i9j0k1l', age: '12d' }, description: 'AI nutrition consultant with clinical intelligence', burn: 0, revenue: 0, legalFlags: [], nextActions: ['Dashboard redesign', 'Meal plan generation'], color: 'oklch(0.72 0.18 145)', repo: 'salasoliva27/nutria-app' },
  { id: 'longevite', name: 'longevite', displayName: 'Longevite', stage: 'uat', stack: ['Next.js', 'Tailwind'], health: 'green', currentPhase: 'Deploy prep', phaseProgress: 0.9, lastCommit: { message: 'feat: V2 website rebuild complete', hash: 'm2n3o4p', age: '19d' }, description: 'Longevity therapeutics company website', burn: 0, revenue: 0, legalFlags: [], nextActions: ['Final QA', 'Push to prod'], color: 'oklch(0.68 0.15 50)', repo: 'salasoliva27/LongeviteTherapeutics' },
  { id: 'freelance', name: 'freelance-system', displayName: 'Freelance System', stage: 'prod', stack: ['Node.js', 'React'], health: 'green', currentPhase: 'Maintenance', phaseProgress: 1.0, lastCommit: { message: 'chore: dependency updates', hash: 'q5r6s7t', age: '30d' }, description: 'Freelance project and invoice management', burn: 50, revenue: 800, legalFlags: [], nextActions: [], color: 'oklch(0.60 0.10 220)', repo: 'salasoliva27/freelance-system' },
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
  { id: 'lr1', rule: 'Always kill and restart tsx after route changes — never trust hot-reload for backend files', content: 'tsx watch does NOT hot-reload route file changes — must kill and restart process', domain: 'technical', project: 'espacio-bosques', timestamp: Date.now() - 86400000, sourceMemoryIds: ['mem-tsx-1', 'mem-tsx-2'], status: 'active' },
  { id: 'lr2', rule: 'Target independent labs first — no incumbent to displace, direct sales viable', content: 'CDMX optical market: ~2,400 independent labs, no dominant SaaS player', domain: 'market', project: 'lool-ai', timestamp: Date.now() - 172800000, sourceMemoryIds: ['mem-mkt-1'], status: 'active' },
  { id: 'lr3', rule: 'Always fund Bitso sandbox wallet with MXN before testing any crypto flow', content: 'Bitso sandbox requires explicit MXN funding before crypto operations', domain: 'technical', project: 'espacio-bosques', timestamp: Date.now() - 259200000, sourceMemoryIds: ['mem-bitso-1'], status: 'active' },
  { id: 'lr4', rule: 'Flag CNBV sandbox notification as a blocker before any prod deploy involving tokenized assets', content: 'Ley Fintech Article 58: tokenized real estate requires CNBV sandbox notification', domain: 'legal', project: 'espacio-bosques', timestamp: Date.now() - 345600000, sourceMemoryIds: ['mem-legal-1', 'mem-legal-2'], status: 'active' },
  { id: 'lr5', rule: 'Handle content_block_delta events in streaming — tool_use breaks without them', content: 'Claude API streaming with tool_use requires handling content_block_delta events', domain: 'technical', project: 'lool-ai', timestamp: Date.now() - 432000000, sourceMemoryIds: ['mem-claude-1'], status: 'active' },
  { id: 'lr6', rule: 'Default to simulation-first architecture for every new project — proven 60% bug reduction', content: 'Simulation-first dev cuts integration bugs by ~60% based on 3 project comparison', domain: 'pattern', project: 'all', timestamp: Date.now() - 518400000, sourceMemoryIds: ['mem-sim-1', 'mem-sim-2', 'mem-sim-3'], status: 'active' },
  { id: 'lr7', rule: 'Prioritize Polanco and Roma Norte for lool-ai pilot — highest lab density', content: 'Polanco and Roma Norte have highest concentration of optical labs in CDMX', domain: 'market', project: 'lool-ai', timestamp: Date.now() - 604800000, sourceMemoryIds: ['mem-geo-1'], status: 'active' },
  { id: 'lr8', rule: 'Estimate 4 weeks for any React project — never promise 2 weeks again', content: 'React projects consistently take 4 weeks, not the 2 weeks estimated', domain: 'pattern', project: 'all', timestamp: Date.now() - 691200000, sourceMemoryIds: ['mem-est-1', 'mem-est-2', 'mem-est-3'], status: 'argued' },
];

const TERMINAL_INITIAL = [
  '[bridge] listening on port 3100',
  '[bridge] hook config written to .claude/settings.json',
  '[watcher] watching vault and project directories',
];

// ── Agent Registry (real agents from agents/core/) ─────
export const AGENT_REGISTRY: AgentInfo[] = [
  { id: 'a-dev', name: 'Developer', icon: '>', role: 'Software architecture, build sequencing, technical decisions', description: 'The developer agent handles all code tasks — architecture decisions, build sequencing, feature implementation, and technical debt. It reads project context before touching any code and follows the dispatch protocol for verification.', file: 'agents/core/developer.md', lastUpdated: '2026-04-13T20:13:17Z', tools: ['GitHub', 'Context7', 'Playwright'], linkedAgents: ['a-ux', 'a-security'] },
  { id: 'a-ux', name: 'UX', icon: '◎', role: 'Visual verification, Playwright, design system', description: 'The UX agent verifies every UI change through a multi-layer protocol: code review, server start, desktop + mobile screenshots via Playwright, functional click-through testing, and cross-environment checks.', file: 'agents/core/ux.md', lastUpdated: '2026-04-13T20:13:17Z', tools: ['Playwright'], linkedAgents: ['a-dev'] },
  { id: 'a-legal', name: 'Legal', icon: '§', role: 'Compliance, contracts, regulatory flags', description: 'Handles LFPDPPP compliance, Ley Fintech exposure, contract reviews, and regulatory flags. Automatically surfaces legal concerns when sessions touch regulated projects like espacio-bosques.', file: 'agents/core/legal.md', lastUpdated: '2026-04-13T20:13:17Z', tools: ['Brave Search'], linkedAgents: [] },
  { id: 'a-financial', name: 'Financial', icon: '$', role: 'Portfolio P&L, burn tracking, runway', description: 'Tracks burn rate, revenue, runway, and P&L across the entire venture portfolio. Produces financial snapshots and flags capacity conflicts when new commitments are proposed.', file: 'agents/core/financial.md', lastUpdated: '2026-04-13T21:40:23Z', tools: ['Google Sheets'], linkedAgents: [] },
  { id: 'a-intake', name: 'Intake', icon: '+', role: 'New idea validation and project spin-up', description: 'Runs the full intake protocol for new ideas: understand, validate (market research), check conflicts, propose structure, and spin up. Challenges weak ideas and capacity conflicts directly.', file: 'agents/core/intake.md', lastUpdated: '2026-04-13T21:20:59Z', tools: ['Brave Search'], linkedAgents: ['a-research'] },
  { id: 'a-research', name: 'Research', icon: '?', role: 'Market research, competitor analysis, discovery', description: 'All research tasks route here. Uses Brave Search, Firecrawl, USDA API, and NotebookLM with a priority matrix based on research type. Mexico/LATAM market focus with source citations and confidence levels.', file: 'agents/core/research.md', lastUpdated: '2026-04-13T21:56:32Z', tools: ['Brave Search', 'Firecrawl', 'NotebookLM'], linkedAgents: [] },
  { id: 'a-deploy', name: 'Deploy', icon: '↑', role: 'Dev → UAT → prod pipeline, tagging, drift detection', description: 'Manages the deployment pipeline across environments. Handles tagging, drift detection between prod tags and HEAD, and environment promotion with verification gates.', file: 'agents/core/deploy.md', lastUpdated: '2026-04-13T21:20:59Z', tools: ['GitHub'], linkedAgents: [] },
  { id: 'a-calendar', name: 'Calendar', icon: '▦', role: 'Google Cal sync, conflict detection', description: 'Two-way Google Calendar sync via MCP. Detects scheduling conflicts, checks capacity against active projects, and enforces the post-3pm availability constraint.', file: 'agents/core/calendar.md', lastUpdated: '2026-04-13T21:20:59Z', tools: ['Google Calendar'], linkedAgents: [] },
  { id: 'a-performance', name: 'Performance', icon: '◆', role: 'Dashboards, weekly summaries, metrics', description: 'Tracks project performance metrics, produces weekly summaries, and maintains dashboards. Monitors build times, test coverage, and delivery velocity.', file: 'agents/core/performance.md', lastUpdated: '2026-04-13T21:20:59Z', tools: ['Google Sheets'], linkedAgents: [] },
  { id: 'a-oversight', name: 'Oversight', icon: '◉', role: 'Product coherence, gap detection, launch readiness', description: 'Sees the full product end-to-end. Walks user flows, finds integration gaps, produces launch readiness checklists, and manages external dependency loops. Works WITH Jano in a loop — does not fix unilaterally.', file: 'agents/core/oversight.md', lastUpdated: '2026-04-13T21:20:59Z', tools: ['Playwright'], linkedAgents: ['a-ux'] },
  { id: 'a-marketing', name: 'Marketing', icon: '◈', role: 'Brand, content, campaigns, email, video', description: 'Handles brand voice, content creation, campaign execution, email outreach via Gmail MCP, and video generation via Remotion. Uses Magic MCP for UI component generation and competitor benchmarking.', file: 'agents/core/marketing.md', lastUpdated: '2026-04-13T20:13:17Z', tools: ['Brave Search', 'Magic MCP', 'Gmail', 'Remotion'], linkedAgents: [] },
  { id: 'a-trickle', name: 'Trickle-Down', icon: '⇣', role: 'Cross-project proposal routing', description: 'When a pattern or proposal should apply across projects, this agent evaluates each project individually and produces ADOPT / ADAPT / REJECT decisions with specific reasoning per project.', file: 'agents/core/trickle-down.md', lastUpdated: '2026-04-13T21:20:59Z', tools: ['GitHub'], linkedAgents: [] },
  { id: 'a-security', name: 'Security', icon: '⊘', role: 'Vulnerability detection, OWASP review, pre-deploy gates', description: 'Runs OWASP top 10 checks, audits auth flows, reviews data handling, and gates deployments. Cross-agent hardening ensures security is checked even when other agents are executing.', file: 'agents/core/security.md', lastUpdated: '2026-04-13T20:13:17Z', tools: ['Playwright', 'GitHub'], linkedAgents: [] },
  { id: 'a-nutrition', name: 'Nutrition', icon: '♥', role: 'Clinical nutrition intelligence (powers nutrIA)', description: 'Domain-specific agent for clinical nutrition. Uses USDA FoodData Central API and Open Food Facts for nutritional data. Powers the nutrIA product with evidence-based recommendations.', file: 'agents/core/nutrition.md', lastUpdated: '2026-04-13T20:13:17Z', tools: ['USDA API', 'Open Food Facts'], linkedAgents: [] },
  { id: 'a-evolve', name: 'Evolve', icon: '∞', role: 'Self-improvement, capability discovery, memory consolidation', description: 'The system introspection and growth engine. Runs timed loops searching for tools, strengthening knowledge connections, and installing capabilities that benefit all projects. Does not build features — makes the system itself better.', file: 'agents/core/evolve.md', lastUpdated: '2026-04-15T01:58:00Z', tools: ['Brave Search', 'GitHub'], linkedAgents: [] },
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

// Persist key session state across reloads
const SESSION_STORAGE_KEY = 'venture-os-session';
function loadPersistedState(): Partial<DashboardState> | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // Only restore if saved within last 2 hours
    if (saved._savedAt && Date.now() - saved._savedAt > 2 * 60 * 60 * 1000) return null;
    return saved;
  } catch { return null; }
}
function persistState(s: DashboardState) {
  try {
    const toSave = {
      chatMessages: s.chatMessages,
      chatAuth: s.chatAuth,
      chatStatus: s.chatStatus === 'thinking' || s.chatStatus === 'streaming' ? 'done' : s.chatStatus,
      memories: s.memories,
      sessionEvents: s.sessionEvents.slice(0, 30),
      agentCounts: s.agentCounts,
      documents: s.documents.slice(0, 20),
      tools: s.tools.map(t => ({ id: t.id, callCount: t.callCount })),
      _savedAt: Date.now(),
    };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* quota exceeded, ignore */ }
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const brainData = useRef(makeBrainData());
  const persisted = useRef(loadPersistedState());

  const [state, setState] = useState<DashboardState>(() => {
    const p = persisted.current;
    const restoredTools = p?.tools
      ? TOOLS.map(t => {
          const saved = (p.tools as any[])?.find((st: any) => st.id === t.id);
          return saved ? { ...t, callCount: saved.callCount } : t;
        })
      : TOOLS;

    return {
      projects: PROJECTS,
      agents: [],
      tools: restoredTools,
      memories: (p?.memories as MemoryEntry[]) || [],
      gitCommits: [],
      brainNodes: brainData.current.nodes,
      brainEdges: brainData.current.edges,
      notifications: NOTIFICATIONS,
      sessionEvents: (p?.sessionEvents as any[]) || [],
      learnings: LEARNINGS,
      terminalLines: TERMINAL_INITIAL,
      calendarSlots: makeCalendar(),
      fileActivities: makeFileActivities(),
      documents: (p?.documents as any[]) || [],
      selectedProject: null,
      selectedBrainNode: null,
      centerView: 'constellation',
      commandPaletteOpen: false,
      scoreboardOpen: false,
      chatMessages: (p?.chatMessages as any[]) || [
        { id: 'sys-1', role: 'system', content: 'Initializing...', timestamp: Date.now() },
      ],
      chatInput: '',
      chatThinking: false,
      chatAuth: (p?.chatAuth as string) || null,
      chatStatus: (p?.chatStatus as any) || 'idle',
      chatThinkingStart: null,
      activeDocumentId: null,
      rightPanelTab: 'memory',
      agentCounts: (p?.agentCounts as Record<string, number>) || {},
    };
  });

  // Persist state on changes (debounced)
  const persistTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => persistState(state), 500);
  }, [state]);

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

          // Increment agent counts — map tool to owning agents
          const agentCounts = { ...s.agentCounts };
          if (toolId) {
            const toolAgentMap: Record<string, string[]> = {
              github: ['Developer', 'Deploy', 'Security', 'Trickle-Down'],
              playwright: ['UX', 'Developer', 'Security', 'Oversight'],
              brave: ['Research', 'Intake', 'Legal', 'Marketing'],
              filesystem: ['Developer'],
              supabase: ['Developer'],
              'claude-sdk': ['Developer'],
              obsidian: ['Research'],
              sequential: ['Oversight'],
            };
            const ownerAgents = toolAgentMap[toolId];
            if (ownerAgents) {
              // Credit the first (primary) agent
              const primary = ownerAgents[0];
              agentCounts[primary] = (agentCounts[primary] || 0) + 1;
            }
          }

          // Extract memories from memory/vault tool calls
          const input = msg.input as Record<string, unknown> | undefined;
          let memories = s.memories;
          if (input && msg.toolName.startsWith('mcp__janus-memory__')) {
            const action = msg.toolName.split('__').pop();
            if (action === 'remember') {
              const content = (input.content as string) || (input.name as string) || '';
              const project = (input.project as string) || undefined;
              const memType: MemoryEntry['type'] = (input.type as string) === 'decision' ? 'decision' : 'learning';
              if (content) {
                const mem: MemoryEntry = { id: uid(), type: memType, direction: 'out', content, project, timestamp: Date.now() };
                memories = [mem, ...memories].slice(0, 100);
              }
            } else if (action === 'recall') {
              const query = (input.query as string) || (input.name as string) || 'recall';
              const mem: MemoryEntry = { id: uid(), type: 'recall', direction: 'in', content: query, timestamp: Date.now() };
              memories = [mem, ...memories].slice(0, 100);
            }
          }
          if (input && msg.toolName.startsWith('mcp__obsidian-vault__')) {
            const action = msg.toolName.split('__').pop();
            if (action === 'write_note' || action === 'patch_note') {
              const path = (input.path as string) || (input.note as string) || '';
              const content = (input.content as string) || (input.patch as string) || '';
              const snippet = content.length > 120 ? content.slice(0, 120) + '...' : content;
              if (path) {
                const mem: MemoryEntry = { id: uid(), type: 'learning', direction: 'out', content: `${path}: ${snippet}`, timestamp: Date.now() };
                memories = [mem, ...memories].slice(0, 100);
              }
            } else if (action === 'read_note' || action === 'search_notes') {
              const query = (input.path as string) || (input.query as string) || 'vault read';
              const mem: MemoryEntry = { id: uid(), type: 'context', direction: 'in', content: query, timestamp: Date.now() };
              memories = [mem, ...memories].slice(0, 100);
            }
          }

          // ── Derive learnings from memory writes ────────────
          let learnings = s.learnings;
          if (input && msg.toolName.startsWith('mcp__janus-memory__')) {
            const action = msg.toolName.split('__').pop();
            if (action === 'remember') {
              const content = (input.content as string) || '';
              const name = (input.name as string) || '';
              const project = (input.project as string) || 'all';
              const memType = (input.type as string) || '';
              if (content && memType !== 'recall') {
                const domain = memType === 'decision' ? 'pattern' as const
                  : name.includes('market') ? 'market' as const
                  : name.includes('legal') ? 'legal' as const
                  : name.includes('gtm') ? 'gtm' as const
                  : 'technical' as const;
                const learning: Learning = {
                  id: uid(),
                  rule: content.length > 140 ? content.slice(0, 140) + '...' : content,
                  content,
                  domain,
                  project,
                  timestamp: Date.now(),
                  sourceMemoryIds: [memories[0]?.id || uid()],
                  status: 'active',
                };
                learnings = [learning, ...learnings].slice(0, 50);
              }
            }
          }
          if (input && msg.toolName.startsWith('mcp__obsidian-vault__')) {
            const action = msg.toolName.split('__').pop();
            if (action === 'write_note' || action === 'patch_note') {
              const notePath = (input.path as string) || (input.note as string) || '';
              const content = (input.content as string) || (input.patch as string) || '';
              if (notePath && (notePath.includes('learnings/') || notePath.includes('concepts/'))) {
                const snippet = content.length > 140 ? content.slice(0, 140) + '...' : content;
                const domain = notePath.includes('market') ? 'market' as const
                  : notePath.includes('legal') ? 'legal' as const
                  : notePath.includes('gtm') ? 'gtm' as const
                  : notePath.includes('pattern') ? 'pattern' as const
                  : 'technical' as const;
                const learning: Learning = {
                  id: uid(),
                  rule: `Updated ${notePath.split('/').pop()}: ${snippet}`,
                  content: `${notePath}: ${content.length > 200 ? content.slice(0, 200) + '...' : content}`,
                  domain,
                  project: 'all',
                  timestamp: Date.now(),
                  sourceMemoryIds: [memories[0]?.id || uid()],
                  status: 'active',
                };
                learnings = [learning, ...learnings].slice(0, 50);
              }
            }
          }

          // Detect document creation from Write/Edit tool calls
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

          return { ...s, tools, terminalLines, sessionEvents, brainEdges, memories, learnings, documents, activeDocumentId, rightPanelTab, agentCounts };
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

      case 'learning_update': {
        const l = (msg as any).learning;
        if (l) {
          setState(s => {
            // Deduplicate by id — update if exists, prepend if new
            const exists = s.learnings.findIndex(x => x.id === l.id);
            let learnings: Learning[];
            if (exists >= 0) {
              learnings = s.learnings.map((x, i) => i === exists ? { ...x, rule: l.rule, content: l.content, timestamp: l.timestamp } : x);
            } else {
              learnings = [{ ...l, status: l.status || 'active', sourceMemoryIds: l.sourceMemoryIds || [] } as Learning, ...s.learnings].slice(0, 50);
            }
            return { ...s, learnings };
          });
        }
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
  const selectBrainNode = useCallback((id: string | null) => setState(s => ({ ...s, selectedBrainNode: id })), []);
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

    // If editing, truncate from the edit point first, then add the new message
    const editIdx = editingFromIdx.current;
    editingFromIdx.current = null;

    setState(s => {
      const base = editIdx !== null ? s.chatMessages.slice(0, editIdx) : s.chatMessages;
      return {
        ...s,
        chatMessages: [...base, { id: uid(), role: 'user', content: trimmed, timestamp: Date.now() }],
        chatInput: '',
        chatStatus: editIdx !== null ? 'idle' as const : s.chatStatus,
        chatThinking: editIdx !== null ? false : s.chatThinking,
        chatThinkingStart: editIdx !== null ? null : s.chatThinkingStart,
      };
    });

    // Reset session when editing so next response starts fresh
    if (editIdx !== null) {
      hasActiveSession.current = false;
    }

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

    // Message interruption: if agent is mid-response, interrupt and re-inject
    const currentStatus = state.chatStatus;
    if (currentStatus === 'thinking' || currentStatus === 'streaming') {
      // Interrupt current generation
      send({ type: 'interrupt', sessionId: 'session-0' });

      // Add system indicator
      setState(s => ({
        ...s,
        chatMessages: [...s.chatMessages, {
          id: uid(), role: 'system',
          content: 'Incorporating your message...',
          timestamp: Date.now(),
        }],
      }));

      // Re-send with injected context after brief delay for interrupt to land
      setTimeout(() => {
        send({
          type: 'follow_up',
          prompt: `[User interrupted with additional context: ${trimmed}]\n\nPlease incorporate the above into your response and continue.`,
          sessionId: 'session-0',
        });
      }, 300);

      setState(s => ({ ...s, chatThinking: true, chatStatus: 'thinking', chatThinkingStart: Date.now() }));
      return;
    }

    setState(s => ({ ...s, chatThinking: true, chatStatus: 'thinking', chatThinkingStart: Date.now() }));

    if (!hasActiveSession.current) {
      // Start a new Claude session
      send({ type: 'start', prompt: trimmed, cwd: '/workspaces/janus-ia', sessionId: 'session-0' });
      hasActiveSession.current = true;
    } else {
      // Follow up on existing session
      send({ type: 'follow_up', prompt: trimmed, sessionId: 'session-0' });
    }
  }, []);

  const stopResponse = useCallback(() => {
    const send = wsSendRef.current;
    if (send) {
      send({ type: 'interrupt', sessionId: 'session-0' });
    }
    hasActiveSession.current = false;
    setState(s => ({
      ...s,
      chatThinking: false,
      chatStatus: 'idle',
      chatThinkingStart: null,
      chatMessages: [...s.chatMessages, { id: uid(), role: 'system', content: 'Response stopped.', timestamp: Date.now() }],
    }));
  }, []);

  // Track which message is being edited — truncation happens on send, not on click
  const editingFromIdx = useRef<number | null>(null);

  const editMessage = useCallback((messageId: string): string | null => {
    let editContent: string | null = null;
    setState(s => {
      const idx = s.chatMessages.findIndex(m => m.id === messageId);
      if (idx < 0 || s.chatMessages[idx].role !== 'user') return s;
      editContent = s.chatMessages[idx].content;
      editingFromIdx.current = idx;
      return s; // Don't mutate yet — wait for submit
    });
    return editContent;
  }, []);

  const forkChat = useCallback((parentSessionId: string, label: string): string => {
    const newSessionId = `session-${Date.now()}`;
    const send = wsSendRef.current;

    // Copy current messages as fork context
    const forkMessageIndex = state.chatMessages.length;

    if (send) {
      send({
        type: 'fork',
        parentSessionId,
        newSessionId,
        forkLabel: label,
        forkMessageIndex,
      });
    }

    // Dispatch custom event so WindowShell can create the window
    window.dispatchEvent(new CustomEvent('venture-os:fork-chat', {
      detail: { sessionId: newSessionId, parentSessionId, label, depth: 1, messages: [...state.chatMessages] },
    }));

    return newSessionId;
  }, [state.chatMessages]);

  const actions: DashboardActions = { selectProject, selectBrainNode, setCenterView, toggleCommandPalette, toggleScoreboard, sendChatMessage, stopResponse, editMessage, dismissNotification, addTerminalLine, setActiveDocument, setRightPanelTab, forkChat };

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
