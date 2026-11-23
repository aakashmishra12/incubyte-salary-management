import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { askAssistant, fetchAssistantStatus } from './assistant.ts';
import {
  changeSalary,
  createEmployee,
  fetchEmployee,
  fetchEmployees,
  fetchReference,
  markEmployeeLeft,
  updateEmployee,
} from './employees.ts';
import {
  fetchBreakdown,
  fetchOutliers,
  fetchOverview,
  type BreakdownParams,
  type OutlierParams,
} from './insights.ts';
import type {
  EmployeeChanges,
  EmployeeDetail,
  NewEmployeeInput,
  SalaryChangeInput,
} from './types.ts';

/**
 * Hooks that load server data. TanStack Query caches each result under its key,
 * and gives the component `data`, `isPending` and `isError` without any hand-written state.
 */

export function useReference() {
  // The fixed lists never change while the app is open, so they are fetched once.
  return useQuery({ queryKey: ['reference'], queryFn: fetchReference, staleTime: Infinity });
}

export function useEmployees(params: URLSearchParams) {
  return useQuery({
    // The filters are part of the key: different filters are a different cached result.
    queryKey: ['employees', params.toString()],
    queryFn: () => fetchEmployees(params),
    // While the next page loads, keep showing the current one instead of flashing empty.
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(id: number) {
  return useQuery({ queryKey: ['employee', id], queryFn: () => fetchEmployee(id) });
}

export function useAssistantStatus() {
  return useQuery({
    queryKey: ['assistant', 'status'],
    queryFn: fetchAssistantStatus,
    staleTime: 30_000,
  });
}

/** Asks the assistant a question. Each answer changes what is left of the allowance and the providers' state. */
export function useAskAssistant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: askAssistant,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['assistant', 'status'] }),
  });
}

// Every insight key starts with 'insights', so one call can mark them all as out of date.

export function useOverview() {
  return useQuery({ queryKey: ['insights', 'overview'], queryFn: fetchOverview });
}

export function useBreakdown(params: BreakdownParams) {
  return useQuery({
    queryKey: ['insights', 'breakdown', params],
    queryFn: () => fetchBreakdown(params),
    placeholderData: keepPreviousData,
  });
}

export function useOutliers(params: OutlierParams) {
  return useQuery({
    queryKey: ['insights', 'outliers', params],
    queryFn: () => fetchOutliers(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * What every successful change to an employee does to the cache.
 * A mutation is TanStack Query's name for a request that changes data.
 */
function useShowUpdatedEmployee() {
  const queryClient = useQueryClient();

  return (updated: EmployeeDetail) => {
    // The server answered with the updated employee, so show it without asking again.
    queryClient.setQueryData(['employee', updated.employee.id], updated);
    // Lists and insights may now be out of date. Mark them so they reload when next shown.
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['insights'] });
  };
}

export function useChangeSalary(id: number) {
  return useMutation({
    mutationFn: (change: SalaryChangeInput) => changeSalary(id, change),
    onSuccess: useShowUpdatedEmployee(),
  });
}

export function useCreateEmployee() {
  return useMutation({
    mutationFn: (input: NewEmployeeInput) => createEmployee(input),
    onSuccess: useShowUpdatedEmployee(),
  });
}

export function useUpdateEmployee(id: number) {
  return useMutation({
    mutationFn: (changes: EmployeeChanges) => updateEmployee(id, changes),
    onSuccess: useShowUpdatedEmployee(),
  });
}

export function useMarkLeft(id: number) {
  return useMutation({
    mutationFn: (leftOn: string) => markEmployeeLeft(id, leftOn),
    onSuccess: useShowUpdatedEmployee(),
  });
}
