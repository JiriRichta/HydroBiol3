// Mixed-sample calculation (SPEC §6 MIX-01..04, plan rev.2 §7a).
//
// pH is aggregated through H+ concentration, never by averaging the pH
// numbers directly:
//
//   pH_mix = -log10( (1/n) * sum(10^(-pH_i)) )
//
// Both pH and plain-mean aggregation share one rule for what counts:
//   - missing (parameter absent or value === null): excluded silently, not
//     counted in n, no warning (a legitimately absent reading).
//   - invalid (flagged invalid, NaN or ±Infinity): excluded, not counted in
//     n, but reported as a warning with the source measurement's id.
//   - n === 0 after exclusions: result stays null (never 0).
//   - n === 1: result is exactly that one value (no averaging artifact).

import { createCalculatedMeasurement } from '../model/measurement.js';
import { getAggregation, PARAMETERS } from '../registry/parameters.js';

function collectCandidates(measurements, key) {
  return measurements.map((m) => {
    const param = m.parameters[key];
    if (!param || param.value === null || param.value === undefined) {
      return { measurementId: m.measurementId, status: 'missing' };
    }
    if (param.invalid || typeof param.value !== 'number' || !Number.isFinite(param.value)) {
      return { measurementId: m.measurementId, status: 'invalid', value: param.value, unit: param.unit };
    }
    return { measurementId: m.measurementId, status: 'valid', value: param.value, unit: param.unit };
  });
}

function checkUnitCompatibility(candidates) {
  const units = new Set(candidates.filter((c) => c.status === 'valid').map((c) => c.unit));
  return units.size <= 1;
}

/** pH_mix = -log10(mean(10^-pH_i)) over valid values only. */
export function aggregatePhHplus(candidates) {
  const valid = candidates.filter((c) => c.status === 'valid');
  const excluded = candidates.filter((c) => c.status === 'invalid').map((c) => c.measurementId);
  if (valid.length === 0) return { value: null, n: 0, excluded };
  const meanH = valid.reduce((sum, c) => sum + 10 ** -c.value, 0) / valid.length;
  const value = -Math.log10(meanH);
  return { value, n: valid.length, excluded };
}

/** Simple arithmetic mean over valid values only, same exclusion rules as pH. */
export function aggregateMean(candidates) {
  const valid = candidates.filter((c) => c.status === 'valid');
  const excluded = candidates.filter((c) => c.status === 'invalid').map((c) => c.measurementId);
  if (valid.length === 0) return { value: null, n: 0, excluded };
  const value = valid.reduce((sum, c) => sum + c.value, 0) / valid.length;
  return { value, n: valid.length, excluded };
}

/**
 * Builds a new calculated mixed-sample measurement from >=2 Working Set
 * snapshots, given in stable workingOrder (MIX-02: Time comes from the
 * first one in that order, never from the currently displayed sort).
 *
 * @returns {{ ok:true, measurement:object, warnings:object[] } | { ok:false, error:object }}
 */
export function createMixedSample(measurementsInWorkingOrder) {
  if (!Array.isArray(measurementsInWorkingOrder) || measurementsInWorkingOrder.length < 2) {
    return { ok: false, error: { code: 'MIX_NEEDS_AT_LEAST_TWO', message: 'Pro směsný vzorek je třeba vybrat alespoň dvě měření.' } };
  }

  const dates = new Set(measurementsInWorkingOrder.map((m) => m.date));
  const sites = new Set(measurementsInWorkingOrder.map((m) => m.site));
  if (dates.size > 1) {
    return { ok: false, error: { code: 'MIX_DATE_MISMATCH', message: `Vybraná měření mají různé datum (${Array.from(dates).join(', ')}). Opravte je a zkuste znovu.` } };
  }
  if (sites.size > 1) {
    return { ok: false, error: { code: 'MIX_SITE_MISMATCH', message: `Vybraná měření mají různou lokalitu (${Array.from(sites).join(', ')}). Opravte je a zkuste znovu.` } };
  }

  const warnings = [];
  const parameters = {};
  const methods = {};
  const counts = {};
  const excludedByKey = {};

  Object.keys(PARAMETERS).forEach((key) => {
    const aggregation = getAggregation(key);
    if (aggregation === 'none') return; // MIX-03: never averaged (e.g. depth, ph_mv, orp handled explicitly below is 'mean' though)

    const candidates = collectCandidates(measurementsInWorkingOrder, key);
    const hasAnyData = candidates.some((c) => c.status !== 'missing');
    if (!hasAnyData) return; // nothing to aggregate, leave parameter absent entirely

    if (!checkUnitCompatibility(candidates)) {
      warnings.push({
        code: 'MIX_INCOMPATIBLE_UNITS',
        severity: 'warning',
        field: key,
        message: `Parametr "${key}" má u vybraných měření nekompatibilní jednotky — hodnota ve směsném vzorku zůstává prázdná.`
      });
      return;
    }

    const result = aggregation === 'ph_hplus' ? aggregatePhHplus(candidates) : aggregateMean(candidates);
    methods[key] = aggregation;
    counts[key] = result.n;
    if (result.excluded.length > 0) {
      excludedByKey[key] = result.excluded;
      warnings.push({
        code: 'MIX_INVALID_VALUES_EXCLUDED',
        severity: 'warning',
        field: key,
        message: `U parametru "${key}" bylo ${result.excluded.length} neplatných hodnot vyloučeno z agregace (ID: ${result.excluded.join(', ')}).`
      });
    }
    if (result.value !== null) {
      const unit = PARAMETERS[key].unitConvertible
        ? candidates.find((c) => c.status === 'valid')?.unit ?? PARAMETERS[key].unit
        : PARAMETERS[key].unit;
      parameters[key] = { value: result.value, unit, raw: null, sourceColumn: null, sensorId: null };
    }
  });

  const first = measurementsInWorkingOrder[0];
  const measurement = createCalculatedMeasurement({
    date: first.date,
    time: first.time, // MIX-02: from the first measurement in stable workingOrder
    site: first.site,
    sampleNumber: null, // MIX-03: never computed
    annotation: null,
    description: 'agregovaný směsný vzorek (průměr přes H⁺ pro pH)',
    device: null,
    parameters,
    supplementary: { air_temperature_c: null, transparency_m: null, flow: null },
    extraParameters: {},
    originalRaw: {},
    calculation: {
      sourceMeasurementIds: measurementsInWorkingOrder.map((m) => m.measurementId),
      methods,
      counts,
      excluded: excludedByKey
    }
  });

  return { ok: true, measurement, warnings };
}
