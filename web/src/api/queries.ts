import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchEmployees, fetchReference } from './employees.ts';

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
