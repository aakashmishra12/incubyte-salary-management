# Slice 1: pay rules

## Why
The pay rules are the heart of the product and the part most likely to be wrong in a quiet way. They are written first, as pure functions with no database and no HTTP, so every rule is tested in milliseconds.

## Terms
- **Minor units:** the smallest unit of a currency. 1 US dollar is 100 cents. The Japanese yen has no smaller unit, so 1 yen is 1 minor unit.
- **Peer group:** active employees who share the same country, department and level.
- **Compa-ratio:** an employee's salary divided by the median salary of their peer group.

## Acceptance criteria
**Statistics**
1. The median of an odd number of salaries is the middle value once sorted.
2. The median of an even number of salaries is the average of the two middle values, rounded to a whole minor unit.
3. A summary of a group gives count, minimum, median, mean and maximum. The mean is rounded to a whole minor unit.
4. A summary of an empty group is "no data", never zero. Zero would read as "people are paid nothing".
5. Computing a statistic never changes the list it was given.

**Money**
6. An amount converts to USD using the fixed rate for its currency, rounded to a whole cent.
7. Currencies without a smaller unit (yen) convert correctly.
8. A USD amount converts to itself.

**Outliers**
9. An employee paid less than 80% of their peer median is flagged as "below".
10. An employee paid more than 120% of their peer median is flagged as "above".
11. An employee at exactly 80% or exactly 120% is not flagged.
12. A peer group with fewer than 5 people is not rated, and nobody in it is flagged.
13. Peer groups never mix countries, departments or levels.
14. Each flag reports the compa-ratio, the peer median and the size of the peer group, so the HR Manager can see why.

## Notes
- The flag decision uses whole-number arithmetic (`salary * 100 < median * 80`), so a salary at exactly 80% can never be flagged because of a floating point error.
- The exchange rates are fixed, illustrative values with a date. They are not live market rates. See D-003.
