# TOOLS REGISTRY
## Venture OS — Central Tool Configuration

All tools are configured once here. Projects declare which tools they need in their own TOOLS.md — they never manage credentials or configurations themselves.

---

## AVAILABLE TOOLS

| Tool | MCP Server | Status | Used for | Projects using it |
|---|---|---|---|---|
| GitHub | github | ✅ Installed | Repo management, code push, auto-create repos | All |
| Gmail | gmail | ✅ Installed (needs GMAIL_CREDENTIALS) | Read client threads, extract project context, send proposals | freelance-system, lool-ai |
| Google Calendar | google-calendar | ✅ Installed (needs GCAL_CREDENTIALS) | Two-way scheduling, conflict detection, project timelines | All |
| Google Drive | google-drive | ✅ Installed (needs GDRIVE_CREDENTIALS) | Client deliverables, large file storage, shared docs | All |
| Brave Search | brave-search | ✅ Installed (needs BRAVE_API_KEY) | Market research, competitor analysis, lead sourcing | All |
| Playwright | playwright | ✅ Installed | Browser automation, screenshot websites for portfolio | freelance-system |
| Filesystem | filesystem | ✅ Installed | Read/write files across /workspaces | All |
| Fetch | fetch | ✅ Installed | HTTP requests, web scraping | All |
| Sequential Thinking | sequential-thinking | ✅ Installed | Multi-step reasoning chains | All |
| Memory (basic) | memory | ✅ Installed | In-session key-value memory | All |
| n8n | n8n | ✅ Installed (needs N8N_API_KEY, N8N_BASE_URL) | Build and deploy automation workflows | freelance-system |
| Cloudflare | cloudflare | ✅ Installed (needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID) | R2 media storage, Workers, KV | lool-ai, campaigns |
| Notion | notion | ✅ Active (via Claude.ai integration) | Documentation, structured notes | Optional |
| Supabase Memory | supabase-memory | ⬜ Planned — cross-workspace semantic memory | Conversation history, learning database, RAG across all projects | All |
| Playwright CLI | CLI — `@playwright/cli` | ✅ Installed globally (`npm i -g @playwright/cli`) | Token-efficient browser automation for agents; better than MCP Playwright for coding agents | freelance-system, lool-ai |
| UI/UX Pro Max | CLI — `uipro-cli` | ✅ Installed globally (`npm i -g uipro-cli`) | 67 UI styles, 161 palettes, 57 font pairings, industry-specific design system generator. Run: `uipro init --ai claude` in any project. Auto-activates on frontend work. | All frontend projects |
| shadcn/ui | Component library — `npx shadcn@latest init` | ✅ Available (init per project) | Copy-own component model built on Radix UI + Tailwind. Run `npx shadcn@latest add [component]` to add individual components. Default choice for any React/Next.js UI. Pairs with uipro-cli for style decisions. | All React/Next.js projects |

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
