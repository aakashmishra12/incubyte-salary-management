import { afterEach, describe, expect, it } from 'vitest';
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

// The server counts days in UTC. A browser far ahead of or behind UTC must still show the same day,
// and these two zones are the furthest either way. The tests would fail if local time crept in.
describe.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
  'dates when the computer is set to %s',
  (zone) => {
    const original = process.env.TZ;
    afterEach(() => {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    });

    it('gives the UTC date as today, whatever the local clock says', () => {
      process.env.TZ = zone;

      expect(todayIso(new Date('2026-11-20T23:30:00Z'))).toBe('2026-11-20');
      expect(todayIso(new Date('2026-11-20T00:30:00Z'))).toBe('2026-11-20');
    });

    it('shows a calendar date as written, never a day earlier or later', () => {
      process.env.TZ = zone;

      expect(formatDate('2026-11-01')).toBe('1 Nov 2026');
      expect(formatDate('2026-12-31')).toBe('31 Dec 2026');
    });
  },
);
