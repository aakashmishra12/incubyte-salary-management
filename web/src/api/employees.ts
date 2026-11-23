import { api } from './client.ts';
import type {
  EmployeeChanges,
  EmployeeDetail,
  EmployeePage,
  NewEmployeeInput,
  Reference,
  SalaryChangeInput,
} from './types.ts';

/** The employee list for the filters in the address bar. The server applies its own defaults. */
export function fetchEmployees(params: URLSearchParams): Promise<EmployeePage> {
  const query = params.toString();
  return api<EmployeePage>(`/api/employees${query ? `?${query}` : ''}`);
}

export function fetchReference(): Promise<Reference> {
  return api<Reference>('/api/reference');
}

export function fetchEmployee(id: number): Promise<EmployeeDetail> {
  return api<EmployeeDetail>(`/api/employees/${id}`);
}

export function changeSalary(id: number, change: SalaryChangeInput): Promise<EmployeeDetail> {
  return api<EmployeeDetail>(`/api/employees/${id}/salary-changes`, {
    method: 'POST',
    body: change,
  });
}

export function createEmployee(input: NewEmployeeInput): Promise<EmployeeDetail> {
  return api<EmployeeDetail>('/api/employees', { method: 'POST', body: input });
}

export function updateEmployee(id: number, changes: EmployeeChanges): Promise<EmployeeDetail> {
  return api<EmployeeDetail>(`/api/employees/${id}`, { method: 'PATCH', body: changes });
}

export function markEmployeeLeft(id: number, leftOn: string): Promise<EmployeeDetail> {
  return api<EmployeeDetail>(`/api/employees/${id}/leave`, { method: 'POST', body: { leftOn } });
}
