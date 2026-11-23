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
