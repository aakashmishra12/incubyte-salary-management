import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmployeePage } from '../api/types.ts';
import { anEmployee, reference } from '../testing/fixtures.ts';
import { renderPage, stubApi } from '../testing/render.tsx';
import { EmployeesPage } from './EmployeesPage.tsx';

function pageOf(items: EmployeePage['items'], total = items.length): EmployeePage {
  return { items, total, page: 1, pageSize: 25 };
}

/** The most recent request the page made for the employee list. */
function lastListRequest(requests: ReturnType<typeof stubApi>) {
  return requests.filter((request) => request.url.pathname === '/api/employees').at(-1)!.url
    .searchParams;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EmployeesPage', () => {
  it('lists employees with their salary in the local currency', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () =>
        pageOf([
          anEmployee({
            employeeCode: 'E00042',
            firstName: 'Kenji',
            lastName: 'Sato',
            country: 'JP',
            currency: 'JPY',
            salaryMinor: 9_000_000,
            salaryUsdMinor: 60_300_00,
          }),
        ]),
    });

    renderPage(<EmployeesPage />);

    const row = (await screen.findByText('Kenji Sato')).closest('tr')!;
    expect(within(row).getByText('E00042')).toBeInTheDocument();
    expect(within(row).getByText('¥9,000,000')).toBeInTheDocument();
    expect(within(row).getByText('about $60,300')).toBeInTheDocument();
  });

  it('says how many employees match', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => pageOf([anEmployee()], 9_598),
    });

    renderPage(<EmployeesPage />);

    expect(await screen.findByText('9,598 employees')).toBeInTheDocument();
  });

  it('asks the server for matching employees when I search', async () => {
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => pageOf([anEmployee()]),
    });
    renderPage(<EmployeesPage />, { route: '/?page=3' });

    await userEvent.type(await screen.findByLabelText('Search'), 'rao');

    await screen.findByText('Asha Rao');
    await vi.waitFor(() => expect(lastListRequest(requests).get('search')).toBe('rao'));
    // A new search starts again from the first page.
    expect(lastListRequest(requests).get('page')).toBeNull();
  });

  it('asks the server for one country when I filter by country', async () => {
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => pageOf([anEmployee()]),
    });
    renderPage(<EmployeesPage />);

    await userEvent.click(await screen.findByLabelText('Country'));
    await userEvent.click(await screen.findByRole('option', { name: 'India' }));

    await vi.waitFor(() => expect(lastListRequest(requests).get('country')).toBe('IN'));
  });

  it('sorts by salary, highest first, when I click the salary heading', async () => {
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => pageOf([anEmployee()]),
    });
    renderPage(<EmployeesPage />);

    await userEvent.click(await screen.findByRole('button', { name: /salary/i }));

    await vi.waitFor(() => {
      expect(lastListRequest(requests).get('sort')).toBe('salary');
      expect(lastListRequest(requests).get('order')).toBe('desc');
    });
  });

  it('asks for the next page when I go to the next page', async () => {
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => pageOf([anEmployee()], 60),
    });
    renderPage(<EmployeesPage />);

    await userEvent.click(await screen.findByRole('button', { name: /next page/i }));

    await vi.waitFor(() => expect(lastListRequest(requests).get('page')).toBe('2'));
  });

  it('says so when nothing matches', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => pageOf([]),
    });

    renderPage(<EmployeesPage />, { route: '/?search=nobody' });

    expect(await screen.findByText('No employees match these filters.')).toBeInTheDocument();
  });

  it('says so when the list cannot be loaded, and loads it when I retry', async () => {
    let serverIsDown = true;
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () =>
        serverIsDown ? new Response('{}', { status: 500 }) : pageOf([anEmployee()]),
    });
    renderPage(<EmployeesPage />);
    expect(await screen.findByText('The employee list could not be loaded.')).toBeInTheDocument();

    serverIsDown = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
  });
});
