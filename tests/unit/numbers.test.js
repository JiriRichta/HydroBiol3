import { describe, it, expect } from 'vitest';
import { parseNumber } from '../../src/core/import/numbers.js';

describe('parseNumber', () => {
  it('treats empty string as empty, not zero (IMP-07)', () => {
    const r = parseNumber('');
    expect(r.empty).toBe(true);
    expect(r.value).toBeNull();
    expect(r.invalid).toBe(false);
  });

  it('treats null/undefined as empty', () => {
    expect(parseNumber(null).empty).toBe(true);
    expect(parseNumber(undefined).empty).toBe(true);
  });

  it('parses a plain dot-decimal number', () => {
    const r = parseNumber('261.6');
    expect(r.value).toBe(261.6);
    expect(r.invalid).toBe(false);
    expect(r.empty).toBe(false);
  });

  it('parses a comma-decimal number when decimalSeparator is comma', () => {
    const r = parseNumber('7,39', { decimalSeparator: ',' });
    expect(r.value).toBeCloseTo(7.39);
  });

  it('parses negative numbers and scientific notation', () => {
    expect(parseNumber('-8.5000000000000006E-2').value).toBeCloseTo(-0.085);
    expect(parseNumber('-0.006').value).toBe(-0.006);
  });

  it('flags unparsable text as invalid, never coerced to 0', () => {
    const r = parseNumber('N/A');
    expect(r.invalid).toBe(true);
    expect(r.value).toBeNull();
    expect(r.empty).toBe(false);
  });

  it('flags a bare "0" as a real, valid zero (distinct from empty)', () => {
    const r = parseNumber('0');
    expect(r.value).toBe(0);
    expect(r.invalid).toBe(false);
    expect(r.empty).toBe(false);
  });
});
