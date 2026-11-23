/**
 * Dates travel as YYYY-MM-DD text. They are calendar dates with no time and no time zone,
 * so everything here works in UTC to make sure the day never shifts.
 */

const DISPLAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "2020-01-15" becomes "15 Jan 2020". */
export function formatDate(isoDate: string): string {
  return DISPLAY.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Today as YYYY-MM-DD in UTC, the same "today" the server uses. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
