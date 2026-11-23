# Slice 2: data

## Why
The features need somewhere to keep employees and their salary history, and the assignment asks for a seed script with 10,000 employees.

## Tables
**employees**: one row per person, holding their current salary.

| Column | Meaning |
|---|---|
| `id` | Internal number, the primary key. |
| `employee_code` | The ID people use, such as E00042. Unique. |
| `first_name`, `last_name`, `email` | Email is unique. |
| `country`, `department`, `level`, `job_title` | Country, department and level together define the peer group. |
| `hire_date` | |
| `status`, `left_on` | `active` or `left`. People are never deleted (D-006). |
| `currency`, `salary_minor` | Annual gross base salary in the smallest unit of the local currency (D-004). |
| `salary_usd_minor` | The same salary in US cents at the fixed rate. Stored so that lists can be sorted and totals summed in one currency. |

**salary_changes**: one row per salary change, never updated or deleted (D-005).

| Column | Meaning |
|---|---|
| `employee_id` | Whose salary changed. |
| `previous_minor`, `new_minor`, `currency` | The old and new amounts. The first row for a person has no old amount. |
| `effective_date`, `reason` | When it applies and why. |

## Acceptance criteria
**Schema**
1. Opening a new database creates the tables and indexes.
2. Opening an existing database changes nothing and loses no data.
3. The database refuses a salary of zero or less, a status other than `active` or `left`, and a duplicate email or employee code.

**Seed**
4. The generator produces exactly the number of employees asked for.
5. The same seed number always produces the same employees. A different seed number produces different ones.
6. Every employee code and email is unique.
7. Every employee is paid in the currency of their country, and every salary is positive.
8. With 10,000 employees, every country, department and level is represented.
9. The data contains pay outliers, so the insights have something to show.
10. Seeding stores every employee with their USD amount and one first row of salary history.
11. "Seed if empty" fills an empty database and leaves a database with data alone.

## Notes
- `salary_usd_minor` is derived data. If the fixed rates change, it must be recomputed for every row. That is the price of fast sorting and summing, and it is one function.
- Names come from fixed lists and a small seeded random number generator written in the project, so the output cannot change when a library is upgraded.
- `npm run seed` rebuilds the database with 10,000 employees. The server also seeds itself when it starts with an empty database.
