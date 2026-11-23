/**
 * Reference data: the fixed lists the rest of the app relies on.
 * They live in code because they change rarely and every change should be reviewed.
 */

export interface CurrencyInfo {
  name: string;
  /** How many decimal places the currency has. USD has 2 (cents). The yen has 0. */
  minorUnits: number;
  /** How many US dollars one unit of this currency buys. */
  usdRate: number;
}

/** The date the rates below were fixed. Shown in the UI next to every converted amount. */
export const RATES_AS_OF = '2026-11-01';

/**
 * Fixed, illustrative exchange rates. They are not live market rates.
 * `as const satisfies` keeps the exact keys (so CurrencyCode is a precise type)
 * while still checking each entry has the CurrencyInfo shape.
 */
export const CURRENCIES = {
  USD: { name: 'US dollar', minorUnits: 2, usdRate: 1 },
  INR: { name: 'Indian rupee', minorUnits: 2, usdRate: 0.0118 },
  GBP: { name: 'Pound sterling', minorUnits: 2, usdRate: 1.31 },
  EUR: { name: 'Euro', minorUnits: 2, usdRate: 1.16 },
  CAD: { name: 'Canadian dollar', minorUnits: 2, usdRate: 0.72 },
  AUD: { name: 'Australian dollar', minorUnits: 2, usdRate: 0.66 },
  SGD: { name: 'Singapore dollar', minorUnits: 2, usdRate: 0.77 },
  JPY: { name: 'Japanese yen', minorUnits: 0, usdRate: 0.0067 },
} as const satisfies Record<string, CurrencyInfo>;

export type CurrencyCode = keyof typeof CURRENCIES;

/** The countries ACME employs people in. An employee is paid in the currency of their country. */
export const COUNTRIES = {
  IN: { name: 'India', currency: 'INR' },
  US: { name: 'United States', currency: 'USD' },
  GB: { name: 'United Kingdom', currency: 'GBP' },
  DE: { name: 'Germany', currency: 'EUR' },
  CA: { name: 'Canada', currency: 'CAD' },
  AU: { name: 'Australia', currency: 'AUD' },
  SG: { name: 'Singapore', currency: 'SGD' },
  JP: { name: 'Japan', currency: 'JPY' },
} as const satisfies Record<string, { name: string; currency: CurrencyCode }>;

export type CountryCode = keyof typeof COUNTRIES;

export const DEPARTMENTS = [
  'Engineering',
  'Product',
  'Design',
  'Sales',
  'Marketing',
  'Customer Support',
  'Finance',
  'People',
] as const;

/** `(typeof DEPARTMENTS)[number]` means "any one of the values in the list above". */
export type Department = (typeof DEPARTMENTS)[number];

/** Job levels from most junior to most senior. */
export const LEVELS = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as const;

export type Level = (typeof LEVELS)[number];
