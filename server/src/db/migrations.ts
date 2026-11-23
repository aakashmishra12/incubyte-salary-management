import type { Database } from 'better-sqlite3';

/**
 * Schema changes, in order. A migration is never edited once it has shipped.
 * To change the schema, add a new entry at the end.
 */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE employees (
    id               INTEGER PRIMARY KEY,
    employee_code    TEXT    NOT NULL UNIQUE,
    first_name       TEXT    NOT NULL,
    last_name        TEXT    NOT NULL,
    email            TEXT    NOT NULL UNIQUE,
    country          TEXT    NOT NULL,
    department       TEXT    NOT NULL,
    level            TEXT    NOT NULL,
    job_title        TEXT    NOT NULL,
    hire_date        TEXT    NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'left')),
    left_on          TEXT,
    currency         TEXT    NOT NULL,
    salary_minor     INTEGER NOT NULL CHECK (salary_minor > 0),
    salary_usd_minor INTEGER NOT NULL CHECK (salary_usd_minor >= 0),
    created_at       TEXT    NOT NULL,
    updated_at       TEXT    NOT NULL
  );

  -- One index per column the employee list filters or sorts by.
  CREATE INDEX idx_employees_country    ON employees (country);
  CREATE INDEX idx_employees_department ON employees (department);
  CREATE INDEX idx_employees_level      ON employees (level);
  CREATE INDEX idx_employees_name       ON employees (last_name, first_name);
  CREATE INDEX idx_employees_salary_usd ON employees (salary_usd_minor);

  CREATE TABLE salary_changes (
    id             INTEGER PRIMARY KEY,
    employee_id    INTEGER NOT NULL REFERENCES employees (id),
    previous_minor INTEGER,
    new_minor      INTEGER NOT NULL CHECK (new_minor > 0),
    currency       TEXT    NOT NULL,
    effective_date TEXT    NOT NULL,
    reason         TEXT    NOT NULL,
    created_at     TEXT    NOT NULL
  );

  CREATE INDEX idx_salary_changes_employee ON salary_changes (employee_id, effective_date);
  `,
];

/**
 * Brings a database up to date. SQLite keeps a number called user_version in the file,
 * and it is used here to remember how many migrations have already been applied.
 */
export function migrate(db: Database): void {
  const applied = db.pragma('user_version', { simple: true }) as number;

  for (let version = applied; version < MIGRATIONS.length; version++) {
    // One transaction per migration: it is applied fully or not at all.
    db.transaction(() => {
      db.exec(MIGRATIONS[version]!);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
