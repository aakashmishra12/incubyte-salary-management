import express, { type Express } from 'express';

/**
 * Builds the Express app without starting it.
 * Tests call this directly, and index.ts calls it and then listens on a port.
 */
export function createApp(): Express {
  const app = express();

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  return app;
}
