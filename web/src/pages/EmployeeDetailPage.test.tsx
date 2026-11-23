import { fireEvent, screen, within } from '@testing-library/react';
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
  renderPage(<App />, { route: '/employees/7' });
  return requests;
}

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

  it('does not offer a salary change for someone who has left', async () => {
    openEmployee({
      'GET /api/employees/7': () => kenji({ status: 'left', leftOn: '2025-06-30' }),
    });

    await screen.findByRole('heading', { name: 'Kenji Sato' });
    expect(screen.queryByRole('button', { name: 'Change salary' })).not.toBeInTheDocument();
    expect(screen.getByText(/Left on 30 Jun 2025/)).toBeInTheDocument();
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
