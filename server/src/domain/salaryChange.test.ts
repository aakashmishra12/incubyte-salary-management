import { describe, expect, it } from 'vitest';
import { checkSalaryChange, type SalaryChangeContext } from './salaryChange.ts';

/** An active employee hired in 2020 on 100,000.00, last changed in January 2025. Today is 20 Nov 2026. */
function context(overrides: Partial<SalaryChangeContext> = {}): SalaryChangeContext {
  return {
    status: 'active',
    hireDate: '2020-01-15',
    currentSalaryMinor: 100_000_00,
    lastChangeDate: '2025-01-01',
    today: '2026-11-20',
    ...overrides,
  };
}

const validRequest = { newSalaryMinor: 110_000_00, effectiveDate: '2026-11-01' };

describe('checkSalaryChange', () => {
  it('accepts a different amount on a sensible date', () => {
    expect(checkSalaryChange(context(), validRequest)).toBeNull();
  });

  it('accepts a decrease, because pay cuts and corrections happen', () => {
    expect(checkSalaryChange(context(), { ...validRequest, newSalaryMinor: 90_000_00 })).toBeNull();
  });

  it('accepts a change dated today', () => {
    expect(
      checkSalaryChange(context(), { ...validRequest, effectiveDate: '2026-11-20' }),
    ).toBeNull();
  });

  it('accepts a change on the same day as the previous one', () => {
    expect(checkSalaryChange(context({ lastChangeDate: '2026-11-01' }), validRequest)).toBeNull();
  });

  it('refuses a change for someone who has left', () => {
    expect(checkSalaryChange(context({ status: 'left' }), validRequest)).toEqual({
      kind: 'conflict',
      message: 'This employee has left. Their salary cannot be changed.',
    });
  });

  it('refuses an amount equal to the current salary', () => {
    expect(checkSalaryChange(context(), { ...validRequest, newSalaryMinor: 100_000_00 })).toEqual({
      kind: 'invalid',
      message: 'The new salary is the same as the current salary.',
    });
  });

  it('refuses a date in the future', () => {
    expect(checkSalaryChange(context(), { ...validRequest, effectiveDate: '2026-11-21' })).toEqual({
      kind: 'invalid',
      message: 'The effective date cannot be in the future.',
    });
  });

  it('refuses a date before the hire date', () => {
    expect(
      checkSalaryChange(context({ lastChangeDate: '2020-01-15' }), {
        ...validRequest,
        effectiveDate: '2020-01-14',
      }),
    ).toEqual({
      kind: 'invalid',
      message: 'The effective date cannot be before the hire date (2020-01-15).',
    });
  });

  it('refuses a date before the most recent change', () => {
    expect(checkSalaryChange(context(), { ...validRequest, effectiveDate: '2024-12-31' })).toEqual({
      kind: 'invalid',
      message: 'The effective date cannot be before the most recent change (2025-01-01).',
    });
  });
});
