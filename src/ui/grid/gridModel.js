// Pure sort/filter/selection logic for the DataGrid (UI-01..03). Nothing
// here touches the DOM — gridView.js consumes these functions. Selection
// is always a Set of measurementId, never a row index (UI-01).

import { getColumnValue } from './columns.js';

/**
 * @param {object[]} measurements
 * @param {{ searchText?: string, columnFilters?: Record<string, string> }} filters
 * @param {{ columnId: string|null, direction: 'asc'|'desc'|null }} sort
 * @param {object[]} columns
 */
export function getVisibleRows(measurements, filters, sort, columns) {
  let rows = measurements;

  const search = (filters?.searchText ?? '').trim().toLowerCase();
  if (search) {
    rows = rows.filter((m) =>
      columns.some((col) => {
        const v = getColumnValue(col, m);
        return v !== null && v !== undefined && String(v).toLowerCase().includes(search);
      })
    );
  }

  const columnFilters = filters?.columnFilters ?? {};
  Object.entries(columnFilters).forEach(([columnId, value]) => {
    const needle = String(value ?? '').trim().toLowerCase();
    if (!needle) return;
    const column = columns.find((c) => c.id === columnId);
    if (!column) return;
    rows = rows.filter((m) => {
      const v = getColumnValue(column, m);
      return v !== null && v !== undefined && String(v).toLowerCase().includes(needle);
    });
  });

  if (sort?.columnId && sort.direction) {
    const column = columns.find((c) => c.id === sort.columnId);
    if (column) {
      const dir = sort.direction === 'asc' ? 1 : -1;
      rows = rows.slice().sort((a, b) => compareForSort(getColumnValue(column, a), getColumnValue(column, b), column.type) * dir);
    }
  }

  return rows;
}

/** Missing values consistently sort to the end regardless of direction (UI-02). */
function compareForSort(a, b, type) {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (type === 'number') return Number(a) - Number(b);
  if (type === 'date' || type === 'time') return String(a).localeCompare(String(b));
  return String(a).localeCompare(String(b), 'cs', { numeric: true, sensitivity: 'base' });
}

/** Plain or Ctrl+click: toggles one row's membership; updates the anchor. */
export function toggleSelection(selected, id) {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return { selected: next, anchor: id };
}

/** Shift+click: selects the contiguous range between the anchor and the target in the CURRENT visible order (UI-01). */
export function rangeSelect(selected, anchor, targetId, visibleIds) {
  if (!anchor || !visibleIds.includes(anchor)) {
    return toggleSelection(selected, targetId);
  }
  const from = visibleIds.indexOf(anchor);
  const to = visibleIds.indexOf(targetId);
  if (to === -1) return toggleSelection(selected, targetId);
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const next = new Set(selected);
  for (let i = lo; i <= hi; i += 1) next.add(visibleIds[i]);
  return { selected: next, anchor };
}

/** "Select all" only ever affects the currently visible/filtered set (UI-01). */
export function selectAllVisible(selected, visibleIds) {
  const next = new Set(selected);
  visibleIds.forEach((id) => next.add(id));
  return next;
}

export function deselectAllVisible(selected, visibleIds) {
  const next = new Set(selected);
  visibleIds.forEach((id) => next.delete(id));
  return next;
}

export function clearSelection() {
  return new Set();
}

/** Next sort state for a header click: asc -> desc -> none (workingOrder), per column. */
export function nextSortState(current, columnId) {
  if (current?.columnId !== columnId) return { columnId, direction: 'asc' };
  if (current.direction === 'asc') return { columnId, direction: 'desc' };
  return { columnId: null, direction: null };
}
