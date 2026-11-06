// Individual validation predicates (VAL-01..05). Each rule inspects one
// measurement and returns zero or more issues; validate.js just runs all
// of them and flattens the result.

import { CONDUCTIVITY_PARAM_KEYS } from '../registry/parameters.js';

function issue(code, severity, field, message, measurementId) {
  return { code, severity, field, message, measurementId };
}

/** VAL-03: a negative depth that was not corrected at import is surfaced, never silently hidden. */
export function negativeDepthRule(measurement) {
  const depth = measurement.parameters.depth;
  if (!depth || typeof depth.value !== 'number') return [];
  if (depth.value < 0) {
    return [
      issue(
        'DEPTH_NEGATIVE',
        'warning',
        'depth',
        `Hloubka je záporná (${depth.value} m) a nebyla při importu korigována.`,
        measurement.measurementId
      )
    ];
  }
  return [];
}

/** Any parameter flagged invalid during import stays visible as a blocking issue until fixed. */
export function invalidParameterRule(measurement) {
  const out = [];
  Object.entries(measurement.parameters).forEach(([key, param]) => {
    if (param.invalid) {
      out.push(issue('VALUE_INVALID', 'error', key, `Neplatná hodnota parametru "${key}": "${param.raw}".`, measurement.measurementId));
    }
  });
  return out;
}

/** Imported records should normally carry a date; manual/calculated ones legitimately might not yet. */
export function missingDateRule(measurement) {
  if (measurement.date) return [];
  const severity = measurement.originType === 'imported' ? 'warning' : 'info';
  return [issue('DATE_MISSING', severity, 'date', 'Záznam nemá vyplněné datum.', measurement.measurementId)];
}

/** Surfaces (informationally) that a conductivity-family value is still in µS/cm, not yet mS/m. */
export function unconvertedConductivityRule(measurement) {
  const out = [];
  CONDUCTIVITY_PARAM_KEYS.forEach((key) => {
    const param = measurement.parameters[key];
    if (param && param.unit === 'uS/cm') {
      out.push(
        issue(
          'CONDUCTIVITY_NOT_CONVERTED',
          'info',
          key,
          `Parametr "${key}" je uložen v původní jednotce µS/cm (nebyl převeden na mS/m).`,
          measurement.measurementId
        )
      );
    }
  });
  return out;
}

export const ALL_RULES = [negativeDepthRule, invalidParameterRule, missingDateRule, unconvertedConductivityRule];
