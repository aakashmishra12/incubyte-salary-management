import { describe, expect, it } from 'vitest';
import { payBreakdown, payOverview, peerCoverage, type PayRow } from './insights.ts';

let nextId = 1;

function row(overrides: Partial<PayRow> = {}): PayRow {
  return {
    id: nextId++,
    country: 'US',
    department: 'Engineering',
    level: 'L3',
    currency: 'USD',
    salaryMinor: 100_000_00,
    salaryUsdMinor: 100_000_00,
    ...overrides,
  };
}

const inYen = (salaryMinor: number, salaryUsdMinor: number, overrides: Partial<PayRow> = {}) =>
  row({ country: 'JP', currency: 'JPY', salaryMinor, salaryUsdMinor, ...overrides });

describe('payOverview', () => {
  it('counts the people and adds up the cost in USD', () => {
    const overview = payOverview([row(), row(), inYen(10_000_000, 67_000_00)]);

    expect(overview.headcount).toBe(3);
    expect(overview.totalUsdMinor).toBe(267_000_00);
  });

  it('gives each country its headcount and its total in local currency and in USD', () => {
    const overview = payOverview([inYen(10_000_000, 67_000_00), inYen(5_000_000, 33_500_00)]);

    expect(overview.countries).toEqual([
      {
        country: 'JP',
        currency: 'JPY',
        headcount: 2,
        totalLocalMinor: 15_000_000,
        totalUsdMinor: 100_500_00,
      },
    ]);
  });

  it('lists the country that costs the most first', () => {
    const overview = payOverview([inYen(10_000_000, 67_000_00), row(), row()]);

    expect(overview.countries.map((country) => country.country)).toEqual(['US', 'JP']);
  });

  it('reports zero people and zero cost when there is nobody', () => {
    expect(payOverview([])).toEqual({ headcount: 0, totalUsdMinor: 0, countries: [] });
  });
});

describe('payBreakdown', () => {
  it('summarises each group in USD', () => {
    const groups = payBreakdown(
      [
        row({ level: 'L1', salaryUsdMinor: 50_000_00, salaryMinor: 50_000_00 }),
        row({ level: 'L1', salaryUsdMinor: 70_000_00, salaryMinor: 70_000_00 }),
        row({ level: 'L3', salaryUsdMinor: 100_000_00 }),
      ],
      'level',
    );

    expect(groups.map((group) => [group.key, group.usd])).toEqual([
      ['L1', { count: 2, min: 50_000_00, median: 60_000_00, mean: 60_000_00, max: 70_000_00 }],
      ['L3', { count: 1, min: 100_000_00, median: 100_000_00, mean: 100_000_00, max: 100_000_00 }],
    ]);
  });

  it('also summarises a group in its own currency when everyone shares one', () => {
    const [japan] = payBreakdown(
      [inYen(8_000_000, 53_600_00), inYen(10_000_000, 67_000_00)],
      'country',
    );

    expect(japan!.local).toEqual({
      currency: 'JPY',
      count: 2,
      min: 8_000_000,
      median: 9_000_000,
      mean: 9_000_000,
      max: 10_000_000,
    });
  });

  it('gives no local figures for a group that mixes currencies, because they cannot be added', () => {
    const [level] = payBreakdown([row({ level: 'L3' }), inYen(10_000_000, 67_000_00)], 'level');

    expect(level!.local).toBeNull();
    expect(level!.usd.count).toBe(2);
  });

  it('can group by department', () => {
    const groups = payBreakdown(
      [row({ department: 'Sales' }), row({ department: 'Design' })],
      'department',
    );

    expect(groups.map((group) => group.key)).toEqual(['Design', 'Sales']);
  });

  it('returns no groups when there is nobody', () => {
    expect(payBreakdown([], 'country')).toEqual([]);
  });
});

describe('peerCoverage', () => {
  it('counts who is in a peer group large enough to be rated and who is not', () => {
    const bigGroup = Array.from({ length: 5 }, () => row({ department: 'Engineering' }));
    const smallGroup = Array.from({ length: 4 }, () => row({ department: 'Design' }));

    expect(peerCoverage([...bigGroup, ...smallGroup], 5)).toEqual({ rated: 5, unrated: 4 });
  });

  it('rates nobody when there is nobody', () => {
    expect(peerCoverage([], 5)).toEqual({ rated: 0, unrated: 0 });
  });
});
