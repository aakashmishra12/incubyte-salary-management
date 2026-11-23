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

// Text fields are trimmed first, so a name of only spaces counts as empty.
const nameSchema = z.string().trim().min(1).max(100);
// Emails are compared as lower case, so "A@x.com" and "a@x.com" are the same person.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(200));

const newEmployeeSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  country: z.enum(COUNTRY_CODES),
  department: z.enum(DEPARTMENTS),
  level: z.enum(LEVELS),
  jobTitle: nameSchema,
  hireDate: isoDateSchema,
  salaryMinor: amountMinorSchema,
});

/**
 * Only these fields can be corrected. Zod drops any other field in the body,
 * which is how a salary or a country sent here is ignored.
 */
const employeeChangesSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: emailSchema,
    department: z.enum(DEPARTMENTS),
    level: z.enum(LEVELS),
    jobTitle: nameSchema,
  })
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'Send at least one field to change');

const leaveSchema = z.object({ leftOn: isoDateSchema });

export function employeeRoutes(employees: EmployeeService): Router {
  const router = Router();

  router.get('/', (request, response) => {
    // parse throws a ZodError on bad input, which the error handler turns into a 400.
    const query = listQuerySchema.parse(request.query);
    response.json(employees.list(query));
  });

  router.post('/', (request, response) => {
    const input = newEmployeeSchema.parse(request.body);
    response.status(201).json(employees.create(input));
  });

  router.patch('/:id', (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const changes = employeeChangesSchema.parse(request.body);
    response.json(employees.updateDetails(id, changes));
  });

  router.post('/:id/leave', (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    const { leftOn } = leaveSchema.parse(request.body);
    response.json(employees.markLeft(id, leftOn));
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
