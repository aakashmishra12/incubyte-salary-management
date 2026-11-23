# Performance

The requirement is 10,000 employees. That is small for a database, so the goal here is not clever optimisation. It is to make sure nothing in the design does work in proportion to the whole table when it does not need to, and to measure instead of guess.

## Measured
Run with `npm run measure` on the development laptop (Apple M1, Node 26.11, SQLite in memory, 10,000 seeded employees, 200 runs per operation). The times are for the query plus the calculation, without network time.

| Operation | Median | 95th percentile |
|---|---|---|
| List, first page | 0.06 ms | 0.07 ms |
| List, last page (page 400) | 0.23 ms | 0.25 ms |
| List, search "sharma" | 4.50 ms | 5.17 ms |
| List, filter country + department | 1.00 ms | 1.02 ms |
| List, sort by salary | 0.07 ms | 0.07 ms |
| Employee detail with history | 0.01 ms | 0.01 ms |
| Insights, overview | 5.66 ms | 5.96 ms |
| Insights, breakdown by level | 6.87 ms | 8.19 ms |
| Insights, outliers | 8.67 ms | 9.93 ms |

Seeding 10,000 employees with their first history row takes about 0.11 seconds.

Through HTTP on the same machine, every endpoint answered in under 25 ms on the first request and under 12 ms after that.

## The pay assistant
Measured on the development laptop with live providers, 24 Nov 2026. These depend on the provider and the time of day, so they are examples and not guarantees.

| Question | Provider | Time |
|---|---|---|
| Who is paid furthest above their peers? | Groq (gpt-oss-120b) | 1.6 s |
| What does a level 3 engineer earn in each country? | Groq (gpt-oss-120b) | 1.5 s |
| How much do we spend on salaries in each country? | Gemini (3.5 Flash, low reasoning) | 7.1 s |
| How many active employees do we have in Japan? | OpenRouter (free router), after Groq and Gemini were deliberately refused | 2.5 s |
| The same question again | cache | under 5 ms |

A question takes two model calls: one to ask for a tool, and one to write the answer. The tools themselves take under 10 ms, the same as the screens.

## What keeps it fast
| Choice | Effect |
|---|---|
| Paging happens in the database (`LIMIT` and `OFFSET`) | The browser receives 25 rows, never 10,000. The page size is capped at 100 by validation. |
| Indexes on country, department, level, name and USD salary | Filters and the default sort use an index instead of reading every row. |
| The USD amount is stored on each row (D-014) | Sorting by pay and summing cost need no conversion per row. |
| Prepared statements, created once | SQLite parses each fixed query once, not on every request. |
| The seed runs in one transaction | About 0.1 seconds, instead of 10,000 separate commits. |
| The search box waits 300 ms after typing stops | Typing "sharma" sends one request, not six. |
| The browser caches results per filter (TanStack Query) | Going back to a view already seen shows it at once while it refreshes. |

## Known costs, and when they would matter
| Cost today | Why it is acceptable | What I would do at 100 times the size |
|---|---|---|
| Search uses `LIKE '%term%'`, which reads every row (4.5 ms). | It is the slowest list operation and still far below what a person can notice. | SQLite's full-text search (FTS5), or a prefix index if "starts with" is enough. |
| Each insight loads one small row per active employee and calculates in code (6 to 9 ms). | It keeps the pay rules as pure, tested functions (D-010). | Compute in SQL with window functions, or keep a summary table that is updated when a salary changes. |
| Deep pages use `OFFSET`, which skips rows one by one (0.23 ms at page 400). | Nobody pages to 400. They search or filter. | Keyset paging: "the 25 rows after this name". |
| The total count is a second query per list request. | It is an index-only count at this size. | Cache the count per filter, or show "more than 1,000". |
| Outliers are paged in memory after the whole list is computed. | The whole computation is under 10 ms. | Store the flags, recomputed when a salary in the peer group changes. |

## Not measured
- Many users at once. The app has one user by design, and SQLite allows one writer at a time. Reads do not block each other in WAL mode.
- The deployed server. These numbers are from a laptop and will differ on other hardware.
