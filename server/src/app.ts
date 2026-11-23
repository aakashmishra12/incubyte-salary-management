import path from 'node:path';
import express, { type Express } from 'express';

export interface AppOptions {
  /** Folder holding the built web app. When set, the server serves it next to the API. */
  webDir?: string;
}

/**
 * Builds the Express app without starting it.
 * Tests call this directly, and index.ts calls it and then listens on a port.
 */
export function createApp(options: AppOptions = {}): Express {
  const app = express();

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  // Anything else under /api is a mistake by the caller. Answer in JSON like the rest of the API.
  app.use('/api', (_request, response) => {
    response.status(404).json({ error: 'Not found' });
  });

  const { webDir } = options;
  if (webDir) {
    // Real files first: scripts, styles, images.
    app.use(express.static(webDir));
    // Every other address is a page inside the React app, so send the app and let it route.
    app.get('/{*page}', (_request, response) => {
      response.sendFile(path.join(webDir, 'index.html'));
    });
  }

  return app;
}
