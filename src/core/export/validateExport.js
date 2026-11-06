// Export-time validation (plan §6a): two non-overlapping classes.
//
//  - "blocking" errors can NEVER be waived by any acknowledgement checkbox
//    (wrong/incompatible unit, invalid value, missing required field,
//    unacknowledged unverified mapping).
//  - "warnings" are informational once the user has ticked the unverified-
//    mapping acknowledgement; they never block the download.

/**
 * @param {object} profile
 * @param {{measurementId:string, cells:object[]}[]} rows  from buildExportRows
 * @param {{ acknowledgedUnverified?: boolean }} [options]
 * @returns {{ ok: boolean, blocking: object[], warnings: object[] }}
 */
export function validateExportRows(profile, rows, { acknowledgedUnverified = false } = {}) {
  const warnings = [];

  // Group affected measurement ids per (issueKind, columnHeader) so the UI
  // can show "N records" instead of one line per row.
  const requiredMissing = new Map(); // header -> ids[]
  const invalidValue = new Map(); // header -> ids[]
  const unitMismatch = new Map(); // header -> { requireUnit, foundUnits: Set, ids: [] }

  rows.forEach((row) => {
    row.cells.forEach((cell) => {
      const { column, value, unit, invalid } = cell;
      const isEmpty = value === null || value === undefined || String(value).trim() === '';

      if (column.required && isEmpty) {
        if (!requiredMissing.has(column.header)) requiredMissing.set(column.header, []);
        requiredMissing.get(column.header).push(row.measurementId);
      }
      if (invalid) {
        if (!invalidValue.has(column.header)) invalidValue.set(column.header, []);
        invalidValue.get(column.header).push(row.measurementId);
      }
      if (column.requireUnit && !isEmpty && unit && unit !== column.requireUnit) {
        if (!unitMismatch.has(column.header)) {
          unitMismatch.set(column.header, { requireUnit: column.requireUnit, foundUnits: new Set(), ids: [] });
        }
        const entry = unitMismatch.get(column.header);
        entry.foundUnits.add(unit);
        entry.ids.push(row.measurementId);
      }
    });
  });

  const blocking = [];

  requiredMissing.forEach((ids, header) => {
    blocking.push({
      code: 'REQUIRED_FIELD_MISSING',
      severity: 'error',
      field: header,
      message: `Chybí povinná hodnota ve sloupci "${header}" u ${ids.length} záznamů.`,
      measurementIds: ids
    });
  });

  invalidValue.forEach((ids, header) => {
    blocking.push({
      code: 'VALUE_INVALID',
      severity: 'error',
      field: header,
      message: `Neplatná hodnota ve sloupci "${header}" u ${ids.length} záznamů.`,
      measurementIds: ids
    });
  });

  unitMismatch.forEach((entry, header) => {
    blocking.push({
      code: 'UNIT_MISMATCH',
      severity: 'error',
      field: header,
      message: `Sloupec "${header}" vyžaduje jednotku ${entry.requireUnit}, ale ${entry.ids.length} záznamů má jednotku ${Array.from(entry.foundUnits).join(', ')}. Proveďte explicitní převod před exportem.`,
      measurementIds: entry.ids,
      requireUnit: entry.requireUnit
    });
  });

  const unverifiedColumns = profile.columns.filter((c) => c.mapping === 'unverified');
  if (unverifiedColumns.length > 0) {
    const headers = unverifiedColumns.map((c) => c.header ?? '(bez názvu)').join(', ');
    if (!acknowledgedUnverified) {
      blocking.push({
        code: 'UNVERIFIED_MAPPING_NOT_ACKNOWLEDGED',
        severity: 'error',
        field: null,
        message: `Export obsahuje neověřená mapování do LabSystemu (${headers}). Potvrďte jejich vědomé převzetí před stažením.`,
        measurementIds: []
      });
    } else {
      warnings.push({
        code: 'UNVERIFIED_MAPPING',
        severity: 'warning',
        field: null,
        message: `Export obsahuje vědomě potvrzená neověřená mapování: ${headers}.`
      });
    }
  }

  return { ok: blocking.length === 0, blocking, warnings };
}

/** Convenience: ids of measurements whose given column failed a unit check (for a "convert now" UI action). */
export function findUnitMismatchIds(validationResult, columnHeader) {
  const group = validationResult.blocking.find((b) => b.code === 'UNIT_MISMATCH' && b.field === columnHeader);
  return group ? group.measurementIds : [];
}
