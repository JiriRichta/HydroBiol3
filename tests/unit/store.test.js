import { describe, it, expect, beforeEach } from 'vitest';
import { createSourceStore } from '../../src/core/store/sourceStore.js';
import { createWorkingSet } from '../../src/core/store/workingSet.js';
import { createEditSession } from '../../src/core/store/editSession.js';
import { createImportedMeasurement, createManualMeasurement, deepFreezeMeasurement } from '../../src/core/model/measurement.js';
import { resetIdCounterForTests } from '../../src/core/ids.js';

function seedSource(store, count = 2) {
  const measurements = [];
  for (let i = 0; i < count; i += 1) {
    const m = createImportedMeasurement({
      date: '2026-01-01',
      sampleNumber: String(100 + i),
      parameters: { ph: { value: 7 + i, unit: 'pH', raw: String(7 + i) } },
      supplementary: { air_temperature_c: null, transparency_m: null, flow: null }
    });
    deepFreezeMeasurement(m);
    measurements.push(m);
  }
  store.addBatch({ importId: 'IMP0001', fileName: 'f.csv', fingerprint: 'fp', format: 'EUREKA', measurements });
  return measurements;
}

describe('sourceStore (DATA-02: append-only, immutable)', () => {
  beforeEach(() => resetIdCounterForTests(0));

  it('never allows mutating a stored measurement', () => {
    const store = createSourceStore();
    const [m] = seedSource(store, 1);
    expect(() => {
      m.sampleNumber = '999';
    }).toThrow();
  });

  it('rejects re-adding a batch with an already-used fingerprint', () => {
    const store = createSourceStore();
    seedSource(store, 1);
    expect(() => {
      store.addBatch({ importId: 'IMP0002', fileName: 'f.csv', fingerprint: 'fp', format: 'EUREKA', measurements: [] });
    }).toThrow();
  });
});

describe('workingSet (DATA-03..06)', () => {
  beforeEach(() => resetIdCounterForTests(0));

  it('AT-07: adding creates an independent deep snapshot; editing it never touches Data', () => {
    const source = createSourceStore();
    const [m] = seedSource(source, 1);
    const working = createWorkingSet();

    const res = working.addFromSource([m.measurementId], source);
    expect(res.ok).toBe(true);

    const snapshot = working.get(m.measurementId);
    snapshot.parameters.ph.value = 9.9; // mutate the snapshot directly (simulating an edit)
    expect(m.parameters.ph.value).toBe(7); // original Data record is untouched
  });

  it('AT-09: adding a selection that includes an already-present id rejects the WHOLE batch', () => {
    const source = createSourceStore();
    const measurements = seedSource(source, 2);
    const working = createWorkingSet();
    working.addFromSource([measurements[0].measurementId], source);

    const res = working.addFromSource([measurements[0].measurementId, measurements[1].measurementId], source);
    expect(res.ok).toBe(false);
    expect(res.conflicts).toEqual([measurements[0].measurementId]);
    expect(working.size()).toBe(1); // second measurement was NOT added either
  });

  it('AT-08: removing then re-adding restores the clean normalized values, not prior edits', () => {
    const source = createSourceStore();
    const [m] = seedSource(source, 1);
    const working = createWorkingSet();
    working.addFromSource([m.measurementId], source);
    working.get(m.measurementId).parameters.ph.value = 42; // edit the snapshot

    working.remove([m.measurementId]);
    expect(working.has(m.measurementId)).toBe(false);

    working.addFromSource([m.measurementId], source);
    expect(working.get(m.measurementId).parameters.ph.value).toBe(7); // clean, not 42
  });

  it('DATA-04: the measurementId is identical between Data and its Working Set snapshot', () => {
    const source = createSourceStore();
    const [m] = seedSource(source, 1);
    const working = createWorkingSet();
    working.addFromSource([m.measurementId], source);
    expect(working.get(m.measurementId).measurementId).toBe(m.measurementId);
  });

  it('AT-10: a manual measurement gets a fresh id and fully blank, editable fields', () => {
    const working = createWorkingSet();
    const manual = createManualMeasurement();
    working.insertAfter(manual, null);
    expect(working.size()).toBe(1);
    expect(working.get(manual.measurementId).originType).toBe('manual');
  });

  it('insertBefore places a calculated record immediately before the given id in workingOrder', () => {
    const source = createSourceStore();
    const measurements = seedSource(source, 3);
    const working = createWorkingSet();
    working.addFromSource(measurements.map((m) => m.measurementId), source);

    const calc = createManualMeasurement();
    working.insertBefore(calc, measurements[1].measurementId);
    expect(working.getOrder()).toEqual([
      measurements[0].measurementId,
      calc.measurementId,
      measurements[1].measurementId,
      measurements[2].measurementId
    ]);
  });
});

describe('editSession (transactional bulk/detail editing)', () => {
  beforeEach(() => resetIdCounterForTests(0));

  it('AT-12/AT-13: discard leaves the Working Set completely untouched', () => {
    const source = createSourceStore();
    const [m] = seedSource(source, 1);
    const working = createWorkingSet();
    working.addFromSource([m.measurementId], source);

    const session = createEditSession();
    session.begin('detail', [m.measurementId], working);
    session.updateDraft(m.measurementId, (draft) => {
      draft.parameters.ph.value = 1.23;
    });
    session.discard();

    expect(session.isActive()).toBe(false);
    expect(working.get(m.measurementId).parameters.ph.value).toBe(7); // unchanged
  });

  it('commit atomically writes every draft back, only once validation passes', () => {
    const source = createSourceStore();
    const measurements = seedSource(source, 2);
    const working = createWorkingSet();
    working.addFromSource(measurements.map((x) => x.measurementId), source);

    const session = createEditSession();
    const ids = measurements.map((x) => x.measurementId);
    session.begin('bulk', ids, working);
    ids.forEach((id, i) => session.updateDraft(id, (draft) => { draft.sampleNumber = `NEW-${i}`; }));

    const result = session.commit(working);
    expect(result.ok).toBe(true);
    expect(session.isActive()).toBe(false);
    ids.forEach((id, i) => expect(working.get(id).sampleNumber).toBe(`NEW-${i}`));
  });

  it('a failing validator blocks commit and keeps the session open for correction', () => {
    const source = createSourceStore();
    const [m] = seedSource(source, 1);
    const working = createWorkingSet();
    working.addFromSource([m.measurementId], source);

    const session = createEditSession();
    session.begin('detail', [m.measurementId], working);
    session.updateDraft(m.measurementId, (draft) => { draft.parameters.ph.invalid = true; });

    const validate = (measurement) =>
      measurement.parameters.ph.invalid ? [{ code: 'X', severity: 'error', message: 'bad' }] : [];
    const result = session.commit(working, { validate });
    expect(result.ok).toBe(false);
    expect(session.isActive()).toBe(true); // still open
    expect(working.get(m.measurementId).parameters.ph.value).toBe(7); // not written
  });
});
