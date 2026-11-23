import { CURRENCIES, type CurrencyCode } from './reference.ts';

/**
 * Money is always a whole number of minor units (cents for USD, yen for JPY).
 * Decimals are never stored, because 0.1 + 0.2 is not exactly 0.3 in JavaScript.
 */

/** Turns an amount in major units (85000 dollars) into minor units (8500000 cents). */
export function toMinorUnits(major: number, currency: CurrencyCode): number {
  return Math.round(major * 10 ** CURRENCIES[currency].minorUnits);
}

/** Converts an amount in minor units of any currency to US cents, using the fixed rate. */
export function toUsdMinor(amountMinor: number, currency: CurrencyCode): number {
  const { minorUnits, usdRate } = CURRENCIES[currency];
  const major = amountMinor / 10 ** minorUnits;
  return Math.round(major * usdRate * 100);
}
