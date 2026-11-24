import type { Db } from '../db/database.ts';
import { createEmployeeRepository } from '../repositories/employeeRepository.ts';
import { createEmployeeService } from '../services/employeeService.ts';
import { createInsightService } from '../services/insightService.ts';
import { createAnswerCache } from './answerCache.ts';
import { createAssistantService, type AssistantDeps } from './assistantService.ts';
import { createAssistantTools } from './tools.ts';
import { createUsageLimiter } from './usageLimiter.ts';

/** How many answers are remembered, and for how long. Asserted in a test, because the spec promises them. */
export const CACHE_MAX_ENTRIES = 100;
export const CACHE_TTL_SECONDS = 3600;

/**
 * Wires the assistant to the database. Used by the server and by tests, so both run the
 * same wiring. The providers are passed in: real ones from the settings, or a fake in tests.
 */
export function buildAssistant({
  db,
  failover,
  limits,
  clock = () => new Date(),
}: {
  db: Db;
  failover: AssistantDeps['failover'];
  limits: { perVisitorPerHour: number; perDay: number };
  clock?: () => Date;
}) {
  const repository = createEmployeeRepository(db);

  return createAssistantService({
    failover,
    tools: createAssistantTools({
      employees: createEmployeeService(repository, clock),
      insights: createInsightService(repository),
    }),
    limiter: createUsageLimiter({ ...limits, clock }),
    cache: createAnswerCache({
      maxEntries: CACHE_MAX_ENTRIES,
      ttlSeconds: CACHE_TTL_SECONDS,
      clock,
    }),
    dataVersion: () => repository.dataVersion(),
    clock,
  });
}
