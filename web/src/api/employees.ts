import { api } from './client.ts';
import type { EmployeePage, Reference } from './types.ts';

/** The employee list for the filters in the address bar. The server applies its own defaults. */
export function fetchEmployees(params: URLSearchParams): Promise<EmployeePage> {
  const query = params.toString();
  return api<EmployeePage>(`/api/employees${query ? `?${query}` : ''}`);
}

export function fetchReference(): Promise<Reference> {
  return api<Reference>('/api/reference');
}
