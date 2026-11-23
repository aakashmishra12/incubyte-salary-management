import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate, MIGRATIONS } from './migrations.ts';

describe('migrate', () => {
  it('records how many migrations have been applied', () => {
    const db = new Database(':memory:');

    migrate(db);

    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
  });

  it('can run again on the same database without losing data', () => {
    const db = new Database(':memory:');
    migrate(db);
    db.prepare(
      `INSERT INTO employees (employee_code, first_name, last_name, email, country, department, level,
         job_title, hire_date, currency, salary_minor, salary_usd_minor, created_at, updated_at)
       VALUES ('E00001', 'A', 'B', 'a@b.example', 'US', 'Sales', 'L1', 'Associate', '2020-01-01',
         'USD', 100, 100, 'now', 'now')`,
    ).run();

    migrate(db);

    expect(db.prepare('SELECT COUNT(*) AS total FROM employees').get()).toEqual({ total: 1 });
  });
});
