import { CURRENCIES, type CurrencyCode } from './reference.ts';

/**
 * Money is always a whole number of minor units (cents for USD, yen for JPY).
 * Decimals are never stored, because 0.1 + 0.2 is not exactly 0.3 in JavaScript.
 */

/** Turns an amount in major units (85000 dollars) into minor units (8500000 cents). */
export function toMinorUnits(major: number, currency: CurrencyCode): number {
  return Math.round(major * 10 ** CURRENCIES[currency].minorUnits);
}

/**
 * Converts an amount in minor units of any currency to US cents, using the fixed rate.
 * Whole-number arithmetic (BigInt) is used on purpose: with ordinary decimals, 425.00 rupees at
 * 0.0118 is 5.01499... and rounds to 501 cents, when the exact answer is 5.015, which is 502.
 * Rates have at most six decimal places, so they become whole "micro" rates without any error.
 * Exact halves round up.
 */
export function toUsdMinor(amountMinor: number, currency: CurrencyCode): number {
  const { minorUnits, usdRate } = CURRENCIES[currency];
  const rateMicros = BigInt(Math.round(usdRate * 1_000_000));

  // cents = amountMinor / 10^minorUnits * rate * 100, kept as one exact fraction.
  const numerator = BigInt(amountMinor) * rateMicros * 100n;
  const denominator = 10n ** BigInt(minorUnits) * 1_000_000n;

  // Adding half a unit before dividing is "round half up" for whole numbers.
  return Number((numerator * 2n + denominator) / (denominator * 2n));
}
