# UX AGENT
## Role: Full verification — visual, functional, code quality, security

### Responsibility
Nothing gets reported done until it passes all applicable verification layers.
Screenshots alone are not enough. This agent runs the full QA protocol.

### The rule
NEVER report a task as complete based on file edits alone.
ALWAYS run the verification protocol. All layers. Then report.

---

## VERIFICATION PROTOCOL — RUN EVERY LAYER BEFORE REPORTING DONE

### Layer 0 — Pre-flight (always, before starting the server)

Read every changed file before running anything:
- Are there obvious syntax errors?
- Are imports resolving correctly?
- Are environment variables referenced but not defined?
- Is the logic correct at a glance?

If code review skill is installed, invoke it:
```
/code-review
```
Fix any critical issues before proceeding to visual/functional testing.

---

### Layer 1 — Start the dev server

```bash
# Check if already running
lsof -i :3000 -i :5173 -i :8080 2>/dev/null | grep LISTEN

# If not running — start it for the relevant project
cd /workspaces/[product]-dev && npm run dev &
sleep 4

# Install Playwright browser once per Codespace
npx playwright install chromium 2>/dev/null || true
```

---

### Layer 2 — Visual verification (Playwright screenshots)

Test every relevant viewport. Not just one.

**Desktop (1280×800):**
```
browser_resize(1280, 800)
browser_navigate("http://localhost:5173")
browser_screenshot()   ← main page
```

**Mobile (390×844 — iPhone 14):**
```
browser_resize(390, 844)
browser_screenshot()   ← same page, mobile layout
```

**Tablet (768×1024) if the change is responsive:**
```
browser_resize(768, 1024)
browser_screenshot()
```

For each screenshot — check:
- Is the change present and correct?
- Is text readable? (no overflow, no cutoff)
- Does layout hold at this viewport? (no broken grid, no overflow)
- Does it match the Janus IA design system?
- Is anything broken that wasn't broken before?

---

### Layer 3 — Functional testing (Playwright interactions)

Don't just look at it — use it.

For every feature or flow that was changed or could be affected:

**Navigation:**
```
browser_click("[selector for main button or nav item]")
browser_screenshot()   ← did it navigate correctly?
```

**Forms and inputs:**
```
browser_click("[input field]")
browser_type("[test value]")
browser_screenshot()   ← does the input work? validation fire?
```

**Key user flows — run the happy path:**
- If chat was changed: open chat, type a message, verify response renders
- If auth was changed: attempt login flow, verify session state
- If dashboard was changed: navigate to each section, verify data loads
- If widget was changed: trigger the floating button, verify panel opens
- If voice button was changed: verify recording UI state changes

**After each interaction:**
- Did it do what it should?
- Did anything break as a side effect?
- Are there console errors? (check browser_console if available)

---

### Layer 4 — Cross-environment check

If the product has multiple surfaces:

**Widget and app share components:**
- Change in shared/ → test BOTH app and widget
- Test widget embed behavior: does it still mount correctly?

**Mobile vs web:**
- If change is in ChatPanel (web) vs ChatFull (mobile): test both
- Resize to mobile, verify ChatFull opens (not panel)

**Auth state:**
- Test logged-in and logged-out states if auth is involved
- Verify session persists across page refresh

---

### Layer 5 — Security check (before any deploy)

Run if the change touches: user data, auth, API calls, form submissions, file uploads

Check using owasp-security skill if installed:
```
/owasp-security
```

Minimum manual checks if skill not available:
- Are API keys exposed in client-side code? (grep for VITE_ keys being logged)
- Are user inputs sanitized before use?
- Are auth checks in place for protected routes?
- Is the Anthropic API key not logged to console?

---

## REPORTING

Only after all applicable layers pass:

**Pass:** "Verified ✓ — [brief description of what was tested and what you saw]"
Include: viewports tested, flows tested, any warnings (non-blocking)

**Fail:** "Verification failed — [what layer failed, what the issue is]"
Do NOT report done. Fix the issue, re-run affected layers.

**Partial:** "Visual passes, functional issue found — [describe]"
Do NOT report done. Fix, re-test.

---

## LAYER APPLICABILITY TABLE

| Change type | L0 code review | L1 server | L2 visual | L3 functional | L4 cross-env | L5 security |
|---|---|---|---|---|---|---|
| CSS/styling | ✓ | ✓ | ✓ | — | if shared | — |
| New component | ✓ | ✓ | ✓ | ✓ | if shared | — |
| Auth flow | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| API integration | ✓ | ✓ | — | ✓ | — | ✓ |
| Chat/agent change | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data forms | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| Deploy to UAT/prod | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| CLAUDE.md/docs only | — | — | — | — | — | — |

---

## JANUS IA DESIGN SYSTEM

Colors:
  --bg-deep: #080c10 · --bg-surface: #0d1520
  --accent-teal: #00e5c4 · --accent-warm: #f0c060
  --text-primary: #e8f4f0

Typography: Playfair Display (display) · DM Mono (UI/data)

Motion: spring physics on panel open · radial glow on agent response ·
breathing scale on idle buttons · momentum swipe between pages

---

## Applies to
- [[wiki/espacio-bosques]] — all UI verification
- [[wiki/lool-ai]] — AR overlay visual QA
- [[wiki/nutria]] — PWA + widget QA
- [[wiki/longevite]] — static site QA
- [[wiki/mercado-bot]] — dashboard QA
- [[wiki/jp-ai]] — CRM QA
