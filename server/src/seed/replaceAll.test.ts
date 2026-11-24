import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.ts';
import { anEmployee } from '../testing/builders.ts';
import { generateEmployees } from './generateEmployees.ts';
import { replaceAllEmployees, seedDatabase } from './seedDatabase.ts';

const NOW = '2026-11-01T00:00:00.000Z';
const count = (db: ReturnType<typeof openDatabase>, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('replaceAllEmployees', () => {
  it('swaps everything for the new employees, with their history, and numbers them from 1 again', () => {
    const db = openDatabase(':memory:');
    seedDatabase(db, generateEmployees({ count: 20, seed: 1 }), NOW);

    replaceAllEmployees(db, generateEmployees({ count: 5, seed: 2 }), NOW);

    expect(count(db, 'employees')).toBe(5);
    expect(count(db, 'salary_changes')).toBe(5);
    expect(db.prepare('SELECT MIN(id) AS first FROM employees').get()).toEqual({ first: 1 });
  });

  it('makes the same data as a fresh seed with the same options', () => {
    const replaced = openDatabase(':memory:');
    seedDatabase(replaced, generateEmployees({ count: 20, seed: 9 }), NOW);
    replaceAllEmployees(replaced, generateEmployees({ count: 30, seed: 3 }), NOW);
    const fresh = openDatabase(':memory:');
    seedDatabase(fresh, generateEmployees({ count: 30, seed: 3 }), NOW);

    const dump = (db: ReturnType<typeof openDatabase>) =>
      db.prepare('SELECT * FROM employees ORDER BY id').all();

    expect(dump(replaced)).toEqual(dump(fresh));
  });

  it('is seen at once by a server that already has the database open, because the file is not replaced', () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'seed-test-')), 'salary.sqlite');
    const running = openDatabase(file);
    seedDatabase(running, generateEmployees({ count: 20, seed: 1 }), NOW);
    const seeding = openDatabase(file);

    replaceAllEmployees(seeding, generateEmployees({ count: 7, seed: 2 }), NOW);
    seeding.close();

    expect(count(running, 'employees')).toBe(7);
  });

  it('leaves the old data in place when the new data cannot be saved, because it is one transaction', () => {
    const db = openDatabase(':memory:');
    seedDatabase(db, generateEmployees({ count: 10, seed: 1 }), NOW);
    const duplicateEmail = [
      anEmployee({ email: 'same@acme.example' }),
      anEmployee({ email: 'same@acme.example' }),
    ];

    expect(() => replaceAllEmployees(db, duplicateEmail, NOW)).toThrow(/UNIQUE/);

    expect(count(db, 'employees')).toBe(10);
  });
});

describe('seedDatabase', () => {
  it('saves nothing at all when one employee cannot be saved', () => {
    const db = openDatabase(':memory:');
    const duplicateEmail = [
      anEmployee({ email: 'same@acme.example' }),
      anEmployee({ email: 'same@acme.example' }),
    ];

    expect(() => seedDatabase(db, duplicateEmail, NOW)).toThrow(/UNIQUE/);

    expect(count(db, 'employees')).toBe(0);
    expect(count(db, 'salary_changes')).toBe(0);
  });
});
