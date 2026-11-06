// Renders the shared DataGrid: toolbar (search, column visibility),
// sortable/filterable table with sticky checkbox+id columns, and inline
// editing for unlocked columns. A plain re-render on every state change —
// deliberately not a virtualized/diffing grid (plan §7: keep it simple).

import { h, clear } from '../dom.js';
import { getVisibleRows, nextSortState, toggleSelection, rangeSelect, selectAllVisible, deselectAllVisible } from './gridModel.js';
import { getColumnValue, getColumnUnit, isColumnInvalid } from './columns.js';
import { parseNumber } from '../../core/import/numbers.js';

function formatValue(column, value, unit) {
  if (value === null || value === undefined || value === '') return '';
  if (column.type === 'number') {
    const num = Number(value);
    const text = Number.isInteger(num) ? String(num) : num.toFixed(Math.min(4, (String(value).split('.')[1] ?? '').length || 2));
    return unit ? `${text}` : text;
  }
  return String(value);
}

/**
 * @param {object} config
 * @param {object[]} config.columns
 * @param {(m:object)=>boolean} [config.isCellEditable]  column+measurement -> editable right now
 * @param {(m:object, column:object, rawText:string)=>void} config.onCellCommit
 * @param {(m:object)=>void} [config.onRowActivate]  e.g. double-click to open detail
 */
export function createDataGrid(config) {
  const state = {
    measurements: [],
    columns: config.columns,
    visibleColumnIds: new Set(config.columns.filter((c) => c.defaultVisible).map((c) => c.id)),
    sort: { columnId: null, direction: null },
    filters: { searchText: '', columnFilters: {} },
    selected: new Set(),
    anchor: null,
    colMenuOpen: false,
    sortFilterLocked: false
  };

  const root = h('div', { className: 'hb-grid-wrap' });
  render();

  function setMeasurements(measurements) {
    state.measurements = measurements;
    render();
  }

  function getSelected() {
    return state.selected;
  }

  function setSelected(selected, anchor = state.anchor) {
    state.selected = selected;
    state.anchor = anchor;
    render();
    config.onSelectionChange?.(state.selected);
  }

  function getVisible() {
    return getVisibleRows(state.measurements, state.filters, state.sort, state.columns);
  }

  function render() {
    clear(root);
    root.appendChild(renderToolbar());
    root.appendChild(renderTable());
  }

  function setSortFilterLocked(locked) {
    state.sortFilterLocked = locked;
    render();
  }

  function renderToolbar() {
    const search = h('input', {
      className: 'hb-field',
      type: 'search',
      placeholder: 'Hledat ve viditelných sloupcích...',
      value: state.filters.searchText,
      disabled: state.sortFilterLocked,
      onInput: (e) => {
        if (state.sortFilterLocked) return;
        state.filters.searchText = e.target.value;
        render();
      }
    });

    const colMenuBtn = h('button', { className: 'hb-button hb-button--secondary', onClick: toggleColMenu }, ['Sloupce']);
    const colMenuPanel = state.colMenuOpen ? renderColumnMenu() : null;

    return h('div', { className: 'hb-filterbar' }, [search, h('div', { className: 'hb-colmenu' }, [colMenuBtn, colMenuPanel])]);
  }

  function toggleColMenu() {
    state.colMenuOpen = !state.colMenuOpen;
    render();
  }

  function renderColumnMenu() {
    const labels = state.columns.map((col) =>
      h('label', {}, [
        h('input', {
          type: 'checkbox',
          checked: state.visibleColumnIds.has(col.id),
          onChange: (e) => {
            if (e.target.checked) state.visibleColumnIds.add(col.id);
            else state.visibleColumnIds.delete(col.id);
            render();
          }
        }),
        `${col.header}${col.unit ? ` (${col.unit})` : ''}`
      ])
    );
    return h('div', { className: 'hb-colmenu__panel' }, labels);
  }

  function visibleColumns() {
    return state.columns.filter((c) => state.visibleColumnIds.has(c.id));
  }

  function renderTable() {
    const columns = visibleColumns();
    const visibleRows = getVisibleRows(state.measurements, state.filters, state.sort, state.columns);
    const visibleIds = visibleRows.map((m) => m.measurementId);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => state.selected.has(id));

    const headRow = h('tr', {}, [
      h('th', { className: 'hb-col--sticky-1' }, [
        h('input', {
          type: 'checkbox',
          checked: allVisibleSelected,
          'aria-label': 'Vybrat vše (viditelné)',
          onChange: (e) => {
            state.selected = e.target.checked ? selectAllVisible(state.selected, visibleIds) : deselectAllVisible(state.selected, visibleIds);
            render();
            config.onSelectionChange?.(state.selected);
          }
        })
      ]),
      ...columns.map((col) => h('th', { className: col.type === 'number' ? 'hb-col--numeric' : null }, [renderHeaderCell(col)]))
    ]);

    const bodyRows = visibleRows.map((m) => renderRow(m, columns));

    const table = h('table', { className: 'hb-data-table' }, [h('thead', {}, [headRow]), h('tbody', {}, bodyRows)]);

    return h('div', { className: 'hb-table-wrap' }, [table]);
  }

  function renderHeaderCell(col) {
    const indicator = state.sort.columnId === col.id ? (state.sort.direction === 'asc' ? '▲' : '▼') : '';
    return h(
      'button',
      {
        className: 'hb-sort-btn',
        type: 'button',
        disabled: state.sortFilterLocked,
        onClick: () => {
          if (state.sortFilterLocked) return;
          state.sort = nextSortState(state.sort, col.id);
          render();
        }
      },
      [`${col.header}${col.unit ? ` (${col.unit})` : ''}`, h('span', { className: 'hb-sort-indicator' }, [indicator])]
    );
  }

  function renderRow(measurement, columns) {
    const id = measurement.measurementId;
    const isSelected = state.selected.has(id);
    const tr = h(
      'tr',
      {
        'aria-selected': isSelected ? 'true' : 'false',
        onDblClick: () => config.onRowActivate?.(measurement)
      },
      [
        h('td', { className: 'hb-col--sticky-1' }, [
          h('input', {
            type: 'checkbox',
            checked: isSelected,
            onClick: (e) => {
              e.stopPropagation();
              const visibleIds = getVisible().map((m) => m.measurementId);
              if (e.shiftKey) {
                const result = rangeSelect(state.selected, state.anchor, id, visibleIds);
                setSelected(result.selected, result.anchor);
              } else {
                const result = toggleSelection(state.selected, id);
                setSelected(result.selected, result.anchor);
              }
            }
          })
        ]),
        ...columns.map((col) => renderCell(measurement, col))
      ]
    );
    return tr;
  }

  function renderCell(measurement, col) {
    const value = getColumnValue(col, measurement);
    const unit = getColumnUnit(col, measurement);
    const invalid = isColumnInvalid(col, measurement);
    const editable = config.isCellEditable?.(measurement, col) ?? false;
    const className = [col.type === 'number' ? 'hb-col--numeric' : null, editable ? 'hb-cell--editable' : null, invalid ? 'hb-cell--invalid' : null]
      .filter(Boolean)
      .join(' ') || null;

    if (!editable) {
      const extra = col.renderExtra?.(measurement) ?? null;
      return h('td', { className }, [formatValue(col, value, unit) || '', extra]);
    }

    const input = h('input', {
      className: `hb-cell-input${invalid ? ' is-invalid' : ''}`,
      value: value === null || value === undefined ? '' : String(value),
      onKeydown: (e) => {
        if (e.key === 'Escape') {
          e.target.value = value === null || value === undefined ? '' : String(value);
          e.target.blur();
        } else if (e.key === 'Enter') {
          e.target.blur();
        }
      },
      onBlur: (e) => {
        commitCell(measurement, col, e.target.value);
      }
    });
    return h('td', { className }, [input]);
  }

  function commitCell(measurement, col, rawText) {
    const trimmed = rawText.trim();
    if (col.type === 'number') {
      if (trimmed === '') {
        config.onCellCommit(measurement, col, null);
        render();
        return;
      }
      const parsed = parseNumber(trimmed, { decimalSeparator: '.' });
      if (parsed.invalid) {
        render(); // revert visually to the stored value
        return;
      }
      config.onCellCommit(measurement, col, parsed.value);
    } else {
      config.onCellCommit(measurement, col, trimmed === '' ? null : trimmed);
    }
    render();
  }

  function getSort() {
    return state.sort;
  }

  function resetSort() {
    state.sort = { columnId: null, direction: null };
    render();
  }

  return { el: root, setMeasurements, getSelected, setSelected, getVisible, render, setSortFilterLocked, getSort, resetSort };
}
