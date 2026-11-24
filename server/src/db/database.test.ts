import { describe, expect, it } from 'vitest';
import { openDatabase } from './database.ts';

const validEmployee = {
  employee_code: 'E00001',
  first_name: 'Asha',
  last_name: 'Rao',
  email: 'asha.rao@acme.example',
  country: 'IN',
  department: 'Engineering',
  level: 'L3',
  job_title: 'Senior Software Engineer',
  hire_date: '2020-01-15',
  currency: 'INR',
  salary_minor: 3_000_000_00,
  salary_usd_minor: 35_400_00,
  created_at: '2026-11-01T00:00:00.000Z',
  updated_at: '2026-11-01T00:00:00.000Z',
};

const insertEmployee = `
  INSERT INTO employees (employee_code, first_name, last_name, email, country, department, level,
    job_title, hire_date, currency, salary_minor, salary_usd_minor, created_at, updated_at)
  VALUES (@employee_code, @first_name, @last_name, @email, @country, @department, @level,
    @job_title, @hire_date, @currency, @salary_minor, @salary_usd_minor, @created_at, @updated_at)`;

function tableNames(db: ReturnType<typeof openDatabase>): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  return rows.map((row) => row.name).sort();
}

describe('openDatabase', () => {
  it('creates the tables in a new database', () => {
    const db = openDatabase(':memory:');

    expect(tableNames(db)).toEqual(['employees', 'salary_changes']);
  });

  it('makes new employees active by default', () => {
    const db = openDatabase(':memory:');

    db.prepare(insertEmployee).run(validEmployee);

    expect(db.prepare('SELECT status, left_on FROM employees').get()).toEqual({
      status: 'active',
      left_on: null,
    });
  });

  it('refuses a salary of zero', () => {
    const db = openDatabase(':memory:');

    expect(() => db.prepare(insertEmployee).run({ ...validEmployee, salary_minor: 0 })).toThrow(
      /CHECK constraint failed/,
    );
  });

  it('refuses a second employee with the same email', () => {
    const db = openDatabase(':memory:');
    db.prepare(insertEmployee).run(validEmployee);

    expect(() =>
      db.prepare(insertEmployee).run({ ...validEmployee, employee_code: 'E00002' }),
    ).toThrow(/UNIQUE constraint failed: employees.email/);
  });

  it('refuses a second employee with the same employee code', () => {
    const db = openDatabase(':memory:');
    db.prepare(insertEmployee).run(validEmployee);

    expect(() =>
      db.prepare(insertEmployee).run({ ...validEmployee, email: 'other@acme.example' }),
    ).toThrow(/UNIQUE constraint failed: employees.employee_code/);
  });

  it('refuses a status other than active or left', () => {
    const db = openDatabase(':memory:');
    db.prepare(insertEmployee).run(validEmployee);

    expect(() => db.prepare("UPDATE employees SET status = 'retired'").run()).toThrow(
      /CHECK constraint failed/,
    );
  });

  it('refuses salary history for an employee who does not exist', () => {
    const db = openDatabase(':memory:');

    expect(() =>
      db
        .prepare(
          `INSERT INTO salary_changes (employee_id, previous_minor, new_minor, currency, effective_date, reason, created_at)
           VALUES (999, NULL, 100, 'USD', '2026-01-01', 'Initial salary', '2026-11-01T00:00:00.000Z')`,
        )
        .run(),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('turns on foreign key checks itself, and does not rely on a library default', () => {
    expect(openDatabase(':memory:').pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('has the index that sorting by pay relies on, and uses it', () => {
    const db = openDatabase(':memory:');

    const indexes = db.pragma('index_list(employees)') as { name: string }[];
    const plan = db
      .prepare(
        'EXPLAIN QUERY PLAN SELECT id FROM employees ORDER BY salary_usd_minor DESC LIMIT 25',
      )
      .all() as { detail: string }[];

    expect(indexes.map((i) => i.name)).toContain('idx_employees_salary_usd');
    expect(plan.map((p) => p.detail).join(' ')).toContain('idx_employees_salary_usd');
  });
});
