# How AI was used

Tool: Claude Code (Anthropic) in VS Code. The standing instructions I gave it are in `CLAUDE.md` at the repository root.

## Ground rules I set
- Work stage by stage. The AI explains the plan in plain words and waits for my go-ahead.
- Requirements and a spec come before code. Tests come before the code that passes them.
- I read every line before it is committed. Code I cannot explain does not go in.
- Never invent requirements. Unclear points are written down as explicit assumptions in `docs/ASSUMPTIONS.md`.

## Log
| Stage | What I asked the AI | What I kept | What I changed by hand, and why |
|---|---|---|---|
| 0. Scope | To read the assignment and report what it understood, then propose scope options for each open decision with a recommendation. | The split into "manage data" and "answer questions", and the three screens. | _Filled in after my review._ |
| 0. Scope | To research before deciding: how HR teams measure pay, which SQLite driver works on Node 26, and how free hosts treat a SQLite file. | The compa-ratio rule for outliers, and the plan to test hosting with a skeleton first. Findings and sources are in `docs/research-notes.md`. | _Filled in after my review._ |
| 0. Scope | To draft the one-page requirements document, the decision log, the delivery plan and the list of assumptions. | _Filled in after my review._ | _Filled in after my review._ |
