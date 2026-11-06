// Working Set tab (SPEC §5.3): inline-editable supplementary fields
// (Mode A), transactional bulk editing (Mode C) and the full detail dialog
// (Mode B), plus manual records, mixed samples and removal.

import { h, clear } from '../dom.js';
import { icon } from '../icon.js';
import { createDataGrid } from '../grid/gridView.js';
import { buildColumns } from '../grid/columns.js';
import { confirmDialog, saveDiscardContinueDialog, openDialog } from '../dialogs.js';
import { openDetailDialog } from '../detailDialog.js';
import { createManualMeasurement, cloneMeasurementSnapshot } from '../../core/model/measurement.js';
import { createMixedSample } from '../../core/calc/mix.js';
import { validateMeasurement } from '../../core/validation/validate.js';
import { PARAMETERS } from '../../core/registry/parameters.js';

export function createWorkingTab({ workingSet, editSession, onChanged, onRequestExport }) {
  const columns = buildColumns({ includeIdColumn: true });
  let transientMessage = null;
  let transientTimer = null;

  const statusEl = h('div', { className: 'hb-statusbar' });
  const bannerEl = h('div', {});

  const grid = createDataGrid({
    columns,
    isCellEditable,
    onCellCommit,
    onSelectionChange: renderStatus,
    onRowActivate: (m) => openDetail(m.measurementId)
  });

  const editBtn = h('button', { className: 'hb-button hb-button--secondary', onClick: editSelected }, [icon('edit'), ' Editovat']);
  const bulkBtn = h('button', { className: 'hb-button hb-button--secondary', onClick: toggleBulk }, ['Hromadná editace']);
  const newBtn = h('button', { className: 'hb-button hb-button--secondary', onClick: addManual }, ['Nový záznam']);
  const mixBtn = h('button', { className: 'hb-button hb-button--secondary', onClick: createMixed }, [icon('mix'), ' Směsný vzorek']);
  const removeBtn = h('button', { className: 'hb-button hb-button--secondary', onClick: removeSelected }, [icon('trash'), ' Odebrat']);
  const exportBtn = h('button', { className: 'hb-button hb-button--primary', onClick: goToExport }, ['Export']);

  const root = h('div', { className: 'hb-panel__body' }, [
    bannerEl,
    grid.el,
    h('div', { className: 'hb-panel__toolbar' }, [newBtn, mixBtn, editBtn, bulkBtn, removeBtn, h('div', { className: 'hb-panel__toolbar-spacer' }), exportBtn]),
    statusEl
  ]);

  function isCellEditable(measurement, col) {
    if (!col.locked) return true; // Mode A: supplementary fields always editable
    const session = editSession.current();
    return Boolean(session && session.kind === 'bulk' && session.ids.includes(measurement.measurementId));
  }

  function applyColumnValue(target, col, newValue) {
    if (col.group === 'param') {
      const current = target.parameters[col.paramKey];
      target.parameters[col.paramKey] = {
        ...(current ?? { unit: PARAMETERS[col.paramKey].unit, raw: null, sourceColumn: null, sensorId: null }),
        value: newValue,
        invalid: false
      };
    } else if (col.group === 'supp') {
      target.supplementary[col.suppKey] = newValue;
    } else {
      target[col.id] = newValue;
    }
  }

  function onCellCommit(measurement, col, newValue) {
    const id = measurement.measurementId;
    if (!col.locked) {
      const updated = cloneMeasurementSnapshot(workingSet.get(id));
      applyColumnValue(updated, col, newValue);
      workingSet.replaceSnapshot(id, updated);
    } else {
      editSession.updateDraft(id, (draft) => applyColumnValue(draft, col, newValue));
    }
    refreshGrid();
  }

  function displayMeasurements() {
    return workingSet.getOrder().map((id) => editSession.getDraft(id) ?? workingSet.get(id));
  }

  function refreshGrid() {
    grid.setMeasurements(displayMeasurements());
    renderStatus();
    renderBanner();
  }

  function renderStatus() {
    clear(statusEl);
    const total = workingSet.size();
    const visible = grid.getVisible().length;
    const selected = grid.getSelected();
    const visibleIds = new Set(grid.getVisible().map((m) => m.measurementId));
    const hidden = Array.from(selected).filter((id) => !visibleIds.has(id)).length;
    const issueCount = displayMeasurements().reduce((sum, m) => sum + validateMeasurement(m).filter((i) => i.severity !== 'info').length, 0);
    const parts = [
      h('strong', {}, [String(total)]),
      ' celkem • zobrazeno ',
      h('strong', {}, [String(visible)]),
      ' • vybráno ',
      h('strong', {}, [String(selected.size)]),
      hidden > 0 ? ` (z toho ${hidden} skrytých)` : '',
      ' • problémy ',
      h('strong', { className: issueCount > 0 ? 'hb-statusbar__warn' : null }, [String(issueCount)])
    ];
    if (transientMessage) parts.push(h('span', { className: 'hb-statusbar__spacer' }), h('span', {}, [transientMessage]));
    statusEl.appendChild(h('span', {}, parts));
  }

  function renderBanner() {
    clear(bannerEl);
    const session = editSession.current();
    if (session && session.kind === 'bulk') {
      bulkBtn.textContent = 'Uložit / Zahodit / Pokračovat';
      bannerEl.appendChild(
        h('div', { className: 'hb-banner hb-banner--editing' }, [`Hromadná editace aktivní — ${session.ids.length} záznam(ů), původní hodnoty odemčeny.`])
      );
    } else {
      bulkBtn.textContent = 'Hromadná editace';
    }
  }

  function showInfo(text) {
    transientMessage = text;
    renderStatus();
    if (transientTimer) clearTimeout(transientTimer);
    transientTimer = setTimeout(() => {
      transientMessage = null;
      renderStatus();
    }, 5000);
  }

  function showIssuesDialog(title, issues) {
    const { close } = openDialog({
      title,
      body: h(
        'div',
        { className: 'hb-issue-list' },
        issues.map((i) => h('div', { className: 'hb-issue-list__item' }, [i.message]))
      ),
      actions: [h('button', { className: 'hb-button hb-button--primary', onClick: () => close() }, ['Rozumím'])]
    });
  }

  function firstInWorkingOrder(ids) {
    const order = workingSet.getOrder();
    return order.find((id) => ids.includes(id)) ?? null;
  }

  function maybeResetSortForInsert() {
    if (grid.getSort().columnId) {
      grid.resetSort();
      showInfo('Tabulka přepnuta na ruční pořadí, aby byl nově vložený záznam viditelný na svém místě.');
    }
  }

  function addManual() {
    if (editSession.isActive()) return;
    const selected = Array.from(grid.getSelected());
    const afterId = selected.length > 0 ? firstInWorkingOrder(selected) : null;
    const manual = createManualMeasurement();
    maybeResetSortForInsert();
    workingSet.insertAfter(manual, afterId);
    refreshGrid();
    onChanged();
    openDetail(manual.measurementId);
  }

  async function createMixed() {
    if (editSession.isActive()) return;
    const selected = Array.from(grid.getSelected());
    if (selected.length < 2) {
      await confirmDialog({ title: 'Směsný vzorek', message: 'Pro směsný vzorek vyberte alespoň dvě měření.', confirmLabel: 'Rozumím', cancelLabel: 'Zavřít' });
      return;
    }
    const order = workingSet.getOrder();
    const orderedIds = order.filter((id) => selected.includes(id));
    const orderedMeasurements = orderedIds.map((id) => workingSet.get(id));

    const confirmed = await confirmDialog({
      title: 'Směsný vzorek',
      message: `Vytvořit směsný vzorek z ${orderedMeasurements.length} vybraných měření?`,
      confirmLabel: 'Vytvořit',
      cancelLabel: 'Storno'
    });
    if (!confirmed) return;

    const result = createMixedSample(orderedMeasurements);
    if (!result.ok) {
      await confirmDialog({ title: 'Směsný vzorek nelze vytvořit', message: result.error.message, confirmLabel: 'Rozumím', cancelLabel: 'Zavřít' });
      return;
    }
    maybeResetSortForInsert();
    workingSet.insertBefore(result.measurement, orderedIds[0]);
    refreshGrid();
    onChanged();
    if (result.warnings.length > 0) {
      showIssuesDialog('Upozornění při výpočtu směsného vzorku', result.warnings);
    }
  }

  async function removeSelected() {
    if (editSession.isActive()) return;
    const selected = Array.from(grid.getSelected());
    if (selected.length === 0) return;
    const hasNonImported = selected.some((id) => workingSet.get(id)?.originType !== 'imported');
    const confirmed = await confirmDialog({
      title: 'Odebrat z Pracovní sady',
      message: hasNonImported
        ? `Odebrat ${selected.length} záznam(ů)? Ručně vytvořené nebo vypočítané záznamy budou tímto trvale odstraněny.`
        : `Odebrat ${selected.length} záznam(ů) z Pracovní sady? Importované originály zůstanou v záložce Data.`,
      confirmLabel: 'Odebrat',
      cancelLabel: 'Storno',
      danger: true
    });
    if (!confirmed) return;
    workingSet.remove(selected);
    grid.setSelected(new Set());
    refreshGrid();
    onChanged();
  }

  function editSelected() {
    if (editSession.isActive()) return;
    const visibleIds = grid.getVisible().map((m) => m.measurementId);
    const selected = grid.getSelected();
    const firstVisibleSelected = visibleIds.find((id) => selected.has(id));
    if (!firstVisibleSelected) return;
    openDetail(firstVisibleSelected);
  }

  function openDetail(id) {
    if (editSession.isActive()) return;
    editSession.begin('detail', [id], workingSet);
    refreshGrid();
    const draft = editSession.getDraft(id);
    openDetailDialog(draft, {
      onSave: (updated) => {
        editSession.updateDraft(id, (d) => Object.assign(d, updated));
        const result = editSession.commit(workingSet, { validate: validateMeasurement });
        if (!result.ok) return { ok: false, issues: result.issues };
        refreshGrid();
        onChanged();
        return { ok: true };
      },
      onCancel: () => {
        editSession.discard();
        refreshGrid();
      }
    });
  }

  async function toggleBulk() {
    const session = editSession.current();
    if (session && session.kind === 'bulk') {
      const choice = await saveDiscardContinueDialog({ message: 'Hromadná editace je aktivní. Co s rozpracovanými změnami?' });
      if (choice === 'continue') return;
      if (choice === 'discard') {
        editSession.discard();
        grid.setSortFilterLocked(false);
        refreshGrid();
        return;
      }
      commitBulk();
      return;
    }
    if (editSession.isActive()) return; // a detail session is open elsewhere (shouldn't happen — modal blocks it)
    const selected = Array.from(grid.getSelected());
    if (selected.length === 0) {
      await confirmDialog({ title: 'Hromadná editace', message: 'Nejprve vyberte alespoň jedno měření.', confirmLabel: 'Rozumím', cancelLabel: 'Zavřít' });
      return;
    }
    editSession.begin('bulk', selected, workingSet);
    grid.setSortFilterLocked(true);
    refreshGrid();
  }

  function commitBulk() {
    const session = editSession.current();
    if (!session) return;
    // Re-sync the always-editable fields from the live Working Set in case
    // they were edited (Mode A, immediate) while the bulk session was open,
    // so committing the draft never reverts a concurrent Mode A edit.
    session.ids.forEach((id) => {
      const draft = editSession.getDraft(id);
      const live = workingSet.get(id);
      if (!draft || !live) return;
      draft.sampleNumber = live.sampleNumber;
      draft.description = live.description;
      draft.supplementary = { ...live.supplementary };
    });
    const result = editSession.commit(workingSet, { validate: validateMeasurement });
    if (!result.ok) {
      showIssuesDialog('Hromadnou editaci nelze uložit', result.issues);
      refreshGrid();
      return;
    }
    grid.setSortFilterLocked(false);
    refreshGrid();
    onChanged();
  }

  async function confirmLeave() {
    if (!editSession.isActive()) return true;
    const choice = await saveDiscardContinueDialog();
    if (choice === 'continue') return false;
    if (choice === 'discard') {
      editSession.discard();
      grid.setSortFilterLocked(false);
      refreshGrid();
      return true;
    }
    if (choice === 'save') {
      const session = editSession.current();
      if (session.kind === 'bulk') commitBulk();
      else {
        // Detail sessions are always inside a modal the user must close explicitly;
        // reaching here would mean the modal is still open, so we refuse to navigate.
        return false;
      }
      return !editSession.isActive();
    }
    return false;
  }

  function goToExport() {
    onRequestExport(Array.from(grid.getSelected()));
  }

  function refresh() {
    refreshGrid();
  }

  refresh();
  return { el: root, refresh, confirmLeave };
}
