# OUTPUTS — ROUTING PROTOCOL

All non-code outputs from Janus IA sessions go here.
Code goes to GitHub. Everything else goes to outputs/.

## File naming convention
[project]_[description]_V[N]_[YYYY-MM-DD].[ext]
Example: nutria-app_diet-plan-template_V1_2026-04-02.pdf

Version increments within the same day if multiple iterations.
New day resets to V1 (per Jano's version control preference).

## Categories

outputs/documents/[project]/   ← proposals, reports, diet plans, briefs
outputs/research/[project]/    ← market research, competitor analysis
outputs/designs/[project]/     ← mockups, wireframes, visual references
outputs/screenshots/[project]/ ← Playwright test results, visual records

## Auto-routing rules

When Claude produces a file output:
- PDF, DOCX, PPTX, XLSX → outputs/documents/[project]/
- .md research report → outputs/research/[project]/
- .png/.jpg from design work → outputs/designs/[project]/
- .png from Playwright → outputs/screenshots/[project]/

## Version control
Every outputs/ commit tagged: output-[project]-[type]-[date]
Git history is the version history — no duplicate files needed.
To see all versions: git log --oneline -- outputs/[project]/[file]
To restore a version: git checkout [commit] -- outputs/[project]/[file]
