import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail } from '../api/types.ts';
import { App } from '../App.tsx';
import { anEmployee, reference } from '../testing/fixtures.ts';
import { renderPage, stubApi } from '../testing/render.tsx';

function detailOf(overrides: Partial<EmployeeDetail['employee']> = {}): EmployeeDetail {
  return {
    employee: anEmployee({ id: 7, firstName: 'Kenji', lastName: 'Sato', ...overrides }),
    salaryHistory: [],
  };
}

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByLabelText(label));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

async function fillInNewEmployee() {
  await userEvent.type(await screen.findByLabelText('First name'), 'Mei');
  await userEvent.type(screen.getByLabelText('Last name'), 'Tanaka');
  await userEvent.type(screen.getByLabelText('Email'), 'mei.tanaka@acme.example');
  await choose('Country', 'Japan');
  await choose('Department', 'Engineering');
  await choose('Level', 'L2');
  await userEvent.type(screen.getByLabelText('Job title'), 'Software Engineer');
  fireEvent.change(screen.getByLabelText('Hire date'), { target: { value: '2026-11-03' } });
  await userEvent.type(screen.getByLabelText(/Starting salary/), '7,000,000');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('adding an employee', () => {
  it('is reachable from the employee list', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees': () => ({ items: [], total: 0, page: 1, pageSize: 25 }),
    });
    renderPage(<App />);

    await userEvent.click(await screen.findByRole('link', { name: 'Add employee' }));

    expect(await screen.findByRole('heading', { name: 'Add employee' })).toBeInTheDocument();
  });

  it('asks for the salary in the currency of the chosen country', async () => {
    stubApi({ 'GET /api/reference': () => reference });
    renderPage(<App />, { route: '/employees/new' });

    await screen.findByLabelText('Country');
    await choose('Country', 'Japan');

    expect(screen.getByLabelText('Starting salary (JPY)')).toBeInTheDocument();
  });

  it('sends the new employee and then opens their page', async () => {
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'POST /api/employees': () =>
        new Response(JSON.stringify(detailOf({ id: 7, firstName: 'Mei', lastName: 'Tanaka' })), {
          status: 201,
        }),
      'GET /api/employees/7': () => detailOf({ id: 7, firstName: 'Mei', lastName: 'Tanaka' }),
    });
    renderPage(<App />, { route: '/employees/new' });

    await fillInNewEmployee();
    await userEvent.click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByRole('heading', { name: 'Mei Tanaka' })).toBeInTheDocument();
    expect(requests.find((request) => request.method === 'POST')?.body).toEqual({
      firstName: 'Mei',
      lastName: 'Tanaka',
      email: 'mei.tanaka@acme.example',
      country: 'JP',
      department: 'Engineering',
      level: 'L2',
      jobTitle: 'Software Engineer',
      hireDate: '2026-11-03',
      salaryMinor: 7_000_000,
    });
  });

  it('shows which field the server refused and keeps what I typed', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'POST /api/employees': () =>
        new Response(
          JSON.stringify({
            error: 'Invalid request',
            issues: [{ field: 'email', message: 'Invalid email address' }],
          }),
          { status: 400 },
        ),
    });
    renderPage(<App />, { route: '/employees/new' });

    await fillInNewEmployee();
    await userEvent.click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByText('Invalid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('First name')).toHaveValue('Mei');
  });

  it('shows the reason when the server refuses the employee as a whole', async () => {
    stubApi({
      'GET /api/reference': () => reference,
      'POST /api/employees': () =>
        new Response('{"error":"Another employee already has this email."}', { status: 409 }),
    });
    renderPage(<App />, { route: '/employees/new' });

    await fillInNewEmployee();
    await userEvent.click(screen.getByRole('button', { name: 'Add employee' }));

    expect(await screen.findByText('Another employee already has this email.')).toBeInTheDocument();
  });

  it('points out an empty required field without calling the server', async () => {
    const requests = stubApi({ 'GET /api/reference': () => reference });
    renderPage(<App />, { route: '/employees/new' });

    await userEvent.click(await screen.findByRole('button', { name: 'Add employee' }));

    expect(screen.getAllByText('Required').length).toBeGreaterThan(0);
    expect(requests.some((request) => request.method === 'POST')).toBe(false);
  });
});

describe('editing an employee', () => {
  it('starts from the current details and sends only what I changed', async () => {
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees/7': () => detailOf({ level: 'L2', jobTitle: 'Software Engineer' }),
      'PATCH /api/employees/7': () => detailOf({ level: 'L3', jobTitle: 'Software Engineer' }),
    });
    renderPage(<App />, { route: '/employees/7' });

    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('First name')).toHaveValue('Kenji');
    await userEvent.click(within(dialog).getByLabelText('Level'));
    await userEvent.click(await screen.findByRole('option', { name: 'L3' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({ level: 'L3' });
  });
});

describe('marking an employee as left', () => {
  it('sends the leaving date and then shows them as left', async () => {
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees/7': () => detailOf(),
      'POST /api/employees/7/leave': () => detailOf({ status: 'left', leftOn: '2026-11-15' }),
    });
    renderPage(<App />, { route: '/employees/7' });

    await userEvent.click(await screen.findByRole('button', { name: 'Mark as left' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Leaving date'), {
      target: { value: '2026-11-15' },
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as left' }));

    expect(await screen.findByText(/Left on 15 Nov 2026/)).toBeInTheDocument();
    expect(requests.find((request) => request.url.pathname.endsWith('/leave'))?.body).toEqual({
      leftOn: '2026-11-15',
    });
  });
});
