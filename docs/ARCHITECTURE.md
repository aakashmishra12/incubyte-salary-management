# Architecture

## The whole system
One Node.js process serves both the API and the built React app. The data lives in one SQLite file next to it.

```mermaid
flowchart LR
    HR[HR Manager's browser]

    subgraph Server["One Node.js process"]
        direction TB
        Static["Built React app<br/>(static files)"]
        subgraph API["Express API under /api"]
            direction TB
            Routes["Routes<br/>HTTP and input validation (Zod)"]
            Services["Services<br/>use cases, transactions"]
            Domain["Domain<br/>pure pay rules"]
            Repos["Repositories<br/>all SQL"]
            Routes --> Services
            Services --> Domain
            Services --> Repos
        end
    end

    DB[("SQLite file<br/>employees, salary_changes")]

    HR -- "page load" --> Static
    HR -- "JSON over HTTP" --> Routes
    Repos --> DB
```

## The layers on the server
A request moves down through four layers, and each layer knows only the one below it.

| Layer | Folder | Job | Knows about |
|---|---|---|---|
| Routes | `server/src/routes` | Read the request, check its shape with a Zod schema, call a service, send JSON. | HTTP |
| Services | `server/src/services` | One function per use case. Load data, ask the rules, write in a transaction. | The rules and the repository |
| Domain | `server/src/domain` | The pay rules: money, statistics, outliers, salary change rules, insights. Pure functions. | Nothing outside itself |
| Repositories | `server/src/repositories` | Every SQL statement in the app. | The database |

Why this split:
- **The rules are testable in isolation.** The domain folder imports no database and no web framework, so its tests run in milliseconds and cannot break for technical reasons.
- **SQL is in one place.** Moving to PostgreSQL would change the repositories folder and `db`, and nothing else.
- **Dependencies are passed in.** `createApp` receives the database and the clock. Tests pass an in-memory database and a fixed time, which is what makes them deterministic.

## What happens when a salary changes
```mermaid
sequenceDiagram
    participant B as Browser
    participant R as Route
    participant S as Service
    participant D as Domain rules
    participant P as Repository
    participant Q as SQLite

    B->>R: POST /api/employees/42/salary-changes
    R->>R: Validate the body (Zod). Bad shape: 400
    R->>S: changeSalary(42, input)
    S->>P: load the employee and history
    P->>Q: SELECT
    S->>D: checkSalaryChange(state, request, today)
    D-->>S: allowed, or the rule that was broken (409 or 422)
    S->>P: in one transaction
    P->>Q: UPDATE employees (salary and USD amount)
    P->>Q: INSERT INTO salary_changes
    S-->>R: the updated employee and history
    R-->>B: 201 and JSON
    B->>B: show the new salary, mark lists and insights as out of date
```

## The pay assistant
The assistant lets the HR Manager ask about pay in plain words. The important design rule is that **the model never produces a number**. It can only choose between four read-only tools that wrap code that is already tested, and it copies what they return.

```mermaid
flowchart LR
    Q[Question from the panel] --> Cache{Same question,<br/>same data?}
    Cache -- yes --> Free[Cached answer<br/>no model, no allowance used]
    Cache -- no --> Limit{Visitor and daily<br/>limits}
    Limit -- over --> R429[429 with the wait]
    Limit -- ok --> Loop

    subgraph Loop["Tool loop: at most 4 rounds"]
        direction TB
        Fail[Failover over providers<br/>Groq, Gemini, OpenRouter, NVIDIA, Ollama]
        Tools[Four read-only tools]
        Fail -- "asks for a tool" --> Tools
        Tools -- "result as text with currency" --> Fail
    end

    Loop --> A[Answer + sources + who answered]
    Tools --> Services[Insight and employee services<br/>the same tested code as the screens]
```

| Part | Where | What it does |
|---|---|---|
| Tools | `server/src/assistant/tools.ts` | Overview, breakdown, outliers and employee search. Amounts become text with their currency, shares and ratios are computed here, lists are capped at ten, and a mistake by the model comes back as an error it can correct. Nothing can change data. |
| Provider client | `providerClient.ts` | One client for any provider with the OpenAI-style chat API and tools. Failures are sorted into rate limited, unavailable, refused and misconfigured. Error messages are fixed text, so a key can never leak. |
| Failover | `failover.ts` | Tries providers in order within one question. Leaves a failing provider alone for the time it asked for, and keeps a daily budget per provider that counts failed attempts too. A provider chosen by hand is never silently replaced. |
| Limits | `usageLimiter.ts` | 20 new questions per visitor per hour and 300 per day overall. Both are settings. A refused question costs nothing, and a question no provider could answer is given back. |
| Cache | `answerCache.ts` | A repeated first question is answered for free. The key includes a number that changes whenever any employee data changes, so a remembered answer can never be out of date. |
| Service | `assistantService.ts` | The order of checks (cache, limits, providers), the tool loop and its limits, and the instructions given to the model. |

## The web app
| Part | Folder | Job |
|---|---|---|
| Pages | `web/src/pages` | One per screen: employee list, employee detail, add employee, insights. |
| Components | `web/src/components` | The dialogs and shared form pieces. |
| API | `web/src/api` | The only code that calls `fetch`, plus the TanStack Query hooks that cache server data. |
| Format | `web/src/format` | Turning minor units and ISO dates into text, and typed text back into minor units. |

Two choices worth knowing:
- **Server data is not copied into component state.** TanStack Query holds it, keyed by the request. After a change, the affected keys are marked as out of date and reload when next shown.
- **Filters live in the address bar.** The employee list reads its search, filters, sort and page from the URL, so a view can be bookmarked and the back button works.

## Data model
```mermaid
erDiagram
    employees ||--o{ salary_changes : "has history"
    employees {
        integer id PK
        text employee_code UK
        text first_name
        text last_name
        text email UK
        text country
        text department
        text level
        text job_title
        text hire_date
        text status "active or left"
        text left_on
        text currency
        integer salary_minor "local currency, smallest unit"
        integer salary_usd_minor "derived, fixed rates"
    }
    salary_changes {
        integer id PK
        integer employee_id FK
        integer previous_minor "null for the starting salary"
        integer new_minor
        text currency
        text effective_date
        text reason
    }
```

Countries, currencies, exchange rates, departments and levels are fixed lists in code (`server/src/domain/reference.ts`), not tables. They change rarely, and a change should go through review.

## Where each decision is explained
The reasons behind these choices, with the options that were turned down, are in [DECISIONS.md](DECISIONS.md).
