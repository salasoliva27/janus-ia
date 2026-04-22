#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# JANUS IA — SESSION PRE-FLIGHT CHECK
# Runs automatically on every session start via Claude Code hook.
# Output is injected into the AI's context BEFORE it responds.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# Workspace-aware: default to this script's repo, but honor WORKSPACE_ROOT so
# the same preflight can run in any janus-fork.
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE="${WORKSPACE_ROOT:-$SCRIPT_DIR}"
WORKSPACE_NAME="$(basename "$WORKSPACE")"
CLAUDE_PROJECT_DIR="$(echo "$WORKSPACE" | sed 's|/|-|g')"
MEMORY_DIR="$HOME/.claude/projects/$CLAUDE_PROJECT_DIR/memory"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           JANUS IA — SESSION PRE-FLIGHT CHECK           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ─── 1. MEMORY SYSTEM HEALTH ──────────────────────────────────
echo "▸ MEMORY SYSTEMS"

# Auto-memory (Claude Code built-in) — dir may not exist yet on a fresh fork
if [ -d "$MEMORY_DIR" ]; then
  MEMORY_COUNT=$(find "$MEMORY_DIR" -name "*.md" -not -name "MEMORY.md" 2>/dev/null | wc -l || echo 0)
else
  MEMORY_COUNT=0
fi
echo "  Auto-memory files: ${MEMORY_COUNT}"

# Supabase memory MCP — scoped to this workspace only
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then
  MEM_STATS=$(curl -s -m 5 \
    "${SUPABASE_URL}/rest/v1/memories?select=type&workspace=eq.${WORKSPACE_NAME}&limit=500" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null || echo "FAIL")

  if [ "$MEM_STATS" = "FAIL" ] || echo "$MEM_STATS" | grep -q '"message"'; then
    echo "  Supabase memory: ✗ UNREACHABLE"
  else
    TOTAL=$(echo "$MEM_STATS" | python3 -c "import json,sys; data=json.load(sys.stdin); print(len(data))" 2>/dev/null || echo "0")
    TYPES=$(echo "$MEM_STATS" | python3 -c "
import json,sys
from collections import Counter
data=json.load(sys.stdin)
counts=Counter(r['type'] for r in data)
print(', '.join(f'{t}:{c}' for t,c in counts.most_common()))
" 2>/dev/null || echo "unknown")
    echo "  Supabase memory: ✓ ${TOTAL} memories (${TYPES})"
  fi

  # Check last memory date — scoped to this workspace
  LAST_MEM=$(curl -s -m 5 \
    "${SUPABASE_URL}/rest/v1/memories?select=created_at&workspace=eq.${WORKSPACE_NAME}&order=created_at.desc&limit=1" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null || echo "[]")

  LAST_DATE=$(echo "$LAST_MEM" | python3 -c "
import json,sys
data=json.load(sys.stdin)
if data: print(data[0]['created_at'][:10])
else: print('never')
" 2>/dev/null || echo "unknown")
  echo "  Last memory written: ${LAST_DATE}"

  # Gap warning
  DAYS_SINCE=$(python3 -c "
from datetime import datetime
try:
    last=datetime.strptime('${LAST_DATE}','%Y-%m-%d')
    gap=(datetime.now()-last).days
    if gap>1: print(f'  ⚠ {gap} DAYS since last memory — learning gap detected')
except: pass
" 2>/dev/null)
  [ -n "$DAYS_SINCE" ] && echo "$DAYS_SINCE"

  # ─── Session-handoff anchor check (MANDATORY) ─────────────
  # The next session's primary context is a `most-recent-context` memory
  # written by the previous session. If it's missing or stale, warn loudly.
  ANCHOR_RESP=$(curl -s -m 5 \
    "${SUPABASE_URL}/rest/v1/memories?select=id,created_at,content&metadata=cs.%7B%22tags%22:%5B%22most-recent-context%22%5D%7D&workspace=eq.$WORKSPACE_NAME&order=created_at.desc&limit=1" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null || echo "[]")

  ANCHOR_AGE=$(echo "$ANCHOR_RESP" | python3 -c "
import json, sys
from datetime import datetime, timezone
try:
    data = json.loads(sys.stdin.read())
    if not isinstance(data, list) or not data:
        print('MISSING')
    else:
        ts = data[0]['created_at'].replace('Z','+00:00')
        dt = datetime.fromisoformat(ts)
        age = (datetime.now(timezone.utc) - dt).total_seconds() / 3600
        print(f'FRESH:{age:.0f}' if age < 48 else f'STALE:{age:.0f}')
except Exception as e:
    print('MISSING')
" 2>/dev/null)

  case "$ANCHOR_AGE" in
    MISSING)
      echo "  Session anchor: ✗ NO most-recent-context MEMORY EXISTS"
      echo "    → The previous session did NOT write a handoff. Context is lost."
      echo "    → Do NOT treat this as normal. Acknowledge the gap to Jano."
      ;;
    FRESH:*)
      HOURS="${ANCHOR_AGE#FRESH:}"
      echo "  Session anchor: ✓ most-recent-context (${HOURS}h old) — injected below"
      ;;
    STALE:*)
      HOURS="${ANCHOR_AGE#STALE:}"
      echo "  Session anchor: ⚠ most-recent-context is ${HOURS}h old (>48h stale) — injected below"
      ;;
  esac
else
  echo "  Supabase memory: ✗ NO CREDENTIALS (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing)"
fi

echo ""

# ─── 2. VAULT HEALTH ──────────────────────────────────────────
echo "▸ KNOWLEDGE VAULT"

# Check vault files exist
CONCEPT_COUNT=$(find "$WORKSPACE/concepts" -name "*.md" 2>/dev/null | wc -l)
LEARNING_COUNT=$(find "$WORKSPACE/learnings" -name "*.md" 2>/dev/null | wc -l)
AGENT_COUNT=$(find "$WORKSPACE/agents" -name "*.md" 2>/dev/null | wc -l)
echo "  Concepts: ${CONCEPT_COUNT} | Learnings: ${LEARNING_COUNT} | Agents: ${AGENT_COUNT}"

# ─── Skill integrity check ─────────────────────────────────────
# skills/registry.md claims INSTALLED — verify ~/.claude/skills/ isn't empty.
# Codespace ephemerality repeatedly wipes installs and the registry doesn't know.
mkdir -p "$HOME/.claude/skills" 2>/dev/null || true
SKILL_DIR_COUNT=$( { find "$HOME/.claude/skills" -maxdepth 1 -mindepth 1 -type d 2>/dev/null || true; } | wc -l)
REGISTRY_CLAIMS=$(grep -c "^### .* INSTALLED\|INSTALLED 2026" "$WORKSPACE/skills/registry.md" 2>/dev/null || echo 0)
if [ "${REGISTRY_CLAIMS:-0}" -gt 0 ] && [ "${SKILL_DIR_COUNT:-0}" -eq 0 ]; then
  echo "  ⚠ Skills: registry claims ${REGISTRY_CLAIMS} installed, but ~/.claude/skills/ is EMPTY"
  echo "    → Codespace ephemerality likely wiped them. Re-install via the registry entries, or update the registry."
else
  echo "  Installed skills: ${SKILL_DIR_COUNT} dirs in ~/.claude/skills/"
fi

# Check PROJECTS.md exists and has content
if [ -f "$WORKSPACE/PROJECTS.md" ]; then
  PROJ_LINES=$(wc -l < "$WORKSPACE/PROJECTS.md")
  echo "  PROJECTS.md: ✓ (${PROJ_LINES} lines)"
else
  echo "  PROJECTS.md: ✗ MISSING"
fi


# ─── Vault plasticity check ───────────────────────────────────
# Diagnostic 2026-04-20: most agents/concepts are append-only (del/add
# ratio ~0). Surface append-only files so /evolve knows what to rewrite.
APPEND_ONLY=$( { cd "$WORKSPACE" && git log --since="30 days ago" --numstat --pretty=format: -- agents/ concepts/ 2>/dev/null || true; } | awk 'NF==3 {add[$3]+=$1; del[$3]+=$2} END {n=0; for (f in add) if (add[f]>=40 && del[f]==0) n++; print n}')
if [ "${APPEND_ONLY:-0}" -gt 0 ]; then
  echo "  ⚠ Vault plasticity: ${APPEND_ONLY} agent/concept files are append-only (30d) — consider /evolve to rewrite"
fi

echo ""

# ─── 3. GIT STATE ─────────────────────────────────────────────
echo "▸ GIT STATE"

cd "$WORKSPACE"
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)
LAST_COMMIT_DATE=$(git log -1 --format="%ci" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
LAST_COMMIT_MSG=$(git log -1 --format="%s" 2>/dev/null | head -c 80 || echo "unknown")
echo "  Branch: ${BRANCH}"
echo "  Uncommitted changes: ${UNCOMMITTED}"
echo "  Last commit: ${LAST_COMMIT_DATE} — ${LAST_COMMIT_MSG}"

# Check for unpushed commits
UNPUSHED=$(git log origin/${BRANCH}..HEAD --oneline 2>/dev/null | wc -l || echo "0")
[ "$UNPUSHED" -gt 0 ] && echo "  ⚠ ${UNPUSHED} unpushed commits"

echo ""

# ─── 4. ACTIVE PROJECT SNAPSHOT ───────────────────────────────
echo "▸ ACTIVE PROJECTS (from cross-project-map)"
if [ -f "$WORKSPACE/learnings/cross-project-map.md" ]; then
  # Extract capacity section
  python3 -c "
import re
with open('$WORKSPACE/learnings/cross-project-map.md') as f:
    content = f.read()
cap = re.search(r'## Capacity.*?(?=\n## |\Z)', content, re.DOTALL)
if cap:
    lines = cap.group().strip().split('\n')
    for line in lines[1:]:
        line = line.strip()
        if line.startswith('-') or line.startswith('Rule:') or line.startswith('Total:'):
            print(f'  {line}')
" 2>/dev/null
fi

echo ""

# ─── 5. PROTOCOL REMINDER ─────────────────────────────────────
echo "▸ SESSION PROTOCOL CHECKLIST"
echo "  ✓ Permission mode: Full Auto (default)"
echo "  ✓ Most-recent-context — auto-injected below"
echo "  ✓ Recent corrections — auto-injected below"
echo "  □ Cross-synthesis: legal, market, tech, capacity"
echo "  □ Monitor own context usage — snapshot at ~70%, hard-stop at ~80%"
echo "  □ Respond to user"
echo ""
echo "▸ INLINE LEARNING RULES (active all session)"
echo "  □ Correction from user → immediate capture_correction()"
echo "  □ Surprising discovery → immediate remember(type='learning')"
echo "  □ Decision made → immediate remember(type='decision')"
echo "  □ Minimum 3 memories per session"
echo "  □ End of session → capture_session_summary()"
echo ""
echo "▸ CONTEXT RUNOUT PROTOCOL (non-negotiable)"
echo "  □ When tool outputs get large or tasks are multi-step, treat this as CRITICAL"
echo "  □ Proactively snapshot a most-recent-context memory BEFORE the system auto-compacts"
echo "  □ A snapshot MUST contain: in-flight task state, files touched, next 1-3 actions, blockers"
echo "  □ Never stop silently mid-task. If context is tight, announce it and hand off cleanly."
echo "  □ If previous session ended abnormally (no handoff), acknowledge the gap to Jano FIRST."
echo ""
echo "════════════════════════════════════════════════════════════"
echo " DO NOT SKIP THESE PROTOCOLS. They exist because you"
echo " skipped them for 30 days and lost all learning."
echo "════════════════════════════════════════════════════════════"
echo ""

# ─── 6. AUTO-INJECT MOST-RECENT-CONTEXT + RECENT CORRECTIONS ──
# This is what replaces the "□ recall() recent work" checkbox — the content
# lands directly in context so there's nothing to remember to fetch.
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_KEY" ]; then

  # Full content of the freshest most-recent-context handoff (if any)
  ANCHOR_CONTENT=$(curl -s -m 5 \
    "${SUPABASE_URL}/rest/v1/memories?select=content,created_at&metadata=cs.%7B%22tags%22:%5B%22most-recent-context%22%5D%7D&workspace=eq.$WORKSPACE_NAME&order=created_at.desc&limit=1" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null || echo "[]")

  ANCHOR_FOUND=$(echo "$ANCHOR_CONTENT" | python3 -c "
import json, sys
try:
    data = json.loads(sys.stdin.read())
    print('yes' if isinstance(data, list) and data else 'no')
except Exception:
    print('no')
" 2>/dev/null)

  # Fallback: if no tagged anchor, grab the most recent session-type memory
  # for this workspace. Safety net for sessions that ended abnormally
  # (crash / force-quit / context-full before the stop-gate could enforce).
  if [ "$ANCHOR_FOUND" = "no" ]; then
    ANCHOR_CONTENT=$(curl -s -m 5 \
      "${SUPABASE_URL}/rest/v1/memories?select=content,created_at&type=eq.session&workspace=eq.$WORKSPACE_NAME&order=created_at.desc&limit=1" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null || echo "[]")
    ANCHOR_IS_FALLBACK=1
  else
    ANCHOR_IS_FALLBACK=0
  fi

  echo "$ANCHOR_CONTENT" | ANCHOR_IS_FALLBACK="$ANCHOR_IS_FALLBACK" python3 -c "
import json, os, sys
try:
    data = json.loads(sys.stdin.read())
    if isinstance(data, list) and data:
        rec = data[0]
        fallback = os.environ.get('ANCHOR_IS_FALLBACK') == '1'
        print('')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        header = '▸ MOST-RECENT-CONTEXT' if not fallback else '▸ SESSION-MEMORY FALLBACK  (no most-recent-context tag found)'
        print(f'{header}  (written {rec[\"created_at\"][:19]}Z)')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        if fallback:
            print('⚠ Previous session did NOT write a `most-recent-context`-tagged handoff.')
            print('⚠ Showing the most recent session-type memory as a fallback.')
            print('⚠ This may be incomplete — verify with Jano before assuming state.')
            print('')
        print(rec['content'].strip())
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('')
except Exception:
    pass
" 2>/dev/null

  # Last 3 corrections — the rules learned from prior failures
  CORRECTIONS=$(curl -s -m 5 \
    "${SUPABASE_URL}/rest/v1/memories?select=content,created_at&type=eq.correction&workspace=eq.$WORKSPACE_NAME&order=created_at.desc&limit=3" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null || echo "[]")

  echo "$CORRECTIONS" | python3 -c "
import json, sys
try:
    data = json.loads(sys.stdin.read())
    if isinstance(data, list) and data:
        print('▸ RECENT CORRECTIONS (do not repeat)')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        for i, rec in enumerate(data, 1):
            date = rec['created_at'][:10]
            # Strip the 'CORRECTION:' prefix if present. Print in full — the
            # RULE sits at the end of the body and truncation loses the point.
            body = rec['content'].strip()
            if body.startswith('CORRECTION:'):
                body = body[len('CORRECTION:'):].strip()
            print(f'[{i}] {date}')
            print(body)
            print('')
        print('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        print('')
except Exception:
    pass
" 2>/dev/null
fi
