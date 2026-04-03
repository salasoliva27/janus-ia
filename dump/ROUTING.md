# DUMP — INBOX ROUTING PROTOCOL

Drop any file here. Janus IA will route it to the right place.

## How to trigger routing
Say: "route the dump" or "process dump folder"
or Janus checks dump/ at the start of every session automatically.

## Routing logic

For each file in dump/:

1. IDENTIFY: What type is this?
   - Image (.png/.jpg/.webp/.svg) → is it a UI screenshot? design asset? photo?
   - PDF → is it a document to read? a research paper? a contract?
   - .md/.txt → is it notes? a prompt? documentation?
   - Data file (.csv/.json/.xlsx) → which project does this belong to?

2. IDENTIFY: Which project?
   - Filename hint (e.g. "longevite-hero.png" → longevite-therapeutics)
   - Content analysis if unclear
   - Ask Jano if genuinely ambiguous

3. ROUTE:
   - Product image for a website → push to [product]-dev repo in the right assets folder
   - Research document → outputs/research/[project]/
   - Design reference → outputs/designs/[project]/
   - Data file → [product]-dev repo or outputs/documents/[project]/
   - Prompt/notes → outputs/documents/[project]/ or [product]-dev repo

4. CONFIRM: Tell Jano where each file went

5. DELETE from dump/ after routing

6. LOG: Add entry to dump/routing-log.md
   Format: [DATE] [filename] → [destination] ([reason])
