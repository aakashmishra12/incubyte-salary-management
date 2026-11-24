import react from '@vitejs/plugin-react';
import path from 'node:path';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // The server's port may be set in the .env file at the project root, so the proxy reads it too.
  const env = loadEnv(mode, path.resolve(import.meta.dirname, '..'), '');
  const apiPort = Number(process.env.PORT ?? env.PORT) || 3000;

  return {
    plugins: [react()],
    server: {
      // In development the UI runs on Vite's port and forwards API calls to the server.
      proxy: { '/api': `http://localhost:${apiPort}` },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test-setup.ts',
    },
  };
});
