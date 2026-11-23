import type { Db } from '../db/database.ts';
import type { EmployeeDraft } from '../domain/employee.ts';
import { createEmployeeRepository } from '../repositories/employeeRepository.ts';
import { generateEmployees, type GenerateOptions } from './generateEmployees.ts';

/** The seed used by `npm run seed` and by the server when it starts empty. */
export const DEFAULT_SEED: GenerateOptions = { count: 10_000, seed: 2026 };

/** Stores the employees, each with the first row of their salary history. */
export function seedDatabase(db: Db, employees: readonly EmployeeDraft[], now: string): void {
  const repository = createEmployeeRepository(db);

  // One transaction for everything: about a hundred times faster than one per row,
  // and a failure halfway leaves the database empty instead of half filled.
  db.transaction(() => {
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
  })();
}

/** Seeds only when there are no employees yet. Returns whether it seeded. */
export function seedIfEmpty(db: Db, options: GenerateOptions, now: string): boolean {
  if (createEmployeeRepository(db).count() > 0) return false;

  seedDatabase(db, generateEmployees(options), now);
  return true;
}
