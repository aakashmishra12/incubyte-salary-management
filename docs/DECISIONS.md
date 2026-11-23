# Decision log

One entry per decision. Status is Accepted, Proposed (waiting for my review) or Superseded.

## D-001: Which pay questions the app answers
- **Status:** Accepted, 23 Nov 2026
- **Context:** The assignment says the HR Manager must "answer questions about how the org pays people" and leaves the questions open.
- **Options considered:** (a) Totals and averages only. (b) Totals, spread per group and outliers. (c) A full analytics tool with custom reports, pay bands and equity analysis.
- **Decision:** (b). Headcount and cost per country, minimum, median, average and maximum per country, department or level, and outliers against peers.
- **Trade-off:** Fixed questions are less flexible than a report builder. They are the questions HR is asked most, and each one is a small tested function.

## D-002: How outliers are defined
- **Status:** Accepted, 23 Nov 2026
- **Context:** "Paid far above or below peers" needs a precise rule.
- **Options considered:** (a) Compa-ratio against a pay band midpoint, the usual HR method. (b) Compa-ratio against the median of the peer group. (c) A statistical rule such as 1.5 times the interquartile range.
- **Decision:** (b). Compa-ratio is salary divided by the peer median. Peers share country, department and level. Below 0.80 or above 1.20 is flagged. Groups under 5 people are not rated.
- **Trade-off:** ACME has no pay bands in its data, so (a) is not possible. The 80% to 120% zone is the common HR comfort range, and an HR Manager can explain it to anyone, which is harder with (c). A flag is a prompt to look, not proof of unfair pay.

## D-003: Multiple currencies
- **Status:** Accepted, 23 Nov 2026
- **Context:** Salaries in different countries cannot be added or compared directly.
- **Options considered:** (a) Local currency only, no cross-country view. (b) Convert everything to USD on entry. (c) Store local, convert to USD for comparison with a fixed dated rate table. (d) Live rates from an API.
- **Decision:** (c).
- **Trade-off:** Converted figures are approximate and the UI says so. (b) loses the real salary. (d) adds an outside dependency and makes tests and totals change from day to day.

## D-004: Money is stored as whole numbers
- **Status:** Accepted, 23 Nov 2026
- **Context:** JavaScript numbers are floating point, so 0.1 + 0.2 is not exactly 0.3.
- **Options considered:** (a) Decimal column and floats in code. (b) Integer in the smallest unit of the currency. (c) A decimal library.
- **Decision:** (b). The currency table records how many decimals each currency has (the yen has none).
- **Trade-off:** Amounts must be formatted for display in one place. No rounding drift and no extra library.

## D-005: Salary history is kept
- **Status:** Accepted, 23 Nov 2026
- **Context:** In Excel a changed cell loses the old value and nobody knows who changed it or why.
- **Options considered:** (a) Overwrite. (b) Append a history row on every change, with effective date and reason.
- **Decision:** (b). The employee row holds the current salary and the history table holds every change. Both are written in one transaction.
- **Trade-off:** One more table and the current salary is stored twice. Reads of the current salary stay simple and fast.

## D-006: Employees are marked as left, never deleted
- **Status:** Accepted, 23 Nov 2026
- **Context:** "Manage" includes people leaving.
- **Options considered:** (a) Hard delete. (b) A status of active or left.
- **Decision:** (b). People who have left are excluded from insights.
- **Trade-off:** Every insight query must filter on status. History and past records stay intact.

## D-007: Salary means annual gross base salary
- **Status:** Accepted, 23 Nov 2026
- **Context:** Real pay has bonus, equity and allowances.
- **Decision:** One figure per employee. Components are left out.
- **Trade-off:** Total compensation cannot be shown. The model stays small and every insight has one clear meaning.

## D-008: No login
- **Status:** Accepted, 23 Nov 2026. See assumption A1 in ASSUMPTIONS.md.
- **Context:** Salary data is sensitive, and the assignment names one persona and does not mention authentication.
- **Decision:** No login. The deployed app holds generated data only.
- **Trade-off:** Not safe for real data as it stands. Authentication and an audit of who made each change are the first items under "what I would add next".

## D-009: Stack
- **Status:** Accepted, 23 Nov 2026
- **Context:** The role is Node, React and TypeScript. The assignment asks for a relational database and a component library.
- **Decision:** TypeScript on both sides. Express 5 with Zod for input validation. SQLite with hand-written SQL behind a repository layer. React with Vite and MUI. Vitest, Supertest and React Testing Library. GitHub Actions.
- **Options considered and why not:**
  - Next.js: we have our own API and need no server rendering, so it adds concepts without a benefit here.
  - PostgreSQL: more capable, and needs a hosted database and setup for anyone running the project. 10,000 rows with one user is well inside what SQLite handles.
  - An ORM (Prisma, Drizzle): hides the SQL. There are about ten queries, and plain SQL is easier to read and to explain.
  - Fastify: a fine choice. Express is the one more people know.
- **Trade-off:** SQLite is a single file on one server. If ACME needed several app servers or many concurrent writers, the repository layer is the only place that would change to move to PostgreSQL.
- **SQLite driver (settled in the data slice):** `better-sqlite3`. Node's built-in `node:sqlite` needs no install, and it is still marked release candidate in Node 26. `better-sqlite3` is mature, and version 13 ships ready-made binaries for macOS, Linux and Windows inside the package, so nothing is compiled on install. Its optional build script is switched off in `package.json` (`allowScripts`). All SQL sits behind the repository layer, so changing the driver later touches one folder.

## D-010: Statistics are computed in code, not in SQL
- **Status:** Accepted, 23 Nov 2026
- **Context:** SQLite has no median function.
- **Options considered:** (a) Median in SQL with window functions. (b) Fetch only group and amount for active employees and compute in plain TypeScript functions.
- **Decision:** (b).
- **Trade-off:** 10,000 small rows are read per insight request, which is a few milliseconds and will be measured. In return the business rules are pure functions that are tested without a database. At millions of rows this would move into SQL or a summary table.

## D-011: Work in vertical slices, each with a short spec first
- **Status:** Accepted, 23 Nov 2026
- **Context:** The commit history must show how the solution evolved, and the app should be deployable early.
- **Options considered:** (a) Layer by layer: all of the database, then all of the API, then all of the UI. (b) Feature by feature, each from database to screen.
- **Decision:** (b). Each slice starts with acceptance criteria in `docs/specs/`, then a failing test, then the code, then a refactor. The app is deployed from the first slice.
- **Trade-off:** Some early code is revisited when a later slice needs more from it. Every commit leaves a working app, and nothing is integrated late.

## D-012: Hosting on a VPS
- **Status:** Accepted, 23 Nov 2026
- **Context:** The app must be deployed and working. SQLite is a file, so the host needs a disk that survives restarts.
- **Options considered:** (a) A free platform host. Deploys on every push, and the free tier has no persistent disk and sleeps when idle, so the first visit is slow and edits are lost on restart. (b) A Linux VPS I have access to, running the Node process behind the web server that is already there.
- **Decision:** (b). The app still seeds itself when the database is empty, so a fresh server needs one command.
- **Trade-off:** Setup and updates are manual steps that a platform would do for me, and they are written down in the README. In return the data persists, there is no cold start during a review, and the deployment is something I can explain end to end.

## D-013: TypeScript 6.0, run directly by Node on the server
- **Status:** Accepted, 23 Nov 2026
- **Context:** TypeScript 7.0 is the newest release. Node 24 and later can run TypeScript files directly by removing the type annotations.
- **Options considered:** (a) TypeScript 7.0. (b) TypeScript 6.0. For running the server: (c) compile to JavaScript with `tsc` and run the output, (d) let Node run the `.ts` files and use `tsc` only to check types.
- **Decision:** (b) and (d).
- **Trade-off:** The lint tooling (typescript-eslint) supports TypeScript up to 6.0 only, and working lint matters more than the newest compiler. Running `.ts` directly removes a build step and a second copy of the code. In exchange, a few TypeScript features that generate code (such as enums) cannot be used, and the `erasableSyntaxOnly` setting makes the compiler reject them. The server needs Node 24 or later.

## D-014: Store the USD equivalent next to each salary
- **Status:** Accepted, 23 Nov 2026
- **Context:** Sorting the employee list by pay and summing cost across countries both need one currency.
- **Options considered:** (a) Convert in every query with a rate lookup. (b) Convert in application code after loading the rows. (c) Store `salary_usd_minor` on each employee row, written whenever the salary is written.
- **Decision:** (c).
- **Trade-off:** It is derived data, so it must be recomputed if the rates change. The rates are fixed by decision D-003, the write happens in one function, and in return the database can sort, filter and sum by pay with a plain column.

## D-015: The API sends money as whole minor units with a currency code
- **Status:** Accepted, 24 Nov 2026
- **Context:** Amounts cross from the database to the server to the browser as JSON numbers.
- **Options considered:** (a) Decimal major units such as `85000.5`. (b) Text such as `"85000.50"`. (c) Whole minor units such as `8500050` plus `"USD"`.
- **Decision:** (c), the same convention payment APIs use.
- **Trade-off:** A person reading the JSON must know that 8500050 means 85,000.50. In return no floating point value ever crosses the wire, and one function in the browser does all the formatting.

## D-016: Rule violations answer 422, state conflicts answer 409, bad shapes answer 400
- **Status:** Accepted, 24 Nov 2026
- **Context:** The UI needs to tell "you typed something invalid" from "this is not allowed".
- **Decision:** 400 with the field name when the request has the wrong shape (checked by Zod before any code runs). 422 when the shape is right and a business rule refuses it, such as a date in the future. 409 when the employee's state forbids the action, such as changing the salary of someone who has left, or a duplicate email. Anything unexpected is a 500 with no internal details.
- **Trade-off:** Three codes to explain instead of one. The browser can show the server's message as it is, and never has to repeat the rules.

## D-017: Reference data lives in code, not in tables
- **Status:** Accepted, 24 Nov 2026
- **Context:** Countries, currencies, exchange rates, departments and levels are needed by validation, the seed and the UI.
- **Options considered:** (a) Tables with screens to edit them. (b) Constants in one file, served to the UI by one endpoint.
- **Decision:** (b).
- **Trade-off:** Adding a country needs a code change and a deploy. These lists change rarely, a change to a rate should be reviewed, and TypeScript can check every use of a country or currency code at compile time.

## D-018: The employee list keeps its filters in the address bar
- **Status:** Accepted, 24 Nov 2026
- **Context:** Search, filters, sort and page are state that the user builds up.
- **Options considered:** (a) Component state. (b) URL query parameters.
- **Decision:** (b).
- **Trade-off:** A little more code to read and write the address. In return a view can be bookmarked or shared, refresh keeps it, and the back button undoes a filter.

## D-019: One design language, applied through the MUI theme
- **Status:** Accepted, 24 Nov 2026
- **Context:** The app was built on MUI's default look. It worked, and it looked like every MUI demo.
- **Options considered:** (a) Keep the default. (b) Style each screen by hand. (c) Adopt one written design language and apply it in one theme file.
- **Decision:** (c). The reference is `docs/design/DESIGN.md`, an open-source description of a Vercel-inspired design language (ink on near-white, hairline borders, the Geist typeface). `web/src/theme.ts` turns its tokens into an MUI theme.
- **Trade-off:** The look is borrowed, not designed for ACME. In return it is consistent, written down, and changing it later means changing one file. The parts of the reference meant for marketing pages (the gradient, pill buttons) are left out, for the reasons in `docs/design/README.md`. No test changed, because the tests check behaviour and not appearance.

## D-020: Add a pay assistant, and make the model unable to invent numbers
- **Status:** Accepted, 24 Nov 2026. This adds a feature after the one-pager was written (F9).
- **Context:** The HR Manager's real question is often "who is paid furthest above their peers in India?", asked in words and not in filters. The assignment does not require an assistant, but it is titled "Build with AI", and asking in words is the natural way to answer the pay questions.
- **Options considered:** (a) Let the model write SQL. (b) Put the whole employee table in the prompt. (c) Give the model a few fixed, read-only tools that wrap code that is already tested, and let it only choose which tool to call and phrase the result.
- **Decision:** (c).
- **Trade-off:** The assistant can only answer what the tools cover. In return no figure comes from the model, it cannot read or change anything else, an injected instruction has nothing dangerous to call, and every answer can be checked against a screen the app already has. A model can still misstate a figure it was given, which is why each answer lists its sources.

## D-021: Providers behind one OpenAI-style interface, with failover and a daily budget
- **Status:** Accepted, 24 Nov 2026
- **Context:** Free model APIs change their limits and their model lists without notice. The research found sources that disagreed about what some providers still offer.
- **Options considered:** (a) One provider's own SDK. (b) The OpenAI-style chat format with tools, which Groq, OpenRouter and Ollama all accept, behind one small interface, with the provider chosen by settings.
- **Decision:** (b). Providers are tried in order. A limited or failing provider is skipped for a cooling-off time. Each has a daily budget of calls that counts failed attempts too, because OpenRouter's free tier counts them.
- **Trade-off:** I wrote about 100 lines of client instead of using an SDK, and use only the features all providers share. In return a provider can be added or dropped with settings, and no provider's outage or limit ends the feature.

## D-022: Limits and a cache that cannot go stale
- **Status:** Accepted, 24 Nov 2026
- **Context:** The live app has no login, and a free allowance is shared by every visitor. Anyone who finds the address could use it all.
- **Decision:** 20 new questions per visitor per hour and 300 per day overall, both settings. A repeated first question is answered from a cache of at most 100 answers for at most an hour, keyed by the question and by SQLite's count of rows changed on the connection, so any data change empties the cache without any code having to remember to.
- **Trade-off:** Limits and cache are in memory, so a restart resets them, and visitors are told apart by IP address, so people behind one office address share an allowance. A durable counter would need a table, which is more than a demo needs.

## D-023: What the model is allowed to see
- **Status:** Accepted, 24 Nov 2026
- **Context:** Questions and tool results are sent to an outside service. Some free tiers log prompts or may train on them.
- **Decision:** The tools return totals and breakdowns, and the outlier and search tools return at most 10 named employees per call. All data in this app is generated. Keys live in the server's environment only.
- **Trade-off:** Fine for generated data. For real salary data I would send aggregates only, and use a provider with a data processing agreement and no training on inputs.

