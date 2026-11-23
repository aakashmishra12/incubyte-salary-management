import type { Db } from '../db/database.ts';
import type { Employee, EmployeeDraft, EmployeeStatus } from '../domain/employee.ts';
import { toUsdMinor } from '../domain/money.ts';

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
