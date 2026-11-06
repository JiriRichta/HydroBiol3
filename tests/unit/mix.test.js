import { describe, it, expect } from 'vitest';
import { aggregatePhHplus, aggregateMean, createMixedSample } from '../../src/core/calc/mix.js';
import { createImportedMeasurement, deepFreezeMeasurement } from '../../src/core/model/measurement.js';
import { resetIdCounterForTests } from '../../src/core/ids.js';

function candidate(value, status = 'valid', unit = 'pH') {
  return { measurementId: 'x', status, value, unit };
}

describe('aggregatePhHplus — AT-15, plan §7a', () => {
  it('pH 7 and 8 average to ~7.259637310505756, never the arithmetic 7.5', () => {
    const r = aggregatePhHplus([candidate(7), candidate(8)]);
    expect(r.value).toBeCloseTo(7.259637310505756, 12);
    expect(r.value).not.toBeCloseTo(7.5, 1);
    expect(r.n).toBe(2);
  });

  it('matches independently computed references for 3- and 2-value mixes', () => {
    expect(aggregatePhHplus([candidate(6), candidate(7), candidate(8)]).value).toBeCloseTo(6.431798275933005, 12);
    expect(aggregatePhHplus([candidate(6.5), candidate(8.5)]).value).toBeCloseTo(6.796708621881339, 12);
  });

  it('invariant: n identical pH values average to that same pH', () => {
    const r = aggregatePhHplus([candidate(7.4), candidate(7.4), candidate(7.4)]);
    expect(r.value).toBeCloseTo(7.4, 12);
  });

  it('invariant: a single value returns itself with n=1 (property-style spot checks)', () => {
    for (const v of [0, 3.2, 7, 9.99, 13.5]) {
      const r = aggregatePhHplus([candidate(v)]);
      expect(r.value).toBeCloseTo(v, 10);
      expect(r.n).toBe(1);
    }
  });

  it('missing values are excluded silently (not counted, no warning)', () => {
    const r = aggregatePhHplus([candidate(7), { measurementId: 'm', status: 'missing' }, candidate(8)]);
    expect(r.value).toBeCloseTo(7.259637310505756, 12);
    expect(r.n).toBe(2);
    expect(r.excluded).toEqual([]);
  });

  it('invalid values are excluded but reported with their measurementId', () => {
    const r = aggregatePhHplus([candidate(7), { measurementId: 'bad1', status: 'invalid', value: NaN }, candidate(8)]);
    expect(r.value).toBeCloseTo(7.259637310505756, 12);
    expect(r.n).toBe(2);
    expect(r.excluded).toEqual(['bad1']);
  });

  it('returns null (not 0) when nothing valid remains', () => {
    const r = aggregatePhHplus([{ measurementId: 'a', status: 'missing' }, { measurementId: 'b', status: 'invalid', value: NaN }]);
    expect(r.value).toBeNull();
    expect(r.n).toBe(0);
  });
});

describe('aggregateMean — same exclusion rules as pH', () => {
  it('averages valid values only', () => {
    const r = aggregateMean([candidate(10, 'valid', '°C'), candidate(20, 'valid', '°C'), { measurementId: 'm', status: 'missing' }]);
    expect(r.value).toBe(15);
    expect(r.n).toBe(2);
  });
});

describe('createMixedSample — MIX-01..04, AT-15/AT-16', () => {
  function seedMeasurement(fields) {
    const m = createImportedMeasurement(fields);
    deepFreezeMeasurement(m);
    return m;
  }

  it('requires at least two measurements', () => {
    resetIdCounterForTests(0);
    const m1 = seedMeasurement({ date: '2026-01-01', site: 'A' });
    expect(createMixedSample([m1]).ok).toBe(false);
  });

  it('stops with a clear error when Date differs', () => {
    resetIdCounterForTests(0);
    const m1 = seedMeasurement({ date: '2026-01-01', site: 'A' });
    const m2 = seedMeasurement({ date: '2026-01-02', site: 'A' });
    const res = createMixedSample([m1, m2]);
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('MIX_DATE_MISMATCH');
  });

  it('stops with a clear error when Site differs', () => {
    resetIdCounterForTests(0);
    const m1 = seedMeasurement({ date: '2026-01-01', site: 'A' });
    const m2 = seedMeasurement({ date: '2026-01-01', site: 'B' });
    const res = createMixedSample([m1, m2]);
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe('MIX_SITE_MISMATCH');
  });

  it('AT-15: aggregates pH through H+, averages other measured params, takes Time from the first in stable order', () => {
    resetIdCounterForTests(0);
    const m1 = seedMeasurement({
      date: '2026-01-01',
      time: '09:00:00',
      site: 'A',
      parameters: { ph: { value: 7, unit: 'pH', raw: '7' }, water_temperature: { value: 10, unit: '°C', raw: '10' } }
    });
    const m2 = seedMeasurement({
      date: '2026-01-01',
      time: '10:00:00',
      site: 'A',
      parameters: { ph: { value: 8, unit: 'pH', raw: '8' }, water_temperature: { value: 20, unit: '°C', raw: '20' } }
    });
    const res = createMixedSample([m1, m2]);
    expect(res.ok).toBe(true);
    expect(res.measurement.time).toBe('09:00:00'); // first in stable order, not sorted
    expect(res.measurement.parameters.ph.value).toBeCloseTo(7.259637310505756, 12);
    expect(res.measurement.parameters.water_temperature.value).toBe(15);
    expect(res.measurement.originType).toBe('calculated');
    expect(res.measurement.calculation.sourceMeasurementIds).toEqual([m1.measurementId, m2.measurementId]);
  });

  it('AT-16: Depth and sampleNumber are never computed, left blank', () => {
    resetIdCounterForTests(0);
    const m1 = seedMeasurement({
      date: '2026-01-01',
      site: 'A',
      sampleNumber: '001',
      parameters: { depth: { value: 1, unit: 'm', raw: '1' }, ph: { value: 7, unit: 'pH', raw: '7' } }
    });
    const m2 = seedMeasurement({
      date: '2026-01-01',
      site: 'A',
      sampleNumber: '002',
      parameters: { depth: { value: 2, unit: 'm', raw: '2' }, ph: { value: 8, unit: 'pH', raw: '8' } }
    });
    const res = createMixedSample([m1, m2]);
    expect(res.ok).toBe(true);
    expect(res.measurement.parameters.depth).toBeUndefined();
    expect(res.measurement.sampleNumber).toBeNull();
  });

  it('blocks averaging across incompatible units for the same parameter, with a warning, leaving it blank', () => {
    resetIdCounterForTests(0);
    const m1 = seedMeasurement({ date: '2026-01-01', site: 'A', parameters: { specific_conductance: { value: 30, unit: 'mS/m', raw: '30' } } });
    const m2 = seedMeasurement({ date: '2026-01-01', site: 'A', parameters: { specific_conductance: { value: 300, unit: 'uS/cm', raw: '300' } } });
    const res = createMixedSample([m1, m2]);
    expect(res.ok).toBe(true);
    expect(res.measurement.parameters.specific_conductance).toBeUndefined();
    expect(res.warnings.some((w) => w.code === 'MIX_INCOMPATIBLE_UNITS')).toBe(true);
  });
});
