import type { EmployeeStatus } from './employee.ts';

/** What the rules need to know about the employee and the day. */
export interface SalaryChangeContext {
  status: EmployeeStatus;
  hireDate: string;
  currentSalaryMinor: number;
  /** The effective date of the most recent change. Every employee has at least the starting salary. */
  lastChangeDate: string;
  today: string;
}

export interface SalaryChangeRequest {
  newSalaryMinor: number;
  effectiveDate: string;
}

/**
 * Why a change is refused.
 * - `conflict`: the employee is in a state where no change is possible.
 * - `invalid`: this particular request breaks a rule.
 */
export interface SalaryChangeProblem {
  kind: 'conflict' | 'invalid';
  message: string;
}

/**
 * Decides whether a salary change is allowed. Returns null when it is, or the first problem found.
 * Dates are YYYY-MM-DD text, which compares correctly with < and >.
 */
export function checkSalaryChange(
  context: SalaryChangeContext,
  request: SalaryChangeRequest,
): SalaryChangeProblem | null {
  if (context.status === 'left') {
    return {
      kind: 'conflict',
      message: 'This employee has left. Their salary cannot be changed.',
    };
  }
  if (request.newSalaryMinor === context.currentSalaryMinor) {
    return invalid('The new salary is the same as the current salary.');
  }
  if (request.effectiveDate > context.today) {
    return invalid('The effective date cannot be in the future.');
  }
  if (request.effectiveDate < context.hireDate) {
    return invalid(`The effective date cannot be before the hire date (${context.hireDate}).`);
  }
  if (request.effectiveDate < context.lastChangeDate) {
    return invalid(
      `The effective date cannot be before the most recent change (${context.lastChangeDate}).`,
    );
  }
  return null;
}

function invalid(message: string): SalaryChangeProblem {
  return { kind: 'invalid', message };
}
