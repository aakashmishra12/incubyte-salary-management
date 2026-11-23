import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

/** Renders a page the way the app does: inside the router and the data cache. */
export function renderPage(page: ReactElement, { route = '/' }: { route?: string } = {}) {
  // A new cache per test, and no retries, so a failing request fails the test at once.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

type Handler = (url: URL, init?: RequestInit) => unknown;

/**
 * Replaces fetch for one test. Each key is "METHOD /path" and its handler returns the JSON
 * body. Returning a Response gives full control, for example to send an error status.
 * The returned list records every request made, so tests can check what the page asked for.
 */
export function stubApi(handlers: Record<string, Handler>) {
  const requests: { method: string; url: URL; body: unknown }[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost');
      const method = init?.method ?? 'GET';
      requests.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });

      const handler = handlers[`${method} ${url.pathname}`];
      if (!handler) return new Response('{"error":"Not found"}', { status: 404 });

      const result = handler(url, init);
      return result instanceof Response ? result : Response.json(result);
    }),
  );

  return requests;
}
