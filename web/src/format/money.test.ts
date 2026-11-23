import { describe, expect, it } from 'vitest';
import { formatMoney, formatUsd, parseMoney, percentChange } from './money.ts';

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

describe('parseMoney', () => {
  it('reads a typed amount into minor units', () => {
    expect(parseMoney('110000', 'USD')).toBe(110_000_00);
  });

  it('accepts thousands separators and surrounding spaces', () => {
    expect(parseMoney(' 110,000 ', 'USD')).toBe(110_000_00);
  });

  it('accepts cents', () => {
    expect(parseMoney('85000.50', 'USD')).toBe(85_000_50);
  });

  it('reads yen as they are', () => {
    expect(parseMoney('9500000', 'JPY')).toBe(9_500_000);
  });

  it.each(['', '   ', 'abc', '12abc', '-5', '0', '1e6', '1.2.3'])(
    'has no answer for %j',
    (text) => {
      expect(parseMoney(text, 'USD')).toBeNull();
    },
  );
});

describe('percentChange', () => {
  it('shows a rise with a plus sign', () => {
    expect(percentChange(100_000_00, 110_000_00)).toBe('+10.0%');
  });

  it('shows a cut with a minus sign', () => {
    expect(percentChange(100_000_00, 95_000_00)).toBe('-5.0%');
  });
});
