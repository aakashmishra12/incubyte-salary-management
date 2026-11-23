import path from 'node:path';

/** Settings read from the environment once, with defaults that work for local development. */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseFile:
    process.env.DATABASE_FILE ?? path.join(import.meta.dirname, '../data/salary.sqlite'),
  /** Where the built web app is, when it has been built. */
  webDir: path.join(import.meta.dirname, '../../web/dist'),
};
