import { describe, expect, it } from 'vitest';
import { findOutliers } from '../domain/outliers.ts';
import { COUNTRIES, DEPARTMENTS, LEVELS } from '../domain/reference.ts';
import { generateEmployees } from './generateEmployees.ts';

describe('generateEmployees', () => {
  it('produces exactly the number asked for', () => {
    expect(generateEmployees({ count: 250, seed: 1 })).toHaveLength(250);
  });

  it('produces the same employees for the same seed', () => {
    expect(generateEmployees({ count: 200, seed: 7 })).toEqual(
      generateEmployees({ count: 200, seed: 7 }),
    );
  });

  it('produces different employees for a different seed', () => {
    expect(generateEmployees({ count: 200, seed: 7 })).not.toEqual(
      generateEmployees({ count: 200, seed: 8 }),
    );
  });

  describe('with 10,000 employees', () => {
    const employees = generateEmployees({ count: 10_000, seed: 2026 });

    it('gives everyone a unique employee code and email', () => {
      expect(new Set(employees.map((e) => e.employeeCode)).size).toBe(10_000);
      expect(new Set(employees.map((e) => e.email)).size).toBe(10_000);
    });

    it('pays everyone in the currency of their country', () => {
      for (const employee of employees) {
        expect(employee.currency).toBe(COUNTRIES[employee.country].currency);
      }
    });

    it('gives everyone a positive whole-number salary', () => {
      for (const employee of employees) {
        expect(Number.isInteger(employee.salaryMinor)).toBe(true);
        expect(employee.salaryMinor).toBeGreaterThan(0);
      }
    });

    it('covers every country, department and level', () => {
      expect(new Set(employees.map((e) => e.country))).toEqual(new Set(Object.keys(COUNTRIES)));
      expect(new Set(employees.map((e) => e.department))).toEqual(new Set(DEPARTMENTS));
      expect(new Set(employees.map((e) => e.level))).toEqual(new Set(LEVELS));
    });

    it('pays more at higher levels, for the same country and department', () => {
      const medianSalary = (level: string) => {
        const salaries = employees
          .filter((e) => e.country === 'US' && e.department === 'Engineering' && e.level === level)
          .map((e) => e.salaryMinor)
          .sort((a, b) => a - b);
        return salaries[Math.floor(salaries.length / 2)]!;
      };

      expect(medianSalary('L1')).toBeLessThan(medianSalary('L3'));
      expect(medianSalary('L3')).toBeLessThan(medianSalary('L5'));
    });

    it('contains pay outliers in both directions, and they are a small minority', () => {
      const active = employees
        .filter((e) => e.status === 'active')
        .map((e, index) => ({ ...e, id: index }));

      const outliers = findOutliers(active);

      expect(outliers.some((o) => o.direction === 'below')).toBe(true);
      expect(outliers.some((o) => o.direction === 'above')).toBe(true);
      expect(outliers.length).toBeLessThan(active.length * 0.1);
    });

    it('never hires anyone after the day the data was made, which the API would refuse', () => {
      const latest = employees
        .map((e) => e.hireDate)
        .sort()
        .at(-1)!;

      expect(latest <= '2026-11-01').toBe(true);
    });

    it('marks a few people as having left, on or after the day they were hired', () => {
      const left = employees.filter((e) => e.status === 'left');

      expect(left.length).toBeGreaterThan(0);
      expect(left.length).toBeLessThan(1_000);
      for (const employee of left) {
        expect(employee.leftOn! >= employee.hireDate).toBe(true);
      }
      for (const employee of employees.filter((e) => e.status === 'active')) {
        expect(employee.leftOn).toBeNull();
      }
    });
  });
});
