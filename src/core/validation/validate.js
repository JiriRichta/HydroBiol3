// Aggregates all validation rules over one measurement or a whole
// collection (VAL-01: every issue carries a code, severity, measurementId,
// field and message).

import { ALL_RULES } from './rules.js';

export function validateMeasurement(measurement) {
  return ALL_RULES.flatMap((rule) => rule(measurement));
}

export function validateMeasurements(measurements) {
  return measurements.flatMap((m) => validateMeasurement(m));
}

export function countBySeverity(issues) {
  return issues.reduce(
    (acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] ?? 0) + 1;
      return acc;
    },
    { error: 0, warning: 0, info: 0 }
  );
}
