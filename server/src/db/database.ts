import Database from 'better-sqlite3';
import { migrate } from './migrations.ts';

export type Db = Database.Database;

/**
 * Opens the database file (or ':memory:' in tests) and makes sure the schema is current.
 */
export function openDatabase(file: string): Db {
  const db = new Database(file);

  // SQLite does not check foreign keys unless asked to, on every connection.
  db.pragma('foreign_keys = ON');
  // Write-ahead logging lets reads continue while a write is in progress.
  db.pragma('journal_mode = WAL');

  migrate(db);
  return db;
}
