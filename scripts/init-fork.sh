#!/usr/bin/env bash
# init-fork.sh — bootstrap a fresh janus-ia fork for a new user.
#
# Strips Jano-specific content (his project wikis, outputs, specific learnings)
# while keeping the core agent framework intact: agents/, concepts/, scripts/,
# dashboard/, mcp-servers/, registries, CLAUDE.md.
#
# Run ONCE after cloning/forking. It's idempotent — safe to re-run, but it
# will warn before deleting directories that already look stripped.
#
# Usage:
#   ./scripts/init-fork.sh            → interactive, asks before stripping
#   ./scripts/init-fork.sh --yes      → non-interactive, just do it

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

YES=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
    *) echo "unknown flag: $arg"; exit 1 ;;
  esac
done

if [ ! -f "$REPO/CLAUDE.md" ] || [ ! -d "$REPO/agents" ]; then
  echo "× $REPO doesn't look like a janus-ia fork (missing CLAUDE.md or agents/)" >&2
  exit 1
fi

cat <<EOF
┌──────────────────────────────────────────────────────────┐
│  JANUS FORK BOOTSTRAP                                     │
├──────────────────────────────────────────────────────────┤
│  About to strip Jano-specific content from this fork:    │
│    - wiki/          (his project-specific pages)          │
│    - projects/      (his dev/uat/prod tracking)           │
│    - outputs/       (his generated docs + screenshots)    │
│    - dump/          (his inbox)                           │
│  Resetting to empty templates:                            │
│    - PROJECTS.md                                          │
│    - learnings/market.md  (Mexico-specific)               │
│    - learnings/supabase-registry.md  (his schema)         │
│                                                           │
│  Keeping the agent framework:                             │
│    ✓ CLAUDE.md, agents/, concepts/                        │
│    ✓ learnings/patterns.md, technical.md, gtm.md          │
│    ✓ scripts/, dashboard/, mcp-servers/                   │
│    ✓ tools/registry.md, skills/registry.md                │
│                                                           │
│  After this runs, launch \`./dash\` — the dashboard will   │
│  walk you through first-run discovery.                    │
└──────────────────────────────────────────────────────────┘
EOF

if [ "$YES" != "1" ]; then
  read -r -p "proceed? [y/N] " ans
  case "$ans" in
    y|Y|yes) ;;
    *) echo "aborted"; exit 0 ;;
  esac
fi

echo ""
echo "▸ removing Jano-specific dirs..."
for d in wiki projects outputs dump; do
  if [ -d "$REPO/$d" ]; then
    rm -rf "$REPO/$d"
    echo "  removed $d/"
  fi
done

echo "▸ resetting templates..."
cat > "$REPO/PROJECTS.md" <<'TEMPLATE'
# Projects

No projects yet. Add entries as you start building:

## Template

| Project | Stage | Module(s) | Next step |
|---|---|---|---|
| example | dev | validation + build | finalize intake |

Full per-project pages live in `wiki/<name>.md`.
TEMPLATE

mkdir -p "$REPO/learnings"
cat > "$REPO/learnings/market.md" <<'TEMPLATE'
# Market knowledge

Track market-level learnings here: industry data, competitor notes, regulatory
snapshots, pricing benchmarks. Write one section per geography/vertical. The
AI re-reads this before research or go/no-go decisions.
TEMPLATE

cat > "$REPO/learnings/supabase-registry.md" <<'TEMPLATE'
# Supabase registry

If/when projects in this fork start using Supabase, register every table here:
purpose, schema file path, and which projects write to it. This is how the AI
avoids cross-project schema collisions.

| Table | Purpose | Schema | Writers |
|---|---|---|---|
TEMPLATE

cat > "$REPO/learnings/cross-project-map.md" <<'TEMPLATE'
---
type: learning
tags: [cross-project, relationships, map]
---
# Cross-Project Map

Maps relationships between all projects. The pre-flight check parses the
`## Capacity` section to show your active backlog.

## Shared Infrastructure

| Resource | Projects | Notes |
|---|---|---|

## Cross-Cutting Patterns

(Patterns that repeat across 2+ projects get their own concept node in
`concepts/` and link back here.)

## Capacity

No active projects yet. Add bullets like:
- [[wiki/<project-slug>]] — short status (N sessions to next milestone)

Total: 0 sessions queued.
Rule: capacity-aware intake — flag new requests when backlog is full.
TEMPLATE

# Drop dated session-artifact files
find "$REPO/learnings" -maxdepth 1 -name "self-improvement-session-*.md" -delete 2>/dev/null || true

if [ -f "$REPO/CHANGELOG.md" ]; then
  echo "▸ resetting CHANGELOG.md..."
  echo "# Changelog" > "$REPO/CHANGELOG.md"
fi

# ─── Rewrite README to a generic template ─────────────────────
FORK_NAME="$(basename "$REPO")"
echo "▸ resetting README.md → $FORK_NAME..."
cat > "$REPO/README.md" <<TEMPLATE
# $FORK_NAME

Personal AI brain — initialized from the [janus-ia](https://github.com/salasoliva27/janus-ia)
template. Built on Claude Code with an agent dispatch protocol, file-based
memory, MCP integrations, and a workspace-aware dashboard.

## First run

\`\`\`bash
./dash              # launch the dashboard
\`\`\`

In the first chat turn, tell the AI: **\`run discovery\`**. It will walk you
through declaring your projects, your stack, and personalizing the agents in
\`agents/\` and \`CLAUDE.md\` for your work.

## Layout

\`\`\`
agents/         agent specs (developer, ux, legal, financial, ...)
concepts/       cross-project patterns (the compounding layer)
learnings/      domain knowledge (market, technical, gtm, patterns)
dashboard/      the UI you launch with ./dash
mcp-servers/    local MCP servers (memory, etc.)
scripts/        bootstrap, preflight, gdrive, dash-link, init-fork
tools/          tool registry + configs
skills/         skills registry
CLAUDE.md       master brain — read this first
\`\`\`

\`CLAUDE.md\` is the source of truth for how the system behaves. Personalize
it during discovery before doing real work.

---

To pull updates from upstream janus-ia later:
\`\`\`bash
git remote add upstream https://github.com/salasoliva27/janus-ia.git
git fetch upstream && git merge upstream/main
\`\`\`
TEMPLATE

# ─── Self-anchor hook + MCP paths ─────────────────────────────
# .claude/settings.json hooks and .mcp.json paths reference
# /workspaces/janus-ia. Point them at this fork instead.
echo "▸ rewriting hardcoded /workspaces/janus-ia paths..."
for f in "$REPO/.claude/settings.json" "$REPO/.mcp.json"; do
  if [ -f "$f" ]; then
    # Use | as sed delimiter since paths contain /
    sed -i "s|/workspaces/janus-ia|$REPO|g" "$f"
    echo "  rewrote $f"
  fi
done

echo ""
echo "✓ fork initialized."
echo ""
echo "next:"
echo "  ./dash              # launch the dashboard"
echo "                      # first turn, tell the AI: 'run discovery'"
