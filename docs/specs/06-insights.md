# Slice 6: insights (F6, F7, F8)

## User story
As the HR Manager, I want to answer the pay questions leadership and finance ask me, in seconds and with numbers I can defend, so that I am not building pivot tables under pressure.

## The questions
| Question | Insight |
|---|---|
| How many people do we pay, and what does it cost per year? Where does the money go? | Overview (F6) |
| What does a role typically earn, and how wide is the spread? How do countries compare? | Breakdown (F7) |
| Who is paid far above or below people doing the same job in the same place? | Outliers (F8) |

## Acceptance criteria
**Overview (F6)**
1. Shows the number of active employees and the total annual salary cost in USD.
2. Shows, per country, the headcount, the total in local currency and the total in USD, largest cost first.
3. Employees who have left are not counted anywhere in the insights.

**Breakdown (F7)**
4. Groups active employees by country, department or level, and shows the count, minimum, median, mean and maximum salary of each group.
5. The breakdown can be narrowed by country, department and level. Example: group by country, narrowed to Engineering and L3, answers "what does a senior engineer earn in each country".
6. Every group shows its figures in USD. A group whose members all share one currency also shows them in that currency.
7. A combination with no employees shows "no data", never zeros.

**Outliers (F8)**
8. Lists active employees paid below 80% or above 120% of the median of their peer group (same country, department and level), most extreme first.
9. Each row shows the salary, the peer median, the compa-ratio and the size of the peer group, so the flag can be explained.
10. The list can be narrowed by direction (below or above), country and department, and is paginated.
11. The page says how many employees could not be rated because their peer group has fewer than 5 people. Silence would suggest they are all fine.

**Everywhere**
12. Every USD figure is labelled as approximate, with the date of the fixed rates.
13. After a salary change, the insights reflect it the next time they are opened.

## API
- `GET /api/insights/overview`
- `GET /api/insights/breakdown?groupBy=country&department=Engineering&level=L3`
- `GET /api/insights/outliers?direction=below&country=IN&page=1&pageSize=25`

## Notes
- The calculations are pure functions (D-010). The repository hands them one small row per active employee, about 10,000 rows, read in a few milliseconds.
- A flag is a prompt to look, not a verdict. Tenure, performance and negotiated offers are not in the data.
