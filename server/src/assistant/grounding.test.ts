import { describe, expect, it } from 'vitest';
import { findUngroundedFigures } from './grounding.ts';

describe('findUngroundedFigures', () => {
  const evidence = [
    '{"activeEmployees":9598,"totalAnnualCostUsd":"USD 651,024,049","shareOfTotalCostPercent":41.3}',
    '{"salary":"GBP 80,000","peerMedian":"GBP 48,500","compaRatio":1.65,"employeeCode":"E00042"}',
  ];

  it('finds nothing wrong when every figure came from the data', () => {
    const answer = 'We have 9,598 people costing USD 651,024,049, and the US is 41.3% of that.';

    expect(findUngroundedFigures(answer, evidence)).toEqual([]);
  });

  it('does not care about thousands separators, or whether the data had them', () => {
    expect(findUngroundedFigures('There are 9598 active employees.', evidence)).toEqual([]);
    expect(findUngroundedFigures('Cost: 651024049 dollars.', evidence)).toEqual([]);
  });

  it('flags a figure that is not in the data', () => {
    const answer = 'The average salary is USD 1,234,567.';

    expect(findUngroundedFigures(answer, evidence)).toEqual(['1234567']);
  });

  it('flags a figure the model worked out itself, such as a rounded version or a difference', () => {
    expect(findUngroundedFigures('That is about USD 651 million.', evidence)).toEqual(['651']);
    expect(findUngroundedFigures('She earns 31,500 more than her peers.', evidence)).toEqual([
      '31500',
    ]);
  });

  it('flags a decimal that is not in the data', () => {
    expect(findUngroundedFigures('The ratio is 1.66.', evidence)).toEqual(['1.66']);
  });

  it('treats 41.30 and 41.3 as the same figure', () => {
    expect(findUngroundedFigures('It is 41.30% of the total.', evidence)).toEqual([]);
  });

  it('ignores small whole numbers, which are counts and list positions, not salary figures', () => {
    const answer = '1. Sofia\n2. Riya\nThe top 5 people, in 3 countries, at level L3.';

    expect(findUngroundedFigures(answer, evidence)).toEqual([]);
  });

  it('accepts figures that the question itself contained', () => {
    const answer = 'You asked about 2025, and in 2025 nobody left.';

    expect(findUngroundedFigures(answer, [...evidence, 'Who left in 2025?'])).toEqual([]);
  });

  it('accepts employee codes that appear in the data', () => {
    expect(findUngroundedFigures('Employee E00042 is paid GBP 80,000.', evidence)).toEqual([]);
  });

  it('lists each unmatched figure once, in the order it appears', () => {
    const answer = 'It is 777,000, then 888,000, then 777,000 again.';

    expect(findUngroundedFigures(answer, evidence)).toEqual(['777000', '888000']);
  });

  it('flags everything when there is no data at all', () => {
    expect(findUngroundedFigures('The median is USD 85,000.', [])).toEqual(['85000']);
  });
});
