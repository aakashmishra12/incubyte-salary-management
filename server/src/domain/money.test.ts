import { describe, expect, it } from 'vitest';
import { toMinorUnits, toUsdMinor } from './money.ts';
import { COUNTRIES, CURRENCIES } from './reference.ts';

describe('toUsdMinor', () => {
  it('leaves a USD amount unchanged', () => {
    expect(toUsdMinor(12_345_67, 'USD')).toBe(12_345_67);
  });

  it('converts with the fixed rate for the currency', () => {
    // 100,000.00 GBP at 1.31 USD per pound is 131,000.00 USD.
    expect(toUsdMinor(100_000_00, 'GBP')).toBe(131_000_00);
  });

  it('converts a currency that has no smaller unit', () => {
    // 10,000,000 yen at 0.0067 USD per yen is 67,000.00 USD.
    expect(toUsdMinor(10_000_000, 'JPY')).toBe(67_000_00);
  });

  it('rounds to a whole cent', () => {
    // 0.01 INR is far less than a cent.
    expect(toUsdMinor(1, 'INR')).toBe(0);
    // 1.00 EUR at 1.16 is exactly 116 cents.
    expect(toUsdMinor(1_00, 'EUR')).toBe(116);
  });
});

describe('toUsdMinor at exact halves', () => {
  // Each of these is exactly half a cent over, so it must round up. With ordinary decimal
  // arithmetic they come out one cent low, for example 425.00 * 0.0118 = 5.015 is held as 5.01499.
  it.each([
    ['INR', 42_500, 502],
    ['INR', 137_500, 1_623],
    ['SGD', 4_350, 3_350],
    ['SGD', 9_950, 7_662],
  ] as const)('rounds %s %i up to %i cents', (currency, amountMinor, expected) => {
    expect(toUsdMinor(amountMinor, currency)).toBe(expected);
  });

  it('still converts a very large salary without losing a cent', () => {
    // 90 billion yen is far above any salary, and above the size where plain numbers stay exact.
    expect(toUsdMinor(90_000_000_000, 'JPY')).toBe(60_300_000_000_00);
  });

  it('gives zero for zero', () => {
    expect(toUsdMinor(0, 'GBP')).toBe(0);
  });
});

describe('toMinorUnits', () => {
  it('turns dollars into cents', () => {
    expect(toMinorUnits(85_000, 'USD')).toBe(85_000_00);
  });

  it('keeps yen as they are, because the yen has no smaller unit', () => {
    expect(toMinorUnits(9_000_000, 'JPY')).toBe(9_000_000);
  });

  it('does not suffer from floating point drift', () => {
    // 1.15 * 100 is 114.99999999999999 in JavaScript.
    expect(toMinorUnits(1.15, 'USD')).toBe(115);
  });
});

describe('reference data', () => {
  it('gives every country a currency that has a rate', () => {
    for (const country of Object.values(COUNTRIES)) {
      expect(CURRENCIES[country.currency]).toBeDefined();
    }
  });
});
