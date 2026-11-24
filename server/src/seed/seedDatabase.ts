import type { Db } from '../db/database.ts';
import type { EmployeeDraft } from '../domain/employee.ts';
import { createEmployeeRepository } from '../repositories/employeeRepository.ts';
import { generateEmployees, type GenerateOptions } from './generateEmployees.ts';

/** The seed used by `npm run seed` and by the server when it starts empty. */
export const DEFAULT_SEED: GenerateOptions = { count: 10_000, seed: 2026 };

/** A fixed timestamp for seeded rows, so two seeded databases are identical. */
export const SEED_TIMESTAMP = '2026-11-01T00:00:00.000Z';

/** Adds the employees, each with the first row of their salary history. Not a transaction by itself. */
function insertAll(db: Db, employees: readonly EmployeeDraft[], now: string): void {
  const repository = createEmployeeRepository(db);

  for (const employee of employees) {
    const employeeId = repository.insert(employee, now);
    repository.insertSalaryChange(
      {
        employeeId,
        previousMinor: null,
        newMinor: employee.salaryMinor,
        currency: employee.currency,
        effectiveDate: employee.hireDate,
        reason: 'Starting salary',
      },
      now,
    );
  }
}

/**
 * Stores the employees, each with the first row of their salary history.
 * One transaction for everything: about a hundred times faster than one per row,
 * and a failure halfway leaves the database empty instead of half filled.
 */
export function seedDatabase(db: Db, employees: readonly EmployeeDraft[], now: string): void {
  db.transaction(() => insertAll(db, employees, now))();
}

/**
 * Replaces every employee and every salary change with the given employees, in one transaction.
 * The file is not deleted or replaced, so a server that has it open sees the new data at once, and
 * if the new data cannot be saved the old data is still there. Used by `npm run seed`.
 */
export function replaceAllEmployees(
  db: Db,
  employees: readonly EmployeeDraft[],
  now: string,
): void {
  db.transaction(() => {
    // History first, because it refers to employees.
    db.exec('DELETE FROM salary_changes');
    db.exec('DELETE FROM employees');
    insertAll(db, employees, now);
  })();
}

/** Seeds only when there are no employees yet. Returns whether it seeded. */
export function seedIfEmpty(db: Db, options: GenerateOptions, now: string): boolean {
  if (createEmployeeRepository(db).count() > 0) return false;

  seedDatabase(db, generateEmployees(options), now);
  return true;
}
