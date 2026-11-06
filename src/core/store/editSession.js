// Transactional editing for the Working Set (DATA-03, SPEC §5.3 modes B/C).
//
// A session holds independent draft clones; the Working Set is only ever
// touched atomically on commit(). discard() simply drops the drafts,
// leaving the Working Set exactly as it was — there is nothing to "undo"
// because nothing was changed yet.

import { cloneMeasurementSnapshot } from '../model/measurement.js';

export function createEditSession() {
  let session = null; // { kind: 'detail'|'bulk', ids: string[], draft: Map<id, measurement> }

  function isActive() {
    return session !== null;
  }

  function current() {
    return session;
  }

  /** Starts a new session over the given ids, cloning their current Working Set snapshots. */
  function begin(kind, ids, workingSet) {
    if (session) {
      throw new Error('An edit session is already active; commit or discard it first.');
    }
    const draft = new Map();
    ids.forEach((id) => {
      const existing = workingSet.get(id);
      if (existing) draft.set(id, cloneMeasurementSnapshot(existing));
    });
    session = { kind, ids: ids.slice(), draft };
    return session;
  }

  function getDraft(id) {
    return session?.draft.get(id) ?? null;
  }

  /** Mutates one draft in place via `updater(measurement)`. */
  function updateDraft(id, updater) {
    if (!session) throw new Error('No active edit session.');
    const draft = session.draft.get(id);
    if (!draft) throw new Error(`No draft for measurement ${id} in this session.`);
    updater(draft);
    return draft;
  }

  /**
   * Validates (if `validate` is given) then atomically writes every draft
   * back into the Working Set. On any blocking ('error' severity) issue,
   * nothing is written and the session stays open so the user can fix it.
   */
  function commit(workingSet, { validate } = {}) {
    if (!session) throw new Error('No active edit session.');
    if (validate) {
      const allIssues = [];
      session.draft.forEach((measurement) => {
        allIssues.push(...validate(measurement));
      });
      const blocking = allIssues.filter((issue) => issue.severity === 'error');
      if (blocking.length > 0) {
        return { ok: false, issues: blocking };
      }
    }
    session.draft.forEach((measurement, id) => {
      workingSet.replaceSnapshot(id, measurement);
    });
    session = null;
    return { ok: true };
  }

  /** Drops every draft without touching the Working Set. */
  function discard() {
    session = null;
    return { ok: true };
  }

  return { isActive, current, begin, getDraft, updateDraft, commit, discard };
}
