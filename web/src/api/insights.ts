import { api } from './client.ts';
import type { OutlierPage, PayBreakdown, PayOverview } from './types.ts';

/** Builds "?a=1&b=2" from the entries that have a value, or "" when none do. */
function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(name, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function fetchOverview(): Promise<PayOverview> {
  return api<PayOverview>('/api/insights/overview');
}

export interface BreakdownParams {
  groupBy: string;
  country: string;
  department: string;
  level: string;
}

export function fetchBreakdown(params: BreakdownParams): Promise<PayBreakdown> {
  return api<PayBreakdown>(`/api/insights/breakdown${queryString({ ...params })}`);
}

export interface OutlierParams {
  direction: string;
  country: string;
  department: string;
  page: number;
  pageSize: number;
}

export function fetchOutliers(params: OutlierParams): Promise<OutlierPage> {
  return api<OutlierPage>(`/api/insights/outliers${queryString({ ...params })}`);
}
