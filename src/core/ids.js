// Session-unique, monotonically increasing measurement identifiers.
// IDs are never reused and never reflect row position, so they stay stable
// across sorting, filtering and snapshotting (see DATA-04 in the spec).

let counter = 0;

/**
 * Returns a new unique id of the form "M000001". Deterministic within a
 * session because the counter only ever increases.
 */
export function nextMeasurementId() {
  counter += 1;
  return `M${String(counter).padStart(6, '0')}`;
}

/** Resets the counter. Used only by tests to get reproducible ids. */
export function resetIdCounterForTests(start = 0) {
  counter = start;
}

let importCounter = 0;

export function nextImportId() {
  importCounter += 1;
  return `IMP${String(importCounter).padStart(4, '0')}`;
}

export function resetImportCounterForTests(start = 0) {
  importCounter = start;
}
