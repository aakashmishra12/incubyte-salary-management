# Slice 3: browse employees (F1, F2)

## User story
As the HR Manager, I want to find any employee among 10,000 in a few seconds, so that I can check or change their pay without scrolling through a spreadsheet.

## Acceptance criteria
**List**
1. The list shows 25 employees per page by default, sorted by last name then first name.
2. I can move between pages, and I can see how many employees match in total.
3. I can change the page size, up to 100. The browser never receives all 10,000 rows.
4. I can sort by name, employee ID, hire date, country, department, level or salary, ascending or descending.
5. Sorting by salary compares the USD equivalent, so that 9,000,000 yen does not rank above 90,000 dollars.

**Search and filter**
6. I can search by part of a name, an email or an employee ID. Upper and lower case do not matter.
7. I can filter by country, department, level and status, alone or together with a search.
8. Characters that mean something to the database (`%` and `_`) are treated as plain text in a search.
9. When nothing matches, the list says so instead of showing an empty table.

**Errors**
10. A request with an invalid value (an unknown country, a page size of 1000) gets status 400 and a message naming the field. It never reaches the database.
11. Asking for a page past the end returns an empty page with the correct total, not an error.
12. If the list cannot be loaded, the page says so and offers a retry.

## API
`GET /api/employees?page=1&pageSize=25&search=rao&country=IN&department=Engineering&level=L3&status=active&sort=salary&order=desc`

```json
{ "items": [ { "id": 1, "employeeCode": "E00001", "firstName": "Asha", "...": "..." } ],
  "total": 42, "page": 1, "pageSize": 25 }
```

`GET /api/reference` returns the fixed lists the filters need: countries, departments, levels and currencies.

## Notes
- Amounts travel as whole minor units plus a currency code. The browser formats them for display.
- The sort column is chosen from a fixed list in code. User input is never placed into SQL text. Values are always passed as parameters.
