import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail } from '../api/types.ts';
import { App } from '../App.tsx';
import { anEmployee, reference } from '../testing/fixtures.ts';
import { renderPage, stubApi } from '../testing/render.tsx';

/** Kenji Sato, id 7, on 100,000 USD since a promotion in 2024. */
function kenji(overrides: Partial<EmployeeDetail['employee']> = {}): EmployeeDetail {
  return {
    employee: anEmployee({
      id: 7,
      employeeCode: 'E00007',
      firstName: 'Kenji',
      lastName: 'Sato',
      email: 'kenji.sato@acme.example',
      hireDate: '2020-01-15',
      salaryMinor: 100_000_00,
      salaryUsdMinor: 100_000_00,
      ...overrides,
    }),
    salaryHistory: [
      {
        id: 2,
        previousMinor: 80_000_00,
        newMinor: 100_000_00,
        currency: 'USD',
        effectiveDate: '2024-04-01',
        reason: 'Promotion',
      },
      {
        id: 1,
        previousMinor: null,
        newMinor: 80_000_00,
        currency: 'USD',
        effectiveDate: '2020-01-15',
        reason: 'Starting salary',
      },
    ],
  };
}

function openEmployee(handlers: Parameters<typeof stubApi>[0] = {}) {
  const requests = stubApi({
    'GET /api/reference': () => reference,
    'GET /api/employees/7': () => kenji(),
    ...handlers,
  });
  ({ queryClient } = renderPage(<App />, { route: '/employees/7' }));
  return requests;
}

/** The cache of the page just opened, so a test can make it fetch again. */
let queryClient: ReturnType<typeof renderPage>['queryClient'];

async function fillInChange({
  salary,
  date,
  reason,
}: {
  salary: string;
  date: string;
  reason: string;
}) {
  await userEvent.click(await screen.findByRole('button', { name: 'Change salary' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText(/New salary/), salary);
  // A date field is set directly: typing into one behaves differently in each browser.
  fireEvent.change(within(dialog).getByLabelText('Effective date'), { target: { value: date } });
  await userEvent.type(within(dialog).getByLabelText('Reason'), reason);
  return dialog;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('EmployeeDetailPage', () => {
  it('shows who the employee is and what they are paid', async () => {
    openEmployee();

    expect(await screen.findByRole('heading', { name: 'Kenji Sato' })).toBeInTheDocument();
    // The hire date also appears in the salary history, so look inside the details only.
    const details = within(screen.getByLabelText('Employee details'));
    expect(details.getByText('E00007')).toBeInTheDocument();
    expect(details.getByText('kenji.sato@acme.example')).toBeInTheDocument();
    expect(details.getByText('15 Jan 2020')).toBeInTheDocument();
    expect(screen.getByTestId('current-salary')).toHaveTextContent('$100,000');
  });

  it('shows the approximate USD amount for a salary in another currency', async () => {
    openEmployee({
      'GET /api/employees/7': () =>
        kenji({
          country: 'JP',
          currency: 'JPY',
          salaryMinor: 9_000_000,
          salaryUsdMinor: 60_300_00,
        }),
    });

    expect(await screen.findByTestId('current-salary')).toHaveTextContent('¥9,000,000');
    expect(screen.getByText(/about \$60,300/)).toBeInTheDocument();
  });

  it('shows the salary history, newest first, with the size of each change', async () => {
    openEmployee();

    const history = await screen.findByRole('table', { name: 'Salary history' });
    const rows = within(history).getAllByRole('row').slice(1);

    expect(rows[0]).toHaveTextContent('1 Apr 2024');
    expect(rows[0]).toHaveTextContent('$80,000');
    expect(rows[0]).toHaveTextContent('$100,000');
    expect(rows[0]).toHaveTextContent('+25.0%');
    expect(rows[0]).toHaveTextContent('Promotion');
    expect(rows[1]).toHaveTextContent('Starting salary');
  });

  it('says so when the employee does not exist', async () => {
    openEmployee({
      'GET /api/employees/7': () => new Response('{"error":"Employee not found"}', { status: 404 }),
    });

    expect(await screen.findByText('Employee not found')).toBeInTheDocument();
  });

  it('offers nothing to change for someone who has left, and says they have left', async () => {
    openEmployee({
      'GET /api/employees/7': () => kenji({ status: 'left', leftOn: '2025-06-30' }),
    });

    await screen.findByRole('heading', { name: 'Kenji Sato' });
    for (const name of ['Change salary', 'Edit details', 'Mark as left']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByText(/Left on 30 Jun 2025/)).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
  });

  it('shows no percentage for the starting salary, and no dollar line for a salary already in dollars', async () => {
    openEmployee();

    const history = await screen.findByRole('table', { name: 'Salary history' });
    const starting = within(history).getAllByRole('row')[2]!;

    expect(within(starting).getAllByRole('cell')[1]).toHaveTextContent('');
    expect(within(starting).getAllByRole('cell')[3]).toHaveTextContent('');
    expect(screen.queryByText(/at fixed rates/)).not.toBeInTheDocument();
  });

  it('keeps showing the employee when a later refresh fails, and says the data may be out of date', async () => {
    let failing = false;
    const requests = openEmployee({
      'GET /api/employees/7': () => (failing ? new Response('{}', { status: 500 }) : kenji()),
    });
    await screen.findByRole('heading', { name: 'Kenji Sato' });
    expect(requests.length).toBeGreaterThan(0);

    failing = true;
    await act(() => queryClient.invalidateQueries({ queryKey: ['employee', 7] }));

    // The failed fetch is reported a moment after the cache is told to refresh.
    expect(
      await screen.findByText(
        'The latest data could not be loaded. What is shown may be out of date.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kenji Sato' })).toBeInTheDocument();
  });

  it('does not close a dialog I am typing in when a refresh fails', async () => {
    let failing = false;
    openEmployee({
      'GET /api/employees/7': () => (failing ? new Response('{}', { status: 500 }) : kenji()),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Change salary' }));
    await userEvent.type(await screen.findByLabelText(/New salary/), '110000');

    failing = true;
    await act(() => queryClient.invalidateQueries({ queryKey: ['employee', 7] }));
    await screen.findByText(
      'The latest data could not be loaded. What is shown may be out of date.',
    );

    expect(screen.getByLabelText(/New salary/)).toHaveValue('110000');
  });
});

describe('changing a salary', () => {
  it('shows the size of the change before I save', async () => {
    openEmployee();

    const dialog = await fillInChange({
      salary: '110,000',
      date: '2026-11-01',
      reason: 'Annual review',
    });

    expect(within(dialog).getByText(/\$100,000 to \$110,000/)).toBeInTheDocument();
    expect(within(dialog).getByText(/\+10\.0%/)).toBeInTheDocument();
  });

  it('cannot be saved until the amount and the reason are filled in', async () => {
    openEmployee();

    await userEvent.click(await screen.findByRole('button', { name: 'Change salary' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('sends the change in minor units and then shows the new salary', async () => {
    const updated = kenji({ salaryMinor: 110_000_00, salaryUsdMinor: 110_000_00 });
    updated.salaryHistory.unshift({
      id: 3,
      previousMinor: 100_000_00,
      newMinor: 110_000_00,
      currency: 'USD',
      effectiveDate: '2026-11-01',
      reason: 'Annual review',
    });
    const requests = openEmployee({ 'POST /api/employees/7/salary-changes': () => updated });

    const dialog = await fillInChange({
      salary: '110000',
      date: '2026-11-01',
      reason: 'Annual review',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      newSalaryMinor: 110_000_00,
      effectiveDate: '2026-11-01',
      reason: 'Annual review',
    });
    expect(screen.getByTestId('current-salary')).toHaveTextContent('$110,000');
    expect(screen.getByText('Annual review')).toBeInTheDocument();
  });

  it('sends the change once, however many times Save is pressed while it is being saved', async () => {
    const updated = kenji({ salaryMinor: 110_000_00, salaryUsdMinor: 110_000_00 });
    let release: (value: Response) => void = () => {};
    const requests = openEmployee({
      'POST /api/employees/7/salary-changes': () =>
        new Promise<Response>((resolve) => (release = resolve)) as unknown as Response,
    });
    const dialog = await fillInChange({
      salary: '110000',
      date: '2026-11-01',
      reason: 'Annual review',
    });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
    // A fast second click and the Enter key both arrive while the first save is still running.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    fireEvent.submit(within(dialog).getByLabelText('Reason').closest('form')!);
    release(Response.json(updated));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
  });

  it('marks the lists and insights as out of date after a change, so they show the new salary when next opened', async () => {
    openEmployee({
      'POST /api/employees/7/salary-changes': () =>
        kenji({ salaryMinor: 110_000_00, salaryUsdMinor: 110_000_00 }),
    });
    queryClient.setQueryData(['employees', 'country=IN'], {
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    });
    queryClient.setQueryData(['insights', 'overview'], { headcount: 1 });
    const dialog = await fillInChange({
      salary: '110000',
      date: '2026-11-01',
      reason: 'Annual review',
    });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(queryClient.getQueryState(['employees', 'country=IN'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['insights', 'overview'])?.isInvalidated).toBe(true);
  });

  it('shows the reason and keeps what I typed when the server refuses the change', async () => {
    openEmployee({
      'POST /api/employees/7/salary-changes': () =>
        new Response('{"error":"The effective date cannot be in the future."}', { status: 422 }),
    });

    const dialog = await fillInChange({
      salary: '110000',
      date: '2026-11-01',
      reason: 'Annual review',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog).findByText('The effective date cannot be in the future.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/New salary/)).toHaveValue('110000');
    expect(within(dialog).getByLabelText('Reason')).toHaveValue('Annual review');
  });
});

describe('from the employee list', () => {
  it('opens an employee when I click their name', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => ({ items: [kenji().employee], total: 1, page: 1, pageSize: 25 }),
      'GET /api/employees/7': () => kenji(),
    });
    renderPage(<App />);

    await userEvent.click(await screen.findByRole('link', { name: 'Kenji Sato' }));

    expect(await screen.findByRole('heading', { name: 'Kenji Sato' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Salary history' })).toBeInTheDocument();
  });
});
