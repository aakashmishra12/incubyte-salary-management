# Slice 5: maintain employees (F5)

## User story
As the HR Manager, I want to add a new joiner, correct someone's details, and record that someone has left, so that the data stays true without a spreadsheet.

## Acceptance criteria
**Add**
1. A new employee needs a first name, last name, email, country, department, level, job title, hire date and starting salary.
2. The employee ID is assigned by the system, as the next number in the series (E10001 after E10000).
3. The currency comes from the country. It is not typed in.
4. The starting salary becomes the first row of the salary history, dated on the hire date.
5. An email that another employee already has is refused (status 409).
6. A hire date in the future is refused. Future joiners are out of scope.

**Edit**
7. The name, email, department, level and job title can be corrected. Only the fields sent are changed.
8. The salary is not changed here. It has its own flow with a date and a reason (slice 4).
9. The country and hire date cannot be changed. A move to another country changes the currency and is a different process, out of scope.
10. A change to a new email that another employee already has is refused (status 409).

**Mark as left**
11. Marking an employee as left needs the date they left.
12. The date cannot be before the hire date or in the future.
13. An employee who has already left cannot be marked as left again, and their details can no longer be edited (status 409).
14. An employee who has left stays in the list and keeps their history. They are excluded from insights (slice 6).

**In the browser**
15. Each form shows which field is wrong, using the server's answer, and keeps what I typed.
16. After adding an employee I land on their page.

## API
- `POST /api/employees` returns 201 and the new employee with their history.
- `PATCH /api/employees/42` with only the fields to change.
- `POST /api/employees/42/leave` with `{ "leftOn": "2026-11-15" }`.
