# TOOLS REGISTRY
## Venture OS — Central Tool Configuration

All tools are configured once here. Projects declare which tools they need in their own TOOLS.md — they never manage credentials or configurations themselves.

---

## AVAILABLE TOOLS

| Tool | MCP Server | Used for | Projects using it |
|---|---|---|---|
| GitHub | github | Repo management, code push, auto-create repos | All |
| Gmail | gmail | Read client threads, extract project context, send proposals (Lane A) | freelance-system, lool-ai |
| Google Calendar | google-calendar | Two-way scheduling, conflict detection, project timelines | All |
| Google Drive | google-drive | Client deliverables, large file storage, shared docs | All |
| Brave Search | brave-search | Market research, competitor analysis, lead sourcing | All |
| Playwright | playwright | Auto-screenshot websites for portfolio | freelance-system |
| n8n | n8n | Build and deploy automation workflows | freelance-system |
| Cloudflare R2 | cloudflare-r2 | Campaign media storage (images, video) | lool-ai, campaigns |
| Notion | notion | Documentation, structured notes | Optional |

---

## STORAGE ROUTING RULES

Apply these automatically — never ask Jano where to store something:

```
Code, markdown, CSV, configs → GitHub (project repo)
Research docs, proposals → GitHub (project repo /validation or /gtm)
Client deliverables, PDFs, shared docs → Google Drive /VentureOS/[project]/
Campaign images, AI-generated media → R2 venture-os-media/[project]/
Large video files → Google Drive /VentureOS/[project]/media/
```

---

## GOOGLE CALENDAR RULES

- Jano's constraint: **available after 3pm weekdays, weekends flexible**
- Never schedule deep work before 3pm on weekdays
- Buffer 30 minutes between project context switches
- Sync project milestones as calendar events
- Flag when a project's estimated timeline doesn't fit available hours

---

## GMAIL CONTEXT EXTRACTION

When a project needs client communication context:
1. Search Gmail for threads related to that project or contact
2. Extract: last message date, current status, any commitments made, next expected action
3. Update the project's GTM tracker with this information
4. Flag any threads that need a response from Jano

---

## ADDING NEW TOOLS

When a new tool is needed:
1. Add it to this file with server URL, use case, and which projects need it
2. Add to .mcp.json
3. Update any project TOOLS.md files that should use it
4. Log in CHANGELOG.md
