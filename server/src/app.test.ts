import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { aDatabaseWith } from './testing/builders.ts';

const { db } = aDatabaseWith();

describe('GET /api/health', () => {
  it('reports that the API is up', async () => {
    const response = await request(createApp({ db })).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('an unknown path under /api', () => {
  it('answers 404 with a JSON error, not an HTML page', async () => {
    const response = await request(createApp({ db })).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.type).toBe('application/json');
    expect(response.body).toEqual({ error: 'Not found' });
  });
});

describe('when given a built web app to serve', () => {
  const webDir = path.join(import.meta.dirname, '../test-fixtures/web');

  it('serves the web app at the root', async () => {
    const response = await request(createApp({ db, webDir })).get('/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('fixture web app');
  });

  it('serves the web app for page addresses that only the browser router knows', async () => {
    const response = await request(createApp({ db, webDir })).get('/employees/42');

    expect(response.status).toBe(200);
    expect(response.text).toContain('fixture web app');
  });

  it('still answers unknown API paths with a JSON 404', async () => {
    const response = await request(createApp({ db, webDir })).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not found' });
  });
});

describe('security headers', () => {
  it('sends the standard protective headers on every response', async () => {
    const response = await request(createApp({ db })).get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('does not announce which framework the server runs', async () => {
    const response = await request(createApp({ db })).get('/api/health');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
