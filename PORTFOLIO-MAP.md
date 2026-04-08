
# Portfolio Mind Map
## Jano's Venture OS — Repo Interaction Map
_Last updated: April 2026_

---

## Structure — all repos at a glance

```mermaid
mindmap
  root((Jano Portfolio))
    venture-os
      Janus IA master brain
      CLAUDE.md dispatch protocol
      Agents core + domain
      Skills + Tools registries
      PROJECTS.md portfolio state
    espacio-bosques
      frontend React+Vite
      backend Express+Prisma
      contracts Hardhat
    lool-ai
      React SPA
      MediaPipe face mesh
    nutria-app
      app React PWA
      widget IIFE bundle
    LongeviteTherapeutics
      Static HTML+CSS+JS
      GSAP animations
```

---

## Interactions — data flows and shared services

```mermaid
graph TD
  subgraph ORCH["venture-os (Janus IA)"]
    JA[CLAUDE.md<br/>Master Brain]
    PR[PROJECTS.md<br/>Portfolio State]
    AG[Agents<br/>core + domain]
  end

  subgraph EB["espacio-bosques"]
    EBF[frontend<br/>React + Vite + Tailwind]
    EBB[backend<br/>Express + simStore]
    EBC[contracts<br/>Hardhat / Solidity]
    EBF -->|REST /api/*| EBB
    EBB -->|future deploy| EBC
  end

  subgraph NA["nutria-app"]
    NAA[app<br/>React PWA]
    NAW[widget<br/>IIFE bundle]
    NAA -->|same session| NAW
  end

  subgraph LT["LongeviteTherapeutics"]
    LTS[Static site<br/>index.html + GSAP]
    LTS -->|embeds| NAW
  end

  subgraph LA["lool-ai"]
    LAR[React SPA<br/>MediaPipe + canvas]
  end

  subgraph EXT["Shared External Services"]
    SB[(Supabase<br/>rycybujjedtofghigyxm<br/>bosques_* + nutria_* tables)]
    CL[Claude API<br/>claude-sonnet-4-6]
    BT[Bitso sandbox<br/>MXN → ETH quotes]
  end

  EBF -->|Supabase Auth| SB
  EBB -->|blueprints + chat| CL
  EBB -->|quotes| BT
  NAA -->|Auth + conversations| SB
  NAA -->|nutrition agent| CL
  NAW -->|session-only chat| CL

  JA -->|orchestrates| EB
  JA -->|orchestrates| NA
  JA -->|orchestrates| LT
  JA -->|orchestrates| LA
```

---

## Per-repo quick reference

| Repo | Type | Stack | External deps | Status |
|---|---|---|---|---|
| **venture-os** | Orchestrator | Markdown + agents | GitHub MCP, Gmail, GCal, Notion | Always active |
| **espacio-bosques** | Community funding platform | React · Express · Prisma · Hardhat | Supabase, Claude API, Bitso | POC complete |
| **lool-ai** | B2B virtual try-on widget | React · MediaPipe | None (standalone) | Core widget done |
| **nutria-app** | Nutrition AI — app + widget | React · Supabase · Claude API | Supabase, Claude API | Build phase |
| **LongeviteTherapeutics** | Clinic website | Static HTML · GSAP | nutria-app widget | V2 built, not deployed |

---

## Shared infrastructure

| Service | Project ref | Used by | Table prefix |
|---|---|---|---|
| Supabase | `rycybujjedtofghigyxm` | espacio-bosques, nutria-app | `bosques_*`, `nutria_*` |
| Claude API | `claude-sonnet-4-6` | espacio-bosques (blueprints), nutria-app (agent) | — |
| Bitso sandbox | sandbox API | espacio-bosques | — |

**Rule:** All credentials live in `salasoliva27/dotfiles` and are injected as env vars into every Codespace. Never hardcode in any repo.

---

## How the repos relate

- **venture-os** is the brain — it doesn't run code, it orchestrates all others
- **nutria-app widget** embeds into **LongeviteTherapeutics** via `<script src="widget.js">`
- **espacio-bosques** is fully self-contained (frontend + backend + contracts), shares only Supabase and Claude
- **lool-ai** is standalone — no backend, no auth, no shared services yet
- **Supabase** is the only shared database — table prefixes prevent collisions between projects

---

## Test endpoints (simulation mode)

All backends in dev must expose `/api/test/*`. See `scripts/test-api.sh` in each repo.

| Endpoint | What it tests |
|---|---|
| `GET /api/test` | List all test endpoints |
| `GET /api/test/state` | Dump current store state |
| `POST /api/test/invest` | Simulate an investment (100 MXN min) |
| `POST /api/test/reset` | Reset sim data to seed |
