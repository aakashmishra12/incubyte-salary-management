import type { Employee, Reference } from '../api/types.ts';

export const reference: Reference = {
  countries: [
    { code: 'IN', name: 'India', currency: 'INR' },
    { code: 'US', name: 'United States', currency: 'USD' },
    { code: 'JP', name: 'Japan', currency: 'JPY' },
  ],
  currencies: [
    { code: 'INR', name: 'Indian rupee', minorUnits: 2 },
    { code: 'USD', name: 'US dollar', minorUnits: 2 },
    { code: 'JPY', name: 'Japanese yen', minorUnits: 0 },
  ],
  departments: ['Engineering', 'Sales'],
  levels: ['L1', 'L2', 'L3'],
  ratesAsOf: '2026-11-01',
};

let nextId = 1;

/** A valid employee. A test overrides only the fields it cares about. */
export function anEmployee(overrides: Partial<Employee> = {}): Employee {
  const id = nextId++;
  return {
    id,
    employeeCode: `E${String(id).padStart(5, '0')}`,
    firstName: 'Asha',
    lastName: 'Rao',
    email: `asha.rao${id}@acme.example`,
    country: 'US',
    department: 'Engineering',
    level: 'L3',
    jobTitle: 'Senior Software Engineer',
    hireDate: '2020-01-15',
    status: 'active',
    leftOn: null,
    currency: 'USD',
    salaryMinor: 100_000_00,
    salaryUsdMinor: 100_000_00,
    ...overrides,
  };
}
