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

  // Anything else under /api is a mistake by the caller. Answer in JSON like the rest of the API.
  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Not found' });
  });

  return app;
}
