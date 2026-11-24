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

  describe('the compa-ratio shown for a flagged employee', () => {
    it('never reads as exactly on the boundary when the person is just outside it', () => {
      // 7,996 is 79.96% of 10,000: flagged as below, but rounding to two places gives 0.80.
      const below = findOutliers(peers([7_996, 10_000, 10_000, 10_000, 10_000]));
      // 12,004 is 120.04% of 10,000: flagged as above, but rounding gives 1.20.
      const above = findOutliers(peers([10_000, 10_000, 10_000, 10_000, 12_004]));

      expect(below[0]).toMatchObject({ direction: 'below', compaRatio: 0.79 });
      expect(above[0]).toMatchObject({ direction: 'above', compaRatio: 1.21 });
    });

    it('is rounded to two places otherwise', () => {
      // 16,667 against a median of 10,000 is 1.6667, shown as 1.67.
      const [outlier] = findOutliers(peers([10_000, 10_000, 10_000, 10_000, 16_667]));

      expect(outlier).toMatchObject({ compaRatio: 1.67, peerMedianMinor: 10_000, peerCount: 5 });
    });

    it('reports the number of peers, counting the person flagged', () => {
      const [outlier] = findOutliers(
        peers([10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 30_000]),
      );

      expect(outlier!.peerCount).toBe(7);
    });
  });
});
