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

export interface NewEmployeeInput {
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  department: string;
  level: string;
  jobTitle: string;
  hireDate: string;
  salaryMinor: number;
}

/** The details that can be corrected. Only the fields that changed are sent. */
export type EmployeeChanges = Partial<
  Pick<Employee, 'firstName' | 'lastName' | 'email' | 'department' | 'level' | 'jobTitle'>
>;

/** Count, minimum, median, mean and maximum of a group of salaries, in minor units. */
export interface Summary {
  count: number;
  min: number;
  median: number;
  mean: number;
  max: number;
}

export interface PayOverview {
  headcount: number;
  totalUsdMinor: number;
  countries: {
    country: string;
    currency: string;
    headcount: number;
    totalLocalMinor: number;
    totalUsdMinor: number;
  }[];
  ratesAsOf: string;
}

export interface PayBreakdown {
  groupBy: 'country' | 'department' | 'level';
  groups: {
    key: string;
    usd: Summary;
    /** Null when the group mixes currencies. */
    local: (Summary & { currency: string }) | null;
  }[];
  ratesAsOf: string;
}

export interface OutlierItem {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  country: string;
  department: string;
  level: string;
  currency: string;
  salaryMinor: number;
  direction: 'below' | 'above';
  compaRatio: number;
  peerMedianMinor: number;
  peerCount: number;
}

export interface OutlierPage {
  items: OutlierItem[];
  total: number;
  page: number;
  pageSize: number;
  rule: { minPeers: number; lowPercent: number; highPercent: number };
  coverage: { rated: number; unrated: number };
}
