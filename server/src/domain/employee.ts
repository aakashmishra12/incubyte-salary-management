import type { CountryCode, CurrencyCode, Department, Level } from './reference.ts';

export type EmployeeStatus = 'active' | 'left';

/** Everything needed to store a new employee. The database adds the id. */
export interface EmployeeDraft {
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  country: CountryCode;
  department: Department;
  level: Level;
  jobTitle: string;
  /** Dates are text in the form YYYY-MM-DD, which sorts correctly as plain text. */
  hireDate: string;
  status: EmployeeStatus;
  leftOn: string | null;
  currency: CurrencyCode;
  salaryMinor: number;
}

/** An employee as stored. */
export interface Employee extends EmployeeDraft {
  id: number;
  salaryUsdMinor: number;
}
