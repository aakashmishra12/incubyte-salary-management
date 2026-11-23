import { describe, expect, it } from 'vitest';
import { formatMoney, formatUsd } from './money.ts';

describe('formatMoney', () => {
  it('shows US cents as dollars', () => {
    expect(formatMoney(85_000_00, 'USD')).toBe('$85,000');
  });

  it('shows yen as they are, because the yen has no smaller unit', () => {
    expect(formatMoney(9_000_000, 'JPY')).toBe('¥9,000,000');
  });

  it('shows other currencies with their own symbol', () => {
    expect(formatMoney(6_110_000_00, 'INR')).toBe('₹6,110,000');
    expect(formatMoney(72_500_00, 'GBP')).toBe('£72,500');
    expect(formatMoney(68_000_00, 'EUR')).toBe('€68,000');
  });

  it('rounds to a whole unit, which is enough for annual salaries', () => {
    expect(formatMoney(85_000_49, 'USD')).toBe('$85,000');
    expect(formatMoney(85_000_50, 'USD')).toBe('$85,001');
  });
});

describe('formatUsd', () => {
  it('shows large totals in full', () => {
    expect(formatUsd(651_024_049_00)).toBe('$651,024,049');
  });
});
