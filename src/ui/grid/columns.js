// Shared column definitions for the Data and Working Set grids (SPEC
// §5.2/§5.3). `locked: true` columns are read-only in the grid outside an
// active bulk-edit session (or always, for Data); `locked: false` columns
// (the "doplňkové" fields) are always directly editable in the Working Set.

import { PARAMETERS, SUPPLEMENTARY_FIELDS } from '../../core/registry/parameters.js';

export const META_COLUMNS = [
  { id: 'sampleNumber', header: 'Vzorek', type: 'text', group: 'meta', locked: false, defaultVisible: true },
  { id: 'date', header: 'Datum', type: 'date', group: 'meta', locked: true, defaultVisible: true },
  { id: 'time', header: 'Čas', type: 'time', group: 'meta', locked: true, defaultVisible: true },
  { id: 'site', header: 'Lokalita', type: 'text', group: 'meta', locked: true, defaultVisible: true },
  { id: 'device', header: 'Přístroj', type: 'text', group: 'meta', locked: true, defaultVisible: false },
  { id: 'annotation', header: 'Annotation', type: 'text', group: 'meta', locked: true, defaultVisible: false },
  { id: 'description', header: 'Popis', type: 'text', group: 'meta', locked: false, defaultVisible: false }
];

export const PARAM_COLUMN_ORDER = [
  'depth',
  'water_temperature',
  'do_concentration',
  'do_saturation',
  'specific_conductance',
  'conductivity',
  'nlf_conductivity',
  'ph',
  'ph_mv',
  'orp',
  'chlorophyll_ugl',
  'chlorophyll_rfu',
  'chlorophyll_cells',
  'phycocyanin_ugl',
  'phycocyanin_rfu',
  'phycocyanin_cells',
  'turbidity_ntu',
  'turbidity_fnu'
];

const DEFAULT_VISIBLE_PARAMS = new Set([
  'depth',
  'water_temperature',
  'do_concentration',
  'do_saturation',
  'specific_conductance',
  'ph'
]);

export function paramColumns() {
  return PARAM_COLUMN_ORDER.map((key) => ({
    id: `param:${key}`,
    header: PARAMETERS[key].label,
    unit: PARAMETERS[key].unit,
    type: 'number',
    group: 'param',
    paramKey: key,
    locked: true,
    defaultVisible: DEFAULT_VISIBLE_PARAMS.has(key)
  }));
}

export function supplementaryColumns() {
  return Object.entries(SUPPLEMENTARY_FIELDS).map(([key, def]) => ({
    id: `supp:${key}`,
    header: def.label,
    unit: def.unit,
    type: 'number',
    group: 'supp',
    suppKey: key,
    locked: false,
    defaultVisible: true
  }));
}

/**
 * Builds the full ordered column list for a grid. Every column object is a
 * fresh clone (never a shared reference) so one tab can freely customize
 * its own copy (e.g. Data's "already in Working Set" badge, or forcing
 * everything read-only) without corrupting another tab's columns — this
 * previously bled Data's `locked`/`renderExtra` overrides into the Working
 * Set grid because META_COLUMNS is a module-level constant.
 */
export function buildColumns({ includeIdColumn = false } = {}) {
  const columns = [];
  if (includeIdColumn) {
    columns.push({ id: 'measurementId', header: 'ID', type: 'text', group: 'meta', locked: true, defaultVisible: false });
  }
  columns.push(...META_COLUMNS, ...paramColumns(), ...supplementaryColumns());
  return columns.map((col) => ({ ...col }));
}

/** Reads a column's current value off a measurement. */
export function getColumnValue(column, measurement) {
  if (column.group === 'param') {
    const p = measurement.parameters[column.paramKey];
    return p ? p.value : null;
  }
  if (column.group === 'supp') {
    return measurement.supplementary?.[column.suppKey] ?? null;
  }
  return measurement[column.id] ?? null;
}

/** True if a column's underlying parameter/field is actually invalid on this measurement. */
export function isColumnInvalid(column, measurement) {
  if (column.group === 'param') {
    return Boolean(measurement.parameters[column.paramKey]?.invalid);
  }
  return false;
}

/** Column's current unit label for display (parameters carry their own live unit, which may change on conversion). */
export function getColumnUnit(column, measurement) {
  if (column.group === 'param') {
    return measurement.parameters[column.paramKey]?.unit ?? column.unit ?? null;
  }
  return column.unit ?? null;
}
