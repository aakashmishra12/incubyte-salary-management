import type { EmployeeDraft } from '../domain/employee.ts';
import { toMinorUnits } from '../domain/money.ts';
import {
  COUNTRIES,
  CURRENCIES,
  type CountryCode,
  type CurrencyCode,
  type Department,
  type Level,
} from '../domain/reference.ts';
import { createRandom, type Random } from './random.ts';

export interface GenerateOptions {
  count: number;
  seed: number;
}

// How the 10,000 people are spread. The numbers are relative weights, not percentages.
const COUNTRY_WEIGHTS: Record<CountryCode, number> = {
  US: 30,
  IN: 28,
  GB: 10,
  DE: 8,
  CA: 7,
  AU: 6,
  SG: 6,
  JP: 5,
};

const DEPARTMENT_WEIGHTS: Record<Department, number> = {
  Engineering: 35,
  Sales: 15,
  'Customer Support': 14,
  Product: 8,
  Marketing: 8,
  Finance: 7,
  People: 7,
  Design: 6,
};

// A pyramid: many junior people, few directors.
const LEVEL_WEIGHTS: Record<Level, number> = { L1: 22, L2: 30, L3: 25, L4: 13, L5: 7, L6: 3 };

// The typical salary is built from three parts: level, department and country.
const BASE_USD_BY_LEVEL: Record<Level, number> = {
  L1: 55_000,
  L2: 75_000,
  L3: 100_000,
  L4: 130_000,
  L5: 165_000,
  L6: 210_000,
};

const DEPARTMENT_PAY_FACTOR: Record<Department, number> = {
  Engineering: 1.15,
  Product: 1.1,
  Design: 1.0,
  Sales: 0.95,
  Finance: 0.95,
  Marketing: 0.9,
  People: 0.85,
  'Customer Support': 0.75,
};

const COUNTRY_PAY_FACTOR: Record<CountryCode, number> = {
  US: 1.0,
  AU: 0.85,
  SG: 0.85,
  DE: 0.82,
  CA: 0.82,
  GB: 0.8,
  JP: 0.7,
  IN: 0.28,
};

// Salaries are round figures. Nobody is paid 84,317.52 a year.
const ROUND_TO: Record<CurrencyCode, number> = {
  USD: 500,
  GBP: 500,
  EUR: 500,
  CAD: 500,
  AUD: 500,
  SGD: 500,
  INR: 10_000,
  JPY: 50_000,
};

const ROLE_BY_DEPARTMENT: Record<Department, string> = {
  Engineering: 'Software Engineer',
  Product: 'Product Manager',
  Design: 'Product Designer',
  Sales: 'Account Executive',
  Marketing: 'Marketing Specialist',
  'Customer Support': 'Support Specialist',
  Finance: 'Financial Analyst',
  People: 'People Partner',
};

const TITLE_PREFIX: Record<Exclude<Level, 'L6'>, string> = {
  L1: 'Associate ',
  L2: '',
  L3: 'Senior ',
  L4: 'Lead ',
  L5: 'Principal ',
};

// prettier-ignore
const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Aiko', 'Akira', 'Alice', 'Amelia', 'Ananya', 'Arjun', 'Ava', 'Ben',
  'Charlotte', 'Chloe', 'Daniel', 'Deepak', 'Divya', 'Elena', 'Emily', 'Emma', 'Ethan', 'Felix',
  'Grace', 'Hana', 'Hannah', 'Haruto', 'Isabella', 'Ishaan', 'Jack', 'James', 'Jonas', 'Kavya',
  'Kenji', 'Lena', 'Leon', 'Liam', 'Lucas', 'Mei', 'Mia', 'Meera', 'Noah', 'Oliver',
  'Olivia', 'Priya', 'Rahul', 'Riya', 'Rohan', 'Sakura', 'Sanjay', 'Sofia', 'Sophie', 'Tara',
  'Thomas', 'Vikram', 'Wei', 'William', 'Xin', 'Yuki', 'Zara', 'Zoe', 'Neha', 'Lukas',
] as const;

// prettier-ignore
const LAST_NAMES = [
  'Agarwal', 'Anderson', 'Bauer', 'Brown', 'Campbell', 'Chen', 'Clark', 'Das', 'Davies', 'Desai',
  'Evans', 'Fischer', 'Garcia', 'Gupta', 'Hall', 'Harris', 'Hoffmann', 'Iyer', 'Jackson', 'Johnson',
  'Jones', 'Joshi', 'Kapoor', 'Kato', 'Khan', 'Kim', 'Kumar', 'Lee', 'Lim', 'Martin',
  'Mehta', 'Miller', 'Mishra', 'Moore', 'Nair', 'Nakamura', 'Ng', 'Patel', 'Rao', 'Reddy',
  'Roberts', 'Sato', 'Schmidt', 'Schneider', 'Shah', 'Sharma', 'Singh', 'Smith', 'Suzuki', 'Tan',
  'Tanaka', 'Taylor', 'Thomas', 'Verma', 'Wagner', 'Walker', 'Weber', 'White', 'Wilson', 'Wong',
] as const;

const FIRST_HIRE_DAY = Date.UTC(2012, 0, 1);
const LAST_HIRE_DAY = Date.UTC(2026, 9, 31);
const ONE_DAY = 24 * 60 * 60 * 1000;

// About 3 in 100 people are paid well outside their group, half low and half high.
const OUTLIER_CHANCE = 0.03;
// About 4 in 100 people have left the company.
const LEFT_CHANCE = 0.04;

/**
 * Builds a list of made-up employees. The same options always give the same list,
 * because every random choice comes from a generator started with the seed.
 */
export function generateEmployees({ count, seed }: GenerateOptions): EmployeeDraft[] {
  const random = createRandom(seed);
  const timesNameUsed = new Map<string, number>();
  const employees: EmployeeDraft[] = [];

  for (let number = 1; number <= count; number++) {
    const firstName = random.pick(FIRST_NAMES);
    const lastName = random.pick(LAST_NAMES);
    const country = random.weighted(COUNTRY_WEIGHTS);
    const department = random.weighted(DEPARTMENT_WEIGHTS);
    const level = random.weighted(LEVEL_WEIGHTS);
    const currency = COUNTRIES[country].currency;

    const hireDay = randomDay(random, FIRST_HIRE_DAY, LAST_HIRE_DAY);
    const hasLeft = random.next() < LEFT_CHANCE;
    const leftDay = hasLeft ? randomDay(random, hireDay, LAST_HIRE_DAY) : null;

    employees.push({
      employeeCode: `E${String(number).padStart(5, '0')}`,
      firstName,
      lastName,
      email: uniqueEmail(firstName, lastName, timesNameUsed),
      country,
      department,
      level,
      jobTitle: jobTitle(department, level),
      hireDate: toIsoDate(hireDay),
      status: hasLeft ? 'left' : 'active',
      leftOn: leftDay === null ? null : toIsoDate(leftDay),
      currency,
      salaryMinor: salaryFor(random, country, department, level, currency),
    });
  }

  return employees;
}

function salaryFor(
  random: Random,
  country: CountryCode,
  department: Department,
  level: Level,
  currency: CurrencyCode,
): number {
  const typicalUsd =
    BASE_USD_BY_LEVEL[level] * DEPARTMENT_PAY_FACTOR[department] * COUNTRY_PAY_FACTOR[country];

  // Adding two random numbers gives a bell-like spread: most people near the middle.
  // The result runs from -12% to +12%.
  let factor = 1 + (random.next() + random.next() - 1) * 0.12;

  if (random.next() < OUTLIER_CHANCE) {
    const paidLow = random.next() < 0.5;
    factor = paidLow ? 0.55 + random.next() * 0.2 : 1.3 + random.next() * 0.3;
  }

  const inLocalCurrency = (typicalUsd * factor) / CURRENCIES[currency].usdRate;
  const step = ROUND_TO[currency];
  const rounded = Math.max(step, Math.round(inLocalCurrency / step) * step);
  return toMinorUnits(rounded, currency);
}

function jobTitle(department: Department, level: Level): string {
  if (level === 'L6') return `Director of ${department}`;
  return `${TITLE_PREFIX[level]}${ROLE_BY_DEPARTMENT[department]}`;
}

/** asha.rao@acme.example for the first Asha Rao, asha.rao2@acme.example for the second. */
function uniqueEmail(firstName: string, lastName: string, timesUsed: Map<string, number>): string {
  const name = `${firstName}.${lastName}`.toLowerCase();
  const times = (timesUsed.get(name) ?? 0) + 1;
  timesUsed.set(name, times);
  return `${name}${times === 1 ? '' : times}@acme.example`;
}

function randomDay(random: Random, from: number, to: number): number {
  return from + random.int(0, Math.floor((to - from) / ONE_DAY)) * ONE_DAY;
}

function toIsoDate(day: number): string {
  return new Date(day).toISOString().slice(0, 10);
}
