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

describe('parseMoney: amounts that look right but are not', () => {
  it.each([
    '1,5',
    '1,50',
    '85,000,5',
    '12,34,567',
    '1,2345',
    ',500',
    '1,,000',
    '85.000,50',
    '.5',
    '5.',
  ])(
    'refuses %j, because a comma that is not grouping thousands could be a decimal comma',
    (text) => {
      expect(parseMoney(text, 'USD')).toBeNull();
    },
  );

  it('accepts thousands grouped in threes, with or without a decimal part', () => {
    expect(parseMoney('1,234,567', 'USD')).toBe(1_234_567_00);
    expect(parseMoney('1,234.50', 'USD')).toBe(1_234_50);
  });

  it('refuses more decimals than the currency has: no fractions of a yen, no third decimal for dollars', () => {
    expect(parseMoney('9500000.5', 'JPY')).toBeNull();
    expect(parseMoney('9500000.0', 'JPY')).toBeNull();
    expect(parseMoney('85000.505', 'USD')).toBeNull();
    expect(parseMoney('85000.5', 'USD')).toBe(85_000_50);
  });

  it('refuses an amount above what the server would accept, so the person is told before they save', () => {
    expect(parseMoney('10,000,000,000', 'USD')).toBe(1_000_000_000_000);
    expect(parseMoney('10,000,000,001', 'USD')).toBeNull();
  });
});

describe('percentChange', () => {
  it('shows a rise with a plus sign', () => {
    expect(percentChange(100_000_00, 110_000_00)).toBe('+10.0%');
  });

  it('shows a cut with a minus sign', () => {
    expect(percentChange(100_000_00, 95_000_00)).toBe('-5.0%');
  });
});
