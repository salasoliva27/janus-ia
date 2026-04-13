---
type: project-wiki
project: espacio-bosques
tags: [espacio-bosques, blockchain, dao, cdmx, bitso, simulation]
updated: 2026-04-13
---
# espacio-bosques

Community DAO platform for Bosques de las Lomas. Fiat-first, no MetaMask.

## Status
✅ POC complete — simulation mode working. Next: first real demo.

## Key decisions
- Bitso API as licensed IFPE (Ley Fintech compliance)
- SIMULATION_MODE=true — zero real money in testing
- Supabase auth (email/PIN + Google)
- eb_ table prefix in shared Supabase instance
- Claude model: claude-sonnet-4-6

## POC done
- ✅ Supabase email/password + Google OAuth
- ✅ AI blueprint creation + conversational chat refinement
- ✅ Bitso MXN→ETH quote + simulated investment flow
- ✅ Full EN/ES i18n
- ✅ User profile page, SAT RFC validation
- ✅ Evidence review + voting thresholds + notification bell
- ⬜ First real demo
- ⬜ Seed 5+ investors for PENDING_VOTES threshold path

## Connections
- [[wiki/nutria]] — same Supabase instance, same auth pattern
- [[wiki/lool-ai]] — overlapping CDMX geography
- [[agents/core/legal]] — Ley Fintech / CNBV flag
- [[agents/core/financial]] — no revenue yet
- [[learnings/cross-project-map]]

## Legal flag
⚠️ Ley Fintech / CNBV — custodial model, using Bitso as licensed IFPE
