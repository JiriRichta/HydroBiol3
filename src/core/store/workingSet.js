// Working Set store: independent deep snapshots keyed by their stable,
// never-reindexed `workingOrder` (DATA-03, DATA-04, DATA-05, DATA-06).

import { cloneMeasurementSnapshot } from '../model/measurement.js';

export function createWorkingSet() {
  let order = [];
  const items = new Map();

  function has(id) {
    return items.has(id);
  }

  function get(id) {
    return items.get(id) ?? null;
  }

  function getAll() {
    return order.map((id) => items.get(id));
  }

  function getOrder() {
    return order.slice();
  }

  function size() {
    return order.length;
  }

  /**
   * Adds deep clones of the given source measurements. All-or-nothing: if
   * any id is already present, or any id doesn't exist in the source
   * store, nothing is added (DATA-05).
   */
  function addFromSource(ids, sourceStore) {
    const conflicts = ids.filter((id) => items.has(id));
    if (conflicts.length > 0) {
      return { ok: false, reason: 'ALREADY_IN_WORKING_SET', conflicts };
    }
    const missing = ids.filter((id) => !sourceStore.has(id));
    if (missing.length > 0) {
      return { ok: false, reason: 'NOT_FOUND_IN_SOURCE', missing };
    }
    ids.forEach((id) => {
      const snapshot = cloneMeasurementSnapshot(sourceStore.get(id));
      items.set(id, snapshot);
      order.push(id);
    });
    return { ok: true, added: ids.slice() };
  }

  /** Removes snapshots by id. Re-adding later always starts from a clean source clone (DATA-06). */
  function remove(ids) {
    const existing = ids.filter((id) => items.has(id));
    existing.forEach((id) => items.delete(id));
    order = order.filter((id) => !existing.includes(id));
    return { ok: true, removed: existing };
  }

  /** Inserts a manual/calculated measurement at the end, or right after `afterId` in workingOrder. */
  function insertAfter(measurement, afterId = null) {
    items.set(measurement.measurementId, measurement);
    if (afterId && order.includes(afterId)) {
      order.splice(order.indexOf(afterId) + 1, 0, measurement.measurementId);
    } else {
      order.push(measurement.measurementId);
    }
    return measurement.measurementId;
  }

  /** Inserts a calculated measurement right before `beforeId` in workingOrder (MIX-04). */
  function insertBefore(measurement, beforeId) {
    items.set(measurement.measurementId, measurement);
    const idx = beforeId && order.includes(beforeId) ? order.indexOf(beforeId) : order.length;
    order.splice(idx, 0, measurement.measurementId);
    return measurement.measurementId;
  }

  /** Atomically replaces one snapshot's full value (used by editSession.commit()). */
  function replaceSnapshot(id, newSnapshot) {
    if (!items.has(id)) {
      throw new Error(`Working set has no entry for ${id}`);
    }
    items.set(id, newSnapshot);
  }

  return {
    has,
    get,
    getAll,
    getOrder,
    size,
    addFromSource,
    remove,
    insertAfter,
    insertBefore,
    replaceSnapshot
  };
}
