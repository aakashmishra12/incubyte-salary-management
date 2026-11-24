import { describe, expect, it } from 'vitest';
import { HttpError } from '../http/errors.ts';
import { aDatabaseWith, anEmployee, TEST_NOW } from '../testing/builders.ts';
import { createEmployeeService } from './employeeService.ts';

const clock = () => new Date(TEST_NOW);

describe('employeeService.changeSalary', () => {
  it('saves the new salary and its history row together, or neither', () => {
    const { db, repository, ids } = aDatabaseWith([
      anEmployee({ salaryMinor: 100_000_00, hireDate: '2020-01-15' }),
    ]);
    // The history write fails, as it would if the disk filled up at that moment.
    const failing = {
      ...repository,
      insertSalaryChange: () => {
        throw new Error('the disk is full');
      },
    };
    const service = createEmployeeService(failing, clock);

    expect(() =>
      service.changeSalary(ids[0]!, {
        newSalaryMinor: 110_000_00,
        effectiveDate: '2026-11-01',
        reason: 'Annual review',
      }),
    ).toThrow('the disk is full');

    // The new salary was written first, and must have been taken back.
    expect(db.prepare('SELECT salary_minor, salary_usd_minor FROM employees').get()).toEqual({
      salary_minor: 100_000_00,
      salary_usd_minor: 100_000_00,
    });
  });

  it('uses the date of the most recent change, not the hire date, as the earliest allowed date', () => {
    const { repository, ids } = aDatabaseWith([
      anEmployee({ salaryMinor: 100_000_00, hireDate: '2020-01-15' }),
    ]);
    repository.insertSalaryChange(
      {
        employeeId: ids[0]!,
        previousMinor: null,
        newMinor: 100_000_00,
        currency: 'USD',
        effectiveDate: '2026-06-01',
        reason: 'Promotion',
      },
      TEST_NOW,
    );
    const service = createEmployeeService(repository, clock);

    const attempt = () =>
      service.changeSalary(ids[0]!, {
        newSalaryMinor: 110_000_00,
        effectiveDate: '2026-05-31',
        reason: 'Backdated',
      });

    expect(attempt).toThrow(HttpError);
    expect(attempt).toThrow('before the most recent change (2026-06-01)');
  });
});
