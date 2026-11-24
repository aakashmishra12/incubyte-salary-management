import type { Employee } from '../domain/employee.ts';
import { COUNTRIES, type CountryCode, type Department, type Level } from '../domain/reference.ts';
import { checkSalaryChange } from '../domain/salaryChange.ts';
import { HttpError } from '../http/errors.ts';
import type {
  EmployeeDetailChanges,
  EmployeeListQuery,
  EmployeeRepository,
  SalaryChange,
} from '../repositories/employeeRepository.ts';

export interface EmployeePage {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmployeeDetail {
  employee: Employee;
  salaryHistory: SalaryChange[];
}

export interface SalaryChangeInput {
  newSalaryMinor: number;
  effectiveDate: string;
  reason: string;
}

/** What the HR Manager fills in for a new joiner. The system supplies the rest. */
export interface NewEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  country: CountryCode;
  department: Department;
  level: Level;
  jobTitle: string;
  hireDate: string;
  salaryMinor: number;
}

/**
 * The use cases around employees. Routes call these, and these call the repository.
 * Business rules go here, never in a route and never in SQL.
 * The clock is passed in so tests decide what "now" is.
 */
export function createEmployeeService(repository: EmployeeRepository, clock: () => Date) {
  function getDetail(id: number): EmployeeDetail {
    const employee = repository.findById(id);
    if (!employee) throw new HttpError(404, 'Employee not found');
    return { employee, salaryHistory: repository.salaryHistory(id) };
  }

  /** Refuses an email that belongs to someone else. `ownId` is the employee being edited, if any. */
  function ensureEmailIsFree(email: string, ownId?: number): void {
    const ownerId = repository.findIdByEmail(email);
    if (ownerId !== undefined && ownerId !== ownId) {
      throw new HttpError(409, 'Another employee already has this email.');
    }
  }

  return {
    create(input: NewEmployeeInput): EmployeeDetail {
      const now = clock().toISOString();
      if (input.hireDate > now.slice(0, 10)) {
        throw new HttpError(422, 'The hire date cannot be in the future.');
      }
      ensureEmailIsFree(input.email);

      // The currency follows from the country. The caller never chooses it.
      const currency = COUNTRIES[input.country].currency;

      const id = repository.inTransaction(() => {
        const employeeId = repository.insert(
          {
            ...input,
            employeeCode: repository.nextEmployeeCode(),
            status: 'active',
            leftOn: null,
            currency,
          },
          now,
        );
        repository.insertSalaryChange(
          {
            employeeId,
            previousMinor: null,
            newMinor: input.salaryMinor,
            currency,
            effectiveDate: input.hireDate,
            reason: 'Starting salary',
          },
          now,
        );
        return employeeId;
      });

      return getDetail(id);
    },

    updateDetails(id: number, changes: EmployeeDetailChanges): EmployeeDetail {
      const { employee } = getDetail(id);
      if (employee.status === 'left') {
        throw new HttpError(409, 'This employee has left. Their details cannot be changed.');
      }
      if (changes.email !== undefined) ensureEmailIsFree(changes.email, id);

      repository.updateDetails(id, changes, clock().toISOString());
      return getDetail(id);
    },

    markLeft(id: number, leftOn: string): EmployeeDetail {
      const { employee, salaryHistory } = getDetail(id);
      const now = clock().toISOString();

      if (employee.status === 'left') {
        throw new HttpError(409, 'This employee has already left.');
      }
      if (leftOn < employee.hireDate) {
        throw new HttpError(
          422,
          `The leaving date cannot be before the hire date (${employee.hireDate}).`,
        );
      }
      if (leftOn > now.slice(0, 10)) {
        throw new HttpError(422, 'The leaving date cannot be in the future.');
      }
      // The history is newest first. Someone cannot leave before their pay was last set.
      const lastChange = salaryHistory[0]?.effectiveDate;
      if (lastChange && leftOn < lastChange) {
        throw new HttpError(
          422,
          `The leaving date cannot be before the most recent salary change (${lastChange}).`,
        );
      }

      repository.markLeft(id, leftOn, now);
      return getDetail(id);
    },

    list(query: EmployeeListQuery): EmployeePage {
      const { items, total } = repository.list(query);
      return { items, total, page: query.page, pageSize: query.pageSize };
    },

    getDetail,

    changeSalary(id: number, input: SalaryChangeInput): EmployeeDetail {
      const { employee, salaryHistory } = getDetail(id);
      const now = clock().toISOString();

      const problem = checkSalaryChange(
        {
          status: employee.status,
          hireDate: employee.hireDate,
          currentSalaryMinor: employee.salaryMinor,
          // History is newest first. Someone with no history yet falls back to their hire date.
          lastChangeDate: salaryHistory[0]?.effectiveDate ?? employee.hireDate,
          today: now.slice(0, 10),
        },
        input,
      );
      if (problem) {
        // 409: the employee's state forbids it. 422: this request breaks a rule.
        throw new HttpError(problem.kind === 'conflict' ? 409 : 422, problem.message);
      }

      // The new salary and its history row are saved together or not at all.
      repository.inTransaction(() => {
        repository.updateSalary(id, input.newSalaryMinor, employee.currency, now);
        repository.insertSalaryChange(
          {
            employeeId: id,
            previousMinor: employee.salaryMinor,
            newMinor: input.newSalaryMinor,
            currency: employee.currency,
            effectiveDate: input.effectiveDate,
            reason: input.reason,
          },
          now,
        );
      });

      return getDetail(id);
    },
  };
}

export type EmployeeService = ReturnType<typeof createEmployeeService>;
