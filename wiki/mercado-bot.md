---
type: project-wiki
project: mercado-bot
tags: [mercado-bot, trading, prediction-market, simulation]
updated: 2026-04-13
---
# mercado-bot

Prediction market trading bot — simulation + research tool.

## Status
🔄 Dashboard v1 built. Python backend scaffolding next.

## Key decisions
- SIMULATION_MODE hardcoded — Live trading locked (requires US entity)
- Kelly Criterion position sizing
- Claude API (PREDICT step) called directly from browser
- Dark terminal aesthetic (Share Tech Mono + Barlow Condensed + CRT scan lines)

## Build done
- ✅ React + Vite dashboard at projects/mercado-bot-dev/dashboard/
- ✅ Pipeline runner: SCAN → RESEARCH → PREDICT → EXECUTE → COMPOUND
- ✅ Portfolio P&L chart, signals table, trade log, risk monitor
- ⬜ Python backend scaffolding

## Connections
- [[agents/core/financial]] — P&L tracking
- [[learnings/cross-project-map]]
