/**
 * `npm run measure`: times the main reads against 10,000 seeded employees.
 * It calls the services directly, so the numbers are the cost of the query and the
 * calculation, without network time. Results are recorded in docs/PERFORMANCE.md.
 */
import { openDatabase } from './db/database.ts';
import { createEmployeeRepository } from './repositories/employeeRepository.ts';
import { generateEmployees } from './seed/generateEmployees.ts';
import { DEFAULT_SEED, SEED_TIMESTAMP, seedDatabase } from './seed/seedDatabase.ts';
import { createEmployeeService } from './services/employeeService.ts';
import { createInsightService } from './services/insightService.ts';

const RUNS = 200;

const db = openDatabase(':memory:');
const seedStart = performance.now();
seedDatabase(db, generateEmployees(DEFAULT_SEED), SEED_TIMESTAMP);
const seedMs = performance.now() - seedStart;

const repository = createEmployeeRepository(db);
const employees = createEmployeeService(repository, () => new Date());
const insights = createInsightService(repository);

const list = { page: 1, pageSize: 25, sort: 'name', order: 'asc' } as const;

const cases: [string, () => unknown][] = [
  ['List, first page', () => employees.list(list)],
  ['List, last page (page 400)', () => employees.list({ ...list, page: 400 })],
  ['List, search "sharma"', () => employees.list({ ...list, search: 'sharma' })],
  [
    'List, filter country + department',
    () => employees.list({ ...list, country: 'IN', department: 'Engineering' }),
  ],
  ['List, sort by salary', () => employees.list({ ...list, sort: 'salary', order: 'desc' })],
  ['Employee detail with history', () => employees.getDetail(5000)],
  ['Insights, overview', () => insights.overview()],
  ['Insights, breakdown by level', () => insights.breakdown('level', {})],
  ['Insights, outliers', () => insights.outliers({ page: 1, pageSize: 25 })],
];

/** The middle and the slow end of many runs. One run alone would mostly measure noise. */
function time(work: () => unknown): { median: number; p95: number } {
  const durations: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const start = performance.now();
    work();
    durations.push(performance.now() - start);
  }
  durations.sort((a, b) => a - b);
  return { median: durations[Math.floor(RUNS / 2)]!, p95: durations[Math.floor(RUNS * 0.95)]! };
}

console.log(`Node ${process.version}, ${DEFAULT_SEED.count} employees, ${RUNS} runs each\n`);
console.log(`Seed 10,000 employees with history: ${seedMs.toFixed(0)} ms\n`);
console.log('| Operation | Median | 95th percentile |');
console.log('|---|---|---|');
for (const [name, work] of cases) {
  const { median, p95 } = time(work);
  console.log(`| ${name} | ${median.toFixed(2)} ms | ${p95.toFixed(2)} ms |`);
}
