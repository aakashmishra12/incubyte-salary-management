import { describe, expect, it } from 'vitest';
import { aDatabaseWith, anEmployee } from '../testing/builders.ts';
import type { EmployeeListQuery } from './employeeRepository.ts';

/** The defaults the API applies. Each test changes only what it is about. */
function query(overrides: Partial<EmployeeListQuery> = {}): EmployeeListQuery {
  return { page: 1, pageSize: 25, sort: 'name', order: 'asc', ...overrides };
}

describe('employeeRepository.list', () => {
  it('returns employees with every field the list shows', () => {
    const { repository, ids } = aDatabaseWith([
      anEmployee({
        employeeCode: 'E00042',
        firstName: 'Kenji',
        lastName: 'Sato',
        email: 'kenji.sato@acme.example',
        country: 'JP',
        currency: 'JPY',
        salaryMinor: 9_000_000,
      }),
    ]);

    const { items } = repository.list(query());

    expect(items).toEqual([
      {
        id: ids[0],
        employeeCode: 'E00042',
        firstName: 'Kenji',
        lastName: 'Sato',
        email: 'kenji.sato@acme.example',
        country: 'JP',
        department: 'Engineering',
        level: 'L3',
        jobTitle: 'Senior Software Engineer',
        hireDate: '2020-01-15',
        status: 'active',
        leftOn: null,
        currency: 'JPY',
        salaryMinor: 9_000_000,
        salaryUsdMinor: 60_300_00,
      },
    ]);
  });

  it('sorts by last name, then first name', () => {
    const { repository } = aDatabaseWith([
      anEmployee({ firstName: 'Zoe', lastName: 'Adams' }),
      anEmployee({ firstName: 'Ben', lastName: 'Young' }),
      anEmployee({ firstName: 'Ava', lastName: 'Adams' }),
    ]);

    const names = repository.list(query()).items.map((e) => `${e.firstName} ${e.lastName}`);

    expect(names).toEqual(['Ava Adams', 'Zoe Adams', 'Ben Young']);
  });

  it('returns one page and the total number of matches', () => {
    const { repository } = aDatabaseWith(
      ['A', 'B', 'C', 'D', 'E'].map((lastName) => anEmployee({ lastName })),
    );

    const result = repository.list(query({ page: 2, pageSize: 2 }));

    expect(result.items.map((e) => e.lastName)).toEqual(['C', 'D']);
    expect(result.total).toBe(5);
  });

  it('returns an empty page with the right total when the page is past the end', () => {
    const { repository } = aDatabaseWith([anEmployee(), anEmployee()]);

    const result = repository.list(query({ page: 9 }));

    expect(result).toEqual({ items: [], total: 2 });
  });

  it('filters by country, department, level and status', () => {
    const { repository } = aDatabaseWith([
      anEmployee({ lastName: 'Match', country: 'IN', department: 'Sales', level: 'L2' }),
      anEmployee({ lastName: 'OtherCountry', country: 'US', department: 'Sales', level: 'L2' }),
      anEmployee({ lastName: 'OtherDepartment', country: 'IN', department: 'Design', level: 'L2' }),
      anEmployee({ lastName: 'OtherLevel', country: 'IN', department: 'Sales', level: 'L5' }),
      anEmployee({
        lastName: 'Left',
        country: 'IN',
        department: 'Sales',
        level: 'L2',
        status: 'left',
        leftOn: '2025-01-01',
      }),
    ]);

    const result = repository.list(
      query({ country: 'IN', department: 'Sales', level: 'L2', status: 'active' }),
    );

    expect(result.items.map((e) => e.lastName)).toEqual(['Match']);
    expect(result.total).toBe(1);
  });

  it.each([
    ['part of a first name', 'ken'],
    ['part of a last name', 'SAT'],
    ['a full name', 'kenji sato'],
    ['part of an email', 'kenji.sato@'],
    ['an employee code', 'e00042'],
  ])('finds an employee by %s, ignoring case', (_description, search) => {
    const { repository } = aDatabaseWith([
      anEmployee({
        employeeCode: 'E00042',
        firstName: 'Kenji',
        lastName: 'Sato',
        email: 'kenji.sato@acme.example',
      }),
      anEmployee({ firstName: 'Maria', lastName: 'Lopez', email: 'maria.lopez@acme.example' }),
    ]);

    const result = repository.list(query({ search }));

    expect(result.items.map((e) => e.lastName)).toEqual(['Sato']);
  });

  it('treats % and _ in a search as plain text, not as wildcards', () => {
    const { repository } = aDatabaseWith([anEmployee(), anEmployee()]);

    expect(repository.list(query({ search: '%' })).total).toBe(0);
    expect(repository.list(query({ search: '_' })).total).toBe(0);
  });

  it('combines a search with a filter', () => {
    const { repository } = aDatabaseWith([
      anEmployee({ lastName: 'Rao', country: 'IN' }),
      anEmployee({ lastName: 'Rao', country: 'US' }),
    ]);

    const result = repository.list(query({ search: 'rao', country: 'IN' }));

    expect(result.items.map((e) => e.country)).toEqual(['IN']);
  });

  it('sorts by salary using the USD equivalent, not the raw number', () => {
    const { repository } = aDatabaseWith([
      // 9,000,000 yen is about 60,300 dollars: a bigger number, a smaller salary.
      anEmployee({ lastName: 'Yen', country: 'JP', currency: 'JPY', salaryMinor: 9_000_000 }),
      anEmployee({ lastName: 'Dollar', country: 'US', currency: 'USD', salaryMinor: 90_000_00 }),
    ]);

    const highestFirst = repository.list(query({ sort: 'salary', order: 'desc' }));

    expect(highestFirst.items.map((e) => e.lastName)).toEqual(['Dollar', 'Yen']);
  });

  it('sorts in descending order when asked', () => {
    const { repository } = aDatabaseWith([
      anEmployee({ lastName: 'A', hireDate: '2019-05-01' }),
      anEmployee({ lastName: 'B', hireDate: '2023-05-01' }),
    ]);

    const newestFirst = repository.list(query({ sort: 'hireDate', order: 'desc' }));

    expect(newestFirst.items.map((e) => e.lastName)).toEqual(['B', 'A']);
  });
});

describe('employeeRepository.dataVersion', () => {
  it('stays the same while data is only read', () => {
    const { repository } = aDatabaseWith([anEmployee()]);
    const before = repository.dataVersion();

    repository.list(query());
    repository.activePayRows();

    expect(repository.dataVersion()).toBe(before);
  });

  it.each([
    [
      'an employee is added',
      (r: ReturnType<typeof aDatabaseWith>['repository']) =>
        r.insert(anEmployee(), '2026-11-20T09:00:00.000Z'),
    ],
    [
      'a salary changes',
      (r: ReturnType<typeof aDatabaseWith>['repository'], id: number) =>
        r.updateSalary(id, 1_00, 'USD', '2026-11-20T09:00:00.000Z'),
    ],
    [
      'details are edited',
      (r: ReturnType<typeof aDatabaseWith>['repository'], id: number) =>
        r.updateDetails(id, { level: 'L5' }, '2026-11-20T09:00:00.000Z'),
    ],
    [
      'someone is marked as left',
      (r: ReturnType<typeof aDatabaseWith>['repository'], id: number) =>
        r.markLeft(id, '2026-11-01', '2026-11-20T09:00:00.000Z'),
    ],
  ])('changes when %s', (_what, change) => {
    const { repository, ids } = aDatabaseWith([anEmployee()]);
    const before = repository.dataVersion();

    change(repository, ids[0]!);

    expect(repository.dataVersion()).not.toBe(before);
  });
});
