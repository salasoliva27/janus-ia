# How to add a new agent

Core agents (agents/core/): always available portfolio-wide
Domain agents (agents/domain/): deep expertise for specific fields

When to add a domain agent:
- A product requires specialized knowledge that other products might also need
- The knowledge is complex enough to warrant its own dedicated file

Steps:
1. Create agents/domain/[field].md
2. Define: role, tools it uses, skills it uses, output format, clinical flags if any
3. Register in CLAUDE.md AGENTS table
4. Any product that needs it: add "Read agents/domain/[field].md" to its CLAUDE.md
