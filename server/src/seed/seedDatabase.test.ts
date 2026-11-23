import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.ts';
import { toUsdMinor } from '../domain/money.ts';
import { generateEmployees } from './generateEmployees.ts';
import { seedDatabase, seedIfEmpty } from './seedDatabase.ts';

const SEEDED_AT = '2026-11-01T00:00:00.000Z';

function count(db: ReturnType<typeof openDatabase>, table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total;
}

describe('seedDatabase', () => {
  it('stores every generated employee', () => {
    const db = openDatabase(':memory:');

    seedDatabase(db, generateEmployees({ count: 300, seed: 1 }), SEEDED_AT);

    expect(count(db, 'employees')).toBe(300);
  });

  it('stores the USD equivalent of each salary', () => {
    const db = openDatabase(':memory:');
    const [first] = generateEmployees({ count: 1, seed: 1 });

    seedDatabase(db, [first!], SEEDED_AT);

    const row = db.prepare('SELECT salary_minor, salary_usd_minor FROM employees').get();
    expect(row).toEqual({
      salary_minor: first!.salaryMinor,
      salary_usd_minor: toUsdMinor(first!.salaryMinor, first!.currency),
    });
  });

  it('starts each salary history with the starting salary on the hire date', () => {
    const db = openDatabase(':memory:');
    const [first] = generateEmployees({ count: 1, seed: 1 });

    seedDatabase(db, [first!], SEEDED_AT);

    const history = db
      .prepare(
        'SELECT previous_minor, new_minor, currency, effective_date, reason FROM salary_changes',
      )
      .all();
    expect(history).toEqual([
      {
        previous_minor: null,
        new_minor: first!.salaryMinor,
        currency: first!.currency,
        effective_date: first!.hireDate,
        reason: 'Starting salary',
      },
    ]);
  });

  it('stores all 10,000 employees with one history row each', () => {
    const db = openDatabase(':memory:');

    seedDatabase(db, generateEmployees({ count: 10_000, seed: 2026 }), SEEDED_AT);

    expect(count(db, 'employees')).toBe(10_000);
    expect(count(db, 'salary_changes')).toBe(10_000);
  });
});

describe('seedIfEmpty', () => {
  it('fills an empty database and says that it did', () => {
    const db = openDatabase(':memory:');

    const seeded = seedIfEmpty(db, { count: 50, seed: 1 }, SEEDED_AT);

    expect(seeded).toBe(true);
    expect(count(db, 'employees')).toBe(50);
  });

  it('leaves a database that already has employees alone', () => {
    const db = openDatabase(':memory:');
    seedIfEmpty(db, { count: 50, seed: 1 }, SEEDED_AT);

    const seededAgain = seedIfEmpty(db, { count: 50, seed: 1 }, SEEDED_AT);

    expect(seededAgain).toBe(false);
    expect(count(db, 'employees')).toBe(50);
  });
});
