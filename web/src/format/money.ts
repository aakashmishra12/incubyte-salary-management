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

/** The largest amount the server accepts, in minor units. Asking before saving saves a round trip. */
const MAX_AMOUNT_MINOR = 1_000_000_000_000;

/**
 * Reads an amount a person typed ("110,000" or "85000.50") into minor units.
 * Returns null for anything that is not a plain positive amount, and for anything that could be
 * misread. A comma is accepted only as a thousands separator, in groups of three: "1,5" might be
 * one and a half typed with a decimal comma, and reading it as 15 would be a hundredfold error.
 * No more decimals are accepted than the currency has (none for yen, two for dollars).
 */
export function parseMoney(text: string, currency: string): number | null {
  const match = text.trim().match(/^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/);
  if (!match) return null;

  const units = minorUnitsOf(currency);
  const fraction = match[2] ?? '';
  if (fraction.length > units) return null;

  const whole = match[1]!.replaceAll(',', '');
  const amountMinor = Number(whole) * 10 ** units + Number(fraction.padEnd(units, '0') || 0);

  return amountMinor > 0 && amountMinor <= MAX_AMOUNT_MINOR ? amountMinor : null;
}

/** "+10.0%" for a rise from 100 to 110, "-5.0%" for a cut from 100 to 95. */
export function percentChange(fromMinor: number, toMinor: number): string {
  const percent = ((toMinor - fromMinor) / fromMinor) * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}
