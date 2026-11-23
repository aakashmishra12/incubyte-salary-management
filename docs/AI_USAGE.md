# How AI was used

Tool: Claude Code (Anthropic) in VS Code. The standing instructions I gave it are in `CLAUDE.md` at the repository root.

## Ground rules I set
- Work stage by stage. The AI explains the plan in plain words and waits for my go-ahead.
- Requirements and a spec come before code. Tests come before the code that passes them.
- I read every line before it is committed. Code I cannot explain does not go in.
- Never invent requirements. Unclear points are written down as explicit assumptions in `docs/ASSUMPTIONS.md`.

## Log
| Stage | What I asked the AI | What I decided or kept | How it was checked |
|---|---|---|---|
| 0. Scope | To read the assignment and report what it understood, then propose options for each open decision with a recommendation. | The split into "manage data" and "answer questions". I considered modelling bonus and allowances and chose base salary only, to keep the model simple. I chose to state assumptions in writing instead of waiting on answers. | Each proposal was discussed before anything was written. |
| 0. Scope | To research before deciding: how HR teams measure pay, which SQLite driver works on Node 26, and how free hosts treat a SQLite file. | The compa-ratio rule for outliers. Findings and sources are in `docs/research-notes.md`. | The sources are linked, and package facts were confirmed against the npm registry. |
| 0. Scope | To draft the one-page requirements document, the decision log, the delivery plan and the list of assumptions. | The drafts, with my decisions above. I overrode one recommendation: the AI proposed a free platform host, and I chose a VPS with a persistent disk (D-012). | I read the documents and answered each open decision before the first commit. |
| Slice 0. Skeleton | To build the walking skeleton from the spec in `docs/specs/00-walking-skeleton.md`, one failing test at a time. | The split between `createApp` (testable) and `index.ts` (starts the server), and the JSON 404 for unknown API paths. | Tests, a run of the built app, and the first green CI run. |
| Slices 1 and 2. Pay rules and data | To write the pay rules and the seed from the specs, each as failing tests first. | Whole-number comparison for the 80% and 120% boundaries, the seeded random generator written in the project, and the stored USD amount (D-014). | 59 tests, and two seed runs compared byte for byte. |
| Slices 3 to 5. Employees | To build the list, detail, salary change, add, edit and mark-as-left flows, API first and then the screen. | The fixed table that maps a sort choice to a column so request text never reaches SQL, and the pure `checkSalaryChange` function. | API tests against an in-memory database, UI tests, and a salary change made by hand in the browser. |
| Slice 6. Insights | To build the three insights from the spec. | Reporting how many employees could not be rated, and showing local currency only when a group shares one. | Tests, and the page opened in the browser against the 10,000 seeded employees. |
| Slice 7. Hardening | To add security headers, a clean shutdown, a measurement script and the architecture and performance documents. | The measured numbers in `docs/PERFORMANCE.md`. | `npm run measure`, run on the development laptop. |
| Design | To apply one written design language across the app. I chose the Vercel-inspired reference in `docs/design/DESIGN.md`. | One theme file that every screen reads, and leaving out the gradient and pill buttons because the reference reserves them for marketing pages. | All 64 UI tests passed unchanged, and each screen was checked in the browser. |

## What the AI got wrong, and how it was caught
| What happened | How it was caught | What changed |
|---|---|---|
| A "failing" test failed because a package was missing, not because the feature was missing. | Reading the failure message instead of only the red status. | Each red run is now checked for the expected message before the test is committed. |
| A date check reported the same field twice for one mistake. | An API test that expects exactly one issue per wrong field. | The two checks became one. |
| A theme setting that older MUI versions accepted does not exist in MUI 9. | The type check failed. | The supported `variants` form is used instead. |
| A UI test looked for a date that appears twice on the page. | The test failed on its first run against the real page. | The test now looks inside the details panel only. |

## How I checked the AI's work
- Every behaviour has a test that was seen to fail first.
- Each screen was opened in a real browser against the 10,000 seeded employees, because component tests cannot show a broken layout or wrong real data.
- The browser check showed something no test would: in the early hours, local time, the default date in the salary form is one day behind the local date, because the app uses the UTC date. That limit is recorded as assumption A5 and listed under what I would add next.
- Lint, type check, tests and build run on every push in GitHub Actions.

