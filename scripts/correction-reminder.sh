#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# JANUS IA — CORRECTION REMINDER (UserPromptSubmit hook)
# Scans the incoming user prompt for redirect patterns (no/don't/
# stop/wrong/actually). When matched, injects a non-blocking
# reminder that Claude MUST call mcp__janus-memory__capture_correction
# BEFORE addressing the correction in code.
#
# NON-BLOCKING. The model still decides. The goal is to make the
# "write correction before fix" rule fire mechanically.
#
# Diagnostic 2026-04-20 found 4 corrections captured across 61
# memories (6.5%). CLAUDE.md calls this rule non-negotiable but
# prompt-only enforcement wasn't cutting through.
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

# shellcheck disable=SC1091
. "$(dirname "$0")/_parse_prompt.sh"

PROMPT=$(parse_prompt)

[ -z "$PROMPT" ] && exit 0

LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Redirect patterns — bilingual ES/EN. Word-boundary anchored to avoid
# false positives (e.g. "nothing" shouldn't hit "no").
# English
PATTERNS='(^|[[:space:],.!?])(no|don'"'"'t|do not|not that|stop|wrong|actually|instead|nope|don'"'"'t do)($|[[:space:],.!?])'
# Spanish
PATTERNS_ES='(^|[[:space:],.!?])(no|para|detente|mal|incorrecto|en realidad|en vez|mejor no)($|[[:space:],.!?])'
# Strong signals (always fire)
STRONG='(that'"'"'s not|that is not|you'"'"'re wrong|you are wrong|don'"'"'t do that|no hagas|no no|redirect|i didn'"'"'t ask|i did not ask|eso no|así no|mal enfoque|wrong approach)'

MATCH=0
if echo "$LOWER" | grep -qE "$STRONG"; then
  MATCH=1
elif echo "$LOWER" | grep -qE "$PATTERNS"; then
  MATCH=1
elif echo "$LOWER" | grep -qE "$PATTERNS_ES"; then
  MATCH=1
fi

[ $MATCH -eq 0 ] && exit 0

# Detect memory system: if Supabase env is missing, we're on the file-based
# setup (Windows / no janus-memory MCP). Swap the advice accordingly.
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  cat <<'EOF'
▸ CORRECTION-REMINDER: this prompt contains a redirect pattern. Per CLAUDE.md evolution rule #4: write the correction BEFORE the fix.

Before editing any code or responding to the correction itself:
  1. Call mcp__janus-memory__capture_correction(original, correction, context, workspace="janus-ia", project=<current>)
  2. Then address what the user asked

Diagnostic 2026-04-20: only 4/61 memories are corrections (6.5%). This rule was documented but not enforced. The capture is what tunes future sessions.

False positive? If this prompt is not actually a correction (just a word that triggered the pattern), skip the capture and proceed normally. Non-blocking.
EOF
else
  # Figure out the memory dir so the instruction is copy-pasteable
  SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
  WORKSPACE="${WORKSPACE_ROOT:-$SCRIPT_DIR}"
  CLAUDE_PROJECT_DIR="$(echo "$WORKSPACE" | sed 's|[/:]|-|g')"
  MEMORY_DIR="$HOME/.claude/projects/$CLAUDE_PROJECT_DIR/memory"
  cat <<EOF
▸ CORRECTION-REMINDER: this prompt contains a redirect pattern. Per CLAUDE.md evolution rule #4: write the correction BEFORE the fix.

The janus-memory MCP is NOT available on this machine. Use file-based capture:
  1. Write tool → \`$MEMORY_DIR/correction_<slug>.md\` with frontmatter:
       ---
       name: <short name>
       description: <one-line trigger — so future-you decides relevance>
       type: correction
       ---
       **Original**: what I did / was about to do
       **Correction**: what Jano said
       **Why**: why this matters for future sessions
       **How to apply**: when/where this rule kicks in
  2. Append a one-line pointer to \`$MEMORY_DIR/MEMORY.md\`:
       - [<name>](correction_<slug>.md) — <hook>
  3. THEN address what the user asked

Rule (CLAUDE.md evolution #4): write the correction BEFORE the fix — not after. If you code first and memory-capture last, the capture gets skipped and you repeat the mistake next session.

False positive? If this prompt is not actually a correction, skip and proceed normally. Non-blocking.
EOF
fi
