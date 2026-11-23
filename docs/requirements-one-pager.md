# Salary Management: requirements (one page)

Written on 23 Nov 2026, before any code. Source: `docs/assignment/ASSIGNMENT.md`.

## Goal
ACME's HR team keeps salary data for 10,000 employees in several countries in Excel. Give the HR Manager a web app to manage that data and to answer questions about how the organisation pays people.

## User
One persona: the HR Manager. They know the organisation and the pay data. They are not technical.

## Scope and features
**Manage salary data**
1. Browse all employees in a table with server-side pagination and sorting.
2. Search by name, email or employee ID. Filter by country, department, level and status.
3. Open one employee and see their details, current salary and salary history.
4. Change a salary with an effective date and a reason. The old value is kept as history.
5. Add an employee, edit their details, and mark them as left.

**Answer questions about pay**
6. Overview: headcount and total annual salary cost, overall and per country.
7. Breakdown: minimum, median, average and maximum salary by country, department or level.
8. Outliers: employees paid more than 20% above or below the median of their peers, where peers share the same country, department and level.

Each feature gets acceptance criteria and tests before it is built.

## Rules and assumptions
- Salary means annual gross base salary: one figure per employee, in the currency of their country.
- Money is stored as whole numbers, never as decimals, to avoid rounding errors.
- Pay is compared across countries in USD, using a fixed and dated rate table. The UI labels these figures as approximate.
- Outliers are judged inside one country, so they never depend on exchange rates.
- A peer group with fewer than 5 people is not rated. A median of 2 people says little.
- Employees who have left stay in the data but are excluded from insights.
- All data is generated. The seed script creates the same 10,000 employees on every run.

## Deliberately left out, and why
| Left out | Reason |
|---|---|
| Login and roles | One persona and generated data. It is the first thing to add before real use. |
| Payroll runs, payslips, tax | A different product. This one is about salary data and insight. |
| Bonus, equity, allowances | Base salary answers the questions above. Components multiply the model. |
| Approval workflows | They need several roles, and there is one. |
| Excel import and export | Needed for a real migration. The seed script stands in for it here. |
| Live exchange rates | An outside dependency that makes tests and demos unreliable. |
| Pay bands and market benchmarks | ACME's Excel holds salaries only. Peers are compared with each other instead. |
| Gender pay gap analysis | It needs personal data and statistical care that one metric cannot give. |
| Deleting employees | It would break history and past totals. Marking as left covers the need. |

## Done means
- The HR Manager can do features 1 to 8 on the deployed app with 10,000 employees.
- Every list and insight responds fast enough to feel instant (measured, see `docs/PERFORMANCE.md`).
- The business rules above are covered by fast, deterministic tests.

## Assumptions
Where the assignment is open, I made an explicit assumption. Each one, and how the code isolates it, is in `docs/ASSUMPTIONS.md`.
