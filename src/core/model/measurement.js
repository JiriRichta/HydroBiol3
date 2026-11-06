// Measurement factory and snapshot helpers (SPEC §2, "Logical model").
//
// A Measurement is a fully self-contained unit: every value and every piece
// of metadata it needs lives on the record itself (DATA-01). Records in the
// Data tab are deep-frozen so they can never be mutated in place (DATA-02);
// Working Set snapshots are independent deep clones (DATA-03).

import { nextMeasurementId } from '../ids.js';

/**
 * @typedef {Object} ParamValue
 * @property {number|null} value   - parsed numeric value, or null if missing/invalid
 * @property {string} unit         - current display unit of `value`
 * @property {string} raw          - original textual value exactly as read
 * @property {string} [sourceColumn]
 * @property {string|null} [sensorId]
 * @property {boolean} [invalid]   - true if the raw text could not be parsed as a number
 */

function baseShape() {
  return {
    measurementId: nextMeasurementId(),
    originType: 'imported', // 'imported' | 'manual' | 'calculated'
    source: null,
    date: null, // 'YYYY-MM-DD' or null — local calendar date, never UTC-shifted
    time: null, // 'HH:MM:SS' or null
    site: null,
    sampleNumber: null, // string; never coerced to number
    annotation: null, // original immutable text (e.g. EUREKA Annotation)
    description: null,
    device: null,
    parameters: {}, // canonicalKey -> ParamValue
    supplementary: {
      air_temperature_c: null,
      transparency_m: null,
      flow: null
    },
    extraParameters: {}, // rawHeader -> { value, raw, unit }
    originalRaw: {}, // read-only audit payload
    calculation: null,
    addedToWorkingSetAt: null // used only for the "already in Working Set" Data-tab badge
  };
}

/** Creates a new measurement that came from an import adapter. */
export function createImportedMeasurement(fields) {
  const m = baseShape();
  Object.assign(m, fields, { originType: 'imported' });
  return m;
}

/** Creates a blank, fully user-editable manual measurement (DATA-07). */
export function createManualMeasurement({ insertedByUser = true } = {}) {
  const m = baseShape();
  m.originType = 'manual';
  m.source = { importId: null, insertedByUser };
  return m;
}

/** Creates a calculated (mixed-sample) measurement (DATA-07, MIX-04). */
export function createCalculatedMeasurement(fields) {
  const m = baseShape();
  Object.assign(m, fields, { originType: 'calculated' });
  return m;
}

/**
 * Recursively freezes a measurement so the Data tab can never be mutated
 * in place (DATA-02). Returns the same object for chaining.
 */
export function deepFreezeMeasurement(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.getOwnPropertyNames(value).forEach((key) => {
    deepFreezeMeasurement(value[key]);
  });
  return Object.freeze(value);
}

/**
 * Produces an independent deep snapshot of a measurement, preserving its
 * measurementId (DATA-03/DATA-04). Safe to call on a frozen source record.
 */
export function cloneMeasurementSnapshot(measurement) {
  return structuredClone(measurement);
}
