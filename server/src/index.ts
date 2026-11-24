import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.ts';
import { buildAssistant } from './assistant/buildAssistant.ts';
import { loadAssistantConfig } from './assistant/config.ts';
import { createFailover } from './assistant/failover.ts';
import { createOpenAiCompatibleClient } from './assistant/providerClient.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './db/database.ts';
import { loadEnvFile } from './loadEnv.ts';
import { DEFAULT_SEED, SEED_TIMESTAMP, seedIfEmpty } from './seed/seedDatabase.ts';

// Settings such as the port and provider keys live in a .env file at the project root, which git
// ignores. Variables already set in the environment win over the file. This must run before the
// settings are read.
loadEnvFile();
const config = loadConfig(process.env);

mkdirSync(path.dirname(config.databaseFile), { recursive: true });
const db = openDatabase(config.databaseFile);

// A new server has an empty database. Fill it so the app is usable straight away.
if (seedIfEmpty(db, DEFAULT_SEED, SEED_TIMESTAMP)) {
  console.log(`Empty database: seeded ${DEFAULT_SEED.count} employees`);
}

// The web app is built into web/dist. In development it does not exist, and Vite serves the UI.
const webDir = existsSync(config.webDir) ? config.webDir : undefined;

// The pay assistant is on only if at least one provider key is set.
const assistantConfig = loadAssistantConfig(process.env);
console.log(assistantConfig.describe());
const assistant =
  assistantConfig.providers.length > 0
    ? buildAssistant({
        db,
        limits: assistantConfig.limits,
        failover: createFailover({
          providers: assistantConfig.providers.map(({ dailyLimit, ...provider }) => ({
            client: createOpenAiCompatibleClient(provider),
            dailyLimit,
          })),
          clock: () => new Date(),
          logError: (error) => console.error('Assistant provider problem:', error),
        }),
      })
    : undefined;

const server = createApp({ db, webDir, assistant, trustProxy: config.trustProxy }).listen(
  config.port,
  config.host,
  () => {
    console.log(`Salary Management listening on http://${config.host}:${config.port}`);
  },
);

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
