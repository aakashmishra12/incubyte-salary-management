import { describe, expect, it } from 'vitest';
import { formatDate, todayIso } from './date.ts';

describe('formatDate', () => {
  it('shows an ISO date in a form people read easily', () => {
    expect(formatDate('2020-01-15')).toBe('15 Jan 2020');
  });

  it('never shifts the day because of the time zone', () => {
    expect(formatDate('2026-11-01')).toBe('1 Nov 2026');
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
  });
});

describe('todayIso', () => {
  it('gives the date of the clock it is handed, as YYYY-MM-DD', () => {
    expect(todayIso(new Date('2026-11-20T09:00:00Z'))).toBe('2026-11-20');
  });
});
