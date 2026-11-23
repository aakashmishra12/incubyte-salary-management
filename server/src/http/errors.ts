import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

/**
 * An error the caller can do something about. The status and message are sent as they are.
 * Anything else that is thrown is a bug or an outage, and the caller gets a plain 500.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * The last stop for every error thrown in a route.
 * Express recognises an error handler by its four parameters, so all four must be listed.
 */
export function createErrorHandler(logError: (error: unknown) => void): ErrorRequestHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (error, _request, response, _next) => {
    if (error instanceof ZodError) {
      response.status(400).json({
        error: 'Invalid request',
        issues: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message });
      return;
    }

    // Unexpected: keep the details for the log and tell the caller nothing internal.
    logError(error);
    response.status(500).json({ error: 'Something went wrong' });
  };
}
