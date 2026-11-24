import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadEnvFile } from './loadEnv.ts';

function aFileWith(contents: string): string {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'env-test-')), '.env');
  writeFileSync(file, contents);
  return file;
}

describe('loadEnvFile', () => {
  it('adds the settings in the file to the environment', () => {
    const env: Record<string, string | undefined> = {};

    loadEnvFile(aFileWith('PORT=8080\nDATABASE_FILE=/data/salary.sqlite\n'), env);

    expect(env).toEqual({ PORT: '8080', DATABASE_FILE: '/data/salary.sqlite' });
  });

  it('never replaces a setting that is already in the environment', () => {
    const env: Record<string, string | undefined> = { PORT: '9000' };

    loadEnvFile(aFileWith('PORT=8080\nHOST=127.0.0.1\n'), env);

    expect(env).toEqual({ PORT: '9000', HOST: '127.0.0.1' });
  });

  it('does nothing when there is no file', () => {
    const env: Record<string, string | undefined> = { PORT: '9000' };

    loadEnvFile('/no/such/folder/.env', env);

    expect(env).toEqual({ PORT: '9000' });
  });

  it('ignores comments and treats an empty value as set but empty', () => {
    const env: Record<string, string | undefined> = {};

    loadEnvFile(aFileWith('# a comment\nGEMINI_API_KEY=\nPORT=8080 # trailing comment\n'), env);

    expect(env.PORT).toBe('8080');
    expect(env.GEMINI_API_KEY).toBe('');
  });

  it('ignores spaces around the equals sign, a slip that is easy to make', () => {
    const env: Record<string, string | undefined> = {};

    loadEnvFile(aFileWith('PORT = 8080\nHOST= 127.0.0.1\n'), env);

    expect(env).toEqual({ PORT: '8080', HOST: '127.0.0.1' });
  });
});
