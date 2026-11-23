import type { Db } from '../db/database.ts';
import type { EmployeeDraft } from '../domain/employee.ts';
import { toUsdMinor } from '../domain/money.ts';

/**
 * All SQL about employees lives in this file. Nothing outside the repositories folder
 * knows the table or column names.
 */
export function createEmployeeRepository(db: Db) {
  // Statements are prepared once and reused, which is much faster than preparing per call.
  const insertStatement = db.prepare(`
    INSERT INTO employees (
      employee_code, first_name, last_name, email, country, department, level, job_title,
      hire_date, status, left_on, currency, salary_minor, salary_usd_minor, created_at, updated_at
    ) VALUES (
      @employeeCode, @firstName, @lastName, @email, @country, @department, @level, @jobTitle,
      @hireDate, @status, @leftOn, @currency, @salaryMinor, @salaryUsdMinor, @now, @now
    )
  `);

  const insertSalaryChangeStatement = db.prepare(`
    INSERT INTO salary_changes (
      employee_id, previous_minor, new_minor, currency, effective_date, reason, created_at
    ) VALUES (
      @employeeId, @previousMinor, @newMinor, @currency, @effectiveDate, @reason, @now
    )
  `);

  const countStatement = db.prepare('SELECT COUNT(*) AS total FROM employees');

  return {
    /** Stores a new employee and returns the id the database gave them. */
    insert(draft: EmployeeDraft, now: string): number {
      const result = insertStatement.run({
        ...draft,
        // The one place the derived USD amount is computed. See D-014.
        salaryUsdMinor: toUsdMinor(draft.salaryMinor, draft.currency),
        now,
      });
      return Number(result.lastInsertRowid);
    },

    insertSalaryChange(change: SalaryChangeDraft, now: string): void {
      insertSalaryChangeStatement.run({ ...change, now });
    },

    count(): number {
      return (countStatement.get() as { total: number }).total;
    },
  };
}

/** The type of the object above, so other files can say "I need an employee repository". */
export type EmployeeRepository = ReturnType<typeof createEmployeeRepository>;

export interface SalaryChangeDraft {
  employeeId: number;
  /** Null for the starting salary, when there was no salary before. */
  previousMinor: number | null;
  newMinor: number;
  currency: string;
  effectiveDate: string;
  reason: string;
}
