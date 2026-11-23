import { openDatabase, type Db } from '../db/database.ts';
import type { EmployeeDraft } from '../domain/employee.ts';
import {
  createEmployeeRepository,
  type EmployeeRepository,
} from '../repositories/employeeRepository.ts';

/** Helpers that keep tests short. Only test files import this folder. */

export const TEST_NOW = '2026-11-20T09:00:00.000Z';

let nextNumber = 1;

/** A valid employee. A test overrides only the fields it cares about. */
export function anEmployee(overrides: Partial<EmployeeDraft> = {}): EmployeeDraft {
  const number = nextNumber++;
  return {
    employeeCode: `T${String(number).padStart(5, '0')}`,
    firstName: 'Asha',
    lastName: 'Rao',
    email: `person${number}@acme.example`,
    country: 'US',
    department: 'Engineering',
    level: 'L3',
    jobTitle: 'Senior Software Engineer',
    hireDate: '2020-01-15',
    status: 'active',
    leftOn: null,
    currency: 'USD',
    salaryMinor: 100_000_00,
    ...overrides,
  };
}

/** A fresh in-memory database with the given employees in it. */
export function aDatabaseWith(employees: EmployeeDraft[] = []): {
  db: Db;
  repository: EmployeeRepository;
  ids: number[];
} {
  const db = openDatabase(':memory:');
  const repository = createEmployeeRepository(db);
  const ids = employees.map((employee) => repository.insert(employee, TEST_NOW));
  return { db, repository, ids };
}
