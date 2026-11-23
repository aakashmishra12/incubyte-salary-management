# Salary Management

A web app for the HR Manager of ACME, a company with 10,000 employees in eight countries, whose salary data lived in Excel. It does two jobs:

1. **Manage salary data:** find anyone in seconds, see their pay and how it changed, record a new salary with a date and a reason, add joiners and mark leavers.
2. **Answer questions about pay:** what the company spends and where, what a role typically earns in each country, and who is paid far above or below their peers.

Built as a take-home assessment for Incubyte.

- **Live app:** _added at submission_
- **Video demo:** _added at submission_

## Where to start reading
| Document | What it is |
|---|---|
| [Requirements one-pager](docs/requirements-one-pager.md) | Goal, features, and what is left out and why. Written before any code. |
| [Decisions](docs/DECISIONS.md) | Each design decision with the options considered and the trade-off. |
| [Assumptions](docs/ASSUMPTIONS.md) | Where the assignment was open, what I assumed and how the code isolates it. |
| [Architecture](docs/ARCHITECTURE.md) | Diagrams of the system, the layers, a salary change and the data model. |
| [Delivery plan](docs/PLAN.md) | The slices in order, the commit conventions and the test strategy. |
| [Specs](docs/specs/) | Acceptance criteria for each slice, written before its tests. |
| [Performance](docs/PERFORMANCE.md) | Measured times with 10,000 employees, and what would change at larger scale. |
| [How AI was used](docs/AI_USAGE.md) | What I asked, what I kept, what went wrong and how it was caught. |
| [AI instructions](CLAUDE.md) | The standing instructions the AI tool worked under. |
| [Research notes](docs/research-notes.md) | What I looked up before deciding, with sources. |
| [The assignment](docs/assignment/ASSIGNMENT.md) | The original text. |

The commit history is meant to be read from the first commit: documents first, then each slice as spec, failing test, code.

## What it does
| Screen | What the HR Manager can do |
|---|---|
| **Employees** | Browse 10,000 employees 25 at a time. Search by name, email or employee ID. Filter by country, department, level and status. Sort by any main column, including salary compared in USD. The filters live in the address bar, so a view can be bookmarked. |
| **Employee** | See the details, the current salary in local currency with the approximate USD amount, and the full salary history. Change the salary with an effective date and a reason. Correct details. Mark as left. |
| **Add employee** | Add a joiner. The employee ID is assigned, and the salary is asked for in the currency of the chosen country. |
| **Insights** | Headcount and annual cost overall and per country. Lowest, median, average and highest salary by country, department or level, narrowed to any combination. A list of pay outliers with the reason for each flag. |

## How to run
Needs Node.js 24 or later (developed on Node 26). No other setup: the database is a file that the app creates.

```bash
npm install
npm run dev
```

The app opens on http://localhost:5173. The API runs on http://localhost:3000.

The first start creates the database and fills it with 10,000 employees. To rebuild it at any time:

```bash
npm run seed
```

The seed is deterministic: every run produces the same 10,000 people, byte for byte.

To run it the way it runs in production, as one process on one port:

```bash
npm run build
npm start
```

| Setting | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | The port the server listens on. |
| `DATABASE_FILE` | `server/data/salary.sqlite` | Where the SQLite file is kept. |

## Checks
```bash
npm test              # all tests, server and web (about 240, a few seconds)
npm run lint          # ESLint
npm run typecheck     # TypeScript, no output files
npm run format:check  # Prettier
npm run coverage      # test coverage for both packages
npm run measure       # times the main operations against 10,000 employees
```

GitHub Actions runs lint, format check, type check, tests and build on every push.

## Design in brief
- **One process, one file.** An Express server serves the API and the built React app. The data is one SQLite file. There is nothing else to install or host.
- **Four layers on the server.** Routes handle HTTP and validate input. Services hold the use cases. The domain holds the pay rules as pure functions. Repositories hold all the SQL.
- **Money is whole numbers.** Every amount is stored and sent in the smallest unit of its currency, so there are no rounding errors. The browser formats it.
- **Salaries stay in local currency.** USD is used only to compare and to add up across countries, with fixed and dated rates, and is labelled as approximate everywhere.
- **Nothing is overwritten or deleted.** Every salary change adds a history row. Leavers are marked, not removed.
- **Outliers can be explained.** A flag means "paid below 80% or above 120% of the median of people in the same country, department and level". The page shows the numbers behind each flag and says how many people could not be rated.

The diagrams are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Testing approach
| Level | What it covers | How |
|---|---|---|
| Domain | Every pay rule and its edge cases: empty groups, even and odd counts, exact boundaries, currencies with no decimals. | Plain function calls. No database. |
| API | Every endpoint with valid input, invalid input and broken rules. | Supertest against the real app with an in-memory SQLite database. |
| UI | The flows a user performs: search, filter, sort, page, change a salary, add, edit, mark as left, read each insight. | React Testing Library. `fetch` is replaced by a stub that records what the page asked for. |

No test depends on the current date, the network or random data. The clock and the random seed are passed in.

## Trade-offs
Each is recorded with its alternatives in [docs/DECISIONS.md](docs/DECISIONS.md). The main ones:

| Choice | What it costs |
|---|---|
| No login (D-008) | Not safe for real salary data as it stands. The deployed app holds generated data only. |
| SQLite (D-009) | One server and one writer at a time. Right for one HR Manager, wrong for many app servers. |
| Fixed exchange rates (D-003) | Cross-country figures are approximate. In return, totals do not move from day to day and tests are deterministic. |
| Statistics computed in code, not SQL (D-010) | Each insight reads about 10,000 small rows (6 to 9 ms). In return, the rules are pure tested functions. |
| USD amount stored on each row (D-014) | Derived data that must be recomputed if the rates change. In return, the database can sort and sum by pay. |
| Peer median as the reference, not a pay band (D-002) | It shows who differs from their colleagues, not whether the whole group is paid fairly against the market. |
| API types repeated by hand in the web app | Two small files can drift apart. A shared package or a generated client would prevent it, with more build setup. |

## What I would add next
In the order I would do them:

1. **Login, roles and an audit of who made each change.** The history records what changed and why, but not who.
2. **HTTPS on a proper domain** for the deployed app.
3. **Import from Excel and export to it.** A real migration starts from the existing spreadsheets, and HR will always want to take numbers out.
4. **Pay bands per role and country,** which would allow range penetration and a comparison with the market, not only with colleagues.
5. **Protection against two people editing the same employee,** by refusing a save that is based on an out-of-date version.
6. **Future-dated and back-dated changes,** with the current salary derived from the history by date.
7. **Time zones.** "Today" is the server's UTC date. A user ahead of UTC cannot yet choose their own date in the first hours of their day.
8. **A browser test of the main flow** against the running app, in addition to the component tests.
9. **Exchange rates as dated data** with a recompute step, in place of constants in code.
10. **Search that scales,** using SQLite full-text search, when the table is much larger.

## How AI was used
The assignment requires AI tools. I used Claude Code, working under the written instructions in [CLAUDE.md](CLAUDE.md): requirements and a spec before code, a failing test before the code that passes it, one slice at a time, and nothing committed that I cannot explain. The log of what was asked, what was kept, and what the AI got wrong is in [docs/AI_USAGE.md](docs/AI_USAGE.md).

## Project layout
```
server/src/
  domain/         pay rules: money, statistics, outliers, insights (pure functions)
  repositories/   all SQL
  services/       use cases and transactions
  routes/         HTTP endpoints and input validation
  http/           error handling and shared schemas
  db/             connection and migrations
  seed/           deterministic generator and seed command
web/src/
  pages/          one file per screen
  components/     dialogs and form helpers
  api/            fetch client, types and data hooks
  format/         money and date formatting
docs/             requirements, decisions, specs, architecture, performance, AI usage
```
