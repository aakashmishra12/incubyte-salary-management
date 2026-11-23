/**
 * The API sends money as whole minor units (cents, or yen for JPY) plus a currency code.
 * These functions turn that into text for the screen. Nothing else in the UI does money maths.
 */

// One fixed locale, so the app reads the same for every user and in every test.
const LOCALE = 'en-US';

/** How many decimal places a currency has: 2 for USD, 0 for JPY. Intl knows the ISO standard. */
function minorUnitsOf(currency: string): number {
  const options = new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).resolvedOptions();
  return options.maximumFractionDigits ?? 2;
}

/** 8500000 and 'USD' become "$85,000". Annual salaries are shown without cents. */
export function formatMoney(amountMinor: number, currency: string): string {
  const major = amountMinor / 10 ** minorUnitsOf(currency);
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(major);
}

export function formatUsd(amountMinor: number): string {
  return formatMoney(amountMinor, 'USD');
}
