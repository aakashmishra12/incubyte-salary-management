import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';

function stubFetch(implementation: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(implementation));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the app name', () => {
    stubFetch(() => Promise.resolve(Response.json({ status: 'ok' })));

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Salary Management' })).toBeInTheDocument();
  });

  it('says the API is reachable when the health check succeeds', async () => {
    stubFetch(() => Promise.resolve(Response.json({ status: 'ok' })));

    render(<App />);

    expect(await screen.findByText('API is reachable')).toBeInTheDocument();
  });

  it('says the API cannot be reached when the health check fails', async () => {
    stubFetch(() => Promise.reject(new Error('network down')));

    render(<App />);

    expect(await screen.findByText('Cannot reach the API')).toBeInTheDocument();
  });

  it('says the API cannot be reached when the server answers with an error', async () => {
    stubFetch(() => Promise.resolve(new Response('boom', { status: 500 })));

    render(<App />);

    expect(await screen.findByText('Cannot reach the API')).toBeInTheDocument();
  });
});
