import {
  payBreakdown,
  payOverview,
  peerCoverage,
  type GroupBy,
  type PayGroup,
  type PayOverview,
} from '../domain/insights.ts';
import { DEFAULT_OUTLIER_RULE, findOutliers, type Outlier } from '../domain/outliers.ts';
import { RATES_AS_OF } from '../domain/reference.ts';
import type {
  EmployeeRepository,
  NamedPayRow,
  PayRowFilter,
} from '../repositories/employeeRepository.ts';

export interface OutlierQuery extends PayRowFilter {
  direction?: 'below' | 'above';
  page: number;
  pageSize: number;
}

/** An outlier with the person's name and pay, ready to show in a table. */
export type OutlierItem = NamedPayRow & Omit<Outlier, 'id'>;

/**
 * The insights use cases. Each one loads the active employees' pay rows and hands them
 * to a pure function in the domain folder. See D-010 for why this is not done in SQL.
 */
export function createInsightService(repository: EmployeeRepository) {
  return {
    overview(): PayOverview & { ratesAsOf: string } {
      return { ...payOverview(repository.activePayRows()), ratesAsOf: RATES_AS_OF };
    },

    breakdown(
      groupBy: GroupBy,
      filter: PayRowFilter,
    ): { groupBy: GroupBy; groups: PayGroup[]; ratesAsOf: string } {
      const rows = repository.activePayRows(filter);
      return { groupBy, groups: payBreakdown(rows, groupBy), ratesAsOf: RATES_AS_OF };
    },

    outliers(query: OutlierQuery) {
      // Peers share country, department and level, so narrowing the rows by any of those
      // before applying the rule gives the same flags as narrowing afterwards, with less work.
      const rows = repository.activePayRows(query);
      const rowById = new Map(rows.map((row) => [row.id, row]));

      const items: OutlierItem[] = findOutliers(rows)
        .filter((outlier) => !query.direction || outlier.direction === query.direction)
        // Most extreme first: the further the ratio is from 1, the higher it sorts.
        .sort((a, b) => Math.abs(b.compaRatio - 1) - Math.abs(a.compaRatio - 1) || a.id - b.id)
        .map(({ id, ...flag }) => ({ ...rowById.get(id)!, ...flag }));

      const start = (query.page - 1) * query.pageSize;
      return {
        items: items.slice(start, start + query.pageSize),
        total: items.length,
        page: query.page,
        pageSize: query.pageSize,
        rule: DEFAULT_OUTLIER_RULE,
        coverage: peerCoverage(rows, DEFAULT_OUTLIER_RULE.minPeers),
      };
    },
  };
}

export type InsightService = ReturnType<typeof createInsightService>;
