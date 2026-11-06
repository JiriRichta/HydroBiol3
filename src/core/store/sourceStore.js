// Append-only store for normalized, immutable Data-tab records (DATA-02).
//
// Nothing here ever mutates or removes a measurement once added — the only
// operation is appending a whole, already-validated import batch.

export function createSourceStore() {
  const byId = new Map();
  const order = [];
  const fingerprints = new Set();
  const batches = [];

  function hasFingerprint(fingerprint) {
    return fingerprints.has(fingerprint);
  }

  /** Appends one atomic import batch. Throws if the fingerprint was already used (caller should check first). */
  function addBatch({ importId, fileName, fingerprint, format, measurements }) {
    if (fingerprints.has(fingerprint)) {
      throw new Error(`Fingerprint ${fingerprint} already present in source store (duplicate import was not caught earlier).`);
    }
    measurements.forEach((m) => {
      if (byId.has(m.measurementId)) {
        throw new Error(`Duplicate measurementId ${m.measurementId} — id generator invariant violated.`);
      }
      byId.set(m.measurementId, m);
      order.push(m.measurementId);
    });
    fingerprints.add(fingerprint);
    batches.push({
      importId,
      fileName,
      fingerprint,
      format,
      measurementIds: measurements.map((m) => m.measurementId),
      importedAt: new Date().toISOString()
    });
  }

  function get(id) {
    return byId.get(id) ?? null;
  }

  function has(id) {
    return byId.has(id);
  }

  function getAll() {
    return order.map((id) => byId.get(id));
  }

  function size() {
    return order.length;
  }

  function getBatches() {
    return batches.slice();
  }

  return { hasFingerprint, addBatch, get, has, getAll, size, getBatches };
}
