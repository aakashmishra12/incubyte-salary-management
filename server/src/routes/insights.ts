import { Router } from 'express';
import { z } from 'zod';
import { COUNTRIES, DEPARTMENTS, LEVELS, type CountryCode } from '../domain/reference.ts';
import type { InsightService } from '../services/insightService.ts';

const COUNTRY_CODES = Object.keys(COUNTRIES) as [CountryCode, ...CountryCode[]];

/** The optional narrowing every insight accepts. */
const filterSchema = z.object({
  country: z.enum(COUNTRY_CODES).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  level: z.enum(LEVELS).optional(),
});

const breakdownQuerySchema = filterSchema.extend({
  groupBy: z.enum(['country', 'department', 'level']).default('country'),
});

const outlierQuerySchema = filterSchema.extend({
  direction: z.enum(['below', 'above']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export function insightRoutes(insights: InsightService): Router {
  const router = Router();

  router.get('/overview', (_request, response) => {
    response.json(insights.overview());
  });

  router.get('/breakdown', (request, response) => {
    const { groupBy, ...filter } = breakdownQuerySchema.parse(request.query);
    response.json(insights.breakdown(groupBy, filter));
  });

  router.get('/outliers', (request, response) => {
    response.json(insights.outliers(outlierQuerySchema.parse(request.query)));
  });

  return router;
}
