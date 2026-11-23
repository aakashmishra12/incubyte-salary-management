/**
 * A small random number generator that always gives the same sequence for the same seed.
 * Math.random cannot be seeded, and the seed data must be identical on every run.
 * The algorithm is "mulberry32", a well-known 32-bit generator.
 */
export interface Random {
  /** A number from 0 (included) to 1 (excluded). */
  next(): number;
  /** A whole number from min to max, both included. */
  int(min: number, max: number): number;
  /** One item from the list, each equally likely. */
  pick<T>(items: readonly T[]): T;
  /** One key from the table, each as likely as its weight says. */
  weighted<K extends string>(weights: Record<K, number>): K;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  const pick = <T>(items: readonly T[]): T => items[int(0, items.length - 1)]!;

  const weighted = <K extends string>(weights: Record<K, number>): K => {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let target = next() * total;
    for (const [key, weight] of entries) {
      target -= weight;
      if (target < 0) return key;
    }
    // Only reachable through floating point rounding at the very top of the range.
    return entries[entries.length - 1]![0];
  };

  return { next, int, pick, weighted };
}
