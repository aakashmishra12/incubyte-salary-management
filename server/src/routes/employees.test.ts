import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { aDatabaseWith, anEmployee } from '../testing/builders.ts';
import type { EmployeeDraft } from '../domain/employee.ts';

function appWith(employees: EmployeeDraft[]) {
  return createApp({ db: aDatabaseWith(employees).db });
}

describe('GET /api/employees', () => {
  it('returns the first page of 25, sorted by name, with the total', async () => {
    const thirty = Array.from({ length: 30 }, (_, index) =>
      anEmployee({ lastName: `Name${String(index).padStart(2, '0')}` }),
    );

    const response = await request(appWith(thirty)).get('/api/employees');

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(25);
    expect(response.body.items[0].lastName).toBe('Name00');
    expect(response.body).toMatchObject({ total: 30, page: 1, pageSize: 25 });
  });

  it('applies page, page size, filters, search and sort from the address', async () => {
    const app = appWith([
      anEmployee({ lastName: 'Low', country: 'IN', currency: 'INR', salaryMinor: 10_000_00 }),
      anEmployee({ lastName: 'High', country: 'IN', currency: 'INR', salaryMinor: 90_000_00 }),
      anEmployee({ lastName: 'Elsewhere', country: 'US' }),
    ]);

    const response = await request(app)
      .get('/api/employees')
      .query({ country: 'IN', sort: 'salary', order: 'desc', page: 1, pageSize: 1 });

    expect(response.body.items.map((e: { lastName: string }) => e.lastName)).toEqual(['High']);
    expect(response.body).toMatchObject({ total: 2, page: 1, pageSize: 1 });
  });

  it('ignores surrounding spaces in a search', async () => {
    const app = appWith([anEmployee({ lastName: 'Rao' }), anEmployee({ lastName: 'Smith' })]);

    const response = await request(app).get('/api/employees').query({ search: '  rao ' });

    expect(response.body.total).toBe(1);
  });

  it.each([
    ['a page size above 100', { pageSize: 1000 }, 'pageSize'],
    ['a page of zero', { page: 0 }, 'page'],
    ['a page that is not a number', { page: 'two' }, 'page'],
    ['an unknown country', { country: 'XX' }, 'country'],
    ['an unknown department', { department: 'Wizardry' }, 'department'],
    ['an unknown level', { level: 'L9' }, 'level'],
    ['an unknown status', { status: 'retired' }, 'status'],
    ['an unknown sort', { sort: 'salary_minor; DROP TABLE employees' }, 'sort'],
    ['an unknown order', { order: 'sideways' }, 'order'],
  ])('refuses %s with a 400 that names the field', async (_description, query, field) => {
    const response = await request(appWith([anEmployee()]))
      .get('/api/employees')
      .query(query);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid request');
    expect(response.body.issues.map((issue: { field: string }) => issue.field)).toEqual([field]);
  });
});

describe('GET /api/reference', () => {
  it('returns the fixed lists the filters need', async () => {
    const response = await request(appWith([])).get('/api/reference');

    expect(response.status).toBe(200);
    expect(response.body.countries).toContainEqual({ code: 'IN', name: 'India', currency: 'INR' });
    expect(response.body.currencies).toContainEqual({
      code: 'JPY',
      name: 'Japanese yen',
      minorUnits: 0,
    });
    expect(response.body.departments).toContain('Engineering');
    expect(response.body.levels).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
    expect(response.body.ratesAsOf).toBe('2026-11-01');
  });
});

describe('when something unexpected goes wrong', () => {
  it('answers 500 with a plain message and no internal details', async () => {
    const { db } = aDatabaseWith([]);
    const logged: unknown[] = [];
    const app = createApp({ db, logError: (error) => logged.push(error) });
    db.close(); // Any query now throws.

    const response = await request(app).get('/api/employees');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Something went wrong' });
    // The details go to the server log, where an engineer can read them.
    expect(logged).toHaveLength(1);
  });
});
