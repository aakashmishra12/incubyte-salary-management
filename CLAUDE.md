# Incubyte take-home: Salary Management

## Goal
Complete Incubyte's "Salary Management Assessment" for the role **Software Craftsperson (Node / React / TypeScript) II**.

Aakash must be able to explain every part of it: design decisions, architecture, AI workflow, trade-offs considered, and possible improvements.

## Source of truth
- `docs/assignment/ASSIGNMENT.md` is the full assignment text. Read all of it first.
- `docs/REQUIREMENTS.md` is the checklist built from it.
- Never invent requirements. If something is unclear, raise it with Aakash and record the agreed assumption in `docs/ASSUMPTIONS.md`.

## The assignment in short
Build salary management software for ACME's HR Manager: 10,000 employees across multiple countries, currently in Excel. The HR Manager must manage salary data in a web app and answer questions about how the org pays people.
- A **one-page requirements document comes first**, before code: goal, scope and features, what is left out and why.
- Backend (Node.js, TypeScript) with a relational database, plus a React or Next.js UI with a component library.
- Seed script with 10,000 employees.
- Deployed and working, with a video demo.
- Meaningful, fast, deterministic unit tests. Incremental commits.
- Commit the thinking too: design notes, architecture diagram, AI prompts, trade-offs, performance notes.
- "We are not looking for the most complex system, but for good engineering judgment."

## What Incubyte said they are looking for
- Think deeply about the problem before coding
- Thoughtful, pragmatic design and architecture decisions
- Maintainable, understandable systems
- AI tools used intentionally, to improve quality and speed
- Clear thinking and structured problem solving
- Strong engineering fundamentals and product thinking
- Production-quality code **and tests**

Incubyte is a software craftsmanship company (TDD, XP, pairing). Tests and a clean commit history matter as much as features.

## Who you are working with
Aakash Mishra, full stack engineer. Explain TypeScript-specific choices (types, generics, config) when they come up.

He must understand and be able to explain every line. Optimise for his understanding, not for speed alone.

## Working agreement
1. **Stage by stage.** At the start of a stage, explain the plan in plain words and wait for "go". At the end, summarise what changed and why, list anything he should read closely, then stop.
2. **Small commits.** One logical change per commit. Use test-first where it fits: a `test:` commit with the failing test, then a `feat:` or `fix:` commit that makes it pass, then `refactor:` if needed. Conventional commit messages.
3. **Explain, don't dump.** No code he cannot explain. Point out the non-obvious lines.
4. **Log AI use** in `docs/AI_USAGE.md` as you go: what was asked, what was decided or kept, and how it was checked.
5. **Log decisions** in `docs/DECISIONS.md`: context, options, choice, trade-off.
6. **Keep it simple.** No over-engineering. But production quality: input validation, error handling, sensible structure, tests for business rules and edge cases.
7. **Git identity:** `Aakash Mishra <theaakashdevsops@gmail.com>` (see the check below). No other account or email.
8. **No secrets** in the repo. `.env` stays ignored; provide `.env.example`.
9. **Dependencies:** well-known packages only. Check install scripts before adding anything unusual.

## Default stack (propose and confirm in Stage 0)
TypeScript end to end, because the role is Node / React / TypeScript:
- Backend: Node.js with Express or Fastify, input validation with Zod
- Database: SQLite (the assignment names it). Decide in Stage 0 whether the deploy target needs PostgreSQL instead, and record why
- UI: React with Vite, or Next.js, with one component library (for example shadcn/ui or MUI)
- Tests: Vitest; Supertest for API tests; React Testing Library for key UI flows
- Tooling: ESLint, Prettier, GitHub Actions running lint and tests
- Deploy: one simple host that fits the database choice

## Stages
Stage 0 (understand and scope) is done: see `docs/requirements-one-pager.md` and `docs/DECISIONS.md`.

From here the work follows the slices in `docs/PLAN.md`, in order. Each slice goes: short spec with acceptance criteria in `docs/specs/`, failing test, smallest code that passes, refactor, review by Aakash, commit. Each slice starts with a plain-words plan and a "go", and ends with a summary.

## Repo visibility
Incubyte needs a link they can open. The repo under `aakashmishra12` is private during development and is made public at submission.

## Git identity check (do this before the first commit)
The GitHub account `aakashmishra12` has several emails attached. Set the repo's identity locally so commits only carry the right one:
`git config user.name "Aakash Mishra"` and `git config user.email "theaakashdevsops@gmail.com"`. Verify with `git log --format='%an <%ae>'` after the first commit.

## Definition of done
- Every item in `docs/REQUIREMENTS.md` is checked.
- Tests pass locally and in CI.
- The project runs with one documented command, the seed creates 10,000 employees, and the deployed URL works.
- The video demo is recorded.
- README is complete.
- Aakash can explain the code, the design and the AI workflow.
