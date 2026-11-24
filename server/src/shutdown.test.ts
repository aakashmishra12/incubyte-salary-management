import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Starts the real server in its own process, on its own port and database, so the test can send
 * it the signal a host sends when it wants the server to stop. This is the only test that runs
 * index.ts, which makes it the check that the whole start-up works.
 */
function startServer(port: number) {
  const database = path.join(mkdtempSync(path.join(tmpdir(), 'shutdown-test-')), 'salary.sqlite');
  const child = spawn(process.execPath, ['src/index.ts'], {
    cwd: path.join(import.meta.dirname, '..'),
    // PORT and DATABASE_FILE override anything in a .env file. No provider key is passed on.
    env: { PATH: process.env.PATH, PORT: String(port), DATABASE_FILE: database },
  });
  let output = '';
  child.stdout.on('data', (chunk) => (output += chunk));
  child.stderr.on('data', (chunk) => (output += chunk));

  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Server did not start. Output: ${output}`)),
      15_000,
    );
    const check = setInterval(() => {
      if (output.includes('listening on')) {
        clearTimeout(timer);
        clearInterval(check);
        resolve();
      }
    }, 50);
  });
  const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
    child.on('exit', (code, signal) => resolve({ code, signal })),
  );
  return { child, ready, exited, output: () => output };
}

/** Asks the system for a port nobody is using, so the tests cannot collide with anything else running. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

describe('the server process', () => {
  it('starts on the port in PORT, seeds an empty database, and answers', async () => {
    const port = await freePort();
    const server = startServer(port);
    await server.ready;

    const response = await fetch(`http://127.0.0.1:${port}/api/employees?pageSize=1`);
    const body = (await response.json()) as { total: number };
    server.child.kill('SIGTERM');
    await server.exited;

    expect(body.total).toBe(10_000);
    expect(server.output()).toContain('Empty database: seeded 10000 employees');
  }, 30_000);

  it('stops cleanly when asked to stop, instead of being killed', async () => {
    const server = startServer(await freePort());
    await server.ready;

    server.child.kill('SIGTERM');
    const result = await server.exited;

    // Exit code 0 and no signal: the server closed the database and left by itself.
    expect(result).toEqual({ code: 0, signal: null });
  }, 30_000);
});
