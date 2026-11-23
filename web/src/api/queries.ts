import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { changeSalary, fetchEmployee, fetchEmployees, fetchReference } from './employees.ts';
import type { SalaryChangeInput } from './types.ts';

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

/** Saves a salary change. A mutation is TanStack Query's name for a request that changes data. */
export function useChangeSalary(id: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (change: SalaryChangeInput) => changeSalary(id, change),
    onSuccess: (updated) => {
      // The server answered with the updated employee, so show it without asking again.
      queryClient.setQueryData(['employee', id], updated);
      // Lists and insights may now be out of date. Mark them so they reload when next shown.
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}
