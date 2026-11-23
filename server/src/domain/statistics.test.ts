import { describe, expect, it } from 'vitest';
import { median, summarize } from './statistics.ts';

describe('median', () => {
  it('is the middle value of an odd number of values', () => {
    expect(median([30, 10, 20])).toBe(20);
  });

  it('is the average of the two middle values of an even number of values', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  it('rounds to a whole number when the two middle values average to a half', () => {
    expect(median([1, 2])).toBe(2);
  });

  it('is the value itself when there is only one', () => {
    expect(median([42])).toBe(42);
  });

  it('is not pulled up by one very high value, unlike the mean', () => {
    expect(median([50, 50, 50, 50, 1000])).toBe(50);
  });

  it('has no answer for an empty list', () => {
    expect(median([])).toBeNull();
  });

  it('does not change the list it was given', () => {
    const values = [3, 1, 2];

    median(values);

    expect(values).toEqual([3, 1, 2]);
  });
});

describe('summarize', () => {
  it('gives count, minimum, median, mean and maximum', () => {
    expect(summarize([10, 20, 60])).toEqual({ count: 3, min: 10, median: 20, mean: 30, max: 60 });
  });

  it('rounds the mean to a whole number', () => {
    expect(summarize([1, 2, 2])?.mean).toBe(2);
  });

  it('says "no data" for an empty group instead of reporting zeros', () => {
    expect(summarize([])).toBeNull();
  });
});
