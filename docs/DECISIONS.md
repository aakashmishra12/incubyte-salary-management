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
- **Status:** Proposed
- **Context:** The role is Node, React and TypeScript. The assignment asks for a relational database and a component library.
- **Decision:** TypeScript on both sides. Express 5 with Zod for input validation. SQLite with hand-written SQL behind a repository layer. React with Vite and MUI. Vitest, Supertest and React Testing Library. GitHub Actions.
- **Options considered and why not:**
  - Next.js: we have our own API and need no server rendering, so it adds concepts without a benefit here.
  - PostgreSQL: more capable, and needs a hosted database and setup for anyone running the project. 10,000 rows with one user is well inside what SQLite handles.
  - An ORM (Prisma, Drizzle): hides the SQL. There are about ten queries, and plain SQL is easier to read and to explain.
  - Fastify: a fine choice. Express is the one more people know.
- **Trade-off:** SQLite is a single file on one server. If ACME needed several app servers or many concurrent writers, the repository layer is the only place that would change to move to PostgreSQL.
- **Open:** SQLite driver. `better-sqlite3` is mature and needs a native binary on the host. Node's built-in `node:sqlite` needs no install and is marked release candidate in Node 26. To be settled in Stage 1 by deploying a skeleton.

## D-010: Statistics are computed in code, not in SQL
- **Status:** Proposed
- **Context:** SQLite has no median function.
- **Options considered:** (a) Median in SQL with window functions. (b) Fetch only group and amount for active employees and compute in plain TypeScript functions.
- **Decision:** (b).
- **Trade-off:** 10,000 small rows are read per insight request, which is a few milliseconds and will be measured. In return the business rules are pure functions that are tested without a database. At millions of rows this would move into SQL or a summary table.

## D-011: Work in vertical slices, each with a short spec first
- **Status:** Proposed
- **Context:** The commit history must show how the solution evolved, and the app should be deployable early.
- **Options considered:** (a) Layer by layer: all of the database, then all of the API, then all of the UI. (b) Feature by feature, each from database to screen.
- **Decision:** (b). Each slice starts with acceptance criteria in `docs/specs/`, then a failing test, then the code, then a refactor. The app is deployed from the first slice.
- **Trade-off:** Some early code is revisited when a later slice needs more from it. Every commit leaves a working app, and nothing is integrated late.
