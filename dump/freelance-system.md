# FREELANCE SYSTEM — DEEP DIVE
## Automated Freelance Pipeline | Mexico City → Global Clients

---

## WHAT IT IS

An automated gate-driven pipeline for freelance tech service delivery. Jano finds leads, the system extracts them, writes proposals, manages the build queue, delivers, and updates the portfolio — all with minimal manual work.

**Runtime:** Claude Code + GitHub Codespaces
**Languages:** Python, Node.js, React, Solidity, SQL
**Automation:** n8n workflows, Claude API

---

## THE PIPELINE

```
[SEARCH] → Gate 1 → [EXTRACT] → [PROPOSE] → Gate 2 → [BUILD] → Gate 3 → [DELIVER] → [PORTFOLIO]
```

### Step 1: Search (automated)
Brave Search API scans Upwork, Freelancer, PeoplePerHour, Fiverr, Freelancehunt for projects matching Jano's stack.

### Step 2: Extract (automated)
From job post: extracts tech stack, complexity, budget, key requirements, contact info. Writes to leads.csv.

### Step 3: Propose (automated)
Claude writes proposal + demo (if applicable). Follows strict rules:
- Under 250 words — no exceptions
- Lead with a specific technical observation about their stack (not generic deliverables)
- Name their technology back to them in the opening
- Include demo for Website, Dashboard, Chatbot projects
- Close with one specific question, not "let's hop on a call"

### Gate 2: Proposal review
Jano reviews, revises if needed, approves → system sends.

### Step 4: Build (automated phases)
When client responds positively → system queues the build.
Build stages: POC → happy path → edge cases → UI → testing → delivery

### Gate 3: Build review
Each stage reviewed before next opens.

### Step 5: Deliver + Portfolio
Auto-push to GitHub + Google Drive. Portfolio site updates with screenshots and outcome.

---

## SERVICES OFFERED

| Service | Keywords | Demo type |
|---|---|---|
| Website | landing page, WordPress, portfolio | Static HTML demo in 2 hours |
| Data Migration | ETL, pipeline, Snowflake, SQL | Python script showing data flow |
| Dashboard/Analytics | PowerBI, Tableau, reporting | Screenshot of PowerBI dashboard |
| Chatbot/AI | Claude, OpenAI, RAG, LLM, assistant | Deployed demo URL (Docker + Claude) |
| Database | Snowflake, SQL, schema, optimization | Schema diagram + query examples |
| Automation | n8n, Zapier, workflow, API | n8n workflow JSON + flow diagram |

---

## JANO'S STACK (SALES POSITIONING)

### Data & Analytics
- Python: Pandas, NumPy, SQLAlchemy
- BI: PowerBI (certified)
- Databases: Snowflake, SQL Server, PostgreSQL
- ETL: Talend, custom Python pipelines

### AI & Automation
- LLM APIs: Claude (Anthropic), OpenAI, Gemini
- RAG systems: Supabase vectors
- Workflows: n8n
- Agent runtime: Claude Code

### Cloud & Infrastructure
- Cloud: Azure, Docker, Supabase, GitHub Actions
- Hosting: Netlify, GitHub Pages, Codespaces

### Web & Frontend
- Frontend: HTML5, CSS3, JavaScript, React, Tailwind CSS
- Web3: Solidity 0.8.x, Hardhat, ethers.js, MetaMask

---

## POSITIONING RULES

1. **Lead technical, not deliverable-first**: "I noticed you're using Snowflake with Python — the migration script I'd write would use SQLAlchemy + Pandas with Snowflake Connector for Python, not JDBC, which would avoid the driver overhead you'd otherwise see in the transformation step." NOT "I will build your data pipeline."

2. **Underbid for reviews**: In the first 30 days, bid 20-30% below market rate. Frame explicitly: "I'm delivering senior-level work at a below-market rate in exchange for a review. This is a deliberate trade — not desperation."

3. **Demo beats words**: For any visual project (website, dashboard, chatbot), have a working prototype in the proposal. Not a mockup. A real URL or attached file.

4. **250-word maximum**: Clients on Upwork read fast and decide in 10 seconds. Long proposals signal poor communication skills.

5. **Close with a question**: "Are you open to a React + Tailwind approach, or is there a specific framework your team already uses?" Forces a response. Generic "let's talk" gets ignored.

---

## LEAD DATABASE SCHEMA

### leads.csv columns
- id (e.g., UP260304-01 — platform prefix + date + sequence)
- platform, post_link, post_date, discovery_date
- service_type, tech_stack, complexity
- contact_name, contact_email, full_request, summary
- budget_posted, bid_suggested, payment_final
- proposal_version, proposal_path, proposal_sent_date
- build_start_date, build_complete_date
- deliverable_type, file_location, github_path, drive_link
- status (found → extracted → proposal_sent → building → complete → won/lost)
- client_response, lost_reason, win_notes, client_rating, would_repeat

---

## CURRENT STATUS (April 2026)

**Stage:** Operational — no leads yet.

Pre-loaded in portfolio:
- Nocturne Solutions collab cases (positions Jano as having delivered real client work)

**Immediate next action:** Run first search session → find 3-5 leads → extract → write proposals → send.

**Target platforms to start:**
- PeoplePerHour: smaller projects, faster response rate, less competition from offshore agencies
- Freelancer.com: high volume, competitive but good for building initial reviews
- Upwork: highest quality clients but slow to start without reviews

---

## FINANCIAL TARGETS

### Month 1
- Goal: 2-3 proposals sent
- Expected win rate (no reviews): ~10-15%
- Target: 1 first win, any amount, for the review

### Month 2-3
- Build reviews to 3-5
- Raise rates to market
- Target: $500-1,500 USD/project

### Month 4+
- With 5+ reviews: compete at market rates
- Specialize in 2-3 service types where win rate is highest
- Target: $2,000-5,000 USD/project

---

## LEARNINGS (Will populate as pipeline runs)

### Proposal wins
*No data yet*

### Proposal losses
*No data yet*

### Platform patterns
*No data yet*

### Pricing patterns
*No data yet*

### Build time reality
*No data yet*
