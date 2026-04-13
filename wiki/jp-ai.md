---
type: project-wiki
project: jp-ai
tags: [jp-ai, ozum, crm, corporate-events, client-project]
updated: 2026-04-13
---
# jp-ai (Ozum AI-OS)

AI operating system for Ozum — corporate events & incentive travel agency.
Client: Juan Pablo García (CSO). Built by Jano.

## Status
🔄 Setup complete — CRM Phase 1 pending

## Key decisions
- Multi-user (all Ozum employees), role-aware CLAUDE.md
- 10 specialized agents
- Supabase collective memory (ozum_memories table — to be wired)
- Repo stays private; transfer to Ozum GitHub org when JP creates one

## Build done
- ✅ CLAUDE.md brain, 10 agents, domain agent (corporate-events.md)
- ✅ Dotfiles: .env.example + setup.sh
- ✅ CRM project spec: Phase 1–4 roadmap
- ✅ .mcp.json pre-configured
- ⬜ Supabase creation + ozum_memories table
- ⬜ CRM Phase 1 build (lead intake + AI proposal generator)

## Connections
- [[agents/core/developer]] — CRM build
- [[agents/core/legal]] — client data handling
- [[learnings/cross-project-map]]
