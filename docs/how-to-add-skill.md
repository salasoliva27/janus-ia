# How to add a new skill

1. Check skills/registry.md — already there?
2. Search: find_helpful_skills("[task]") via claude-skills-mcp
   or search github.com/travisvn/awesome-claude-skills
3. Install:
   mkdir -p ~/.claude/skills/[skill-name]
   curl -sL [raw-url] -o ~/.claude/skills/[skill-name]/SKILL.md
4. Add to skills/registry.md as UNTESTED
5. Test in next session, update verdict
