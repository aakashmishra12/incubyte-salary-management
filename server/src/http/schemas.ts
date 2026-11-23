import { z } from 'zod';

/** Schemas shared by more than one route. */

/** An id in the address, such as the 42 in /api/employees/42. */
export const idParamSchema = z.object({ id: z.coerce.number().int().positive() });

/** A calendar date as YYYY-MM-DD that really exists. "2026-02-30" has the right shape and is refused. */
export const isoDateSchema = z.string().refine((text) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  // An impossible date either fails to parse or rolls over into the next month.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}, 'Use a real date in the format YYYY-MM-DD');

/**
 * An amount of money in minor units: a positive whole number.
 * The upper limit is far above any salary and well inside the range JavaScript counts exactly.
 */
export const amountMinorSchema = z.number().int().positive().max(1_000_000_000_000);
