import { describe, it, expect } from 'vitest';
import { resetIdCounterForTests, nextMeasurementId } from '../../src/core/ids.js';
import {
  createImportedMeasurement,
  createManualMeasurement,
  deepFreezeMeasurement,
  cloneMeasurementSnapshot
} from '../../src/core/model/measurement.js';
import { normalizeUnitToken } from '../../src/core/registry/parameters.js';

describe('measurement ids (DATA-04)', () => {
  it('are unique and never reused within a session', () => {
    resetIdCounterForTests(0);
    const ids = new Set();
    for (let i = 0; i < 100; i += 1) ids.add(nextMeasurementId());
    expect(ids.size).toBe(100);
  });

  it('never reflect row position — they are plain opaque tokens', () => {
    resetIdCounterForTests(0);
    const id = nextMeasurementId();
    expect(id).toMatch(/^M\d{6}$/);
  });
});

describe('deepFreezeMeasurement (DATA-02)', () => {
  it('prevents mutation of top-level and nested fields', () => {
    const m = createImportedMeasurement({ date: '2026-01-01', parameters: { ph: { value: 7, unit: 'pH', raw: '7' } } });
    deepFreezeMeasurement(m);
    expect(() => {
      m.date = '2099-01-01';
    }).toThrow();
    expect(() => {
      m.parameters.ph.value = 99;
    }).toThrow();
    expect(m.date).toBe('2026-01-01');
    expect(m.parameters.ph.value).toBe(7);
  });
});

describe('cloneMeasurementSnapshot (DATA-03)', () => {
  it('produces an independent deep copy that keeps the same measurementId', () => {
    const m = createImportedMeasurement({ date: '2026-01-01', parameters: { ph: { value: 7, unit: 'pH', raw: '7' } } });
    deepFreezeMeasurement(m);
    const snapshot = cloneMeasurementSnapshot(m);
    expect(snapshot.measurementId).toBe(m.measurementId);
    expect(snapshot).not.toBe(m);
    expect(snapshot.parameters).not.toBe(m.parameters);

    // Mutating the snapshot must never affect the frozen source record.
    snapshot.parameters.ph.value = 8.5;
    snapshot.supplementary.transparency_m = 1.2;
    expect(m.parameters.ph.value).toBe(7);
    expect(m.supplementary.transparency_m).toBeNull();
  });

  it('manual measurements start fully blank and editable', () => {
    const m = createManualMeasurement();
    expect(m.originType).toBe('manual');
    expect(m.date).toBeNull();
    expect(m.parameters).toEqual({});
  });
});

describe('normalizeUnitToken', () => {
  it('treats µ, μ and u spellings of micro- as equal', () => {
    expect(normalizeUnitToken('µS/cm')).toBe(normalizeUnitToken('μS/cm'));
    expect(normalizeUnitToken('uS/cm')).toBe(normalizeUnitToken('µS/cm'));
  });

  it('is case/space-insensitive for common unit spellings', () => {
    expect(normalizeUnitToken('mg/l')).toBe('mg/L');
    expect(normalizeUnitToken('NTU')).toBe('NTU');
  });

  it('returns null for empty/missing input', () => {
    expect(normalizeUnitToken(null)).toBeNull();
    expect(normalizeUnitToken('')).toBeNull();
  });
});
