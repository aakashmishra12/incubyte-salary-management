import { useLocation } from 'react-router';

/**
 * Where "Back to employees" and Cancel should go. The list passes its own address (with its
 * filters, search and page) when it opens an employee, so coming back lands on the same view.
 * Anything that is not a plain path inside this app is ignored.
 */
export function useBackToList(): string {
  const { state } = useLocation();
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}
