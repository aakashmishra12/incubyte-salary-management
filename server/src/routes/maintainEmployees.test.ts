import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import type { EmployeeDraft } from '../domain/employee.ts';
import { aDatabaseWith, anEmployee, TEST_NOW } from '../testing/builders.ts';

/** An app whose clock says 20 Nov 2026. */
function setup(employees: EmployeeDraft[] = []) {
  const { db, ids } = aDatabaseWith(employees);
  return { app: createApp({ db, clock: () => new Date(TEST_NOW) }), db, ids };
}

const newJoiner = {
  firstName: 'Mei',
  lastName: 'Tanaka',
  email: 'mei.tanaka@acme.example',
  country: 'JP',
  department: 'Design',
  level: 'L2',
  jobTitle: 'Product Designer',
  hireDate: '2026-11-03',
  salaryMinor: 7_000_000,
};

describe('POST /api/employees', () => {
  it('adds the employee, in the currency of their country, with a USD amount', async () => {
    const { app } = setup();

    const response = await request(app).post('/api/employees').send(newJoiner);

    expect(response.status).toBe(201);
    expect(response.body.employee).toMatchObject({
      ...newJoiner,
      status: 'active',
      leftOn: null,
      currency: 'JPY',
      salaryUsdMinor: 46_900_00,
    });
  });

  it('starts the salary history with the starting salary on the hire date', async () => {
    const { app } = setup();

    const response = await request(app).post('/api/employees').send(newJoiner);

    expect(response.body.salaryHistory).toMatchObject([
      {
        previousMinor: null,
        newMinor: 7_000_000,
        currency: 'JPY',
        effectiveDate: '2026-11-03',
        reason: 'Starting salary',
      },
    ]);
  });

  it('assigns the next employee ID in the series', async () => {
    const { app } = setup([
      anEmployee({ employeeCode: 'E00007' }),
      anEmployee({ employeeCode: 'E10000' }),
    ]);

    const response = await request(app).post('/api/employees').send(newJoiner);

    expect(response.body.employee.employeeCode).toBe('E10001');
  });

  it('starts the series at E00001 in an empty database', async () => {
    const { app } = setup();

    const response = await request(app).post('/api/employees').send(newJoiner);

    expect(response.body.employee.employeeCode).toBe('E00001');
  });

  it('stores the email in lower case and trims the names', async () => {
    const { app } = setup();

    const response = await request(app)
      .post('/api/employees')
      .send({ ...newJoiner, firstName: '  Mei ', email: 'Mei.Tanaka@ACME.example' });

    expect(response.body.employee).toMatchObject({
      firstName: 'Mei',
      email: 'mei.tanaka@acme.example',
    });
  });

  it('refuses an email that another employee already has', async () => {
    const { app } = setup([anEmployee({ email: 'mei.tanaka@acme.example' })]);

    const response = await request(app).post('/api/employees').send(newJoiner);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'Another employee already has this email.' });
  });

  it('refuses a hire date in the future', async () => {
    const { app } = setup();

    const response = await request(app)
      .post('/api/employees')
      .send({ ...newJoiner, hireDate: '2026-11-21' });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: 'The hire date cannot be in the future.' });
  });

  it.each([
    ['no first name', { firstName: '' }, 'firstName'],
    ['no last name', { lastName: '   ' }, 'lastName'],
    ['something that is not an email', { email: 'mei.tanaka' }, 'email'],
    ['an unknown country', { country: 'XX' }, 'country'],
    ['an unknown department', { department: 'Wizardry' }, 'department'],
    ['an unknown level', { level: 'L9' }, 'level'],
    ['no job title', { jobTitle: '' }, 'jobTitle'],
    ['a hire date that does not exist', { hireDate: '2026-02-30' }, 'hireDate'],
    ['a salary of zero', { salaryMinor: 0 }, 'salaryMinor'],
  ])('refuses %s with a 400 that names the field', async (_description, change, field) => {
    const { app } = setup();

    const response = await request(app)
      .post('/api/employees')
      .send({ ...newJoiner, ...change });

    expect(response.status).toBe(400);
    expect(response.body.issues.map((issue: { field: string }) => issue.field)).toEqual([field]);
  });

  it('ignores a currency or an employee ID sent by the caller', async () => {
    const { app } = setup();

    const response = await request(app)
      .post('/api/employees')
      .send({ ...newJoiner, currency: 'USD', employeeCode: 'BOSS', status: 'left' });

    expect(response.body.employee).toMatchObject({
      currency: 'JPY',
      employeeCode: 'E00001',
      status: 'active',
    });
  });
});

describe('PATCH /api/employees/:id', () => {
  it('changes only the fields that were sent', async () => {
    const { app, ids } = setup([
      anEmployee({ firstName: 'Asha', lastName: 'Rao', level: 'L3', jobTitle: 'Senior Engineer' }),
    ]);

    const response = await request(app)
      .patch(`/api/employees/${ids[0]}`)
      .send({ level: 'L4', jobTitle: 'Lead Engineer' });

    expect(response.status).toBe(200);
    expect(response.body.employee).toMatchObject({
      firstName: 'Asha',
      lastName: 'Rao',
      level: 'L4',
      jobTitle: 'Lead Engineer',
    });
  });

  it('does not change the salary, the country or the hire date even when they are sent', async () => {
    const { app, ids } = setup([
      anEmployee({ country: 'US', hireDate: '2020-01-15', salaryMinor: 100_000_00 }),
    ]);

    const response = await request(app)
      .patch(`/api/employees/${ids[0]}`)
      .send({ level: 'L4', country: 'IN', hireDate: '2019-01-01', salaryMinor: 1 });

    expect(response.body.employee).toMatchObject({
      country: 'US',
      hireDate: '2020-01-15',
      salaryMinor: 100_000_00,
    });
  });

  it('refuses an email that another employee already has', async () => {
    const { app, ids } = setup([
      anEmployee({ email: 'first@acme.example' }),
      anEmployee({ email: 'second@acme.example' }),
    ]);

    const response = await request(app)
      .patch(`/api/employees/${ids[1]}`)
      .send({ email: 'first@acme.example' });

    expect(response.status).toBe(409);
  });

  it('accepts the employee keeping their own email', async () => {
    const { app, ids } = setup([anEmployee({ email: 'same@acme.example' })]);

    const response = await request(app)
      .patch(`/api/employees/${ids[0]}`)
      .send({ email: 'same@acme.example', level: 'L5' });

    expect(response.status).toBe(200);
  });

  it('refuses a request that changes nothing', async () => {
    const { app, ids } = setup([anEmployee()]);

    const response = await request(app).patch(`/api/employees/${ids[0]}`).send({});

    expect(response.status).toBe(400);
  });

  it('refuses an invalid value with a 400 that names the field', async () => {
    const { app, ids } = setup([anEmployee()]);

    const response = await request(app).patch(`/api/employees/${ids[0]}`).send({ level: 'L9' });

    expect(response.status).toBe(400);
    expect(response.body.issues[0].field).toBe('level');
  });

  it('refuses to edit someone who has left', async () => {
    const { app, ids } = setup([anEmployee({ status: 'left', leftOn: '2025-06-30' })]);

    const response = await request(app).patch(`/api/employees/${ids[0]}`).send({ level: 'L4' });

    expect(response.status).toBe(409);
  });

  it('answers 404 when the employee does not exist', async () => {
    const { app } = setup();

    const response = await request(app).patch('/api/employees/999').send({ level: 'L4' });

    expect(response.status).toBe(404);
  });
});

describe('POST /api/employees/:id/leave', () => {
  it('marks the employee as left on the given date', async () => {
    const { app, ids } = setup([anEmployee({ hireDate: '2020-01-15' })]);

    const response = await request(app)
      .post(`/api/employees/${ids[0]}/leave`)
      .send({ leftOn: '2026-11-15' });

    expect(response.status).toBe(200);
    expect(response.body.employee).toMatchObject({ status: 'left', leftOn: '2026-11-15' });
  });

  it('keeps the employee and their history', async () => {
    const { app, db, ids } = setup([anEmployee()]);

    await request(app).post(`/api/employees/${ids[0]}/leave`).send({ leftOn: '2026-11-15' });

    expect(db.prepare('SELECT COUNT(*) AS total FROM employees').get()).toEqual({ total: 1 });
  });

  it.each([
    [
      'before the hire date',
      '2020-01-14',
      'The leaving date cannot be before the hire date (2020-01-15).',
    ],
    ['in the future', '2026-11-21', 'The leaving date cannot be in the future.'],
  ])('refuses a date %s', async (_description, leftOn, message) => {
    const { app, ids } = setup([anEmployee({ hireDate: '2020-01-15' })]);

    const response = await request(app).post(`/api/employees/${ids[0]}/leave`).send({ leftOn });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: message });
  });

  it('refuses someone who has already left', async () => {
    const { app, ids } = setup([anEmployee({ status: 'left', leftOn: '2025-06-30' })]);

    const response = await request(app)
      .post(`/api/employees/${ids[0]}/leave`)
      .send({ leftOn: '2026-11-15' });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ error: 'This employee has already left.' });
  });

  it('refuses a missing date with a 400', async () => {
    const { app, ids } = setup([anEmployee()]);

    const response = await request(app).post(`/api/employees/${ids[0]}/leave`).send({});

    expect(response.status).toBe(400);
  });
});
