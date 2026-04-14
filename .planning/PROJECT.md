# Venture OS UI

## What This Is

A web-based operating system interface that replaces the Claude Code terminal experience for managing a multi-venture portfolio. It provides a living system visualization (D3 force graph), embedded chat with Claude, workspace preview panes, document generation, and real-time visibility into every tool call, file edit, and vault change — all in a single browser window launched with one command.

## Core Value

Everything Jano can do in Claude Code terminal, he can do here — but with a living visual layer that shows how the system thinks, builds, and connects.

## Requirements

### Validated

- ✓ Agent dispatch system (CLAUDE.md + agents/core/*.md) — existing
- ✓ Tool/skill registries (tools/registry.md, skills/registry.md) — existing
- ✓ Brain viewer D3 graph (brain-viewer/) — existing
- ✓ Obsidian vault with concepts/learnings/wiki — existing
- ✓ Multi-project portfolio management — existing
- ✓ MCP server integrations (13+ servers configured) — existing
- ✓ Claude Code hooks system — existing

### Active

- [ ] **Chat panel** — full conversation with Claude, markdown rendering, streaming responses, approve/deny for tool permissions (same model as CLI)
- [ ] **Bridge server** — Express + WebSocket server that runs Claude Code CLI as a subprocess, pipes stdin/stdout to the web UI, emits tool call events
- [ ] **Living system graph** — D3 force-directed visualization showing projects, agents, tools, MCP servers, vault concepts as connected nodes. Data-driven from filesystem (agents/*.md, tools/registry.md, projects/*)
- [ ] **Process animations** — visual feedback mapped to events: file read = pulse, git push = ripple, new vault node = bloom, agent dispatch = beam, build fail = red flicker, tool invocation = edge glow
- [ ] **Embedded preview pane** — iframe pointing to running dev servers, auto-detected ports, tabs per project, live HMR updates visible
- [ ] **Document agent** — new agents/core/documents.md that generates investor updates, status reports, slide decks, proposals. Document preview/viewer in workspace panel
- [ ] **Activity feed** — bottom strip showing real-time stream of tool calls, file edits, vault changes, git operations with project-colored borders
- [ ] **Theme editor** — full customization: colors, fonts, spacing, animation styles, presets + custom. Saved to localStorage
- [ ] **Resizable panels** — drag borders between chat, graph, and workspace panels
- [ ] **Self-growing UI** — nodes/panels appear automatically as new agents, tools, projects, or concepts are added to the filesystem
- [ ] **Repo access** — click project nodes to open GitHub repos, view git status per project
- [ ] **Single command startup** — `venture-os` command starts bridge server, Claude Code headless, and opens web UI
- [ ] **Pull-up panels** — brain zoom, project detail, tool registry slide up on demand
- [ ] **Claude Code hooks integration** — hooks that write tool call events to a local file/socket, consumed by the bridge server for real-time activity feed

### Out of Scope

- Full computer use (screen/mouse/keyboard control) — Codespace has no desktop environment. Playwright covers automated browser testing.
- Mobile responsive layout — this is a desktop power tool used in Codespaces
- Multi-user / collaboration — Jano is the sole user
- Replacing Claude Code internals — the bridge wraps Claude Code, it doesn't reimplement it
- Voice input — terminal text input only

## Context

- **Runtime environment:** GitHub Codespaces (headless Linux, no desktop)
- **Existing brain viewer:** `brain-viewer/` has a working D3 force graph with 95 nodes and 346 edges. Can be used as reference/starting point for the system graph.
- **Claude Code hooks:** PreToolUse/PostToolUse hooks are already configured in `.claude/settings.json`. These can be extended to emit events to the bridge server.
- **MCP servers:** 13+ configured (GitHub, Playwright, Obsidian vault, Brave, Context7, Supabase, filesystem, n8n, sequential-thinking, magic, etc.)
- **Portfolio:** 5+ active ventures across espacio-bosques, lool-ai, mercado-bot, nutria, longevite
- **Existing design language:** Dark theme (#080c10 bg, #00e5c4 accent in espacio-bosques; #07080f bg, #00d4ff cyan in mercado-bot). The Venture OS UI should derive its own identity from the agent system.
- **Codebase map:** Full analysis in `.planning/codebase/` (7 documents, 1191 lines)

## Constraints

- **Tech stack**: React + Vite (frontend), Express + WebSocket (bridge server), D3.js (graph). Consistent with existing projects.
- **Runtime**: Must work in GitHub Codespaces — no native desktop dependencies
- **Claude Code compatibility**: Must preserve all existing tools, MCP servers, hooks, skills, CLAUDE.md routing
- **Startup**: Single command (`venture-os`) that launches everything
- **Location**: Lives in `/workspaces/venture-os/dashboard/` (this repo)
- **Theme persistence**: localStorage for theme preferences
- **Data source**: All UI state derived from filesystem reads — no separate database

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Bridge wraps Claude Code CLI (not direct API) | Preserves all existing MCP servers, hooks, skills, CLAUDE.md without reimplementation | — Pending |
| React + Vite frontend | Consistent with espacio-bosques and mercado-bot; fast HMR for development | — Pending |
| D3 force graph (not canvas/WebGL) | Existing brain-viewer uses D3; proven with 95+ nodes; SVG allows CSS animations | — Pending |
| Data-driven UI from filesystem | UI grows automatically as agents/tools/projects are added — no hardcoded panels | — Pending |
| Chat replaces terminal (not companion) | User explicitly wants "everything I do in Codespace, I should be able to do there" | — Pending |
| Fine granularity (8-12 phases) | Complex project with many independent subsystems | — Pending |
| Theme editor with full control | User wants to customize colors, fonts, spacing, AND animation styles | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-14 after initialization*
