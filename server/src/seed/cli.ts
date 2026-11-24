/**
 * `npm run seed`: replaces every employee in the database with 10,000 freshly generated ones.
 * Safe to run as often as you like, and safe to run while the server is running: the database
 * file is kept and the swap is one transaction, so the server never sees a half-empty database.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.ts';
import { openDatabase } from '../db/database.ts';
import { loadEnvFile } from '../loadEnv.ts';
import { generateEmployees } from './generateEmployees.ts';
import { DEFAULT_SEED, replaceAllEmployees, SEED_TIMESTAMP } from './seedDatabase.ts';

// The same settings as the server, so DATABASE_FILE in .env points both at the same file.
loadEnvFile();
const config = loadConfig(process.env);

const startedAt = performance.now();

mkdirSync(path.dirname(config.databaseFile), { recursive: true });
const db = openDatabase(config.databaseFile);
replaceAllEmployees(db, generateEmployees(DEFAULT_SEED), SEED_TIMESTAMP);
db.close();

const seconds = ((performance.now() - startedAt) / 1000).toFixed(2);
console.log(`Seeded ${DEFAULT_SEED.count} employees into ${config.databaseFile} in ${seconds}s`);
