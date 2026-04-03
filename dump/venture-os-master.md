# JANUS IA — MASTER PORTFOLIO BRIEF
## Alejandro "Jano" Salas Oliva | Mexico City | April 2026

---

## WHAT IS JANUS IA

Janus IA is a personal operating system for managing a portfolio of simultaneous ventures at different stages of development. Built on top of Claude Code (AI agent runtime), it coordinates four active projects from a single repository with shared memory, learnings, and financial tracking.

The system is:
- **Active**: challenges assumptions, detects conflicts, proposes next steps
- **Memory-persistent**: every session starts by recalling what was done before
- **Self-improving**: learnings from each project feed back into a shared knowledge base

**Operator:** Jano — full-stack developer, data engineer, and entrepreneur based in Mexico City. Available weekdays after 3pm CDMX time, weekends flexible. Bilingual ES/EN.

**Stack:** Claude Code, GitHub Codespaces, Python, React, Solidity, Node.js, Supabase, n8n, Tailwind CSS, GSAP

---

## ACTIVE PROJECTS (April 2026)

### 1. lool-ai
- **Type:** B2B SaaS
- **What it does:** Virtual try-on widget for glasses — embedded on optical store websites or WhatsApp catalogs. No 3D modeling required. Simple product photo upload.
- **Market:** Independent optical stores in Roma, Condesa, Polanco, Lomas (Mexico City SME neighborhoods)
- **Pricing:** ~800–1,500 MXN/month per store
- **Stage:** Core widget functional. Face tracking, glasses overlay, catalog selector all working. Not yet embeddable.
- **Mexico eyewear market:** ~$1.93B USD in 2025, growing 7.2% CAGR. LATAM market $12.89B → $20.56B by 2032.
- **Gap:** All major virtual try-on incumbents (Fittingbox, Perfect Corp, Banuba, VARAi, Zakeke) are English-first, USD-priced, targeting global enterprise. None serve Mexican optical SMEs.
- **Legal flag:** Facial image data → LFPDPPP compliance required before real user data collection.
- **Business model open question:** Flat fee vs. % of attributed sales (revenue share requires UTM attribution on cart clicks — already architected, not implemented).
- **Next steps:** UTM attribution → embeddable widget → first store pilot in CDMX.

### 2. espacio-bosques
- **Type:** Blockchain community investment platform (DAO)
- **What it does:** Allows Bosques de las Lomas residents to fund, vote on, and monitor community projects via a blockchain escrow with AI-assisted project creation.
- **Market:** Bosques de las Lomas — high-income residential neighborhood, ~15,000 residents, HOA-familiar.
- **Stage:** Smart contract complete (450+ lines Solidity, 22/22 tests passing). React frontend pending.
- **Smart contract features:**
  - CommunityToken (ERC20 — BOSQUES token)
  - ProjectRegistry (create projects, validator voting, approval workflow)
  - EscrowVault (milestone-based fund releases, timelock, 51% quorum)
  - MilestoneManager (evidence submission via IPFS, validator approval)
  - Governance (proposal voting, role management)
  - Reporting (AI report hash anchoring on-chain)
- **Tech stack:** Solidity 0.8.20, Hardhat, React 18, Wagmi, Node.js, Prisma, PostgreSQL, Anthropic Claude API
- **AI integration:** Claude 3.5 Sonnet generates structured project blueprints from natural language, generates telemetry/monitoring reports
- **Legal flag:** Blockchain-based investment → potential CNBV regulatory territory (Ley Fintech 2018) → validate legal structure before real funds.
- **Next steps:** Alchemy account → testnet ETH → MetaMask key in .env → deploy to Sepolia → build 4-screen React frontend.

### 3. longevite-therapeutics
- **Type:** Client project (Jano's mom — Susana)
- **What it does:** Static website for a functional medicine & longevity IV infusion clinic in Mexico City.
- **Location:** Pedregal #47, Col. Lomas Virreyes, CDMX
- **Target audience:** Health-conscious professionals 35–60 in Lomas Virreyes / Polanco
- **Services offered:** IV vitamin therapy, NAD+, ozone therapy, chelation, Myers cocktail, high-dose vitamin C, glutathione, phosphatidylcholine, immune boost, anti-aging protocols
- **Tech stack:** Static HTML/CSS/JS, GSAP animations, bilingual ES/EN
- **Design:** Premium longevity clinic aesthetic — black + olive/gold palette, Cormorant Garamond editorial typography, full-bleed clinic photography
- **Build status:** V2 complete and on GitHub. Pending: Netlify deployment, contact form backend, Google Analytics.
- **Contact:** +52 55 8930 3489 | @longevitetherapeutics | www.longevitetherapeutics.com

### 4. freelance-system
- **Type:** Automated freelance pipeline
- **What it does:** Gate-driven pipeline for finding, proposing, building, and delivering freelance tech projects. Runs on Claude Code + GitHub Codespaces.
- **Platforms:** Upwork, Fiverr, PeoplePerHour, Freelancer, Freelancehunt
- **Services:** Website builds, data migration/ETL, PowerBI dashboards, chatbots/AI, database work, automation (n8n)
- **Jano's stack positioned:** Python/Pandas/Snowflake (data), Claude/OpenAI APIs (AI), React/Tailwind (web), n8n (automation), Azure/Docker (cloud)
- **Positioning rule:** Open with willingness to underbid for reviews. Senior-level delivery at below-market rate in exchange for review. Lead with specific technical observation about client's stack. Keep proposals under 250 words.
- **Stage:** Operational. No leads yet. Nocturne Solutions collab cases pre-loaded in portfolio.
- **Next step:** Get first lead into pipeline.

---

## PORTFOLIO HEALTH (April 2026)

| Project | Stage | Revenue | Monthly burn | Needs |
|---|---|---|---|---|
| lool-ai | Build in progress | $0 | $0 | UTM attribution → embeddable widget |
| espacio-bosques | Deploy pending | $0 | $0 | Alchemy setup → Sepolia deploy |
| longevite-therapeutics | Ready to deploy | N/A (client project) | $0 | Netlify deploy |
| freelance-system | Operational | $0 | $0 | First lead |
| **Portfolio total** | | **$0 MRR** | **$200 MXN/mo** (infra) | |

---

## MARKET INTELLIGENCE

### Mexico City Eyewear (lool-ai)
- Mexico eyewear market 2025: $1.93B USD, 7.2% CAGR through 2035
- LATAM market: $12.89B → $20.56B by 2032. Mexico = largest LATAM share.
- Target neighborhoods: Roma, Condesa, Polanco, Lomas, Narvarte, Del Valle
- All global incumbents are USD-priced, English-first — gap is real and unserved

### CDMX Community Investment (espacio-bosques)
- Mexican fintech ecosystem: 770+ companies, mature regulatory environment
- Ley Fintech (2018) governs crowdfunding and investment platforms
- Bosques de las Lomas: high-income, ~15k residents, HOA-familiar culture
- Blockchain RWA (real world assets) growing trend in Mexico

### Mexico Freelance / Tech Services
- No pipeline data yet — will populate as freelance-system runs

---

## CROSS-PROJECT LEARNINGS

### Validated patterns
- "B2B and B2C simultaneously" almost always means neither. Force a choice at intake.
- Mexican SMEs need Spanish-first onboarding and MXN pricing — regardless of underlying technology.
- Mexico City neighborhood-level targeting outperforms generic "Mexico" targeting for local service businesses.
- POC-first always. Never build production infrastructure before POC is validated with real users.

### Technical patterns
- GSAP + CSS fade-in conflict: when CSS sets `opacity: 0` AND GSAP animates `from({ opacity: 0 })`, everything stays invisible. Fix: always use `gsap.fromTo()` with explicit end state.

### Build sequencing philosophy
1. Core mechanic (must work for product to exist)
2. Happy path (full flow, no edge cases)
3. Edge cases and error handling
4. UI/UX pass
5. Testing + validation
6. Deployment

---

## INFRASTRUCTURE

- **Memory:** Supabase + pgvector + Voyage AI semantic search — cross-workspace persistent memory
- **Storage routing:** Code → GitHub | Client docs → Google Drive | Media → Cloudflare R2
- **AI runtime:** Claude Code (Anthropic) — all projects use Claude as the build agent
- **Credentials:** All API keys in salasoliva27/dotfiles/.env — auto-loaded into all Codespaces
- **MCP servers:** Memory, GitHub, Gmail, Google Calendar, Notion, Brave Search, Playwright, n8n, filesystem
