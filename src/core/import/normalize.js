// Converts a raw adapter result into normalized Measurement drafts
// (SPEC §3.3, IMP-04, VAL-06).
//
// This is the single place that enforces the sensor-collision rule shared
// by every adapter: if two source columns report a non-empty value for the
// same canonical parameter on the same row, the entire file is rejected —
// never silently prioritized, averaged, or partially imported.

import { createImportedMeasurement } from '../model/measurement.js';

function isPopulated(raw) {
  return raw !== null && raw !== undefined && String(raw).trim() !== '';
}

/**
 * @param {object} adapterResult { format, encoding, fileErrors, rows }
 * @param {{ fileName: string, importId: string, fingerprint: string }} ctx
 * @returns {{ importable: boolean, measurements: object[], fileErrors: object[], rowDiagnostics: object[] }}
 */
export function normalizeAdapterResult(adapterResult, ctx) {
  const { format, encoding, fileErrors, rows } = adapterResult;
  const { fileName, importId, fingerprint } = ctx;

  if (fileErrors && fileErrors.length > 0) {
    return { importable: false, measurements: [], fileErrors, rowDiagnostics: [], format, encoding };
  }

  // Pass 1: detect sensor collisions across the whole file before creating
  // anything (VAL-06 — a fatal structural problem must not add partial data).
  const collisionErrors = [];
  rows.forEach((row) => {
    const byKey = new Map();
    row.cells.forEach((cell) => {
      if (!byKey.has(cell.key)) byKey.set(cell.key, []);
      byKey.get(cell.key).push(cell);
    });
    byKey.forEach((cellsForKey, key) => {
      const populated = cellsForKey.filter((c) => isPopulated(c.raw));
      if (populated.length > 1) {
        const detail = populated.map((c) => `${c.sourceColumn}=${c.raw}`).join(', ');
        collisionErrors.push({
          code: 'SENSOR_COLLISION',
          message: `Kolize senzorů pro parametr "${key}" (${row.sourceRow}): ${detail}. Import souboru ${fileName} byl odmítnut jako celek.`
        });
      }
    });
  });

  if (collisionErrors.length > 0) {
    return { importable: false, measurements: [], fileErrors: collisionErrors, rowDiagnostics: [], format, encoding };
  }

  // Pass 2: build one Measurement per row.
  const measurements = [];
  const rowDiagnostics = [];

  rows.forEach((row, index) => {
    const parameters = {};
    row.cells.forEach((cell) => {
      if (!isPopulated(cell.raw)) return;
      parameters[cell.key] = {
        value: cell.value,
        unit: cell.unit,
        raw: cell.raw,
        sourceColumn: cell.sourceColumn,
        sensorId: cell.sensorId ?? null,
        ...(cell.invalid ? { invalid: true } : {})
      };
      if (cell.invalid) {
        rowDiagnostics.push({
          code: 'VALUE_INVALID',
          severity: 'error',
          field: cell.key,
          message: `Neplatná číselná hodnota "${cell.raw}" pro ${cell.key} (${row.sourceRow}).`
        });
      }
    });

    const extraParameters = {};
    row.extra.forEach((entry) => {
      if (!isPopulated(entry.raw)) return;
      extraParameters[entry.sourceColumn] = { value: null, raw: entry.raw, unit: entry.unit ?? null };
    });

    const measurement = createImportedMeasurement({
      date: row.date,
      time: row.time,
      site: row.site,
      sampleNumber: row.sampleNumber,
      annotation: row.annotation,
      device: row.device,
      parameters,
      extraParameters,
      originalRaw: row.originalRaw ?? {},
      source: {
        importId,
        fileName,
        format,
        fingerprint,
        encoding,
        sourceRow: row.sourceRow,
        originalOrder: index,
        sensorIds: row.sensorIds ?? {},
        transformations: [],
        options: {},
        importIssues: row.rowIssues ?? []
      }
    });

    measurements.push(measurement);
    (row.rowIssues ?? []).forEach((issue) => {
      rowDiagnostics.push({ ...issue, measurementId: measurement.measurementId });
    });
  });

  return { importable: true, measurements, fileErrors: [], rowDiagnostics, format, encoding };
}
