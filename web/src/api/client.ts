/** An error answer from the API, with the status and the message the server sent. */
export class ApiError extends Error {
  readonly status: number;
  /** Which fields were wrong, when the server refused the input. */
  readonly issues: { field: string; message: string }[];

  constructor(status: number, message: string, issues: { field: string; message: string }[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

/**
 * The one place that calls fetch. It sends and reads JSON, and turns every error status
 * into an ApiError, so callers only deal with data or a thrown error.
 * <T> is the type the caller expects back. It is a promise about the server, not a check.
 */
export async function api<T>(path: string, init?: { method: string; body?: unknown }): Promise<T> {
  const response = await fetch(path, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!response.ok) {
    // The server sends { error, issues } for known problems. Fall back if the body is not JSON.
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error ?? 'Request failed', body.issues);
  }

  return (await response.json()) as T;
}
