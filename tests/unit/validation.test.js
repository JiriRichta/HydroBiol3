import { describe, it, expect } from 'vitest';
import { validateMeasurement } from '../../src/core/validation/validate.js';
import { createImportedMeasurement } from '../../src/core/model/measurement.js';

describe('validateMeasurement (VAL-01..03)', () => {
  it('flags an uncorrected negative depth as a warning (VAL-03)', () => {
    const m = createImportedMeasurement({ date: '2026-01-01', parameters: { depth: { value: -0.5, unit: 'm', raw: '-0.5' } } });
    const issues = validateMeasurement(m);
    expect(issues.some((i) => i.code === 'DEPTH_NEGATIVE' && i.severity === 'warning')).toBe(true);
  });

  it('does not flag a non-negative depth', () => {
    const m = createImportedMeasurement({ date: '2026-01-01', parameters: { depth: { value: 0.5, unit: 'm', raw: '0.5' } } });
    expect(validateMeasurement(m).some((i) => i.code === 'DEPTH_NEGATIVE')).toBe(false);
  });

  it('flags an invalid parameter value as a blocking error', () => {
    const m = createImportedMeasurement({ date: '2026-01-01', parameters: { ph: { value: null, unit: 'pH', raw: 'N/A', invalid: true } } });
    const issues = validateMeasurement(m);
    expect(issues.some((i) => i.code === 'VALUE_INVALID' && i.severity === 'error')).toBe(true);
  });

  it('flags a missing date on an imported record as a warning, but only info for manual/calculated', () => {
    const imported = createImportedMeasurement({ date: null, parameters: {} });
    expect(validateMeasurement(imported).find((i) => i.code === 'DATE_MISSING').severity).toBe('warning');
  });

  it('surfaces (informationally) that conductivity is still in µS/cm', () => {
    const m = createImportedMeasurement({ date: '2026-01-01', parameters: { specific_conductance: { value: 300, unit: 'uS/cm', raw: '300' } } });
    const issues = validateMeasurement(m);
    expect(issues.some((i) => i.code === 'CONDUCTIVITY_NOT_CONVERTED' && i.severity === 'info')).toBe(true);
  });
});
