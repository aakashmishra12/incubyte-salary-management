import { describe, expect, it } from 'vitest';
import { findOutliers, type PayRecord } from './outliers.ts';

/** Builds a peer group: everyone in the same country, department and level. */
function peers(salaries: number[], overrides: Partial<PayRecord> = {}): PayRecord[] {
  return salaries.map((salaryMinor, index) => ({
    id: index + 1,
    country: 'US',
    department: 'Engineering',
    level: 'L3',
    salaryMinor,
    ...overrides,
  }));
}

describe('findOutliers', () => {
  it('flags someone paid less than 80% of the peer median as below', () => {
    // Median of the five is 100. 79 is 79% of it.
    const outliers = findOutliers(peers([79, 100, 100, 100, 100]));

    expect(outliers).toEqual([
      { id: 1, direction: 'below', compaRatio: 0.79, peerMedianMinor: 100, peerCount: 5 },
    ]);
  });

  it('flags someone paid more than 120% of the peer median as above', () => {
    const outliers = findOutliers(peers([100, 100, 100, 100, 121]));

    expect(outliers).toEqual([
      { id: 5, direction: 'above', compaRatio: 1.21, peerMedianMinor: 100, peerCount: 5 },
    ]);
  });

  it('does not flag someone at exactly 80% or exactly 120%', () => {
    expect(findOutliers(peers([80, 100, 100, 100, 120]))).toEqual([]);
  });

  it('flags nobody when everyone is paid the same', () => {
    expect(findOutliers(peers([100, 100, 100, 100, 100]))).toEqual([]);
  });

  it('does not rate a peer group of fewer than 5 people', () => {
    // 10 would be far below the median, but four people are too few to judge.
    expect(findOutliers(peers([10, 100, 100, 100]))).toEqual([]);
  });

  it('never compares people across countries', () => {
    const us = peers([100, 100, 100, 100, 100], { country: 'US' });
    // Paid half as much, but in another country, so not peers of the group above.
    const india = peers([50, 50, 50, 50, 50], { country: 'IN' });

    expect(findOutliers([...us, ...india])).toEqual([]);
  });

  it('never compares people across departments', () => {
    const engineering = peers([100, 100, 100, 100, 100], { department: 'Engineering' });
    const sales = peers([50, 50, 50, 50, 50], { department: 'Sales' });

    expect(findOutliers([...engineering, ...sales])).toEqual([]);
  });

  it('never compares people across levels', () => {
    const senior = peers([100, 100, 100, 100, 100], { level: 'L3' });
    const junior = peers([50, 50, 50, 50, 50], { level: 'L1' });

    expect(findOutliers([...senior, ...junior])).toEqual([]);
  });

  it('judges each peer group against its own median', () => {
    const us = peers([100, 100, 100, 100, 150], { country: 'US' });
    const india = peers([10, 50, 50, 50, 50], { country: 'IN' }).map((record) => ({
      ...record,
      id: record.id + 100,
    }));

    const flagged = findOutliers([...us, ...india]).map((outlier) => outlier.id);

    expect(flagged).toEqual([5, 101]);
  });

  it('finds nothing in an empty list', () => {
    expect(findOutliers([])).toEqual([]);
  });

  it('lets the caller set a different comfort zone', () => {
    const rule = { minPeers: 5, lowPercent: 90, highPercent: 110 };

    const flagged = findOutliers(peers([85, 100, 100, 100, 115]), rule).map((o) => o.id);

    expect(flagged).toEqual([1, 5]);
  });
});
