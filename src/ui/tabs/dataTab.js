// Data tab (SPEC §5.2): read-only view of every normalized record, with
// selection/sort/filter/column-visibility, and the all-or-nothing "Add
// selected to Working Set" action (DATA-05).

import { h, clear } from '../dom.js';
import { createDataGrid } from '../grid/gridView.js';
import { buildColumns } from '../grid/columns.js';
import { confirmDialog } from '../dialogs.js';

export function createDataTab({ sourceStore, workingSet, onAdded }) {
  const columns = buildColumns({ includeIdColumn: true });
  columns.forEach((c) => {
    c.locked = true; // Data is always read-only (DATA-02)
  });
  const idColumn = columns.find((c) => c.id === 'sampleNumber');
  idColumn.renderExtra = (measurement) => (workingSet.has(measurement.measurementId) ? h('span', { className: 'hb-badge' }, ['v sadě']) : null);

  const statusEl = h('div', { className: 'hb-statusbar' });

  const grid = createDataGrid({
    columns,
    isCellEditable: () => false,
    onSelectionChange: renderStatus
  });

  const addBtn = h('button', { className: 'hb-button hb-button--primary', onClick: addSelected }, ['Přidat vybrané do pracovní sady']);

  const root = h('div', { className: 'hb-panel__body' }, [
    grid.el,
    h('div', { className: 'hb-panel__toolbar' }, [h('div', { className: 'hb-panel__toolbar-spacer' }), addBtn]),
    statusEl
  ]);

  function refresh() {
    grid.setMeasurements(sourceStore.getAll());
    renderStatus();
  }

  function renderStatus() {
    clear(statusEl);
    const total = sourceStore.size();
    const visible = grid.getVisible().length;
    const selected = grid.getSelected();
    const visibleIds = new Set(grid.getVisible().map((m) => m.measurementId));
    const hidden = Array.from(selected).filter((id) => !visibleIds.has(id)).length;
    statusEl.appendChild(
      h('span', {}, [
        h('strong', {}, [String(total)]),
        ' celkem • zobrazeno ',
        h('strong', {}, [String(visible)]),
        ' • vybráno ',
        h('strong', {}, [String(selected.size)]),
        hidden > 0 ? ` (z toho ${hidden} skrytých)` : ''
      ])
    );
  }

  async function addSelected() {
    const ids = Array.from(grid.getSelected());
    if (ids.length === 0) return;
    const result = workingSet.addFromSource(ids, sourceStore);
    if (!result.ok) {
      if (result.reason === 'ALREADY_IN_WORKING_SET') {
        await confirmDialog({
          title: 'Přidání zrušeno',
          message: `Výběr obsahuje ${result.conflicts.length} záznam(ů) již přítomných v Pracovní sadě (${result.conflicts.join(', ')}). Celá operace byla zrušena — opravte výběr a zkuste to znovu.`,
          confirmLabel: 'Rozumím',
          cancelLabel: 'Zavřít'
        });
      }
      return;
    }
    refresh();
    onAdded();
  }

  return { el: root, refresh };
}
