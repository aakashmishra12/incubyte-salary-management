import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { aDatabaseWith, anEmployee, TEST_NOW } from '../testing/builders.ts';
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

describe('GET /api/employees/:id', () => {
  it('returns the employee with their salary history, newest first', async () => {
    const { db, repository, ids } = aDatabaseWith([anEmployee({ lastName: 'Sato' })]);
    const id = ids[0]!;
    repository.insertSalaryChange(
      {
        employeeId: id,
        previousMinor: null,
        newMinor: 80_000_00,
        currency: 'USD',
        effectiveDate: '2020-01-15',
        reason: 'Starting salary',
      },
      TEST_NOW,
    );
    repository.insertSalaryChange(
      {
        employeeId: id,
        previousMinor: 80_000_00,
        newMinor: 100_000_00,
        currency: 'USD',
        effectiveDate: '2024-04-01',
        reason: 'Promotion',
      },
      TEST_NOW,
    );

    const response = await request(createApp({ db })).get(`/api/employees/${id}`);

    expect(response.status).toBe(200);
    expect(response.body.employee).toMatchObject({ id, lastName: 'Sato', salaryMinor: 100_000_00 });
    expect(response.body.salaryHistory).toMatchObject([
      {
        previousMinor: 80_000_00,
        newMinor: 100_000_00,
        effectiveDate: '2024-04-01',
        reason: 'Promotion',
      },
      {
        previousMinor: null,
        newMinor: 80_000_00,
        effectiveDate: '2020-01-15',
        reason: 'Starting salary',
      },
    ]);
  });

  it('answers 404 for an employee who does not exist', async () => {
    const response = await request(appWith([])).get('/api/employees/999');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Employee not found' });
  });

  it('answers 400 for an id that is not a number', async () => {
    const response = await request(appWith([])).get('/api/employees/abc');

    expect(response.status).toBe(400);
  });
});

describe('POST /api/employees/:id/salary-changes', () => {
  /** An app with one employee on 100,000.00 USD hired in 2020, and the clock set to 20 Nov 2026. */
  function setup(overrides: Partial<EmployeeDraft> = {}) {
    const employee = anEmployee({ hireDate: '2020-01-15', salaryMinor: 100_000_00, ...overrides });
    const { db, repository, ids } = aDatabaseWith([employee]);
    const id = ids[0]!;
    repository.insertSalaryChange(
      {
        employeeId: id,
        previousMinor: null,
        newMinor: employee.salaryMinor,
        currency: employee.currency,
        effectiveDate: employee.hireDate,
        reason: 'Starting salary',
      },
      TEST_NOW,
    );
    const app = createApp({ db, clock: () => new Date(TEST_NOW) });
    return { app, db, id };
  }

  const validChange = {
    newSalaryMinor: 110_000_00,
    effectiveDate: '2026-11-01',
    reason: 'Annual review',
  };

  it('records the change and returns the updated employee and history', async () => {
    const { app, id } = setup();

    const response = await request(app)
      .post(`/api/employees/${id}/salary-changes`)
      .send(validChange);

    expect(response.status).toBe(201);
    expect(response.body.employee).toMatchObject({
      salaryMinor: 110_000_00,
      salaryUsdMinor: 110_000_00,
    });
    expect(response.body.salaryHistory[0]).toMatchObject({
      previousMinor: 100_000_00,
      newMinor: 110_000_00,
      currency: 'USD',
      effectiveDate: '2026-11-01',
      reason: 'Annual review',
    });
    expect(response.body.salaryHistory).toHaveLength(2);
  });

  it('updates the USD equivalent for a salary in another currency', async () => {
    const { app, id } = setup({ country: 'JP', currency: 'JPY', salaryMinor: 9_000_000 });

    const response = await request(app)
      .post(`/api/employees/${id}/salary-changes`)
      .send({ ...validChange, newSalaryMinor: 10_000_000 });

    expect(response.body.employee).toMatchObject({
      salaryMinor: 10_000_000,
      salaryUsdMinor: 67_000_00,
    });
  });

  it('keeps the change when the employee is read again', async () => {
    const { app, id } = setup();
    await request(app).post(`/api/employees/${id}/salary-changes`).send(validChange);

    const response = await request(app).get(`/api/employees/${id}`);

    expect(response.body.employee.salaryMinor).toBe(110_000_00);
    expect(response.body.salaryHistory).toHaveLength(2);
  });

  it.each([
    ['no amount', { ...validChange, newSalaryMinor: undefined }, 'newSalaryMinor'],
    ['an amount of zero', { ...validChange, newSalaryMinor: 0 }, 'newSalaryMinor'],
    ['a negative amount', { ...validChange, newSalaryMinor: -5 }, 'newSalaryMinor'],
    ['an amount with a fraction', { ...validChange, newSalaryMinor: 100.5 }, 'newSalaryMinor'],
    ['an amount sent as text', { ...validChange, newSalaryMinor: '110000' }, 'newSalaryMinor'],
    [
      'a date in the wrong format',
      { ...validChange, effectiveDate: '01/11/2026' },
      'effectiveDate',
    ],
    [
      'a date that does not exist',
      { ...validChange, effectiveDate: '2026-02-30' },
      'effectiveDate',
    ],
    ['no reason', { ...validChange, reason: undefined }, 'reason'],
    ['a reason of only spaces', { ...validChange, reason: '     ' }, 'reason'],
    ['a reason longer than 200 characters', { ...validChange, reason: 'x'.repeat(201) }, 'reason'],
  ])('refuses %s with a 400 that names the field', async (_description, body, field) => {
    const { app, id } = setup();

    const response = await request(app).post(`/api/employees/${id}/salary-changes`).send(body);

    expect(response.status).toBe(400);
    expect(response.body.issues.map((issue: { field: string }) => issue.field)).toEqual([field]);
  });

  it('refuses a change that breaks a rule with a 422 and the reason', async () => {
    const { app, id } = setup();

    const response = await request(app)
      .post(`/api/employees/${id}/salary-changes`)
      .send({ ...validChange, effectiveDate: '2026-11-21' });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: 'The effective date cannot be in the future.' });
  });

  it('refuses a change for someone who has left with a 409', async () => {
    const { app, id } = setup({ status: 'left', leftOn: '2025-06-30' });

    const response = await request(app)
      .post(`/api/employees/${id}/salary-changes`)
      .send(validChange);

    expect(response.status).toBe(409);
  });

  it('writes nothing when a change is refused', async () => {
    const { app, db, id } = setup();

    await request(app)
      .post(`/api/employees/${id}/salary-changes`)
      .send({ ...validChange, newSalaryMinor: 100_000_00 });

    expect(db.prepare('SELECT salary_minor FROM employees').get()).toEqual({
      salary_minor: 100_000_00,
    });
    expect(db.prepare('SELECT COUNT(*) AS total FROM salary_changes').get()).toEqual({ total: 1 });
  });

  it('answers 404 when the employee does not exist', async () => {
    const { app } = setup();

    const response = await request(app).post('/api/employees/999/salary-changes').send(validChange);

    expect(response.status).toBe(404);
  });

  it('answers 400 when the body is not valid JSON', async () => {
    const { app, id } = setup();

    const response = await request(app)
      .post(`/api/employees/${id}/salary-changes`)
      .set('Content-Type', 'application/json')
      .send('{ not json');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'The request body is not valid JSON' });
  });
});
