import { describe, expect, it } from 'vitest';
import { ApiError } from './client.ts';
import { shouldRetry } from './queryClient.ts';

describe('shouldRetry', () => {
  it.each([400, 401, 403, 404, 409, 422, 429])(
    'never retries a %i, because asking again gives the same answer and only makes the person wait',
    (status) => {
      expect(shouldRetry(0, new ApiError(status, 'No'))).toBe(false);
    },
  );

  it('retries a server error or a network failure once, in case it was a blip', () => {
    expect(shouldRetry(0, new ApiError(500, 'Oops'))).toBe(true);
    expect(shouldRetry(0, new TypeError('fetch failed'))).toBe(true);
  });

  it('gives up after that one retry', () => {
    expect(shouldRetry(1, new ApiError(500, 'Oops'))).toBe(false);
    expect(shouldRetry(1, new TypeError('fetch failed'))).toBe(false);
  });
});
