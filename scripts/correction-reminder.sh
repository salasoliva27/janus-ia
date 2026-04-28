#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# JANUS IA — CORRECTION REMINDER (UserPromptSubmit hook)
#
# Two-tier enforcement (per audit 2026-04-28):
#   - STRONG match  →  writes a flag file → PreToolUse hook BLOCKS
#                      every tool except capture_correction / remember
#                      until the flag is cleared. This is real, mechanical
#                      enforcement — the only style that's been shown to
#                      change behavior in this repo.
#   - Soft  match   →  emits the previous non-blocking reminder.
#
# The audit found 0/19 redirects in one session were captured despite
# the previous (reminder-only) hook firing. Reminders don't work; only
# blocks do (proven by session-stop-gate's median-4 memory count).
#
# Flag auto-expires after CORRECTION_FLAG_TTL seconds so a false-positive
# strong match doesn't deadlock the session.
# ═══════════════════════════════════════════════════════════════

set -uo pipefail

INPUT=$(cat)

PROMPT=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get('prompt', '') or d.get('user_message', ''))
except Exception:
    print('')
" 2>/dev/null)

[ -z "$PROMPT" ] && exit 0

SESSION_ID=$(echo "$INPUT" | python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    print(d.get('session_id', '') or d.get('sessionId', ''))
except Exception:
    print('')
" 2>/dev/null)

LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# Soft redirect (high false-positive risk; non-blocking reminder)
PATTERNS='(^|[[:space:],.!?])(no|don'"'"'t|do not|not that|stop|wrong|actually|instead|nope|don'"'"'t do)($|[[:space:],.!?])'
PATTERNS_ES='(^|[[:space:],.!?])(no|para|detente|mal|incorrecto|en realidad|en vez|mejor no)($|[[:space:],.!?])'

# Strong redirect (very high confidence; BLOCKING)
STRONG='(that'"'"'s not|that is not|you'"'"'re wrong|you are wrong|don'"'"'t do that|no hagas|no no|redirect|i didn'"'"'t ask|i did not ask|eso no|así no|asi no|mal enfoque|wrong approach|stop doing|deja de|por qué hiciste|why did you do|that was wrong)'

STRONG_HIT=0
SOFT_HIT=0
if echo "$LOWER" | grep -qE "$STRONG"; then
  STRONG_HIT=1
elif echo "$LOWER" | grep -qE "$PATTERNS" || echo "$LOWER" | grep -qE "$PATTERNS_ES"; then
  SOFT_HIT=1
fi

if [ "$STRONG_HIT" -eq 1 ] && [ -n "$SESSION_ID" ]; then
  # Write blocking flag. PreToolUse hook reads this and denies tools
  # other than capture_correction / remember until cleared.
  FLAG="/tmp/janus-correction-pending-${SESSION_ID}"
  # Strip newlines from prompt to keep flag single-line; truncate at 500 chars.
  PROMPT_ONELINE=$(echo "$PROMPT" | tr '\n' ' ' | cut -c 1-500)
  printf '%s\t%s\n' "$(date +%s)" "$PROMPT_ONELINE" > "$FLAG"

  cat <<'EOF'
▸ CORRECTION-CAPTURE REQUIRED — BLOCKING

This prompt contains a high-confidence redirect signal ("you're wrong",
"don't do that", "no no", "redirect", etc). Per the 2026-04-28 audit,
correction capture rate was 0/19 with reminder-only enforcement; this
hook now BLOCKS other tool calls until you record the correction.

REQUIRED — your next tool call MUST be one of:
  • mcp__memory__capture_correction(original=..., correction=..., context=..., workspace="janus-ia", project=<current>)
  • mcp__memory__remember(type="correction", ...)

After that call succeeds, the flag clears automatically and you can
continue normally.

If this is a FALSE POSITIVE (the prompt sounded like a redirect but
isn't actually correcting your behavior), just call:
  mcp__memory__remember(type="learning", content="STRONG correction-pattern false positive: <user prompt snippet>", tags=["false-positive", "correction-hook-tuning"])
That clears the flag AND tunes the hook over time.

The flag auto-expires after 10 minutes if no tool runs.
EOF
  exit 0
fi

if [ "$SOFT_HIT" -eq 1 ]; then
  cat <<'EOF'
▸ CORRECTION-REMINDER (soft signal — not blocking)

This prompt contains a soft redirect pattern. If it IS a correction:
  1. Call mcp__memory__capture_correction(original, correction, context, workspace="janus-ia", project=<current>) FIRST
  2. Then address the actual ask

If it's a false positive (the word triggered the pattern but you're
not being corrected), proceed normally. The strong-match hook will
block automatically when the signal is unambiguous.
EOF
fi
