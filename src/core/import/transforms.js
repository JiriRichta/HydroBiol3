// Explicit, user-confirmed import transformations (SPEC §3.2, plan §5a).
//
// Both transforms only ever run once per measurement (guarded against
// double-application) and always leave an audit trail in
// measurement.source.transformations — the raw value is never discarded.

function nowIso() {
  return new Date().toISOString();
}

const CONDUCTIVITY_KEYS = ['specific_conductance', 'conductivity', 'nlf_conductivity'];

/**
 * Converts any µS/cm conductivity-family parameter to mS/m (÷10). The
 * canonical key — and therefore the parameter's physical meaning — never
 * changes: only its value and unit do (plan §5a).
 */
export function applyConductivityConversion(measurement, { convert }) {
  if (!convert) return measurement;
  const already = new Set(
    measurement.source.transformations.filter((t) => t.type === 'unit_conversion').map((t) => t.param)
  );
  CONDUCTIVITY_KEYS.forEach((key) => {
    if (already.has(key)) return; // guard against double conversion
    const param = measurement.parameters[key];
    if (!param || param.value == null || param.unit !== 'uS/cm') return;
    const originalValue = param.value;
    param.value = originalValue / 10;
    param.unit = 'mS/m';
    measurement.source.transformations.push({
      type: 'unit_conversion',
      param: key,
      from: 'uS/cm',
      to: 'mS/m',
      operation: '÷10',
      originalValue,
      decidedBy: 'user',
      importId: measurement.source.importId,
      at: nowIso()
    });
  });
  return measurement;
}

/** Corrects all negative depth readings to 0 m when the user opts in. */
export function applyDepthCorrection(measurement, { correctNegative }) {
  if (!correctNegative) return measurement;
  const alreadyCorrected = measurement.source.transformations.some((t) => t.type === 'depth_correction');
  if (alreadyCorrected) return measurement;
  const param = measurement.parameters.depth;
  if (!param || param.value == null || param.value >= 0) return measurement;
  const originalValue = param.value;
  param.value = 0;
  measurement.source.transformations.push({
    type: 'depth_correction',
    param: 'depth',
    from: originalValue,
    to: 0,
    decidedBy: 'user',
    importId: measurement.source.importId,
    at: nowIso()
  });
  return measurement;
}

/** Applies all confirmed per-file import options to one measurement draft. */
export function applyImportTransforms(measurement, options) {
  applyConductivityConversion(measurement, options);
  applyDepthCorrection(measurement, options);
  return measurement;
}
