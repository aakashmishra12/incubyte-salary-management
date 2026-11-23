import { groupByPeers, type PayRecord } from './outliers.ts';
import { summarize, type Summary } from './statistics.ts';

/** One active employee, reduced to what the insights need. */
export interface PayRow extends PayRecord {
  currency: string;
  salaryUsdMinor: number;
}

export interface CountryCost {
  country: string;
  currency: string;
  headcount: number;
  totalLocalMinor: number;
  totalUsdMinor: number;
}

export interface PayOverview {
  headcount: number;
  totalUsdMinor: number;
  countries: CountryCost[];
}

/** Headcount and annual salary cost, overall and per country, most expensive country first. */
export function payOverview(rows: readonly PayRow[]): PayOverview {
  const byCountry = new Map<string, CountryCost>();

  for (const row of rows) {
    let cost = byCountry.get(row.country);
    if (!cost) {
      cost = {
        country: row.country,
        currency: row.currency,
        headcount: 0,
        totalLocalMinor: 0,
        totalUsdMinor: 0,
      };
      byCountry.set(row.country, cost);
    }
    cost.headcount += 1;
    cost.totalLocalMinor += row.salaryMinor;
    cost.totalUsdMinor += row.salaryUsdMinor;
  }

  const countries = [...byCountry.values()].sort((a, b) => b.totalUsdMinor - a.totalUsdMinor);

  return {
    headcount: rows.length,
    totalUsdMinor: countries.reduce((total, country) => total + country.totalUsdMinor, 0),
    countries,
  };
}

export type GroupBy = 'country' | 'department' | 'level';

export interface PayGroup {
  /** The country code, department or level this group is for. */
  key: string;
  /** Always present: every salary has a USD equivalent. */
  usd: Summary;
  /** Present only when everyone in the group is paid in the same currency. */
  local: (Summary & { currency: string }) | null;
}

/** Count, minimum, median, mean and maximum salary for each country, department or level. */
export function payBreakdown(rows: readonly PayRow[], groupBy: GroupBy): PayGroup[] {
  const groups = new Map<string, PayRow[]>();
  for (const row of rows) {
    const key = row[groupBy];
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, group]) => {
      const currency = group[0]!.currency;
      const sharesOneCurrency = group.every((row) => row.currency === currency);
      // A group in the map has at least one row, so summarize never returns null here.
      const local = sharesOneCurrency ? summarize(group.map((row) => row.salaryMinor))! : null;

      return {
        key,
        usd: summarize(group.map((row) => row.salaryUsdMinor))!,
        local: local && { currency, ...local },
      };
    });
}

/**
 * How many employees are in a peer group big enough to be rated for outliers, and how many are not.
 * The second number is shown to the HR Manager, so nobody mistakes "not rated" for "fine".
 */
export function peerCoverage(
  rows: readonly PayRecord[],
  minPeers: number,
): { rated: number; unrated: number } {
  let rated = 0;
  let unrated = 0;
  for (const group of groupByPeers(rows)) {
    if (group.length >= minPeers) rated += group.length;
    else unrated += group.length;
  }
  return { rated, unrated };
}
