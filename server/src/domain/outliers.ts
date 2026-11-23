import { median } from './statistics.ts';

/** The few facts about an employee that the outlier rule needs. */
export interface PayRecord {
  id: number;
  country: string;
  department: string;
  level: string;
  salaryMinor: number;
}

export interface OutlierRule {
  /** A peer group smaller than this is not rated. */
  minPeers: number;
  /** Flag below this percentage of the peer median. */
  lowPercent: number;
  /** Flag above this percentage of the peer median. */
  highPercent: number;
}

/** The common HR comfort zone: 80% to 120% of the reference point. */
export const DEFAULT_OUTLIER_RULE: OutlierRule = { minPeers: 5, lowPercent: 80, highPercent: 120 };

export interface Outlier {
  id: number;
  direction: 'below' | 'above';
  /** Salary divided by the peer median, to two decimals. 1.00 means paid at the median. */
  compaRatio: number;
  peerMedianMinor: number;
  peerCount: number;
}

/**
 * Finds employees paid far from the median of their peers.
 * Peers share the same country, department and level, so they also share a currency
 * and no exchange rate is involved.
 */
export function findOutliers(
  records: readonly PayRecord[],
  rule: OutlierRule = DEFAULT_OUTLIER_RULE,
): Outlier[] {
  const outliers: Outlier[] = [];

  for (const group of groupByPeers(records)) {
    if (group.length < rule.minPeers) continue;

    // A group that reaches this line is never empty, so the median is a number.
    const peerMedianMinor = median(group.map((record) => record.salaryMinor))!;

    for (const record of group) {
      // Whole-number comparison: "salary < 80% of median" without dividing,
      // so someone at exactly 80% can never be flagged by a rounding error.
      const scaledSalary = record.salaryMinor * 100;
      const isBelow = scaledSalary < peerMedianMinor * rule.lowPercent;
      const isAbove = scaledSalary > peerMedianMinor * rule.highPercent;
      if (!isBelow && !isAbove) continue;

      outliers.push({
        id: record.id,
        direction: isBelow ? 'below' : 'above',
        compaRatio: Math.round((record.salaryMinor / peerMedianMinor) * 100) / 100,
        peerMedianMinor,
        peerCount: group.length,
      });
    }
  }

  return outliers;
}

/**
 * Splits records into peer groups, keeping the order in which each group first appears.
 * <T extends ...> means: works for any record that has at least these three fields,
 * and gives back the same kind of record it was given.
 */
export function groupByPeers<T extends Pick<PayRecord, 'country' | 'department' | 'level'>>(
  records: readonly T[],
): T[][] {
  const groups = new Map<string, T[]>();

  for (const record of records) {
    const key = `${record.country}|${record.department}|${record.level}`;
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }

  return [...groups.values()];
}
