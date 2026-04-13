# CREDENTIALS & TOOL ACCESS CHECK
## Janus IA — Central Credential Registry
### Last updated: 2026-03-25

---

## HOW THIS WORKS

All secrets live in Jano's private dotfiles repo (`salasoliva27/dotfiles`), loaded as environment variables into every Codespace automatically.

**Never store secrets in any project repo.** Never ask Jano for a key in a conversation.

When a project (lool-ai, freelance-system, espacio-bosques, etc.) needs a tool credential:
- Its own TOOLS.md declares which tools it uses
- It references this file (`janus/CREDENTIALS.md`) for setup procedure
- It does NOT manage credentials itself

If a project is ever handed off to someone outside the portfolio, copy the relevant rows from this file into that project's own CREDENTIALS.md at handoff time.

---

## RUN A LIVE CHECK

Paste this in any Codespace terminal to see which keys are loaded right now:

```bash
echo "=== ANTHROPIC ===" && \
  [ -n "$ANTHROPIC_API_KEY" ] && echo "✅ ANTHROPIC_API_KEY" || echo "❌ ANTHROPIC_API_KEY MISSING" && \
echo "=== GITHUB ===" && \
  [ -n "$GITHUB_TOKEN" ] && echo "✅ GITHUB_TOKEN" || echo "❌ GITHUB_TOKEN MISSING" && \
echo "=== BRAVE ===" && \
  [ -n "$BRAVE_API_KEY" ] && echo "✅ BRAVE_API_KEY" || echo "❌ BRAVE_API_KEY MISSING" && \
echo "=== SUPABASE ===" && \
  [ -n "$SUPABASE_URL" ] && echo "✅ SUPABASE_URL" || echo "❌ SUPABASE_URL MISSING" && \
  [ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && echo "✅ SUPABASE_SERVICE_ROLE_KEY" || echo "❌ SUPABASE_SERVICE_ROLE_KEY MISSING" && \
echo "=== GOOGLE WORKSPACE MCP ===" && \
  [ -n "$GOOGLE_CLIENT_ID" ] && echo "✅ GOOGLE_CLIENT_ID" || echo "❌ GOOGLE_CLIENT_ID MISSING" && \
  [ -n "$GOOGLE_CLIENT_SECRET" ] && echo "✅ GOOGLE_CLIENT_SECRET" || echo "❌ GOOGLE_CLIENT_SECRET MISSING" && \
  [ -f "/home/codespace/.config/google-workspace/tokens.json" ] && echo "✅ OAuth tokens file present" || echo "⚠️  OAuth tokens not yet generated — run: npx @alanse/mcp-server-google-workspace auth" && \
echo "=== N8N ===" && \
  [ -n "$N8N_API_KEY" ] && echo "✅ N8N_API_KEY" || echo "❌ N8N_API_KEY MISSING" && \
  [ -n "$N8N_BASE_URL" ] && echo "✅ N8N_BASE_URL" || echo "❌ N8N_BASE_URL MISSING" && \
echo "=== CLOUDFLARE ===" && \
  [ -n "$CLOUDFLARE_API_TOKEN" ] && echo "✅ CLOUDFLARE_API_TOKEN" || echo "❌ CLOUDFLARE_API_TOKEN MISSING" && \
  [ -n "$CLOUDFLARE_ACCOUNT_ID" ] && echo "✅ CLOUDFLARE_ACCOUNT_ID" || echo "❌ CLOUDFLARE_ACCOUNT_ID MISSING" && \
echo "=== VOYAGE AI (memory embeddings) ===" && \
  [ -n "$VOYAGE_API_KEY" ] && echo "✅ VOYAGE_API_KEY" || echo "❌ VOYAGE_API_KEY MISSING"
```

---

## CURRENT STATUS (as of 2026-03-25)

| Env var | Status | MCP server / tool it unlocks |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Present | Claude API, memory embeddings fallback |
| `GITHUB_TOKEN` | ✅ Present (Codespace-scoped) | GitHub MCP — push only to `janus`; **replace with PAT to unlock all repos** (see below) |
| `BRAVE_API_KEY` | ✅ Present | Brave Search MCP |
| `SUPABASE_URL` | ✅ Present | Cross-workspace memory MCP |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Present | Cross-workspace memory MCP |
| `VOYAGE_API_KEY` | ✅ Present | Memory MCP — high-quality embeddings |
| `GCAL_CREDENTIALS` | ✅ Present (raw JSON) | Not consumed directly by MCP |
| `GMAIL_CREDENTIALS` | ✅ Present (raw JSON) | Not consumed directly by MCP |
| `GDRIVE_CREDENTIALS` | ✅ Present (raw JSON) | Not consumed directly by MCP |
| `GOOGLE_CLIENT_ID` | ⚠️ In dotfiles, not loaded yet | Google Workspace MCP — needs Codespace rebuild to load |
| `GOOGLE_CLIENT_SECRET` | ⚠️ In dotfiles, not loaded yet | Google Workspace MCP — needs Codespace rebuild to load |
| `N8N_API_KEY` | ⏸️ Deferred | n8n MCP — activate only when a client project requires it |
| `N8N_BASE_URL` | ⏸️ Deferred | n8n MCP |
| `CLOUDFLARE_API_TOKEN` | ⏸️ Deferred | Cloudflare MCP — needed at lool-ai pilot stage for client catalog images |
| `CLOUDFLARE_ACCOUNT_ID` | ⏸️ Deferred | Cloudflare MCP |

---

## FIXING MISSING CREDENTIALS

All changes go into `salasoliva27/dotfiles/.env`. They auto-load into all future Codespaces. For the current session, also run `export VAR=value` in terminal after editing.

---

### 1. GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET

**Both vars are already in dotfiles.** They just haven't loaded into the current Codespace session because the Codespace was created before they were added.

**To load them now without rebuilding** (run in terminal):
```bash
source /workspaces/.codespaces/.persistedshare/dotfiles/.env
```
Or rebuild this Codespace (Codespaces → Rebuild) — they'll auto-load on next start.

**To verify once loaded:**
```bash
echo $GOOGLE_CLIENT_ID && echo $GOOGLE_CLIENT_SECRET
```

**Then, one-time OAuth flow** (run once per Codespace machine):
```bash
npx @alanse/mcp-server-google-workspace -s user auth
```
This opens a browser, you approve access, tokens are saved to `/home/codespace/.config/google-workspace/`. After this, the MCP server can access Gmail, Calendar, Drive, Sheets, Docs, Slides, Forms, Tasks, and Chat — all from a single auth.

**What this unlocks:**
- Read/send Gmail, search threads, create drafts
- Create, update, delete Calendar events; detect schedule conflicts
- Read/write/upload Google Drive files
- Create and edit Google Sheets (financial trackers, lead lists)
- Create Google Docs (proposals, briefs)
- Create Google Slides (pitch decks, presentations)
- Google Forms (intake forms, surveys)
- Google Tasks (to-do lists synced to Calendar)
- Google Chat (team messaging)

**Where to find / regenerate if needed:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select project `test-api-383319`
3. APIs & Services → Credentials → your OAuth 2.0 Client ID
4. The client ID and secret are shown there

---

### 2. N8N_API_KEY + N8N_BASE_URL

**What n8n unlocks from Claude Code:**
- Create, read, update, delete workflows
- Trigger workflow executions
- Inspect execution history and logs
- Build the freelance-system automation pipeline from here

**Where to find:**

**If using n8n Cloud (app.n8n.cloud):**
1. Log in at [app.n8n.cloud](https://app.n8n.cloud)
2. Settings (bottom-left gear icon) → API
3. Click "Create an API key"
4. `N8N_BASE_URL` = `https://your-instance-name.app.n8n.cloud`

**If self-hosting n8n:**
1. Go to your n8n URL → Settings → API
2. Generate API key there
3. `N8N_BASE_URL` = your instance URL (e.g., `https://n8n.yourdomain.com`)

**If n8n is not yet set up:**
- Fastest path: [app.n8n.cloud](https://app.n8n.cloud) — free tier includes 5 active workflows
- For production: deploy via Railway, Render, or a VPS. See [n8n self-hosting docs](https://docs.n8n.io/hosting/)

Add to `salasoliva27/dotfiles/.env`:
```
N8N_API_KEY=<your_n8n_api_key>
N8N_BASE_URL=https://your-instance.app.n8n.cloud
```

---

### 3. CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID

**What Cloudflare unlocks from Claude Code:**
- Upload and manage media in R2 (glasses product images for lool-ai, campaign assets)
- Deploy and manage Workers (edge functions)
- Read/write KV stores
- Manage Cloudflare Pages deployments
- DNS management

**Where to find:**

**Account ID:**
1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click on any domain (or go to the main dashboard)
3. Right sidebar → "Account ID" — copy it

**API Token:**
1. [dash.cloudflare.com](https://dash.cloudflare.com) → top-right profile icon → "My Profile"
2. API Tokens → "Create Token"
3. Use template "Edit Cloudflare Workers" or "Custom token"
4. Recommended permissions for full access:
   - Account: Cloudflare R2 Storage — Edit
   - Account: Workers KV Storage — Edit
   - Account: Workers Scripts — Edit
   - Zone: DNS — Edit (if you want DNS control)
5. Copy the token immediately — shown only once

Add to `salasoliva27/dotfiles/.env`:
```
CLOUDFLARE_API_TOKEN=<your_cloudflare_api_token>
CLOUDFLARE_ACCOUNT_ID=<your_account_id>
```

---

### 4. VOYAGE_API_KEY

**What it unlocks:** Higher-quality embeddings for the cross-workspace memory MCP (recall/remember). Without it, the system falls back to Anthropic embeddings — still functional, just slightly lower recall quality.

**Lower priority** — everything else works without this.

**Where to find:**
1. Go to [dash.voyageai.com](https://dash.voyageai.com)
2. Sign up / log in
3. API Keys → Create key
4. Free tier includes 50M tokens/month — sufficient for this use case

Add to `salasoliva27/dotfiles/.env`:
```
VOYAGE_API_KEY=<your_voyage_api_key>
```

---

### 5. GITHUB_TOKEN — Permanent cross-repo PAT (do this once, never again)

**Current situation:** Every new Codespace injects a scoped `GITHUB_TOKEN` that only works for that repo. This causes 403 on cross-repo pushes and would require manual work every time a new project is created.

**Permanent fix:** One Classic PAT with no expiration in dotfiles. It overrides the scoped Codespace token everywhere — current and future Codespaces get it automatically from dotfiles on creation. Zero per-project setup.

**Steps (one time only):**
1. github.com → Settings → Developer Settings → Personal access tokens → **Tokens (classic)**
2. "Generate new token (classic)"
3. **Expiration: No expiration**
4. **Scopes: check `repo`** (full control of all private repos under your account)
5. Generate → copy immediately (shown only once)

Add to `salasoliva27/dotfiles/.env`:
```
GITHUB_TOKEN=ghp_your_new_pat_here
```

**Why Classic PAT, not Fine-grained?**
Fine-grained PATs support "All repositories" but max out at 1 year expiration — you'd rotate it annually. Classic PATs can be set to no expiration. For a solo portfolio, that tradeoff is worth it.

**After this:**
- New Codespaces: PAT loads automatically, push works to any repo from day one
- New projects Claude creates: no manual token step needed ever

---

## WHAT EACH TOOL CAN DO (full capability map)

### Google Workspace MCP — after auth setup
| API | What Claude Code can do |
|---|---|
| Gmail | Search, read, create drafts, send, label, organize threads |
| Google Calendar | Create/update/delete events, check availability, detect conflicts with Jano's 3pm constraint |
| Google Drive | Upload files, create folders, share links, read documents |
| Google Sheets | Create spreadsheets, read/write cells, build financial trackers and lead CSVs |
| Google Docs | Create documents, write and edit content, export to PDF |
| Google Slides | Create presentations, add slides, format pitch decks |
| Google Forms | Create intake forms with questions, read responses |
| Google Tasks | Create and update tasks, sync with Calendar |
| Google Chat | Read/post messages in spaces (if enabled on workspace) |

### n8n MCP
| Action | What Claude Code can do |
|---|---|
| Workflows | Create, read, update, delete, activate/deactivate |
| Executions | Trigger a run, get execution history, inspect errors |
| Credentials | List (read-only, values redacted) |
| Variables | Create and update environment variables |

### Cloudflare MCP
| Service | What Claude Code can do |
|---|---|
| R2 | List buckets, upload/download objects, set CORS, manage lifecycle |
| Workers | Deploy scripts, set env vars, view logs |
| KV | Create namespaces, read/write/delete key-value pairs |
| Pages | Deploy projects, view deployments |
| DNS | Create/update/delete DNS records |

### Brave Search MCP
| Use | What Claude Code can do |
|---|---|
| Web search | Market research, competitor analysis, news, pricing benchmarks |
| Local search | Find businesses by location — useful for CDMX optical store prospecting |

---

## HOW PROJECTS REFERENCE THIS FILE

Each project in the portfolio has its own TOOLS.md that lists which tools it uses. For credential setup, it always points here. Template line for any project's TOOLS.md:

```
## Credential setup
All credentials are managed centrally. See janus/CREDENTIALS.md for:
- How to run the live check
- How to fix any missing keys in salasoliva27/dotfiles
- Where to find / regenerate each key
```

Projects never duplicate credential setup instructions. If instructions drift between repos, the janus version wins.

---

## MEMORY + VAULT TOOLS

### claude-mem
Where to get: No key needed
Install: `npx claude-mem install`
Web viewer: http://localhost:37777
Search: `/mem-search` in Claude Code
Status: ✅ Installed (v12.1.0) — automatic session capture
Notes: Hooks into session lifecycle. Replaces manual remember() at session end for standard sessions.

### mcpvault (Obsidian MCP)
Where to get: No key needed
Install: npx @bitbonsai/mcpvault /workspaces/venture-os
Status: ✅ In .mcp.json (obsidian-vault server)
Notes: Reads/writes janus-ia vault from Codespace. 14 tools for vault operations.

### obra/knowledge-graph
Where to get: No key needed
Install: npx obra-knowledge-graph (KG_VAULT_PATH set in .mcp.json)
Status: ✅ In .mcp.json (knowledge-graph server)
Notes: Graph traversal on vault. Semantic search + path finding across [[wiki links]].

### Graphify
Where to get: No key needed (uses ANTHROPIC_API_KEY for semantic extraction)
Install: ⚠️ NOT AVAILABLE — pip package doesn't exist; npm @mohammednagy/graphify-ts@0.1.5 has broken peer dep (missing typescript)
Status: ⬜ Blocked — check back when package matures
Notes: Intended for codebase structure graph per repo. Try again when a stable version ships.

### SUPABASE_ACCESS_TOKEN
Where to get: supabase.com/dashboard/account/tokens → Generate new token → name "janus-mcp"
Add to dotfiles: `export SUPABASE_ACCESS_TOKEN=your_token`
Status: ✅ In dotfiles — loaded

### SUPABASE_PROJECT_REF
Value: rycybujjedtofghigyxm
Add to dotfiles: `export SUPABASE_PROJECT_REF=rycybujjedtofghigyxm`
Status: ✅ In dotfiles — loaded

---

## ADDING A NEW TOOL

1. Add env var to `salasoliva27/dotfiles/.env`
2. Add to `.mcp.json` in janus
3. Add row to the status table above
4. Add "where to find" section below if non-obvious
5. Update `TOOLS.md` with the new tool entry
6. Restart Claude Code (MCP servers load at startup)
