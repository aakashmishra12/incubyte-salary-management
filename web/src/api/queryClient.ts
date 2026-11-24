import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client.ts';

/**
 * Whether to try a failed request again. An answer from the server that says "no" (a missing
 * employee, a bad filter, a refused change) will be the same next time, so retrying only makes
 * the person wait for the error. A server error or a lost connection may be a blip, so those
 * are tried once more.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 1;
}

/** One cache for all server data, shared by every page. */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });
}
