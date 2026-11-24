import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.tsx';
import { anEmployee, reference } from './testing/fixtures.ts';
import { renderPage, stubApi } from './testing/render.tsx';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('shows the app name and the navigation', () => {
    stubApi({});

    renderPage(<App />);

    expect(screen.getByText('Salary Management')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Employees' })).toBeInTheDocument();
  });

  it('opens on the employee list', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => ({ items: [anEmployee()], total: 1, page: 1, pageSize: 25 }),
    });

    renderPage(<App />);

    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument();
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
  });

  it('says so when the address does not exist', () => {
    stubApi({});

    renderPage(<App />, { route: '/no-such-page' });

    expect(screen.getByText('This page does not exist.')).toBeInTheDocument();
  });
});

describe('App: page titles and room for the assistant button', () => {
  it.each([
    ['/', 'Employees'],
    ['/insights', 'Insights'],
    ['/employees/new', 'Add employee'],
    ['/no-such-page', 'Page not found'],
  ])('titles the browser tab for %s', async (route, title) => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
    });

    renderPage(<App />, { route });

    await vi.waitFor(() => expect(document.title).toBe(`${title} · Salary Management`));
  });

  it("titles the tab with the employee's name once it is loaded", async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees/7': () => ({
        employee: anEmployee({ id: 7, firstName: 'Kenji', lastName: 'Sato' }),
        salaryHistory: [],
      }),
    });

    renderPage(<App />, { route: '/employees/7' });

    await vi.waitFor(() => expect(document.title).toBe('Kenji Sato · Salary Management'));
  });

  it('leaves room below the content, so the assistant button never covers the last row or a submit button', () => {
    stubApi({
      'GET /api/assistant/status': () => ({
        enabled: true,
        providers: [],
        limits: null,
        remainingThisHour: 0,
      }),
    });

    renderPage(<App />, { route: '/no-such-page' });

    expect(
      parseFloat(getComputedStyle(screen.getByRole('main')).paddingBottom),
    ).toBeGreaterThanOrEqual(96);
  });
});
