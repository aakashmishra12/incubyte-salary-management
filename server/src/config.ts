import path from 'node:path';

export interface ServerConfig {
  port: number;
  /** The address to listen on. */
  host: string;
  databaseFile: string;
  /** Where the built web app is, when it has been built. */
  webDir: string;
  /** How many web servers sit in front of this one. Unset when the app is reached directly. */
  trustProxy: number | undefined;
}

/** A positive whole number, or undefined if the text is missing or is anything else. */
function positiveInteger(text: string | undefined): number | undefined {
  if (text === undefined || text.trim() === '') return undefined;
  const value = Number(text);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/**
 * Reads the server settings. `env` is passed in, so this can be tested with any settings
 * and so it is called only after the .env file has been loaded (see loadEnv.ts).
 */
export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  const port = positiveInteger(env.PORT);
  const trustProxy = positiveInteger(env.TRUST_PROXY);

  return {
    port: port !== undefined && port <= 65535 ? port : 3000,
    // Behind a web server, listen only on this machine. Otherwise anyone who can reach the port
    // could send their own X-Forwarded-For header and pick which visitor they are counted as.
    host: env.HOST?.trim() || (trustProxy !== undefined ? '127.0.0.1' : '0.0.0.0'),
    databaseFile:
      env.DATABASE_FILE?.trim() || path.join(import.meta.dirname, '../data/salary.sqlite'),
    webDir: path.join(import.meta.dirname, '../../web/dist'),
    trustProxy,
  };
}
