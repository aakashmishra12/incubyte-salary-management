import { Router } from 'express';
import { COUNTRIES, CURRENCIES, DEPARTMENTS, LEVELS, RATES_AS_OF } from '../domain/reference.ts';

/** The fixed lists the UI needs for filters, forms and money formatting. */
export function referenceRoutes(): Router {
  const router = Router();

  router.get('/', (_request, response) => {
    response.json({
      countries: Object.entries(COUNTRIES).map(([code, country]) => ({ code, ...country })),
      currencies: Object.entries(CURRENCIES).map(([code, { name, minorUnits }]) => ({
        code,
        name,
        minorUnits,
      })),
      departments: DEPARTMENTS,
      levels: LEVELS,
      ratesAsOf: RATES_AS_OF,
    });
  });

  return router;
}
