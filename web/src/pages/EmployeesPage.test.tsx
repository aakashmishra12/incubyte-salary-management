import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmployeePage } from '../api/types.ts';
import { anEmployee, reference } from '../testing/fixtures.ts';
import { App } from '../App.tsx';
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

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe('EmployeesPage: the address bar and the search box', () => {
  const listStub = (items = [anEmployee()], total = items.length) => ({
    'GET /api/reference': () => reference,
    'GET /api/employees': () => pageOf(items, total),
  });

  it('keeps a filter chosen while the search is still waiting to be sent', async () => {
    const requests = stubApi(listStub());
    renderPage(<EmployeesPage />);

    await userEvent.type(await screen.findByLabelText('Search'), 'rao');
    // Within the 300 ms wait, choose a country. The search must not wipe it out when it is sent.
    await userEvent.click(screen.getByLabelText('Country'));
    await userEvent.click(await screen.findByRole('option', { name: 'India' }));
    await wait(500);

    const last = lastListRequest(requests);
    expect(last.get('search')).toBe('rao');
    expect(last.get('country')).toBe('IN');
  });

  it('keeps the page number when a bookmarked or refreshed address is opened', async () => {
    const requests = stubApi(listStub([anEmployee()], 100));
    renderPage(<EmployeesPage />, { route: '/?page=3' });
    await screen.findByText('Asha Rao');

    await wait(500);

    expect(lastListRequest(requests).get('page')).toBe('3');
  });

  it('empties the search box when the address no longer has a search, for example from the nav link', async () => {
    stubApi(listStub());
    renderPage(<App />, { route: '/?search=rao' });
    expect(await screen.findByLabelText('Search')).toHaveValue('rao');

    await userEvent.click(screen.getByRole('link', { name: 'Employees' }));

    expect(screen.getByLabelText('Search')).toHaveValue('');
  });

  it('reverses the sort order on a second click of the same heading', async () => {
    const requests = stubApi(listStub());
    renderPage(<EmployeesPage />);

    await userEvent.click(await screen.findByRole('button', { name: /^name/i }));
    await vi.waitFor(() => expect(lastListRequest(requests).get('order')).toBe('desc'));
    await userEvent.click(screen.getByRole('button', { name: /^name/i }));

    await vi.waitFor(() => expect(lastListRequest(requests).get('order')).toBe('asc'));
  });

  it('can be sorted by hire date, which the spec promises', async () => {
    const requests = stubApi(listStub());
    renderPage(<EmployeesPage />);

    await userEvent.click(await screen.findByRole('button', { name: /hired/i }));

    await vi.waitFor(() => expect(lastListRequest(requests).get('sort')).toBe('hireDate'));
  });

  it('shows the hire date of each person', async () => {
    stubApi(listStub([anEmployee({ hireDate: '2020-01-15' })]));
    renderPage(<EmployeesPage />);

    expect(await screen.findByText('15 Jan 2020')).toBeInTheDocument();
  });

  it('asks for the page size I choose', async () => {
    const requests = stubApi(listStub([anEmployee()], 300));
    renderPage(<EmployeesPage />);
    await screen.findByText('Asha Rao');

    await userEvent.click(screen.getByRole('combobox', { name: /rows per page/i }));
    await userEvent.click(await screen.findByRole('option', { name: '50' }));

    await vi.waitFor(() => expect(lastListRequest(requests).get('pageSize')).toBe('50'));
  });

  it('shows who has left, and does not show a dollar line for someone already paid in dollars', async () => {
    stubApi(
      listStub([
        anEmployee({ firstName: 'Gone', status: 'left', leftOn: '2025-01-01', currency: 'USD' }),
        anEmployee({
          firstName: 'Kenji',
          country: 'JP',
          currency: 'JPY',
          salaryMinor: 9_000_000,
          salaryUsdMinor: 60_300_00,
        }),
      ]),
    );
    renderPage(<EmployeesPage />);

    const gone = (await screen.findByText('Gone Rao')).closest('tr')!;
    expect(within(gone).getByText('Left')).toBeInTheDocument();
    expect(within(gone).queryByText(/about/)).not.toBeInTheDocument();
    const kenji = screen.getByText('Kenji Rao').closest('tr')!;
    expect(within(kenji).getByText('about $60,300')).toBeInTheDocument();
  });
});

describe('EmployeesPage: addresses that are wrong', () => {
  it('says the filters in the address are not valid, and a button clears them', async () => {
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': (url) =>
        url.searchParams.get('country') === 'XX'
          ? new Response(
              '{"error":"Invalid request","issues":[{"field":"country","message":"Invalid option"}]}',
              { status: 400 },
            )
          : pageOf([anEmployee()]),
    });
    renderPage(<EmployeesPage />, { route: '/?country=XX&search=ken' });

    expect(
      await screen.findByText('Some of the filters in the address are not valid.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear the filters' }));

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(lastListRequest(requests).toString()).toBe('');
  });

  it('says that a page past the last one is past the last one, with a way back, not that nothing matches', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': (url) => ({
        items: [],
        total: 40,
        page: Number(url.searchParams.get('page')),
        pageSize: 25,
      }),
    });
    renderPage(<EmployeesPage />, { route: '/?page=9' });

    expect(await screen.findByText('There is no page 9. The last page is 2.')).toBeInTheDocument();
    expect(screen.queryByText('No employees match these filters.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to the first page' })).toBeInTheDocument();
  });

  it('ignores a page number that is not a positive whole number', async () => {
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => pageOf([anEmployee()]),
    });
    renderPage(<EmployeesPage />, { route: '/?page=-4&pageSize=abc' });
    await screen.findByText('Asha Rao');

    const last = lastListRequest(requests);
    expect(last.get('page')).toBeNull();
    expect(last.get('pageSize')).toBeNull();
  });

  it('keeps the filters when I open an employee and come back', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => pageOf([anEmployee({ id: 7, firstName: 'Kenji' })]),
      'GET /api/employees/7': () => ({
        employee: anEmployee({ id: 7, firstName: 'Kenji' }),
        salaryHistory: [],
      }),
    });
    renderPage(<App />, { route: '/?country=IN&search=ken' });

    await userEvent.click(await screen.findByRole('link', { name: 'Kenji Rao' }));
    const back = await screen.findByRole('link', { name: 'Back to employees' });

    expect(back).toHaveAttribute('href', '/?country=IN&search=ken');
  });
});
