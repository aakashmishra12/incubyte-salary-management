import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import type { EmployeeDraft } from '../domain/employee.ts';
import { aDatabaseWith, anEmployee } from '../testing/builders.ts';

function appWith(employees: EmployeeDraft[]) {
  return createApp({ db: aDatabaseWith(employees).db });
}

const inJapan = (salaryMinor: number, overrides: Partial<EmployeeDraft> = {}) =>
  anEmployee({ country: 'JP', currency: 'JPY', salaryMinor, ...overrides });

/** Five US engineers at L3: four on 100,000 and one on the given salary. */
function usEngineersWithOne(salaryMinor: number, lastName: string): EmployeeDraft[] {
  return [
    ...Array.from({ length: 4 }, () => anEmployee({ salaryMinor: 100_000_00 })),
    anEmployee({ salaryMinor, lastName }),
  ];
}

describe('GET /api/insights/overview', () => {
  it('reports headcount and cost, overall and per country, with the rate date', async () => {
    const response = await request(
      appWith([anEmployee({ salaryMinor: 100_000_00 }), inJapan(10_000_000)]),
    ).get('/api/insights/overview');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      headcount: 2,
      totalUsdMinor: 167_000_00,
      countries: [
        {
          country: 'US',
          currency: 'USD',
          headcount: 1,
          totalLocalMinor: 100_000_00,
          totalUsdMinor: 100_000_00,
        },
        {
          country: 'JP',
          currency: 'JPY',
          headcount: 1,
          totalLocalMinor: 10_000_000,
          totalUsdMinor: 67_000_00,
        },
      ],
      ratesAsOf: '2026-11-01',
    });
  });

  it('leaves out employees who have left', async () => {
    const response = await request(
      appWith([anEmployee(), anEmployee({ status: 'left', leftOn: '2025-06-30' })]),
    ).get('/api/insights/overview');

    expect(response.body.headcount).toBe(1);
  });
});

describe('GET /api/insights/breakdown', () => {
  it('groups by country by default', async () => {
    const response = await request(appWith([anEmployee(), inJapan(10_000_000)])).get(
      '/api/insights/breakdown',
    );

    expect(response.body.groupBy).toBe('country');
    expect(response.body.groups.map((group: { key: string }) => group.key)).toEqual(['JP', 'US']);
  });

  it('groups by level when asked', async () => {
    const response = await request(
      appWith([anEmployee({ level: 'L1' }), anEmployee({ level: 'L4' })]),
    )
      .get('/api/insights/breakdown')
      .query({ groupBy: 'level' });

    expect(response.body.groups.map((group: { key: string }) => group.key)).toEqual(['L1', 'L4']);
  });

  it('narrows to a department and level, to compare one role across countries', async () => {
    const response = await request(
      appWith([
        anEmployee({ department: 'Engineering', level: 'L3', salaryMinor: 120_000_00 }),
        anEmployee({ department: 'Sales', level: 'L3', salaryMinor: 60_000_00 }),
        anEmployee({ department: 'Engineering', level: 'L1', salaryMinor: 50_000_00 }),
      ]),
    )
      .get('/api/insights/breakdown')
      .query({ groupBy: 'country', department: 'Engineering', level: 'L3' });

    expect(response.body.groups).toHaveLength(1);
    expect(response.body.groups[0]).toMatchObject({
      key: 'US',
      usd: { count: 1, median: 120_000_00 },
      local: { currency: 'USD', median: 120_000_00 },
    });
  });

  it('returns no groups when nothing matches', async () => {
    const response = await request(appWith([anEmployee({ country: 'US' })]))
      .get('/api/insights/breakdown')
      .query({ country: 'IN' });

    expect(response.body.groups).toEqual([]);
  });

  it('refuses an unknown grouping with a 400', async () => {
    const response = await request(appWith([]))
      .get('/api/insights/breakdown')
      .query({ groupBy: 'shoe size' });

    expect(response.status).toBe(400);
    expect(response.body.issues[0].field).toBe('groupBy');
  });
});

describe('GET /api/insights/outliers', () => {
  it('lists an underpaid employee with everything needed to explain the flag', async () => {
    const response = await request(appWith(usEngineersWithOne(70_000_00, 'Under'))).get(
      '/api/insights/outliers',
    );

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      lastName: 'Under',
      country: 'US',
      department: 'Engineering',
      level: 'L3',
      currency: 'USD',
      salaryMinor: 70_000_00,
      direction: 'below',
      compaRatio: 0.7,
      peerMedianMinor: 100_000_00,
      peerCount: 5,
    });
  });

  it('states the rule it applied', async () => {
    const response = await request(appWith([])).get('/api/insights/outliers');

    expect(response.body.rule).toEqual({ minPeers: 5, lowPercent: 80, highPercent: 120 });
  });

  it('puts the most extreme case first', async () => {
    const response = await request(
      appWith([
        ...Array.from({ length: 5 }, () => anEmployee({ salaryMinor: 100_000_00 })),
        anEmployee({ salaryMinor: 75_000_00, lastName: 'Mild' }),
        anEmployee({ salaryMinor: 190_000_00, lastName: 'Extreme' }),
      ]),
    ).get('/api/insights/outliers');

    expect(response.body.items.map((item: { lastName: string }) => item.lastName)).toEqual([
      'Extreme',
      'Mild',
    ]);
  });

  it('can show only one direction', async () => {
    const app = appWith([
      ...Array.from({ length: 5 }, () => anEmployee({ salaryMinor: 100_000_00 })),
      anEmployee({ salaryMinor: 70_000_00, lastName: 'Under' }),
      anEmployee({ salaryMinor: 150_000_00, lastName: 'Over' }),
    ]);

    const response = await request(app).get('/api/insights/outliers').query({ direction: 'above' });

    expect(response.body.items.map((item: { lastName: string }) => item.lastName)).toEqual([
      'Over',
    ]);
  });

  it('can be narrowed to a country', async () => {
    const app = appWith([
      ...usEngineersWithOne(70_000_00, 'America'),
      ...Array.from({ length: 4 }, () => inJapan(10_000_000)),
      inJapan(5_000_000, { lastName: 'Japan' }),
    ]);

    const response = await request(app).get('/api/insights/outliers').query({ country: 'JP' });

    expect(response.body.items.map((item: { lastName: string }) => item.lastName)).toEqual([
      'Japan',
    ]);
  });

  it('says how many employees could not be rated because their peer group is too small', async () => {
    const response = await request(
      appWith([
        ...usEngineersWithOne(100_000_00, 'Fine'),
        anEmployee({ department: 'Design' }),
        anEmployee({ department: 'Design' }),
      ]),
    ).get('/api/insights/outliers');

    expect(response.body.coverage).toEqual({ rated: 5, unrated: 2 });
  });

  it('never flags someone who has left, and does not count them as a peer', async () => {
    const response = await request(
      appWith([
        ...Array.from({ length: 4 }, () => anEmployee({ salaryMinor: 100_000_00 })),
        anEmployee({ salaryMinor: 10_000_00, status: 'left', leftOn: '2025-06-30' }),
      ]),
    ).get('/api/insights/outliers');

    expect(response.body.items).toEqual([]);
    // Four active peers are too few to rate.
    expect(response.body.coverage).toEqual({ rated: 0, unrated: 4 });
  });

  it('returns one page at a time with the total', async () => {
    const app = appWith([
      ...Array.from({ length: 5 }, () => anEmployee({ salaryMinor: 100_000_00 })),
      anEmployee({ salaryMinor: 60_000_00 }),
      anEmployee({ salaryMinor: 65_000_00 }),
      anEmployee({ salaryMinor: 70_000_00 }),
    ]);

    const response = await request(app)
      .get('/api/insights/outliers')
      .query({ page: 2, pageSize: 2 });

    expect(response.body.items).toHaveLength(1);
    expect(response.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
  });
});
