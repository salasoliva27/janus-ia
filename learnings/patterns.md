# PATTERNS — CROSS-PROJECT LEARNINGS
## Last updated: 2026-04-13

> See [[concepts/]] directory for the full abstraction layer — each validated pattern lives there with project evidence and [[links]].

## Related concepts
- [[concepts/spanish-first-mx]] — Spanish-first + MXN pricing validated across all MX projects
- [[concepts/cdmx-neighborhood-targeting]] — colonia-level beats "Mexico City"
- [[concepts/simulation-first-dev]] — build sim layer before real infra
- [[concepts/test-harness-first]] — test harness before UI
- [[concepts/ley-fintech-compliance]] — Bitso as IFPE, LFPDPPP triggers
- [[concepts/supabase-shared-instance]] — one instance, table-prefix namespacing

## Projects feeding this
- [[wiki/espacio-bosques]] · [[wiki/lool-ai]] · [[wiki/nutria]] · [[wiki/longevite]] · [[wiki/mercado-bot]] · [[wiki/jp-ai]] · [[wiki/freelance-system]]

# ORIGINAL PATTERNS — CROSS-PROJECT LEARNINGS

This file captures patterns that repeat across projects. The master agent reads this before every intake to surface relevant knowledge early.

---

## Validated patterns

### Market framing
- "B2B and B2C simultaneously" almost always means neither. Force a choice at intake. The secondary market can come after the primary is validated.
- Mexican SMEs need Spanish-first onboarding and MXN pricing regardless of how global the underlying technology is.
- Mexico City neighborhood-level targeting outperforms generic "Mexico" targeting for local service businesses.

### Build reality
- No data yet — will populate as projects complete build phases.

### GTM reality  
- No data yet — will populate as projects reach GTM phase.

### Timing
- No data yet — will populate as projects run.

---

## Validated patterns (2026-04-13 self-improvement session)

Each pattern below was cross-verified against at least 2 project repos and the vault. Full abstraction lives in `concepts/`.

### [[concepts/poc-before-production]]
**Rule:** Ship a throwaway POC that validates core UX before wiring any real infrastructure.
**Evidence:** All 5 active projects (espacio-bosques, lool-ai, nutria, longevite, mercado-bot) reached demo-ready state before any Supabase tables, payment rails, or auth providers were live.

### [[concepts/b2b-before-b2c]]
**Rule:** Never build a B2C layer until the B2B layer has 20+ paying clients with proven retention.
**Evidence:** Confirmed from lool-ai GitHub repo — "campaigns | deferred — activate at 20+ stores" is hardcoded in the module spec. espacio-bosques would dilute community trust if opened to a public marketplace before the HOA layer is stable.

### [[concepts/relationship-capital-cdmx]]
**Rule:** Referral chains in CDMX are colonia-scoped — a warm intro in Polanco does not reach Condesa without a separate bridge. Never run GTM for two projects in overlapping colonias simultaneously.
**Evidence:** lool-ai (Polanco optical stores) and longevite (Lomas Virreyes clinic) share the same Polanco/Lomas geography and the same Jano personal network. Running both GTMs simultaneously burns the same relationship capital for different asks.

### [[concepts/simulation-first-dev]]
**Rule:** Build a full simulation layer (in-memory store, sim auth, fake transactions) before touching real infrastructure.
**Evidence:** espacio-bosques ran fully in sim mode (simStore, fake Bitso, no Supabase tables) through the entire POC phase. mercado-bot dashboard was verified against mock data before any Python backend existed.

### [[concepts/test-harness-first]]
**Rule:** Wire `/api/test/*` endpoints before building any UI that depends on that data. Never rely on manually created state in tests.
**Evidence:** espacio-bosques test harness caught 5 silent bugs (delete 404, save silent-fail, ghost drafts, finalize 422, early threshold) that the UI showed as working because UI optimistically updated.