import { Router } from 'express';
import { z } from 'zod';
import { COUNTRIES, DEPARTMENTS, LEVELS, type CountryCode } from '../domain/reference.ts';
import { amountMinorSchema, idParamSchema, isoDateSchema } from '../http/schemas.ts';
import type { EmployeeService } from '../services/employeeService.ts';

const COUNTRY_CODES = Object.keys(COUNTRIES) as [CountryCode, ...CountryCode[]];

/**
 * The shape of a valid list request. Everything in an address is text, so numbers are
 * coerced ("2" becomes 2). Anything that does not fit is refused before any query runs.
 * TypeScript also reads the type of the parsed result from this one definition.
 */
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional(),
  country: z.enum(COUNTRY_CODES).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  level: z.enum(LEVELS).optional(),
  status: z.enum(['active', 'left']).optional(),
  sort: z
    .enum(['name', 'employeeCode', 'hireDate', 'country', 'department', 'level', 'salary'])
    .default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const salaryChangeSchema = z.object({
  newSalaryMinor: amountMinorSchema,
  effectiveDate: isoDateSchema,
  reason: z.string().trim().min(3).max(200),
});

export function employeeRoutes(employees: EmployeeService): Router {
  const router = Router();

  router.get('/', (request, response) => {
    // parse throws a ZodError on bad input, which the error handler turns into a 400.
    const query = listQuerySchema.parse(request.query);
    response.json(employees.list(query));
  });

  router.get('/:id', (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    response.json(employees.getDetail(id));
  });

  router.post('/:id/salary-changes', (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const change = salaryChangeSchema.parse(request.body);
    // 201 Created: a new salary history row now exists.
    response.status(201).json(employees.changeSalary(id, change));
  });

  return router;
}
