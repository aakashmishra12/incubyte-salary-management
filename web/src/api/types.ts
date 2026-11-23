/**
 * The shapes the API returns. They mirror the server's types by hand.
 * A shared package would remove the duplication, at the cost of more build setup
 * than two small files justify.
 */

export interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  department: string;
  level: string;
  jobTitle: string;
  hireDate: string;
  status: 'active' | 'left';
  leftOn: string | null;
  currency: string;
  salaryMinor: number;
  salaryUsdMinor: number;
}

export interface EmployeePage {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Reference {
  countries: { code: string; name: string; currency: string }[];
  currencies: { code: string; name: string; minorUnits: number }[];
  departments: string[];
  levels: string[];
  ratesAsOf: string;
}

export interface SalaryChange {
  id: number;
  /** Null for the starting salary. */
  previousMinor: number | null;
  newMinor: number;
  currency: string;
  effectiveDate: string;
  reason: string;
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
