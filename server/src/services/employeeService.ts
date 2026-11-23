import type { Employee } from '../domain/employee.ts';
import { checkSalaryChange } from '../domain/salaryChange.ts';
import { HttpError } from '../http/errors.ts';
import type {
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

  return {
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
