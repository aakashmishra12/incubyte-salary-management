import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('has defaults that work for local development', () => {
    const config = loadConfig({});

    expect(config.port).toBe(3000);
    expect(config.host).toBe('0.0.0.0');
    expect(config.trustProxy).toBeUndefined();
    expect(config.databaseFile).toMatch(/server\/data\/salary\.sqlite$/);
    expect(config.webDir).toMatch(/web\/dist$/);
  });

  it('reads the port and the database file from the environment', () => {
    const config = loadConfig({ PORT: '8080', DATABASE_FILE: '/var/data/salary.sqlite' });

    expect(config.port).toBe(8080);
    expect(config.databaseFile).toBe('/var/data/salary.sqlite');
  });

  it.each(['abc', '0', '-1', '70000', '80.5', ''])('ignores a port of %j and uses 3000', (port) => {
    expect(loadConfig({ PORT: port }).port).toBe(3000);
  });

  it('listens only on this machine when it sits behind a web server, so nobody can reach it directly', () => {
    const config = loadConfig({ TRUST_PROXY: '1' });

    expect(config.trustProxy).toBe(1);
    expect(config.host).toBe('127.0.0.1');
  });

  it('lets the address to listen on be set, which wins over the default', () => {
    expect(loadConfig({ TRUST_PROXY: '1', HOST: '0.0.0.0' }).host).toBe('0.0.0.0');
    expect(loadConfig({ HOST: '127.0.0.1' }).host).toBe('127.0.0.1');
  });

  it.each(['abc', '0', '-2', '1.5', ''])('ignores a TRUST_PROXY of %j', (value) => {
    const config = loadConfig({ TRUST_PROXY: value });

    expect(config.trustProxy).toBeUndefined();
    expect(config.host).toBe('0.0.0.0');
  });
});
