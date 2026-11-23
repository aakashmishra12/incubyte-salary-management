# Salary Management

A web app for an HR Manager to manage salary data for 10,000 employees across several countries, and to answer questions about how the organisation pays people.

Built as a take-home assessment for Incubyte. **Status: in progress.** The walking skeleton is in place and the features follow, slice by slice.

## Where to start reading
| Document | What it is |
|---|---|
| [Requirements one-pager](docs/requirements-one-pager.md) | Goal, features, and what is left out and why. Written before any code. |
| [Decisions](docs/DECISIONS.md) | Each design decision with the options considered and the trade-off. |
| [Assumptions](docs/ASSUMPTIONS.md) | Where the assignment was open, what I assumed and how the code isolates it. |
| [Delivery plan](docs/PLAN.md) | The slices in order, the commit conventions and the test strategy. |
| [Specs](docs/specs/) | Acceptance criteria for each slice, written before its tests. |
| [How AI was used](docs/AI_USAGE.md) | What I asked, what I kept, what I changed. |
| [Research notes](docs/research-notes.md) | What I looked up before deciding, with sources. |
| [The assignment](docs/assignment/ASSIGNMENT.md) | The original text. |

## How to run
Needs Node.js 24 or later (the project is developed on Node 26).

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

## Checks
```bash
npm test              # all tests, server and web
npm run lint          # ESLint
npm run typecheck     # TypeScript, no output files
npm run format:check  # Prettier
```

## Project layout
```
server/   Express API (TypeScript, run directly by Node)
web/      React app (Vite, MUI)
docs/     Requirements, decisions, plan, specs and notes
```

## Design overview
_Grows with each slice. See the architecture paragraph in [the plan](docs/PLAN.md)._

## Trade-offs and what I would improve next
_To be written at the end. Until then, each trade-off is recorded with its decision in [docs/DECISIONS.md](docs/DECISIONS.md)._
