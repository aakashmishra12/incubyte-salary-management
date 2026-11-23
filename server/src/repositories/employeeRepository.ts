import type { Db } from '../db/database.ts';
import type { Employee, EmployeeDraft, EmployeeStatus } from '../domain/employee.ts';
import { toUsdMinor } from '../domain/money.ts';
import type { CurrencyCode } from '../domain/reference.ts';

/** What the caller may sort the list by. */
export type EmployeeSort =
  'name' | 'employeeCode' | 'hireDate' | 'country' | 'department' | 'level' | 'salary';

export interface EmployeeListQuery {
  page: number;
  pageSize: number;
  sort: EmployeeSort;
  order: 'asc' | 'desc';
  search?: string;
  country?: string;
  department?: string;
  level?: string;
  status?: EmployeeStatus;
}

/**
 * The only way a sort choice reaches SQL: through this fixed table.
 * Text from a request is never placed into a query.
 */
const SORT_COLUMNS: Record<EmployeeSort, string[]> = {
  name: ['last_name', 'first_name'],
  employeeCode: ['employee_code'],
  hireDate: ['hire_date'],
  country: ['country'],
  department: ['department'],
  level: ['level'],
  // The USD equivalent, so salaries in different currencies compare fairly. See D-014.
  salary: ['salary_usd_minor'],
};

/** Column names are snake_case in the database and camelCase in the code. */
const EMPLOYEE_COLUMNS = `
  id,
  employee_code    AS employeeCode,
  first_name       AS firstName,
  last_name        AS lastName,
  email,
  country,
  department,
  level,
  job_title        AS jobTitle,
  hire_date        AS hireDate,
  status,
  left_on          AS leftOn,
  currency,
  salary_minor     AS salaryMinor,
  salary_usd_minor AS salaryUsdMinor
`;

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

  const findByIdStatement = db.prepare(`SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE id = ?`);

  const salaryHistoryStatement = db.prepare(`
    SELECT
      id,
      previous_minor AS previousMinor,
      new_minor      AS newMinor,
      currency,
      effective_date AS effectiveDate,
      reason
    FROM salary_changes
    WHERE employee_id = ?
    ORDER BY effective_date DESC, id DESC
  `);

  const findIdByEmailStatement = db.prepare('SELECT id FROM employees WHERE email = ?');

  // Employee codes look like E00042. Take the number part of the highest one.
  const highestCodeNumberStatement = db.prepare(`
    SELECT COALESCE(MAX(CAST(SUBSTR(employee_code, 2) AS INTEGER)), 0) AS highest
    FROM employees
    WHERE employee_code LIKE 'E%'
  `);

  const markLeftStatement = db.prepare(`
    UPDATE employees SET status = 'left', left_on = @leftOn, updated_at = @now WHERE id = @id
  `);

  const updateSalaryStatement = db.prepare(`
    UPDATE employees
    SET salary_minor = @salaryMinor, salary_usd_minor = @salaryUsdMinor, updated_at = @now
    WHERE id = @id
  `);

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

    findById(id: number): Employee | undefined {
      return findByIdStatement.get(id) as Employee | undefined;
    },

    /** Every salary change for one employee, newest first. */
    salaryHistory(employeeId: number): SalaryChange[] {
      return salaryHistoryStatement.all(employeeId) as SalaryChange[];
    },

    updateSalary(id: number, salaryMinor: number, currency: CurrencyCode, now: string): void {
      updateSalaryStatement.run({
        id,
        salaryMinor,
        salaryUsdMinor: toUsdMinor(salaryMinor, currency),
        now,
      });
    },

    /** The id of the employee who has this email, if anyone does. */
    findIdByEmail(email: string): number | undefined {
      return (findIdByEmailStatement.get(email) as { id: number } | undefined)?.id;
    },

    /** The next free employee code: E10001 when the highest so far is E10000. */
    nextEmployeeCode(): string {
      const { highest } = highestCodeNumberStatement.get() as { highest: number };
      return `E${String(highest + 1).padStart(5, '0')}`;
    },

    /** Changes only the fields given. The column names come from the fixed table below. */
    updateDetails(id: number, changes: EmployeeDetailChanges, now: string): void {
      const fields = Object.keys(changes) as (keyof EmployeeDetailChanges)[];
      const assignments = fields.map((field) => `${EDITABLE_COLUMNS[field]} = @${field}`);
      db.prepare(
        `UPDATE employees SET ${assignments.join(', ')}, updated_at = @now WHERE id = @id`,
      ).run({ ...changes, id, now });
    },

    markLeft(id: number, leftOn: string, now: string): void {
      markLeftStatement.run({ id, leftOn, now });
    },

    /**
     * Runs several writes as one unit: all of them are saved, or none.
     * If `work` throws, everything it wrote is undone.
     */
    inTransaction<T>(work: () => T): T {
      return db.transaction(work)();
    },

    /** One page of employees matching the query, and how many match in total. */
    list(query: EmployeeListQuery): { items: Employee[]; total: number } {
      const { where, params } = buildFilter(query);

      const direction = query.order === 'desc' ? 'DESC' : 'ASC';
      // The id at the end makes the order stable when two rows tie, so paging never
      // shows the same person twice.
      const orderBy = [
        ...SORT_COLUMNS[query.sort].map((column) => `${column} ${direction}`),
        'id',
      ].join(', ');

      const items = db
        .prepare(
          `SELECT ${EMPLOYEE_COLUMNS} FROM employees ${where}
           ORDER BY ${orderBy} LIMIT @limit OFFSET @offset`,
        )
        .all({ ...params, limit: query.pageSize, offset: (query.page - 1) * query.pageSize });

      const { total } = db
        .prepare(`SELECT COUNT(*) AS total FROM employees ${where}`)
        .get(params) as { total: number };

      return { items: items as Employee[], total };
    },
  };
}

/** The type of the object above, so other files can say "I need an employee repository". */
export type EmployeeRepository = ReturnType<typeof createEmployeeRepository>;

/** The details that can be corrected after an employee is created. All are optional. */
export interface EmployeeDetailChanges {
  firstName?: string;
  lastName?: string;
  email?: string;
  department?: string;
  level?: string;
  jobTitle?: string;
}

/** Which column each editable field is stored in. Nothing outside this table can be updated. */
const EDITABLE_COLUMNS: Record<keyof EmployeeDetailChanges, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  email: 'email',
  department: 'department',
  level: 'level',
  jobTitle: 'job_title',
};

/** One row of salary history as stored. */
export interface SalaryChange {
  id: number;
  previousMinor: number | null;
  newMinor: number;
  currency: string;
  effectiveDate: string;
  reason: string;
}

export interface SalaryChangeDraft {
  employeeId: number;
  /** Null for the starting salary, when there was no salary before. */
  previousMinor: number | null;
  newMinor: number;
  currency: string;
  effectiveDate: string;
  reason: string;
}

/**
 * Turns the optional filters into a WHERE clause.
 * The clause contains only fixed text and @placeholders. The values travel separately
 * in params, which is what makes SQL injection impossible.
 */
function buildFilter(query: EmployeeListQuery): {
  where: string;
  params: Record<string, string>;
} {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  if (query.country) {
    conditions.push('country = @country');
    params.country = query.country;
  }
  if (query.department) {
    conditions.push('department = @department');
    params.department = query.department;
  }
  if (query.level) {
    conditions.push('level = @level');
    params.level = query.level;
  }
  if (query.status) {
    conditions.push('status = @status');
    params.status = query.status;
  }
  if (query.search) {
    // LIKE treats % and _ as wildcards. Put a backslash before them so they match literally.
    const literal = query.search.replace(/[\\%_]/g, (character) => `\\${character}`);
    conditions.push(`(
      first_name || ' ' || last_name LIKE @search ESCAPE '\\'
      OR email LIKE @search ESCAPE '\\'
      OR employee_code LIKE @search ESCAPE '\\'
    )`);
    params.search = `%${literal}%`;
  }

  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}
