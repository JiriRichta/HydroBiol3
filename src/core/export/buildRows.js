// Resolves each export column's value from a measurement, with no
// judgment calls (validateExport.js decides pass/fail). Pure data shaping.

function resolveCell(measurement, column) {
  const { source } = column;
  if (source === 'sampleNumber') {
    return { value: measurement.sampleNumber ?? null, unit: null, invalid: false };
  }
  if (source.startsWith('field:')) {
    const name = source.slice('field:'.length);
    return { value: measurement[name] ?? null, unit: null, invalid: false };
  }
  if (source.startsWith('param:')) {
    const key = source.slice('param:'.length);
    const param = measurement.parameters[key];
    if (!param) return { value: null, unit: null, invalid: false };
    return { value: param.value, unit: param.unit, invalid: Boolean(param.invalid) };
  }
  if (source.startsWith('supp:')) {
    const key = source.slice('supp:'.length);
    return { value: measurement.supplementary?.[key] ?? null, unit: null, invalid: false };
  }
  throw new Error(`Unknown export column source "${source}"`);
}

/**
 * @param {object} profile  from export/profiles.js
 * @param {object[]} measurementsInOrder  Working Set snapshots in stable workingOrder
 * @returns {{ header: string|null, type: string, column: object, value: *, unit: string|null, invalid: boolean }[][]}
 *   one array of cells per measurement, in the same order as the columns
 */
export function buildExportRows(profile, measurementsInOrder) {
  return measurementsInOrder.map((measurement) => ({
    measurementId: measurement.measurementId,
    cells: profile.columns.map((column) => ({
      column,
      ...resolveCell(measurement, column)
    }))
  }));
}
