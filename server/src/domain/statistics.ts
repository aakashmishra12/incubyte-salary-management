/** The numbers the HR Manager sees for one group of salaries. Amounts are in minor units. */
export interface Summary {
  count: number;
  min: number;
  median: number;
  mean: number;
  max: number;
}

/**
 * The middle value of a list, or null when the list is empty.
 * With an even count there are two middle values, and the answer is their average,
 * rounded to a whole number because amounts are whole minor units.
 */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;

  // toSorted returns a sorted copy, so the caller's list is not reordered.
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[middle]!;
  return Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

/** Count, minimum, median, mean and maximum of a group, or null when the group is empty. */
export function summarize(values: readonly number[]): Summary | null {
  const middle = median(values);
  if (middle === null) return null;

  let min = Infinity;
  let max = -Infinity;
  let total = 0;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
    total += value;
  }

  return { count: values.length, min, median: middle, mean: Math.round(total / values.length), max };
}
