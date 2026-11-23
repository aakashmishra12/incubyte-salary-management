# Delivery plan

Written on 23 Nov 2026, after the requirements one-pager and before any code.

## How each piece of work is done
1. **Spec.** A short file in `docs/specs/` with the user story and acceptance criteria that can be tested.
2. **Red.** A failing test for the first criterion, committed as `test:`.
3. **Green.** The smallest code that makes it pass, committed as `feat:` or `fix:`.
4. **Refactor.** Clean up with the tests green, committed as `refactor:`.
5. **Review.** I read every line the AI wrote before it is committed. Anything I cannot explain is rewritten or removed.
6. **Ship.** CI runs lint, type checks and tests on every push. The main branch is always deployable.

## Commit history
The history is meant to be read from the first commit to the last as the story of the build.
- The documents come first: assignment, requirements one-pager, decisions, plan. Code starts after them.
- One logical change per commit, with conventional messages: `docs:`, `test:`, `feat:`, `fix:`, `refactor:`, `chore:`.
- The scope names the slice, and the message names the feature from the one-pager where one applies. Example: `test(employees): filter by country returns only that country (F2)`.
- A `test:` commit with the failing test comes before the `feat:` commit that makes it pass.
- A change of mind is a new commit and a new entry in `docs/DECISIONS.md`. History is never rewritten to hide it.

## Slices, in order
| # | Slice | What exists at the end |
|---|---|---|
| 0 | Walking skeleton | Repository, TypeScript, lint, formatter, tests, CI, a health endpoint and one page that calls it. Every later slice adds to an app that already builds, tests and runs. |
| 1 | Pay rules | Money, currency conversion, median and spread, compa-ratio and the outlier rule, as pure tested functions. |
| 2 | Data | Schema, indexes, migration, and a deterministic seed of 10,000 employees. |
| 3 | Browse employees | Table with pagination, sorting, search and filters, from database to screen. |
| 4 | Change a salary | Employee detail, salary change with date and reason, salary history. |
| 5 | Maintain employees | Add an employee, edit details, mark as left. |
| 6 | Insights | Overview, breakdown by country, department or level, and outliers. |
| 7 | Hardening | Error and empty states, edge cases, accessibility pass, measurements in `docs/PERFORMANCE.md`. |
| 8 | Pay assistant (F9) | A panel where the HR Manager asks about pay in plain words. A model can only call four read-only tools over tested code, providers fail over, and limits and a self-emptying cache protect the free allowances. Added after the first plan, and recorded in D-020 to D-023. |
| 9 | Submission | README, architecture diagram, AI usage log, video demo, final check against `docs/REQUIREMENTS.md`. |

## Architecture in one paragraph
One repository with a `server` and a `web` package. The server has four layers: routes (HTTP and input validation), services (use cases such as "change a salary"), repositories (the only place with SQL) and domain (pure functions for the pay rules). The React app talks to the server through a JSON API. In production the server also serves the built React app, so there is one thing to deploy. A diagram follows in `docs/ARCHITECTURE.md` once the skeleton exists.

## Test strategy
| Level | What it covers | Tooling |
|---|---|---|
| Domain | Every pay rule and its edge cases: empty group, one person, even and odd counts, small groups, zero-decimal currencies | Vitest, no database |
| API | Each endpoint with valid and invalid input, against an in-memory SQLite database | Vitest and Supertest |
| UI | The key flows: filter the table, change a salary, read an insight | React Testing Library |

No test depends on the clock, the network or random data. Dates and the random seed are passed in.

## Risks
| Risk | Answer |
|---|---|
| The database file is lost or the server is rebuilt | The app seeds itself when the database is empty, so recovery is one command. See D-012. |
| Scope grows | The one-pager is the boundary. New ideas go to "what I would add next". |
| AI output that looks right and is wrong | Tests first, and line-by-line review before every commit. |
