import type { Employee } from '../domain/employee.ts';
import type { EmployeeListQuery, EmployeeRepository } from '../repositories/employeeRepository.ts';

export interface EmployeePage {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * The use cases around employees. Routes call these, and these call the repository.
 * Business rules go here, never in a route and never in SQL.
 */
export function createEmployeeService(repository: EmployeeRepository) {
  return {
    list(query: EmployeeListQuery): EmployeePage {
      const { items, total } = repository.list(query);
      return { items, total, page: query.page, pageSize: query.pageSize };
    },
  };
}

export type EmployeeService = ReturnType<typeof createEmployeeService>;
