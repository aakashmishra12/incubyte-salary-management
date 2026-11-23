/**
 * `npm run seed`: throws away the current database and builds a fresh one
 * with 10,000 employees. Safe to run as often as you like.
 */
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.ts';
import { openDatabase } from '../db/database.ts';
import { generateEmployees } from './generateEmployees.ts';
import { DEFAULT_SEED, SEED_TIMESTAMP, seedDatabase } from './seedDatabase.ts';

const startedAt = performance.now();

// SQLite keeps two helper files next to the database in WAL mode. Remove all three.
for (const suffix of ['', '-wal', '-shm']) {
  rmSync(config.databaseFile + suffix, { force: true });
}
mkdirSync(path.dirname(config.databaseFile), { recursive: true });

const db = openDatabase(config.databaseFile);
seedDatabase(db, generateEmployees(DEFAULT_SEED), SEED_TIMESTAMP);
db.close();

const seconds = ((performance.now() - startedAt) / 1000).toFixed(2);
console.log(`Seeded ${DEFAULT_SEED.count} employees into ${config.databaseFile} in ${seconds}s`);
