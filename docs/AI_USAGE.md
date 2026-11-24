# How AI was used

Tool: Claude Code (Anthropic) in VS Code. The standing instructions I gave it are in `CLAUDE.md` at the repository root.

## Ground rules I set
- Work stage by stage. The AI explains the plan in plain words and waits for my go-ahead.
- Requirements and a spec come before code. Tests come before the code that passes them.
- The AI wrote the code slice by slice, test first, and I approved each stage and each decision. The finished code was then checked by an adversarial AI review with a skeptic vote per finding, by mutation checks, and by a clean-clone build (see REVIEW.md). That is not the same as me reading every file myself. I will go through the code with the interviewers and say plainly where I have not.
- Never invent requirements. Unclear points are written down as explicit assumptions in `docs/ASSUMPTIONS.md`.

## Log
| Stage | What I asked the AI | What I decided or kept | How it was checked |
|---|---|---|---|
| 0. Scope | To read the assignment and report what it understood, then propose options for each open decision with a recommendation. | The split into "manage data" and "answer questions". I considered modelling bonus and allowances and chose base salary only, to keep the model simple. I chose to state assumptions in writing instead of waiting on answers. | Each proposal was discussed before anything was written. |
| 0. Scope | To research before deciding: how HR teams measure pay, which SQLite driver works on Node 26, and how free hosts treat a SQLite file. | The compa-ratio rule for outliers. Findings and sources are in `docs/research-notes.md`. | The sources are linked, and package facts were confirmed against the npm registry. |
| 0. Scope | To draft the one-page requirements document, the decision log, the delivery plan and the list of assumptions. | The drafts, with my decisions above. I overrode one recommendation: the AI proposed a free platform host, and I chose a VPS with a persistent disk (D-012). | I answered each open decision in conversation, from the AI's written summaries, before the first commit. The documents were reviewed afterwards. |
| Slice 0. Skeleton | To build the walking skeleton from the spec in `docs/specs/00-walking-skeleton.md`, one failing test at a time. | The split between `createApp` (testable) and `index.ts` (starts the server), and the JSON 404 for unknown API paths. | Tests, a run of the built app, and the first green CI run. |
| Slices 1 and 2. Pay rules and data | To write the pay rules and the seed from the specs, each as failing tests first. | Whole-number comparison for the 80% and 120% boundaries, the seeded random generator written in the project, and the stored USD amount (D-014). | 59 tests, and two seed runs compared byte for byte. |
| Slices 3 to 5. Employees | To build the list, detail, salary change, add, edit and mark-as-left flows, API first and then the screen. | The fixed table that maps a sort choice to a column so request text never reaches SQL, and the pure `checkSalaryChange` function. | API tests against an in-memory database, UI tests, and a salary change made by hand in the browser. |
| Slice 6. Insights | To build the three insights from the spec. | Reporting how many employees could not be rated, and showing local currency only when a group shares one. | Tests, and the page opened in the browser against the 10,000 seeded employees. |
| Slice 7. Hardening | To add security headers, a clean shutdown, a measurement script and the architecture and performance documents. | The measured numbers in `docs/PERFORMANCE.md`. | `npm run measure`, run on the development laptop. |
| Design | To apply one written design language across the app. I chose the Vercel-inspired reference in `docs/design/DESIGN.md`. | One theme file that every screen reads, and leaving out the gradient and pill buttons because the reference reserves them for marketing pages. | All 64 UI tests passed unchanged, and each screen was checked in the browser. |
| Slice 8. Pay assistant | To build an assistant that answers pay questions with a free model API, with automatic switching between providers and very careful limits. I chose Groq, Gemini, OpenRouter and NVIDIA as candidates, and asked for at least two so one can take over when the other runs out. | The rule that the model can only call fixed read-only tools. I rejected letting it write SQL or giving it the whole table. I also set the limits and kept the keys in a git-ignored file. | The provider facts (limits, model names, behaviour) for Groq, Gemini and OpenRouter were tested with live keys, and the answers were compared with the Insights page. NVIDIA was not tested, and its figures come from published documentation. The failover was proved live by deliberately breaking the first two providers' keys, so that the third answered. |

## What the AI got wrong, and how it was caught
| What happened | How it was caught | What changed |
|---|---|---|
| A "failing" test failed because a package was missing, not because the feature was missing. | Reading the failure message instead of only the red status. | Each red run is now checked for the expected message before the test is committed. |
| A date check reported the same field twice for one mistake. | An API test that expects exactly one issue per wrong field. | The two checks became one. |
| A theme setting that older MUI versions accepted does not exist in MUI 9. | The type check failed. | The supported `variants` form is used instead. |
| A UI test looked for a date that appears twice on the page. | The test failed on its first run against the real page. | The test now looks inside the details panel only. |
| The first version of the assistant stopped an answer after its first line while looking finished. | Asking the live assistant a real question and comparing it with the Insights page. | A reply that stopped at the token limit is detected, marked as cut off and never cached. Gemini is asked for low reasoning effort. |
| The code did not send Gemini's thought signature back with tool results, which Gemini 3 refuses. | A live call with the tool result sent back without it returned a 400. | The signature is kept and sent back to Gemini only, with a documented placeholder for tool calls another provider made. |
| A 400 from a provider blocked it for an hour. | Reasoning about what a 400 means: one request was refused, not the provider broken. | A 400 now cools the provider for five minutes and logs it. Only a wrong key or model blocks it for an hour. |
| The AI assumed the free Gemini limits were generous. They are 20 requests a day on the main Flash models. | Reading the real rate limit page in AI Studio. | Daily budgets come from measured limits, and Groq is first in the default order. |
| A test used dollars where its helper multiplied by 100, so the tool reported a ratio of 1,600. | The test failed and the diff showed 1600. | The test data was corrected. The tool was right. |

## How I checked the AI's work
- The core behaviours were written test first: in the history, a commit with a failing test comes before the commit that makes it pass. After the adversarial review (docs/REVIEW.md), tests were added for gaps it found, and a mutation check showed they fail when the line they protect is broken.
- Each screen was opened in a real browser against the 10,000 seeded employees, because component tests cannot show a broken layout or wrong real data.
- The browser check showed something no test would: in the early hours, local time, the default date in the salary form is one day behind the local date, because the app uses the UTC date. That limit is recorded as assumption A5 and listed under what I would add next.
- Lint, type check, tests and build run on every push in GitHub Actions.

