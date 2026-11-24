import { z } from 'zod';
import {
  COUNTRIES,
  CURRENCIES,
  DEPARTMENTS,
  LEVELS,
  RATES_AS_OF,
  type CountryCode,
  type CurrencyCode,
} from '../domain/reference.ts';
import type { EmployeeService } from '../services/employeeService.ts';
import type { InsightService } from '../services/insightService.ts';
import type { ToolDefinition } from './types.ts';

/**
 * The only things the model can do: four read-only questions about pay.
 * It cannot run SQL, cannot change anything, and cannot see more than ten people at a time.
 * Every amount is turned into text with its currency here, and every share and ratio is
 * worked out here, so the model never has to calculate and only has to copy.
 */

const MAX_ROWS = 10;
const COUNTRY_CODES = Object.keys(COUNTRIES) as [CountryCode, ...CountryCode[]];

const countryList = COUNTRY_CODES.map((code) => `${code} (${COUNTRIES[code].name})`).join(', ');

const country = z.enum(COUNTRY_CODES).describe(`Country code. One of: ${countryList}.`).optional();
const department = z.enum(DEPARTMENTS).describe('Department name.').optional();
const level = z
  .enum(LEVELS)
  .describe('Job level, L1 (most junior) to L6 (most senior).')
  .optional();
const limit = (fallback: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(MAX_ROWS)
    .default(fallback)
    .describe(`How many people to return, at most ${MAX_ROWS}.`);

/** What a tool call produced. `source` is shown to the HR Manager under the answer. */
export interface ToolResult {
  content: string;
  isError: boolean;
  source?: string;
}

interface Tool extends ToolDefinition {
  run(input: unknown): ToolResult;
}

/** Turns "annual salary in minor units" into text the model can copy: "INR 7,100,000". */
function money(amountMinor: number, currency: string): string {
  const { minorUnits } = CURRENCIES[currency as CurrencyCode];
  const major = Math.round(amountMinor / 10 ** minorUnits);
  return `${currency} ${major.toLocaleString('en-US')}`;
}

const countryLabel = (code: string) => `${COUNTRIES[code as CountryCode]?.name ?? code} (${code})`;

const USD_NOTE = `USD figures are approximate: they use fixed exchange rates dated ${RATES_AS_OF}.`;

/** Builds the tools. The services are passed in, so tests use an in-memory database. */
export function createAssistantTools({
  employees,
  insights,
}: {
  employees: EmployeeService;
  insights: InsightService;
}) {
  /** Defines one tool: its schema checks the arguments, and `execute` does the work. */
  function defineTool<S extends z.ZodType>(spec: {
    name: string;
    description: string;
    schema: S;
    execute: (args: z.output<S>) => { data: unknown; source: string };
  }): Tool {
    // The schema's "$schema" line names the JSON Schema version. Providers do not want it.
    const parameters = z.toJSONSchema(spec.schema, { target: 'draft-7', io: 'input' }) as Record<
      string,
      unknown
    >;
    delete parameters.$schema;

    return {
      name: spec.name,
      description: spec.description,
      parameters,
      run(input) {
        const parsed = spec.schema.safeParse(normalizeArguments(input));
        if (!parsed.success) {
          const problems = parsed.error.issues.map(
            (i) => `${i.path.join('.') || 'arguments'}: ${i.message}`,
          );
          // Say what the tool does accept, so the model can correct itself in one step.
          const shape = (spec.schema as unknown as { shape?: Record<string, unknown> }).shape;
          const allowed = shape ? Object.keys(shape).join(', ') || 'none' : 'none';
          return fail(`Invalid arguments. ${problems.join('. ')}. Allowed arguments: ${allowed}.`);
        }
        const { data, source } = spec.execute(parsed.data);
        return { content: JSON.stringify(data), isError: false, source };
      },
    };
  }

  const tools: Tool[] = [
    defineTool({
      name: 'get_overview',
      description:
        'Company totals for active employees: headcount and total annual salary cost, overall and for each country, with the share of cost each country accounts for. Use it for questions about how much the company spends or how many people it pays.',
      schema: z.strictObject({}),
      execute: () => {
        const overview = insights.overview();
        return {
          source: 'Company overview',
          data: {
            activeEmployees: overview.headcount,
            totalAnnualCostUsd: money(overview.totalUsdMinor, 'USD'),
            countries: overview.countries.map((c) => ({
              country: countryLabel(c.country),
              employees: c.headcount,
              totalAnnualCostLocal: money(c.totalLocalMinor, c.currency),
              totalAnnualCostUsd: money(c.totalUsdMinor, 'USD'),
              shareOfTotalCostPercent:
                Math.round((c.totalUsdMinor / overview.totalUsdMinor) * 1000) / 10,
            })),
            usdNote: USD_NOTE,
          },
        };
      },
    }),

    defineTool({
      name: 'get_breakdown',
      description:
        'Lowest, median, average and highest annual salary, and the number of active employees, for each country, department or level. Narrow it with country, department and level filters, for example to compare one role across countries. Use it for questions about what people typically earn.',
      schema: z.strictObject({
        groupBy: z
          .enum(['country', 'department', 'level'])
          .default('country')
          .describe('What to group by.'),
        country,
        department,
        level,
      }),
      execute: ({ groupBy, ...filter }) => {
        const result = insights.breakdown(groupBy, filter);
        const filters = Object.fromEntries(Object.entries(filter).filter(([, value]) => value));
        const names = [
          filter.country && COUNTRIES[filter.country].name,
          filter.department,
          filter.level,
        ].filter(Boolean);

        return {
          source: `Breakdown by ${groupBy}${names.length ? ` (${names.join(', ')})` : ''}`,
          data: {
            groupedBy: groupBy,
            filters,
            groups: result.groups.map((group) => {
              // Local currency when everyone in the group shares one, otherwise USD.
              const own = group.local ?? { ...group.usd, currency: 'USD' };
              return {
                group: groupBy === 'country' ? countryLabel(group.key) : group.key,
                employees: group.usd.count,
                lowest: money(own.min, own.currency),
                median: money(own.median, own.currency),
                average: money(own.mean, own.currency),
                highest: money(own.max, own.currency),
                ...(own.currency !== 'USD'
                  ? { medianUsdApprox: money(group.usd.median, 'USD') }
                  : {}),
                ...(group.local === null
                  ? {
                      currencyNote:
                        'This group has mixed currencies, so its figures are in approximate USD.',
                    }
                  : {}),
              };
            }),
            ...(result.groups.length === 0
              ? { message: 'No active employees match these filters.' }
              : {}),
            usdNote: USD_NOTE,
          },
        };
      },
    }),

    defineTool({
      name: 'get_outliers',
      description:
        'Employees paid far above or below the median of their peers (same country, department and level). Returns the most extreme first, with their salary, the peer median, the compa-ratio and the number of peers. Use it for questions about who is overpaid, underpaid or out of line.',
      schema: z.strictObject({
        direction: z
          .enum(['below', 'above'])
          .describe('Only people paid below, or above, their peers.')
          .optional(),
        country,
        department,
        level,
        limit: limit(5),
      }),
      execute: ({ limit: rows, ...filter }) => {
        const result = insights.outliers({ ...filter, page: 1, pageSize: rows });
        const names = [
          filter.direction && `${filter.direction} peers`,
          filter.country && COUNTRIES[filter.country].name,
          filter.department,
          filter.level,
        ].filter(Boolean);

        return {
          source: `Pay outliers${names.length ? ` (${names.join(', ')})` : ''}`,
          data: {
            rule: `Flagged when paid below ${result.rule.lowPercent}% or above ${result.rule.highPercent}% of the median of peers in the same country, department and level. Groups with fewer than ${result.rule.minPeers} people are not rated. A flag is a prompt to look, not proof of unfair pay.`,
            totalFlagged: result.total,
            showing: result.items.length,
            unratedEmployees: result.coverage.unrated,
            items: result.items.map((item) => ({
              employee: `${item.firstName} ${item.lastName}`,
              employeeCode: item.employeeCode,
              country: countryLabel(item.country),
              department: item.department,
              level: item.level,
              salary: money(item.salaryMinor, item.currency),
              peerMedian: money(item.peerMedianMinor, item.currency),
              compaRatio: item.compaRatio,
              peers: item.peerCount,
              flag: item.direction,
            })),
          },
        };
      },
    }),

    defineTool({
      name: 'find_employees',
      description:
        'Looks up individual employees by name, email or employee ID, with optional filters, and can sort by salary or hire date. Returns at most 10 active people unless status says otherwise. Use it for questions about specific people, or about the highest or lowest paid.',
      schema: z.strictObject({
        search: z.string().max(100).describe('Part of a name, email or employee ID.').optional(),
        country,
        department,
        level,
        status: z
          .enum(['active', 'left', 'any'])
          .default('active')
          .describe(
            'Active people only by default. Use left for people who have left, or any for both.',
          ),
        sort: z
          .enum(['name', 'salary_desc', 'salary_asc', 'hire_date_newest', 'hire_date_oldest'])
          .default('name')
          .describe('salary_desc is highest paid first. Salary sorts compare USD equivalents.'),
        limit: limit(5),
      }),
      execute: ({ limit: rows, sort, status, ...filter }) => {
        const order = SORTS[sort];
        const page = employees.list({
          ...filter,
          ...(status === 'any' ? {} : { status }),
          ...order.query,
          page: 1,
          pageSize: rows,
        });
        const parts = [
          filter.search && `"${filter.search}"`,
          filter.country && COUNTRIES[filter.country].name,
          filter.department,
          filter.level,
          status !== 'active' &&
            (status === 'left' ? 'people who left' : 'including people who left'),
          order.label,
        ].filter(Boolean);

        return {
          source: `Employee search${parts.length ? `: ${parts.join(', ')}` : ''}`,
          data: {
            totalMatches: page.total,
            showing: page.items.length,
            items: page.items.map((e) => ({
              name: `${e.firstName} ${e.lastName}`,
              employeeCode: e.employeeCode,
              jobTitle: e.jobTitle,
              department: e.department,
              level: e.level,
              country: countryLabel(e.country),
              status: e.status,
              hireDate: e.hireDate,
              salary: money(e.salaryMinor, e.currency),
              salaryUsdApprox: money(e.salaryUsdMinor, 'USD'),
            })),
            usdNote: USD_NOTE,
          },
        };
      },
    }),
  ];

  return {
    definitions: tools.map(({ name, description, parameters }): ToolDefinition => ({
      name,
      description,
      parameters,
    })),

    /** Runs the tool the model asked for. A mistake by the model comes back as an error it can correct. */
    run(name: string, rawArguments: string): ToolResult {
      const tool = tools.find((t) => t.name === name);
      if (!tool) {
        return fail(
          `Unknown tool "${name}". The tools are: ${tools.map((t) => t.name).join(', ')}.`,
        );
      }

      let input: unknown;
      try {
        // Some models send an empty string for a tool that takes no arguments.
        input = JSON.parse(rawArguments.trim() === '' ? '{}' : rawArguments);
      } catch {
        return fail('The arguments were not valid JSON.');
      }
      return tool.run(input);
    },
  };
}

export type AssistantTools = ReturnType<typeof createAssistantTools>;

/** How each sort choice maps onto the employee list, and how it reads in the source label. */
const SORTS = {
  name: { query: { sort: 'name', order: 'asc' }, label: undefined },
  salary_desc: { query: { sort: 'salary', order: 'desc' }, label: 'highest paid first' },
  salary_asc: { query: { sort: 'salary', order: 'asc' }, label: 'lowest paid first' },
  hire_date_newest: { query: { sort: 'hireDate', order: 'desc' }, label: 'newest hires first' },
  hire_date_oldest: { query: { sort: 'hireDate', order: 'asc' }, label: 'oldest hires first' },
} as const;

function fail(message: string): ToolResult {
  return { content: JSON.stringify({ error: message }), isError: true };
}

/**
 * Models are loose with arguments: "India" for "IN", "engineering" for "Engineering",
 * "" for "not set". Tidy those up before the strict check, so a harmless slip does not cost a
 * round trip to the provider.
 */
function normalizeArguments(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return input;

  const tidy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === '' || value === null) continue;
    tidy[key] = typeof value === 'string' ? value.trim() : value;
  }

  if (typeof tidy.country === 'string') {
    const wanted = tidy.country.toLowerCase();
    const match = COUNTRY_CODES.find(
      (code) => code.toLowerCase() === wanted || COUNTRIES[code].name.toLowerCase() === wanted,
    );
    if (match) tidy.country = match;
  }
  if (typeof tidy.department === 'string') {
    const wanted = tidy.department.toLowerCase();
    tidy.department = DEPARTMENTS.find((d) => d.toLowerCase() === wanted) ?? tidy.department;
  }
  if (typeof tidy.level === 'string') tidy.level = tidy.level.toUpperCase();
  for (const key of ['direction', 'status', 'sort', 'groupBy']) {
    if (typeof tidy[key] === 'string') tidy[key] = tidy[key].toLowerCase();
  }
  return tidy;
}
