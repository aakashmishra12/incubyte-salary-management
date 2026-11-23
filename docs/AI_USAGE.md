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
| Slice 0. Skeleton | To build the walking skeleton from the spec in `docs/specs/00-walking-skeleton.md`, one failing test at a time. | The split between `createApp` (testable) and `index.ts` (starts the server), and the JSON 404 for unknown API paths. | _Filled in after my review._ |
| Slice 0. Skeleton | Nothing: this is something the AI got wrong. Its first test run failed because a package (Vite) was missing, not because the feature was missing, and it had already committed the next step. | The correction: it undid those local commits, installed the package, and repeated each step while checking that the test failed for the right reason before making it pass. | Rule added to the workflow: a red test only counts when the failure message is the one the test was written for. |
| Slices 1 and 2. Pay rules and data | To write the pay rules and the seed from the specs, each as failing tests first. | Whole-number comparison for the 80% and 120% boundaries, the seeded random generator written in the project, and the stored USD amount (D-014). | _Filled in after my review._ |
| Slices 3 to 5. Employees | To build the list, detail, salary change, add, edit and mark-as-left flows, API first and then the screen. | The fixed table that maps a sort choice to a column so request text never reaches SQL, and the pure `checkSalaryChange` function. | _Filled in after my review._ |
| Slice 6. Insights | To build the three insights from the spec. | Reporting how many employees could not be rated, and showing local currency only when a group shares one. | _Filled in after my review._ |
| Slice 7. Hardening | To add security headers, a clean shutdown, a measurement script and the architecture and performance documents. | The measured numbers in `docs/PERFORMANCE.md`, taken from `npm run measure`. | _Filled in after my review._ |

## What the AI got wrong, and how it was caught
| What happened | How it was caught | What changed |
|---|---|---|
| A "failing" test failed because a package was missing, not because the feature was missing. | Reading the failure message instead of only the red status. | Each red run is now checked for the expected message before the test is committed. |
| A date check reported the same field twice for one mistake. | An API test that expects exactly one issue per wrong field. | The two checks became one. |
| A UI test looked for a date that appears twice on the page. | The test failed on its first run against the real page. | The test now looks inside the details panel only. |

## How I checked the AI's work
- Every behaviour has a test that was seen to fail first.
- Each screen was opened in a real browser against the 10,000 seeded employees, because component tests cannot show a broken layout or wrong real data.
- The browser check showed something no test would: in the early hours, local time, the default date in the salary form is one day behind the local date, because the app uses the UTC date. That limit is recorded as assumption A5 and listed under what I would add next.
- Lint, type check, tests and build run on every push in GitHub Actions.

