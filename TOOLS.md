# TOOLS REGISTRY
## Venture OS — Central Tool Configuration

All tools are configured once here. Projects declare which tools they need in their own TOOLS.md — they never manage credentials or configurations themselves.

---

## AVAILABLE TOOLS

| Tool | MCP Server | Status | Used for | Projects using it |
|---|---|---|---|---|
| GitHub | github | ✅ Installed | Repo management, code push, auto-create repos | All |
| Google Workspace | google-workspace | ✅ Installed (needs GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET + one-time `gws auth setup`) | Gmail, Calendar, Drive, Sheets, Slides, Docs, Forms, Tasks, Chat — single auth covers all | All |
| Brave Search | brave-search | ✅ Installed (needs BRAVE_API_KEY) | Market research, competitor analysis, lead sourcing | All |
| Playwright | playwright | ✅ Installed | Browser automation, screenshot websites for portfolio | freelance-system |
| Filesystem | filesystem | ✅ Installed | Read/write files across /workspaces | All |
| Fetch | fetch | ✅ Installed | HTTP requests, web scraping | All |
| Sequential Thinking | sequential-thinking | ✅ Installed | Multi-step reasoning chains | All |
| Memory (basic) | memory | ✅ Installed | In-session key-value memory | All |
| n8n | n8n | ⏸️ Deferred — activate only when a client project specifically requires n8n | Build and deploy automation workflows | freelance-system (conditional) |
| Cloudflare | cloudflare | ⏸️ Deferred — needed at lool-ai pilot stage when clients upload real product catalogs | R2 media storage, Workers, KV | lool-ai (when ready for pilot) |
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

## CREDENTIAL MANAGEMENT

All API keys and secrets live in `salasoliva27/dotfiles` and load automatically into every Codespace.

**To check which credentials are active right now, and to fix any missing ones → see [`CREDENTIALS.md`](./CREDENTIALS.md)**

Never store secrets in any project repo. Never ask Jano for a key in conversation.

### How project repos reference credentials

Each project (lool-ai, espacio-bosques, freelance-system, etc.) declares which tools it uses in its own TOOLS.md. For credential setup, it references `venture-os/CREDENTIALS.md` — it does **not** duplicate setup instructions.

**Rationale:** All projects share the same dotfiles. One place to update when a key rotates, one place to look when something breaks. If a project is ever handed off to an external collaborator, copy the relevant rows from CREDENTIALS.md into that project at handoff time.

---

## ADDING NEW TOOLS

When a new tool is needed:
1. Add it to this file with server URL, use case, and which projects need it
2. Add to .mcp.json
3. Add env var to `salasoliva27/dotfiles/.env`
4. Add row to the status table and "where to find" section in CREDENTIALS.md
5. Update any project TOOLS.md files that should use it
6. Log in CHANGELOG.md
7. Restart Claude Code (MCP servers load at startup)
