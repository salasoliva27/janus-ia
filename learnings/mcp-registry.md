# MCP REGISTRY — CURATED EXPERIENCE LOG
## Venture OS | Last updated: 2026-03-30

The system's accumulated knowledge about MCP tools and skills. Grows automatically — a brief entry after every session where a tool or skill is used, a full assessment after every project completes.

**Verdicts:** GOOD · SITUATIONAL · BAD/AVOID · UNTESTED
**Entry format:** `[DATE] — [PROJECT] — [VERDICT]: [notes]`

---

# SECTION 1: MCP TOOLS

---

## ACTIVELY CONFIGURED

### GitHub MCP
**Verdict:** GOOD | **Install:** Built into `.mcp.json`
- Repo management, auto-commit, push — reliable across all projects
- GITHUB_TOKEN loads correctly from dotfiles
- Session log: used across all projects, no failures
- [2026-03-26] — longevite-therapeutics — GOOD: searched repo, read files, pushed 3 files cleanly

### Brave Search MCP
**Verdict:** GOOD | **Install:** Built into `.mcp.json`
- Mexico/LATAM queries return useful results for market research
- Core tool for validation phase and GTM research
- Session log: lool-ai validation, freelance-system lead search

### Google Workspace MCP
**Verdict:** DISABLED — triggers Chrome OAuth popup every session (redirect_uri_mismatch)
**Install:** `@googleworkspace/cli mcp -s drive,gmail,calendar,sheets,slides,docs,forms,tasks,chat`
**Keys:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- [2026-03-30] — venture-os — BAD (for now): Removed from .mcp.json. Reason: `@alanse/mcp-server-google-workspace` tries to auth on every startup because OAuth tokens aren't persisted between Codespace sessions. This opens Chrome with an OAuth flow that fails (redirect_uri_mismatch — Codespace URL ≠ localhost). Gmail already works via `mcp__claude_ai_Gmail` integration. Re-enable only when: tokens can be persisted in dotfiles OR a service account approach is configured.
- To re-enable: (1) add back to .mcp.json, (2) run auth from local machine (not Codespace), (3) save token JSON to dotfiles for persistence

### Memory MCP (Supabase)
**Verdict:** UNTESTED — needs Supabase setup + setup.sql
**Install:** Custom server at mcp-servers/memory/
**Keys:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Full-text search works without VOYAGE_API_KEY; semantic search optional upgrade

### Playwright MCP
**Verdict:** GOOD | **Install:** Built into `.mcp.json`
- Portfolio screenshots work reliably
- [2026-03-26] — longevite-therapeutics — GOOD: browser_install needed once per environment (npx playwright install chromium first, then use browser_install tool). After that, navigate + screenshot work perfectly.

### Filesystem, Fetch, Sequential Thinking
**Verdict:** GOOD | Built-in, no credentials needed

### n8n MCP
**Verdict:** UNTESTED | **Keys:** `N8N_API_KEY`, `N8N_BASE_URL`

### Cloudflare MCP
**Verdict:** UNTESTED | **Keys:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- Activate when campaigns module goes live

---

## DISCOVERED — HIGH PRIORITY

### Context7
**Verdict:** CONFIGURED — needs real-use test
- [2026-03-26] — venture-os — Added to .mcp.json. Will activate on next session start.
**Install:** `npx -y @upstash/context7-mcp` | **Keys:** None
**Why:** Live version-specific docs before generating code. Add "use context7" to any prompt. 89,000+ installs on related skill. Eliminates outdated API answers.
**Session log:** none yet

### claude-skills-mcp ⚡ NEW
**Verdict:** UNTESTED — HIGH PRIORITY
**Install:** `uvx claude-skills-mcp` | **Keys:** None
**Why:** Semantic search across 40,000+ skills without leaving Claude Code. find_helpful_skills() / read_skill_document() / list_skills(). Solves skill discovery permanently.
**Session log:** none yet

### Supabase MCP (official)
**Verdict:** UNTESTED — HIGH PRIORITY
**Install:** `npx -y @supabase/mcp-server-supabase`
**Keys:** Supabase project URL + service role key
**Why:** Already using Supabase for memory — full MCP adds table management, auth, SQL, edge functions
**Session log:** none yet

### Figma MCP (Official)
**Verdict:** UNTESTED — HIGH PRIORITY for lool-ai frontend
**Install:** Via Figma Dev Mode settings | **Keys:** Figma Dev Mode token
**Why:** Live layer structure for design-to-code on the widget UI
**Session log:** none yet

### Firecrawl
**Verdict:** UNTESTED — HIGH PRIORITY for lool-ai GTM
**Install:** `npx -y firecrawl-mcp` | **Keys:** `FIRECRAWL_API_KEY` (free tier)
**Why:** Web scraping for optical store research — contacts, existing digital presence
**Session log:** none yet

---

## DISCOVERED — RECOMMENDED

### Notion MCP
**Verdict:** UNTESTED — NOTE: Notion tools already appear via claude.ai integration (mcp__claude_ai_Notion)
**Install:** `npx -y @notionhq/notion-mcp-server` | **Keys:** Notion API key
**Search volume:** 23,000/mo (#7 most searched MCP) | **Why:** Docs, project wikis, content planning. May already be functional via existing integration — test first before installing separately.
**Session log:** none yet

### Slack MCP
**Verdict:** UNTESTED
**Install:** Via Slack app directory | **Keys:** Slack bot token
**Search volume:** 17,700/mo (#9 most searched MCP) | **Why:** Team communication — relevant when lool-ai has employees or when coordinating with Longevité clinic
**Session log:** none yet

### Zapier MCP
**Verdict:** UNTESTED
**Install:** Via Zapier MCP beta | **Keys:** Zapier API key
**Search volume:** 10,800/mo | **Why:** 8,000+ app integrations. Overlaps with n8n — evaluate which to standardize on. Zapier = simpler, n8n = more control.
**Session log:** none yet

### Tavily Search
**Verdict:** UNTESTED
**Install:** `npx -y tavily-mcp` | **Keys:** `TAVILY_API_KEY` (free tier)
**Search volume:** 2,900/mo | **Why:** AI-optimized search with structured results + citations. Alternative to Exa. Brave = broad, Exa = semantic, Tavily = structured/cited.
**Session log:** none yet

### Desktop Commander
**Verdict:** UNTESTED
**Install:** Via Claude Desktop | **Keys:** None
**Search volume:** 1,900/mo | **Why:** Full desktop control — terminal, file system, process management. Pairs with computer use.
**Session log:** none yet

### Exa Search
**Verdict:** UNTESTED
**Install:** `npx -y exa-mcp-server` | **Keys:** `EXA_API_KEY` (free tier)
**Why:** Semantic search — finds conceptually similar results, better for nuanced research than Brave
**Session log:** none yet

### Linear MCP
**Verdict:** UNTESTED
**Install:** OAuth via Linear settings
**Why:** Structured task tracking for complex builds
**Session log:** none yet

### Docker MCP
**Verdict:** UNTESTED
**Install:** `npx -y @docker/mcp-server` | **Keys:** None (local Docker)
**Why:** Container management for lool-ai and espacio-bosques deployment
**Session log:** none yet

### Netlify MCP
**Verdict:** UNTESTED
**Install:** OAuth via Netlify
**Why:** Deploy sites, manage functions and domains from Claude
**Session log:** none yet

### Apify Actors
**Verdict:** UNTESTED
**Install:** `npx -y @apify/mcp-server` | **Keys:** Apify API key (free tier)
**Why:** 4,000+ scrapers — Instagram, LinkedIn, Google Maps for GTM research
**Session log:** none yet

---

## DISCOVERED — ADD WHEN READY

### Stripe MCP
**Verdict:** UNTESTED — add when lool-ai has first paying customer
**Install:** Via Stripe agent toolkit | **Keys:** Stripe API key
**Session log:** none yet

### Sentry MCP
**Verdict:** UNTESTED — add when lool-ai goes live
**Install:** OAuth via `mcp.sentry.dev/mcp`
**Session log:** none yet

### Human MCP
**Verdict:** UNTESTED — campaigns module
**Install:** `npx -y human-mcp`
**Keys:** Google Gemini API, MiniMax API, ElevenLabs API
**Why:** Image gen, video gen, music, SFX, TTS — 29 tools in one
**Session log:** none yet

### Ayrshare MCP
**Verdict:** UNTESTED — campaigns module
**Install:** `npx -y ayrshare-mcp` | **Keys:** Ayrshare API (~$29/month)
**Why:** Post to 13+ social platforms from Claude
**Session log:** none yet

### Cowork Computer Use ⚡ RELEASED MARCH 24 2026
**Verdict:** UNTESTED
**Install:** Claude Desktop → Settings → Enable computer use (Pro/Max, Mac only, research preview)
**Why:** Claude controls your Mac — open files, browsers, forms. Pairs with Dispatch for phone-to-desktop task assignment.
**Session log:** none yet

---

## JANO-RECOMMENDED (MCP TOOLS)
*Tools Jano has personally sourced and wants in the system. Added on instruction, not discovery.*

### Remotion (video generation framework)
**Verdict:** UNTESTED — HIGH PRIORITY
**Type:** Build tool (npm package, not an MCP server)
**Install:** `npm create video@latest` (new project) or `npm install remotion @remotion/bundler @remotion/renderer` (existing)
**Cloud rendering:** `npm install @remotion/lambda` + AWS credentials (placeholders added to dotfiles 2026-04-01)
**Keys:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` — placeholders in dotfiles, need real AWS IAM keys
**Why:** React → MP4 at $0.01/render-minute. Proven: Submagic ($1M ARR in 3 months), Crayo ($6M ARR), 10+ companies hitting $1M+ on Remotion. Claude can generate Remotion code from natural language.
**Use cases in portfolio:** longevite therapy reels, espacio-bosques project update videos, lool-ai store demo videos, freelance-system new service type
**[2026-04-01] — venture-os — REGISTERED:** Added to TOOLS.md + AWS placeholders to dotfiles. Not yet used in any project build.

---

## REJECTED / AVOID (MCP TOOLS)
*(Empty — will populate as bad experiences accumulate)*

## SITUATIONAL (MCP TOOLS)
*(Empty — will populate with nuanced verdicts)*

---

# SECTION 2: SKILLS

---

## INSTALLED AND WORKING

### docx, pdf, pptx, xlsx
**Verdict:** GOOD | **Location:** /mnt/skills/public/
**Session log:** Used throughout — reliable on all document creation tasks

### frontend-design
**Verdict:** GOOD | **Location:** /mnt/skills/public/frontend-design/
**Notes:** 277,000+ installs. Breaks generic AI design. Use on every frontend task.
**Session log:** Improved lool-ai widget UI

### file-reading, pdf-reading, product-self-knowledge
**Verdict:** GOOD | **Location:** /mnt/skills/public/

### skill-creator
**Verdict:** GOOD | **Location:** /mnt/skills/examples/

---

## JANO-RECOMMENDED (SKILLS)
*Tools Jano has personally sourced and wants in the system. Added on instruction, not discovery.*

### GSAP Skills ⭐ JANO-RECOMMENDED (OFFICIAL)
**Verdict:** UNTESTED — HIGH PRIORITY for any animation work
**Repo:** github.com/greensock/gsap-skills | **Official:** GreenSock (GSAP authors)
**Install (npx):** `npx skills add https://github.com/greensock/gsap-skills`
**Or via marketplace:** `/plugin marketplace add greensock/gsap-skills`
**Keys:** None
**Why:** Official GSAP skill from GreenSock — 8 modules: gsap-core, gsap-timeline, gsap-scrolltrigger, gsap-plugins, gsap-utils, gsap-react, gsap-performance, gsap-frameworks. Prevents incorrect syntax, ensures proper plugin registration and cleanup. Works across 40+ AI agents. Essential for any project using GSAP animations (Longevité, lool-ai widget UI, landing pages).
**Session log:** none yet

### ui-ux-pro-max ⭐ JANO-RECOMMENDED
**Verdict:** UNTESTED — HIGH PRIORITY
**Repo:** github.com/nextlevelbuilder/ui-ux-pro-max-skill | **Website:** uupm.cc
**Install (global):** `npm install -g uipro-cli && uipro init --ai claude --global`
**Or via marketplace:** `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`
**Keys:** None (Python 3.x required)
**Why:** Multi-domain design reasoning engine. Analyzes request against 161 industry categories, runs 5 parallel design searches (style, color, typography, layout pattern, landing page), returns complete design system with anti-patterns. 67 UI styles, 161 palettes, 57 font pairings. Auto-activates on any UI request. Replaces frontend-design for any serious product UI work.
**Use `--persist` flag** to save design system to disk across sessions.
**Session log:** none yet

---

## DISCOVERED — HIGH PRIORITY (SKILLS)

### feature-dev ⚡ 89,000 INSTALLS
**Verdict:** INSTALLED — not yet invoked via /feature-dev
**Install:** Already in /home/codespace/.claude/plugins/marketplaces/claude-plugins-official/plugins/feature-dev/
**Why:** 7-phase structured workflow — discovery, exploration, clarifying Qs, architecture design, implementation, quality review, summary. Commands: /feature-dev, agents: code-explorer, code-architect, code-reviewer.
**Session log:** [2026-03-26] — confirmed installed, /feature-dev command available

### Antigravity Awesome Skills ⭐ 22,000 STARS
**Verdict:** UNTESTED — HIGH PRIORITY
**Install:** `npx antigravity-awesome-skills --claude`
**Stars:** 22,034 | **Skills count:** 1,234+
**Why:** Largest open-source skills pack. Works across Claude Code, Cursor, Gemini CLI, Codex, 8+ agents. Single install command adds 1,234 skills. Check what's inside before relying on it — quality varies at scale.
**Session log:** none yet

### landing-page-guide
**Verdict:** UNTESTED — HIGH PRIORITY for GTM
**Install:** Via awesome-claude-skills repos (openaitoolshub.org list)
**Why:** High-converting landing page structure with CRO principles baked in. Relevant for every project GTM phase.
**Session log:** none yet

### brainstorming
**Verdict:** UNTESTED
**Install:** Via awesome-claude-skills repos
**Why:** Structured ideation — generates constraints, edge cases, alternative approaches before coding. Good for intake and validation phases.
**Session log:** none yet

### deploy-checklist
**Verdict:** UNTESTED
**Install:** Via awesome-claude-skills repos
**Why:** Pre-deployment validation — env vars, rollback plans, smoke tests. Use before every lool-ai or Longevité deploy.
**Session log:** none yet

### test-harness
**Verdict:** UNTESTED
**Install:** Via awesome-claude-skills repos
**Why:** Generates unit, integration, and E2E test suites automatically. Needed when lool-ai reaches production.
**Session log:** none yet

### Excalidraw Diagram Generator
**Verdict:** UNTESTED
**Install:** `npx skills add https://github.com/coleam00/excalidraw-diagram-skill --skill excalidraw-diagram`
**Why:** Architecture diagrams from natural language. Useful for documenting lool-ai system design and explaining to stakeholders.
**Session log:** none yet

### /code-review (official Anthropic)
**Verdict:** UNTESTED
**Install:** `claude plugin install code-review` (free, official)
**Why:** Official code review plugin, no extra cost
**Session log:** none yet

### review-claudemd
**Verdict:** UNTESTED — core of learning loop
**Install:** `curl -sL https://raw.githubusercontent.com/BehiSecc/awesome-claude-skills/main/review-claudemd/SKILL.md -o ~/.claude/skills/review-claudemd/SKILL.md`
**Why:** Reviews recent conversations and suggests CLAUDE.md improvements
**Session log:** none yet

### Task Master AI
**Verdict:** UNTESTED
**Install:** `npm install -g task-master-ai`
**Why:** Turns PRDs into structured task lists agents can mark complete. Good for lool-ai and espacio-bosques.
**Session log:** none yet

### /batch
**Verdict:** UNTESTED
**Install:** Via Claude Code plugin marketplace
**Why:** Decomposes work into parallel git worktrees, creates PRs automatically. Key for complex builds.
**Session log:** none yet

### gstack (Garry Tan / Y Combinator)
**Verdict:** UNTESTED
**Install:** github.com/garry-tang/gstack
**Why:** 6 skills — CEO-level product thinking, automated PR shipping, browser QA
**Session log:** none yet

---

## DISCOVERED — RECOMMENDED (SKILLS)

### owasp-security
**Verdict:** UNTESTED — required before lool-ai handles real user data
**Install:** github.com/BehiSecc/awesome-claude-skills
**Why:** OWASP Top 10:2025, ASVS 5.0, code review checklists for 20+ languages. Required for LFPDPPP compliance.
**Session log:** none yet

### systematic-debugging
**Verdict:** UNTESTED
**Install:** github.com/BehiSecc/awesome-claude-skills
**Why:** Root cause tracing before fix proposals
**Session log:** none yet

### deep-research
**Verdict:** UNTESTED
**Install:** github.com/daymade/claude-code-skills
**Why:** Format-controlled research reports with citations
**Session log:** none yet

### continue-claude-work
**Verdict:** UNTESTED
**Install:** github.com/daymade/claude-code-skills
**Why:** Intelligently resumes from previous sessions — reads compaction summaries, recovers subagent state
**Session log:** none yet

### Magic UI MCP
**Verdict:** UNTESTED
**Install:** `npx -y magic-ui-mcp` (verify current package name)
**Why:** React+Tailwind component library — say "add a marquee" → get production JSX
**Session log:** none yet

---

## REJECTED / AVOID (SKILLS)
*(Empty — will populate)*

## SITUATIONAL (SKILLS)
*(Empty — will populate)*

---

# SECTION 3: PROJECT COMPLETION ASSESSMENTS

*(Empty — will populate after first project completes)*

Format:
```
### [Project] — completed [date]
MCP tools used: [list with verdicts]
Skills used: [list with verdicts]
Registry updates made: [list]
Full assessment: [what worked, what didn't, what to try next time]
```
