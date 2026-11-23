import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { openDatabase } from './db/database.ts';
import { DEFAULT_SEED, SEED_TIMESTAMP, seedIfEmpty } from './seed/seedDatabase.ts';

mkdirSync(path.dirname(config.databaseFile), { recursive: true });
const db = openDatabase(config.databaseFile);

// A new server has an empty database. Fill it so the app is usable straight away.
if (seedIfEmpty(db, DEFAULT_SEED, SEED_TIMESTAMP)) {
  console.log(`Empty database: seeded ${DEFAULT_SEED.count} employees`);
}

// The web app is built into web/dist. In development it does not exist, and Vite serves the UI.
const webDir = existsSync(config.webDir) ? config.webDir : undefined;

const server = createApp({ db, webDir }).listen(config.port, () => {
  console.log(`Salary Management listening on http://localhost:${config.port}`);
});

// When the process is asked to stop (Ctrl+C, or the host restarting it), stop taking
// requests, let the ones in progress finish, and close the database file cleanly.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
