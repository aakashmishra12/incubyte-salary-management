# Slice 4: employee detail and salary change (F3, F4)

## User story
As the HR Manager, I want to open one employee, see what they are paid and how that changed over time, and record a new salary with the date and the reason, so that every change can be explained later.

## Acceptance criteria
**Detail**
1. Opening an employee shows their details, current salary in local currency with the approximate USD amount, and their salary history, newest first.
2. Opening an employee who does not exist says so (status 404).

**Change a salary**
3. A change needs a new amount, an effective date and a reason of at least 3 characters.
4. After a change, the employee's current salary is the new amount, the USD amount is updated, and the history has a new row holding the old amount, the new amount, the date and the reason.
5. Both writes happen together or not at all. A failure can never leave a new salary without its history row.
6. The new amount must be a positive whole number of minor units.
7. The new amount must differ from the current salary. A change that changes nothing would only add noise to the history.
8. The effective date cannot be in the future. Scheduled changes are out of scope.
9. The effective date cannot be before the hire date.
10. The effective date cannot be before the most recent change, so the history always reads in order.
11. The salary of an employee who has left cannot be changed (status 409).
12. A request that breaks a rule is refused with a message that says which rule, and nothing is written.

**In the browser**
13. The form shows the current salary and the percentage the new amount would change it by, before I save.
14. When the server refuses a change, the form shows the reason and keeps what I typed.
15. After a successful change, the page shows the new salary and the new history row without a reload.

## API
`GET /api/employees/42` returns `{ "employee": { ... }, "salaryHistory": [ ... ] }`.

`POST /api/employees/42/salary-changes` with `{ "newSalaryMinor": 9500000, "effectiveDate": "2026-11-01", "reason": "Annual review" }` returns 201 and the same shape as the GET.

## Notes
- "Today" comes from a clock that is passed into the app, so tests set the date and never depend on the day they run.
- The rules are a pure function, tested without a database. The service only loads the data, asks the rules, and writes.
