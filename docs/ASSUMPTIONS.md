# Assumptions

The assignment leaves some points open on purpose. This is each assumption I made, why, and where the code isolates it so that a different answer is a small change.

| # | Open point | Assumption | Why | If the answer were different |
|---|---|---|---|---|
| A1 | Does the app need login? | No login. One HR Manager, generated data only. | The assignment names one persona and no access rules. See D-008. | Add authentication as middleware in front of the API. No route or service changes. |
| A2 | How is pay compared across countries? | Salaries are stored in local currency and compared in USD with a fixed, dated rate table. | Comparison needs one currency, and fixed rates keep totals stable and tests deterministic. See D-003. | Rates are read through one function. A live source replaces the table behind it. |
| A3 | What does "salary" include? | Annual gross base salary. One figure per employee. No bonus or allowances. | It is the simplest model that answers the pay questions in scope. See D-007. | Add a table of pay components. Insights would sum components per employee first. |
| A4 | Who are an employee's peers? | People in the same country, department and level. | Pay differs by all three, so a narrower or wider group would mislead. See D-002. | The peer group is one function in the domain layer. |
