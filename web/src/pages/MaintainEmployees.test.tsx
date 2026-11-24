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
  await userEvent.click(screen.getByLabelText(new RegExp(`^${label}`)));
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

async function fillInNewEmployee() {
  await userEvent.type(await screen.findByLabelText(/^First name/), 'Mei');
  await userEvent.type(screen.getByLabelText(/^Last name/), 'Tanaka');
  await userEvent.type(screen.getByLabelText(/^Email/), 'mei.tanaka@acme.example');
  await choose('Country', 'Japan');
  await choose('Department', 'Engineering');
  await choose('Level', 'L2');
  await userEvent.type(screen.getByLabelText(/^Job title/), 'Software Engineer');
  fireEvent.change(screen.getByLabelText(/^Hire date/), { target: { value: '2026-11-03' } });
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

    await screen.findByLabelText(/^Country/);
    await choose('Country', 'Japan');

    expect(screen.getByLabelText(/^Starting salary \(JPY\)/)).toBeInTheDocument();
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

  it('sends a new employee once, however many times the button is pressed', async () => {
    let release: (value: Response) => void = () => {};
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'POST /api/employees': () =>
        new Promise<Response>((resolve) => (release = resolve)) as unknown as Response,
      'GET /api/employees/7': () => detailOf({ id: 7, firstName: 'Mei', lastName: 'Tanaka' }),
    });
    renderPage(<App />, { route: '/employees/new' });
    await fillInNewEmployee();

    await userEvent.click(screen.getByRole('button', { name: 'Add employee' }));
    expect(screen.getByRole('button', { name: 'Add employee' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Add employee' }));
    fireEvent.submit(screen.getByLabelText(/^First name/).closest('form')!);
    release(
      new Response(JSON.stringify(detailOf({ id: 7, firstName: 'Mei', lastName: 'Tanaka' })), {
        status: 201,
      }),
    );

    await screen.findByRole('heading', { name: 'Mei Tanaka' });
    expect(requests.filter((request) => request.method === 'POST')).toHaveLength(1);
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
    expect(screen.getByLabelText(/^First name/)).toHaveValue('Mei');
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

  it('stops saying a field is required as soon as I start filling it in', async () => {
    stubApi({ 'GET /api/reference': () => reference });
    renderPage(<App />, { route: '/employees/new' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add employee' }));
    const requiredBefore = screen.getAllByText('Required').length;

    await userEvent.type(screen.getByLabelText(/^First name/), 'M');

    // Only the field I touched is cleared. The others still need filling in.
    expect(screen.getAllByText('Required')).toHaveLength(requiredBefore - 1);
  });

  it('marks every required field as required, so a screen reader says so before anything goes wrong', async () => {
    stubApi({ 'GET /api/reference': () => reference });
    renderPage(<App />, { route: '/employees/new' });

    for (const label of ['First name', 'Last name', 'Email', 'Job title', 'Hire date']) {
      expect(await screen.findByLabelText(new RegExp(`^${label}`))).toBeRequired();
    }
  });

  it('moves keyboard focus to the first field that needs attention after a failed send', async () => {
    stubApi({ 'GET /api/reference': () => reference });
    renderPage(<App />, { route: '/employees/new' });
    await userEvent.type(await screen.findByLabelText(/^First name/), 'Mei');

    await userEvent.click(screen.getByRole('button', { name: 'Add employee' }));

    // First name is filled in, so the first problem is the last name.
    expect(screen.getByLabelText(/^Last name/)).toHaveFocus();
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

describe('pressing Enter while a save is already running', () => {
  it('does not edit the employee twice', async () => {
    let release: (value: Response) => void = () => {};
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees/7': () => detailOf({ level: 'L2' }),
      'PATCH /api/employees/7': () =>
        new Promise<Response>((resolve) => (release = resolve)) as unknown as Response,
    });
    renderPage(<App />, { route: '/employees/7' });
    await userEvent.click(await screen.findByRole('button', { name: 'Edit details' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('Job title'));
    await userEvent.type(within(dialog).getByLabelText('Job title'), 'Staff Engineer');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    fireEvent.submit(within(dialog).getByLabelText('Job title').closest('form')!);
    release(Response.json(detailOf({ level: 'L2', jobTitle: 'Staff Engineer' })));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests.filter((request) => request.method === 'PATCH')).toHaveLength(1);
  });

  it('does not mark the employee as left twice', async () => {
    let release: (value: Response) => void = () => {};
    const requests = stubApi({
      'GET /api/reference': () => reference,
      'GET /api/employees/7': () => detailOf(),
      'POST /api/employees/7/leave': () =>
        new Promise<Response>((resolve) => (release = resolve)) as unknown as Response,
    });
    renderPage(<App />, { route: '/employees/7' });
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as left' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Leaving date'), {
      target: { value: '2026-11-15' },
    });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as left' }));
    fireEvent.submit(within(dialog).getByLabelText('Leaving date').closest('form')!);
    release(Response.json(detailOf({ status: 'left', leftOn: '2026-11-15' })));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(requests.filter((request) => request.url.pathname.endsWith('/leave'))).toHaveLength(1);
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
    // The buttons that were pressed have gone, so focus goes to the page heading and is not lost.
    expect(screen.getByRole('heading', { name: 'Kenji Sato' })).toHaveFocus();
    expect(requests.find((request) => request.url.pathname.endsWith('/leave'))?.body).toEqual({
      leftOn: '2026-11-15',
    });
  });
});
