import { describe, expect, it } from 'vitest';
import type { EmployeeDraft } from '../domain/employee.ts';
import { createEmployeeService } from '../services/employeeService.ts';
import { createInsightService } from '../services/insightService.ts';
import { aDatabaseWith, anEmployee, TEST_NOW } from '../testing/builders.ts';
import { createAssistantTools } from './tools.ts';

function setup(employees: EmployeeDraft[]) {
  const { db, repository } = aDatabaseWith(employees);
  const tools = createAssistantTools({
    employees: createEmployeeService(repository, () => new Date(TEST_NOW)),
    insights: createInsightService(repository),
  });
  const changes = () => (db.prepare('SELECT total_changes() AS n').get() as { n: number }).n;
  return { tools, changes };
}

/** Runs a tool and parses the JSON it sends back to the model. */
function run(tools: ReturnType<typeof setup>['tools'], name: string, args: unknown = {}) {
  const result = tools.run(name, typeof args === 'string' ? args : JSON.stringify(args));
  return { ...result, data: JSON.parse(result.content) };
}

/** Five engineers at the same level in the US: a peer group big enough to be rated. */
const usPeers = (salaries: number[]) =>
  salaries.map((salary) => anEmployee({ salaryMinor: salary * 100, lastName: `P${salary}` }));

describe('tool definitions', () => {
  const { tools } = setup([]);

  it('offers exactly four read-only tools', () => {
    expect(tools.definitions.map((tool) => tool.name)).toEqual([
      'get_overview',
      'get_breakdown',
      'get_outliers',
      'find_employees',
    ]);
  });

  it('describes each tool and its arguments as a JSON Schema object', () => {
    for (const tool of tools.definitions) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters).not.toHaveProperty('$schema');
    }
  });

  it('lists the valid countries, departments and levels so the model can choose among them', () => {
    const breakdown = tools.definitions.find((tool) => tool.name === 'get_breakdown')!;
    const text = JSON.stringify(breakdown);

    expect(text).toContain('"IN"');
    expect(text).toContain('Engineering');
    expect(text).toContain('"L3"');
  });
});

describe('get_overview', () => {
  it('gives headcount and cost with the currency on every amount, and the share each country has', () => {
    const { tools } = setup([
      anEmployee({ salaryMinor: 100_000_00 }),
      anEmployee({ country: 'JP', currency: 'JPY', salaryMinor: 10_000_000 }),
      anEmployee({ status: 'left', leftOn: '2025-01-01' }),
    ]);

    const { data, isError } = run(tools, 'get_overview');

    expect(isError).toBe(false);
    expect(data.activeEmployees).toBe(2);
    expect(data.totalAnnualCostUsd).toBe('USD 167,000');
    expect(data.countries[0]).toMatchObject({
      country: 'United States (US)',
      employees: 1,
      totalAnnualCostLocal: 'USD 100,000',
      shareOfTotalCostPercent: 59.9,
    });
    expect(data.countries[1]).toMatchObject({
      country: 'Japan (JP)',
      totalAnnualCostLocal: 'JPY 10,000,000',
      totalAnnualCostUsd: 'USD 67,000',
    });
    expect(data.usdNote).toContain('approximate');
  });
});

describe('get_breakdown', () => {
  it('summarises each group in its own currency when everyone in it shares one', () => {
    const { tools } = setup([
      anEmployee({ country: 'JP', currency: 'JPY', salaryMinor: 8_000_000 }),
      anEmployee({ country: 'JP', currency: 'JPY', salaryMinor: 10_000_000 }),
    ]);

    const { data } = run(tools, 'get_breakdown', { groupBy: 'country' });

    expect(data.groups).toEqual([
      {
        group: 'Japan (JP)',
        employees: 2,
        lowest: 'JPY 8,000,000',
        median: 'JPY 9,000,000',
        average: 'JPY 9,000,000',
        highest: 'JPY 10,000,000',
        medianUsdApprox: 'USD 60,300',
      },
    ]);
  });

  it('uses USD when a group mixes currencies, and says so', () => {
    const { tools } = setup([
      anEmployee({ level: 'L3', salaryMinor: 100_000_00 }),
      anEmployee({ level: 'L3', country: 'JP', currency: 'JPY', salaryMinor: 10_000_000 }),
    ]);

    const { data } = run(tools, 'get_breakdown', { groupBy: 'level' });

    expect(data.groups[0].median).toBe('USD 83,500');
    expect(data.groups[0].currencyNote).toContain('mixed currencies');
  });

  it('narrows to the filters and repeats them back', () => {
    const { tools } = setup([
      anEmployee({ department: 'Engineering', level: 'L3', salaryMinor: 120_000_00 }),
      anEmployee({ department: 'Sales', level: 'L3', salaryMinor: 60_000_00 }),
    ]);

    const { data } = run(tools, 'get_breakdown', {
      groupBy: 'country',
      department: 'Engineering',
      level: 'L3',
    });

    expect(data.filters).toEqual({ department: 'Engineering', level: 'L3' });
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0].median).toBe('USD 120,000');
  });

  it('accepts a country by name and a department in any case', () => {
    const { tools } = setup([
      anEmployee({
        country: 'JP',
        currency: 'JPY',
        department: 'Engineering',
        salaryMinor: 9_000_000,
      }),
    ]);

    const { data, isError } = run(tools, 'get_breakdown', {
      groupBy: 'level',
      country: 'japan',
      department: 'engineering',
    });

    expect(isError).toBe(false);
    expect(data.filters).toEqual({ country: 'JP', department: 'Engineering' });
    expect(data.groups).toHaveLength(1);
  });

  it('says there is no data instead of returning an empty list silently', () => {
    const { tools } = setup([anEmployee({ country: 'US' })]);

    const { data } = run(tools, 'get_breakdown', { groupBy: 'level', country: 'IN' });

    expect(data.groups).toEqual([]);
    expect(data.message).toContain('No active employees');
  });
});

describe('get_outliers', () => {
  const group = () => [
    ...usPeers([100_000, 100_000, 100_000, 100_000]),
    anEmployee({ salaryMinor: 160_000_00, lastName: 'High' }),
  ];

  it('describes each flagged person with the numbers behind the flag', () => {
    const { tools } = setup(group());

    const { data } = run(tools, 'get_outliers');

    expect(data.totalFlagged).toBe(1);
    expect(data.items).toEqual([
      {
        employee: 'Asha High',
        employeeCode: expect.stringMatching(/^T\d{5}$/),
        country: 'United States (US)',
        department: 'Engineering',
        level: 'L3',
        salary: 'USD 160,000',
        peerMedian: 'USD 100,000',
        compaRatio: 1.6,
        peers: 5,
        flag: 'above',
      },
    ]);
    expect(data.rule).toContain('80%');
    expect(data.rule).toContain('120%');
  });

  it('says how many employees could not be rated', () => {
    const { tools } = setup([...group(), anEmployee({ department: 'Design' })]);

    expect(run(tools, 'get_outliers').data.unratedEmployees).toBe(1);
  });

  it('shows at most the number asked for, and never more than ten', () => {
    // Thirty people at 100,000 make that the median, so the twelve at 300,000 are all flagged.
    const many = [
      ...usPeers(Array.from({ length: 30 }, () => 100_000)),
      ...Array.from({ length: 12 }, () => anEmployee({ salaryMinor: 300_000_00 })),
    ];
    const { tools } = setup(many);

    expect(run(tools, 'get_outliers', { limit: 3 }).data.items).toHaveLength(3);
    expect(run(tools, 'get_outliers', { limit: 3 }).data.totalFlagged).toBe(12);
    expect(run(tools, 'get_outliers', { limit: 50 }).isError).toBe(true);
  });

  it('can show only people paid below their peers', () => {
    const { tools } = setup([...group(), anEmployee({ salaryMinor: 50_000_00, lastName: 'Low' })]);

    const { data } = run(tools, 'get_outliers', { direction: 'below' });

    expect(data.items.map((item: { flag: string }) => item.flag)).toEqual(['below']);
  });
});

describe('find_employees', () => {
  it('finds the highest paid, in order, with amounts as text', () => {
    const { tools } = setup([
      anEmployee({ firstName: 'Low', salaryMinor: 50_000_00 }),
      anEmployee({ firstName: 'Top', salaryMinor: 200_000_00 }),
      anEmployee({ firstName: 'Mid', salaryMinor: 100_000_00 }),
    ]);

    const { data } = run(tools, 'find_employees', { sort: 'salary_desc', limit: 2 });

    expect(data.totalMatches).toBe(3);
    expect(data.items.map((item: { name: string }) => item.name)).toEqual(['Top Rao', 'Mid Rao']);
    expect(data.items[0]).toMatchObject({ salary: 'USD 200,000', status: 'active' });
  });

  it('searches by name and filters by country, and shows the local and USD salary', () => {
    const { tools } = setup([
      anEmployee({
        firstName: 'Kenji',
        lastName: 'Sato',
        country: 'JP',
        currency: 'JPY',
        salaryMinor: 9_000_000,
      }),
      anEmployee({ firstName: 'Kenji', lastName: 'Smith', country: 'US' }),
    ]);

    const { data } = run(tools, 'find_employees', { search: 'kenji', country: 'Japan' });

    expect(data.totalMatches).toBe(1);
    expect(data.items[0]).toMatchObject({
      name: 'Kenji Sato',
      country: 'Japan (JP)',
      salary: 'JPY 9,000,000',
      salaryUsdApprox: 'USD 60,300',
    });
  });

  it('includes people who have left only when asked', () => {
    const { tools } = setup([
      anEmployee({ firstName: 'Gone', status: 'left', leftOn: '2025-01-01' }),
    ]);

    expect(run(tools, 'find_employees', { search: 'gone' }).data.totalMatches).toBe(1);
    expect(
      run(tools, 'find_employees', { search: 'gone', status: 'active' }).data.totalMatches,
    ).toBe(0);
  });

  it('returns at most ten people', () => {
    const { tools } = setup(Array.from({ length: 15 }, () => anEmployee()));

    expect(run(tools, 'find_employees', { limit: 10 }).data.items).toHaveLength(10);
    expect(run(tools, 'find_employees', { limit: 11 }).isError).toBe(true);
  });
});

describe('when the model makes a mistake', () => {
  const { tools } = setup([anEmployee()]);

  it('answers an unknown tool with an error that names the tools that exist', () => {
    const result = run(tools, 'delete_everything');

    expect(result.isError).toBe(true);
    expect(result.data.error).toContain('get_overview');
  });

  it('answers arguments that are not JSON with an error', () => {
    expect(run(tools, 'get_overview', '{ not json').isError).toBe(true);
  });

  it('lists the valid choices when a country is wrong', () => {
    const result = run(tools, 'get_breakdown', { groupBy: 'level', country: 'Atlantis' });

    expect(result.isError).toBe(true);
    expect(result.data.error).toContain('country');
    expect(result.data.error).toContain('IN');
  });

  it('treats empty arguments as no arguments', () => {
    expect(run(tools, 'get_overview', '').isError).toBe(false);
  });
});

describe('what the tools are allowed to do', () => {
  it('never changes any data', () => {
    const { tools, changes } = setup([
      ...usPeers([100, 100, 100, 100, 100]),
      anEmployee({ salaryMinor: 300_000_00 }),
    ]);
    const before = changes();

    for (const name of ['get_overview', 'get_breakdown', 'get_outliers', 'find_employees']) {
      run(tools, name, {});
    }

    expect(changes()).toBe(before);
  });
});

describe('sources', () => {
  const { tools } = setup([anEmployee()]);

  it('describes what each call looked at, so a person can check it', () => {
    expect(run(tools, 'get_overview').source).toBe('Company overview');
    expect(
      run(tools, 'get_breakdown', { groupBy: 'level', country: 'IN', department: 'Engineering' })
        .source,
    ).toBe('Breakdown by level (India, Engineering)');
    expect(run(tools, 'get_outliers', { direction: 'below' }).source).toBe(
      'Pay outliers (below peers)',
    );
    expect(run(tools, 'find_employees', { search: 'rao', sort: 'salary_desc' }).source).toBe(
      'Employee search: "rao", highest paid first',
    );
  });

  it('has no source when the call failed', () => {
    expect(run(tools, 'get_breakdown', { groupBy: 'nonsense' }).source).toBeUndefined();
  });
});
