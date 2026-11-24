import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

/** The settings file at the project root. It is ignored by git, because it holds keys. */
export const ENV_FILE = path.join(import.meta.dirname, '../../.env');

/**
 * Adds the settings in a .env file to the environment. A setting that is already there wins,
 * so a real environment variable always overrides the file. A missing file is fine.
 * `env` is passed in so the function can be tested without touching the real environment.
 */
export function loadEnvFile(
  file: string = ENV_FILE,
  env: Record<string, string | undefined> = process.env,
): void {
  if (!existsSync(file)) return;

  for (const [name, value] of Object.entries(parseEnv(readFileSync(file, 'utf8')))) {
    if (env[name] === undefined) env[name] = value;
  }
}
