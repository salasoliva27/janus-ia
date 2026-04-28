// Project-state broadcaster.
//
// The dashboard's project cards used to be hardcoded fixtures in store.tsx —
// fictional commit hashes, frozen `5d` ages, static phase numbers. This module
// replaces the lie with live data:
//   - lastCommit  → GitHub REST API (uses GITHUB_TOKEN)
//   - memoryCount → Supabase REST (memories table, grouped by project)
//   - nextActions → parsed from wiki/<project>.md (lines starting with ⬜)
//   - currentPhase → "Status" line from wiki/<project>.md
//
// The bridge fetches once on startup, then refreshes every REFRESH_MS, plus
// re-parses the wiki file when chokidar fires a change event for it.
//
// Frontend merges partial updates into its existing PROJECTS array via the
// `project_update` message handler in store.tsx.

import * as fs from "node:fs";
import * as path from "node:path";
import type { ServerMessage } from "./types.js";

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || "/workspaces/janus-ia";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";

const REFRESH_MS = 5 * 60 * 1000; // 5 min

interface ProjectMeta {
  id: string;       // matches frontend store.tsx PROJECTS[].id
  repo: string;     // owner/name on GitHub
  wikiSlug: string; // wiki/<slug>.md
  // memoryProject: which project field to filter Supabase memories on.
  // Often the same as id, but a few diverge (e.g. wiki "freelance-system",
  // store id "freelance", supabase project tag "freelance-system").
  memoryProject: string;
}

const PROJECTS: ProjectMeta[] = [
  { id: "espacio-bosques", repo: "salasoliva27/espacio-bosques-dev", wikiSlug: "espacio-bosques", memoryProject: "espacio-bosques" },
  { id: "lool-ai",         repo: "salasoliva27/lool-ai",             wikiSlug: "lool-ai",         memoryProject: "lool-ai" },
  { id: "nutria",          repo: "salasoliva27/nutria-app",          wikiSlug: "nutria",          memoryProject: "nutria" },
  { id: "longevite",       repo: "salasoliva27/LongeviteTherapeutics", wikiSlug: "longevite",     memoryProject: "longevite" },
  { id: "freelance",       repo: "salasoliva27/freelance-system",    wikiSlug: "freelance-system", memoryProject: "freelance-system" },
  { id: "jp-ai",           repo: "salasoliva27/jp-ai",               wikiSlug: "jp-ai",           memoryProject: "jp-ai" },
];

interface CommitInfo {
  hash: string;       // 7-char short SHA
  message: string;    // first line of commit message
  age: string;        // "3d", "5h", "just now"
}

function relativeAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  if (ms < 60_000) return "just now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

async function fetchLastCommit(repo: string): Promise<CommitInfo | null> {
  if (!GITHUB_TOKEN) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data = await r.json() as Array<{ sha: string; commit: { message: string; author: { date: string } } }>;
    if (!data?.length) return null;
    const c = data[0];
    return {
      hash: c.sha.slice(0, 7),
      message: c.commit.message.split("\n")[0].slice(0, 80),
      age: relativeAge(c.commit.author.date),
    };
  } catch {
    return null;
  }
}

async function fetchMemoryCount(memoryProject: string): Promise<number> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return 0;
  try {
    // HEAD request with Prefer: count=exact returns total in Content-Range.
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/memories?select=id&project=eq.${encodeURIComponent(memoryProject)}`,
      {
        method: "HEAD",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: "count=exact",
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    const range = r.headers.get("content-range"); // "0-9/42" or "*/42"
    if (!range) return 0;
    const total = parseInt(range.split("/").pop() ?? "0", 10);
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

interface WikiData {
  currentPhase: string | null;
  nextActions: string[];
}

function parseWiki(wikiSlug: string): WikiData {
  const file = path.join(WORKSPACE_ROOT, "wiki", `${wikiSlug}.md`);
  if (!fs.existsSync(file)) return { currentPhase: null, nextActions: [] };
  const raw = fs.readFileSync(file, "utf-8");

  // Status: the line under "## Status" is the phase summary.
  let currentPhase: string | null = null;
  const statusMatch = raw.match(/##\s+Status\s*\n+([^\n]+)/);
  if (statusMatch) {
    // Strip leading emojis/checkmarks and trailing dashes-after-em-dash.
    currentPhase = statusMatch[1]
      .replace(/^[\s✅🔄⬜⚒⚑▶▸·\-—]+/, "")
      .trim()
      .slice(0, 60);
  }

  // Next actions: lines starting with `- ⬜` (open checkbox in Jano's wiki style).
  const nextActions = raw
    .split("\n")
    .filter((l) => /^\s*[-*]\s*⬜/.test(l))
    .map((l) => l.replace(/^\s*[-*]\s*⬜\s*/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 5); // cap so cards don't explode

  return { currentPhase, nextActions };
}

interface ProjectUpdate {
  projectId: string;
  lastCommit?: CommitInfo;
  memoryCount?: number;
  currentPhase?: string;
  nextActions?: string[];
}

async function buildUpdate(p: ProjectMeta): Promise<ProjectUpdate> {
  const [commit, memoryCount] = await Promise.all([
    fetchLastCommit(p.repo),
    fetchMemoryCount(p.memoryProject),
  ]);
  const wiki = parseWiki(p.wikiSlug);
  const update: ProjectUpdate = { projectId: p.id, memoryCount };
  if (commit) update.lastCommit = commit;
  if (wiki.currentPhase) update.currentPhase = wiki.currentPhase;
  if (wiki.nextActions.length) update.nextActions = wiki.nextActions;
  return update;
}

function broadcastUpdate(broadcast: (m: ServerMessage) => void, u: ProjectUpdate): void {
  broadcast({ type: "project_update", projectId: u.projectId, updates: u } as ServerMessage);
}

/** One-shot refresh of all projects. */
export async function broadcastInitialProjectStates(broadcast: (m: ServerMessage) => void): Promise<void> {
  console.log(`[project-state] fetching ${PROJECTS.length} projects...`);
  const updates = await Promise.all(PROJECTS.map(buildUpdate));
  for (const u of updates) {
    broadcastUpdate(broadcast, u);
    console.log(`[project-state] broadcast ${u.projectId}: commit=${u.lastCommit?.hash ?? 'none'} memCount=${u.memoryCount} phase="${u.currentPhase ?? ''}" actions=${u.nextActions?.length ?? 0}`);
  }
}

/** Re-broadcast one project (used by file-watcher when its wiki changes). */
export async function refreshOneProject(
  broadcast: (m: ServerMessage) => void,
  projectIdOrWikiSlug: string,
): Promise<void> {
  const p = PROJECTS.find((x) => x.id === projectIdOrWikiSlug || x.wikiSlug === projectIdOrWikiSlug);
  if (!p) return;
  const u = await buildUpdate(p);
  broadcastUpdate(broadcast, u);
}

/** Polling loop for upstream changes (commits land on GitHub without touching the repo locally). */
export function startProjectStateRefresh(broadcast: (m: ServerMessage) => void): NodeJS.Timeout {
  return setInterval(() => {
    broadcastInitialProjectStates(broadcast).catch((e) => {
      console.error("[project-state] refresh failed:", e?.message ?? e);
    });
  }, REFRESH_MS);
}

/** Lookup by file path (for the chokidar handler). Returns wikiSlug if path matches a known wiki file. */
export function wikiSlugFromPath(filePath: string): string | null {
  const m = filePath.match(/\/wiki\/([^/]+)\.md$/);
  if (!m) return null;
  return PROJECTS.some((p) => p.wikiSlug === m[1]) ? m[1] : null;
}
