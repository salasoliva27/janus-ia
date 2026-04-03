# SKILLS REGISTRY
## Janus IA | Last updated: 2026-04-03

All skills available across Janus IA projects.
Skills teach Claude how to do something before a task starts.
MCP tools give access to external systems. They compose.

**Verdicts:** GOOD · SITUATIONAL · BAD/AVOID · UNTESTED
**Location:** /mnt/skills/public/ (built-in) or ~/.claude/skills/ (installed)

---

## HOW AGENTS USE THIS FILE

Before starting a task, check this registry:
1. Is there a skill that teaches how to do this well?
2. Is it GOOD and installed?
3. Load it by reading the SKILL.md before starting
4. If not installed: search and install (see TOOLS.md discovery protocol)

---

## INSTALLED AND WORKING

### docx · pdf · pptx · xlsx
**Verdict:** GOOD | /mnt/skills/public/
Document creation — all reliable. Use for any file output task.

### frontend-design
**Verdict:** GOOD | /mnt/skills/public/frontend-design/
277,000+ installs. Prevents generic AI design.
**Rule:** Read before ANY frontend task.

### file-reading · pdf-reading · product-self-knowledge
**Verdict:** GOOD | /mnt/skills/public/

### skill-creator
**Verdict:** GOOD | /mnt/skills/examples/
Use to build new custom skills for Janus IA.

### feature-dev ⚡
**Verdict:** INSTALLED — not yet invoked via /feature-dev
7-phase structured workflow. Most popular Claude Code skill (89k installs).
Located: /home/codespace/.claude/plugins/marketplaces/...

---

## HIGH PRIORITY — NOT YET INSTALLED

### /code-review (official Anthropic)
Free. `claude plugin install code-review`

### review-claudemd
Suggests CLAUDE.md improvements from recent sessions.
`curl -sL https://raw.githubusercontent.com/BehiSecc/awesome-claude-skills/main/review-claudemd/SKILL.md -o ~/.claude/skills/review-claudemd/SKILL.md`

### Task Master AI
Turns PRDs into structured agent-readable task lists.
`npm install -g task-master-ai`

### /batch
Parallel git worktrees for complex builds.
Via Claude Code plugin marketplace.

### gstack (Garry Tan / YC)
6 skills: product thinking + PR automation + browser QA.
github.com/garry-tang/gstack

### owasp-security
Required before any product handles real user data.
OWASP Top 10:2025, ASVS 5.0. github.com/BehiSecc/awesome-claude-skills

### systematic-debugging
Root cause tracing before fix proposals.
github.com/BehiSecc/awesome-claude-skills

### NotebookLM skill
**Alternative to MCP** — Python-based, runs directly in Claude Code.
Use if MCP has auth issues.

### deep-research
Format-controlled research reports with citations.
github.com/daymade/claude-code-skills

### ui-ux-pro-max ⭐ JANO-RECOMMENDED
Multi-domain design reasoning engine. 67 UI styles, 161 palettes, 57 font pairings.
`npm install -g uipro-cli && uipro init --ai claude --global`
Or: `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill`

### GSAP Skills ⭐ JANO-RECOMMENDED (OFFICIAL)
Official GSAP skill from GreenSock — 8 modules.
`npx skills add https://github.com/greensock/gsap-skills`
Or: `/plugin marketplace add greensock/gsap-skills`

---

## REJECTED / AVOID
*(Populate as bad experiences accumulate)*

## SITUATIONAL
*(Populate with nuanced verdicts)*
