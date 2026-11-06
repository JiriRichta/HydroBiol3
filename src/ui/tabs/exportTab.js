// Export tab (SPEC §5.4, §7, plan §6a): profile + scope selection, exact
// preview, two-class validation and the actual XLSX download.

import { h, clear } from '../dom.js';
import { icon } from '../icon.js';
import { confirmDialog } from '../dialogs.js';
import { EXPORT_PROFILES } from '../../core/export/profiles.js';
import { buildExportRows } from '../../core/export/buildRows.js';
import { validateExportRows, findUnitMismatchIds } from '../../core/export/validateExport.js';
import { buildWorkbook, workbookToBytes, readBackWorkbook } from '../../core/export/writeXlsx.js';
import { applyConductivityConversion } from '../../core/import/transforms.js';
import { cloneMeasurementSnapshot } from '../../core/model/measurement.js';

function excelSheetSafeName(prefix) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`.slice(0, 31);
}

export function createExportTab({ workingSet, editSession }) {
  const state = {
    profileId: 'CB',
    scope: 'all', // 'all' | 'selected'
    preselected: [],
    acknowledgedUnverified: false,
    fileName: ''
  };

  const sideEl = h('div', { className: 'hb-export-side' });
  const mainEl = h('div', { className: 'hb-export-main' });

  const root = h('div', { className: 'hb-panel__body' }, [h('div', { className: 'hb-export-layout' }, [sideEl, mainEl])]);

  function setPreselection(ids) {
    state.preselected = ids;
    state.scope = ids.length > 0 ? 'selected' : 'all';
    render();
  }

  function currentMeasurementsInOrder() {
    const order = workingSet.getOrder();
    if (state.scope === 'selected') {
      const set = new Set(state.preselected);
      return order.filter((id) => set.has(id)).map((id) => workingSet.get(id));
    }
    return order.map((id) => workingSet.get(id));
  }

  function render() {
    renderSide();
    renderMain();
  }

  function renderSide() {
    clear(sideEl);
    const profileCards = Object.values(EXPORT_PROFILES).map((profile) =>
      h('label', { className: 'hb-radio-card' }, [
        h('input', {
          type: 'radio',
          name: 'export-profile',
          checked: state.profileId === profile.id,
          onChange: () => {
            state.profileId = profile.id;
            render();
          }
        }),
        h('span', {}, [profile.label])
      ])
    );

    const scopeCards = [
      h('label', { className: 'hb-radio-card' }, [
        h('input', {
          type: 'radio',
          name: 'export-scope',
          checked: state.scope === 'all',
          onChange: () => {
            state.scope = 'all';
            render();
          }
        }),
        h('span', {}, [`Celá Pracovní sada (${workingSet.size()})`])
      ]),
      h('label', { className: 'hb-radio-card' }, [
        h('input', {
          type: 'radio',
          name: 'export-scope',
          checked: state.scope === 'selected',
          disabled: state.preselected.length === 0,
          onChange: () => {
            state.scope = 'selected';
            render();
          }
        }),
        h('span', {}, [`Aktuálně vybraná (${state.preselected.length})`])
      ])
    ];

    sideEl.appendChild(h('div', { className: 'hb-dialog__section-title' }, ['Profil']));
    sideEl.appendChild(h('div', {}, profileCards));
    sideEl.appendChild(h('div', { className: 'hb-dialog__section-title' }, ['Rozsah']));
    sideEl.appendChild(h('div', {}, scopeCards));
    sideEl.appendChild(h('div', { className: 'hb-dialog__section-title' }, ['Název souboru']));
    sideEl.appendChild(
      h('input', {
        className: 'hb-field',
        type: 'text',
        placeholder: defaultFileName(),
        value: state.fileName,
        onInput: (e) => {
          state.fileName = e.target.value;
        }
      })
    );
  }

  function defaultFileName() {
    const profile = EXPORT_PROFILES[state.profileId];
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `LabSystem_${profile.id}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.xlsx`;
  }

  function renderMain() {
    clear(mainEl);

    if (editSession.isActive()) {
      mainEl.appendChild(h('div', { className: 'hb-banner hb-banner--danger' }, ['Export je blokován: Pracovní sada má otevřenou neuzavřenou editaci. Dokončete ji nejprve na záložce Pracovní sada.']));
      return;
    }

    const profile = EXPORT_PROFILES[state.profileId];
    const measurements = currentMeasurementsInOrder();

    if (measurements.length === 0) {
      mainEl.appendChild(h('div', { className: 'hb-empty-state' }, ['Zvolený rozsah neobsahuje žádná měření.']));
      return;
    }

    const rows = buildExportRows(profile, measurements);
    const validation = validateExportRows(profile, rows, { acknowledgedUnverified: state.acknowledgedUnverified });

    mainEl.appendChild(h('p', {}, [`Export: ${measurements.length} měření, profil ${profile.label}.`]));

    if (validation.blocking.length > 0) {
      mainEl.appendChild(h('div', { className: 'hb-dialog__section-title' }, ['Blokující chyby (nelze obejít potvrzením)']));
      mainEl.appendChild(
        h(
          'div',
          { className: 'hb-issue-list' },
          validation.blocking.map((issue) => renderBlockingIssue(issue, profile, measurements))
        )
      );
    }

    if (validation.warnings.length > 0 || profile.columns.some((c) => c.mapping === 'unverified')) {
      mainEl.appendChild(renderAcknowledgeBox(profile));
    }

    mainEl.appendChild(h('div', { className: 'hb-dialog__section-title' }, ['Náhled']));
    mainEl.appendChild(renderPreviewTable(profile, rows));

    const downloadBtn = h(
      'button',
      {
        className: 'hb-button hb-button--primary',
        disabled: !validation.ok,
        onClick: () => doDownload(profile, rows)
      },
      [icon('download'), ' Stáhnout XLSX']
    );
    mainEl.appendChild(h('div', { className: 'hb-panel__toolbar' }, [h('div', { className: 'hb-panel__toolbar-spacer' }), downloadBtn]));
  }

  function renderBlockingIssue(issue, profile, measurements) {
    const canFix = issue.code === 'UNIT_MISMATCH' && issue.requireUnit === 'mS/m';
    return h('div', { className: 'hb-issue-list__item' }, [
      h('span', {}, [issue.message]),
      canFix
        ? h(
            'button',
            {
              className: 'hb-button hb-button--secondary',
              onClick: () => fixConductivity(profile, measurements, issue.field)
            },
            [`Převést vodivost µS/cm → mS/m u ${issue.measurementIds.length} záznamů`]
          )
        : null
    ]);
  }

  function fixConductivity(profile, measurements, columnHeader) {
    const column = profile.columns.find((c) => c.header === columnHeader);
    const key = column?.source?.startsWith('param:') ? column.source.slice('param:'.length) : null;
    if (!key) return;
    const rows = buildExportRows(profile, measurements);
    const validation = validateExportRows(profile, rows, { acknowledgedUnverified: true });
    const ids = findUnitMismatchIds(validation, columnHeader);
    ids.forEach((id) => {
      const updated = cloneMeasurementSnapshot(workingSet.get(id));
      applyConductivityConversion(updated, { convert: true });
      workingSet.replaceSnapshot(id, updated);
    });
    render();
  }

  function renderAcknowledgeBox(profile) {
    const unverified = profile.columns.filter((c) => c.mapping === 'unverified').map((c) => c.header);
    return h('div', { className: 'hb-ack-box' }, [
      h('input', {
        type: 'checkbox',
        checked: state.acknowledgedUnverified,
        onChange: (e) => {
          state.acknowledgedUnverified = e.target.checked;
          render();
        }
      }),
      h('span', {}, [
        `Beru na vědomí, že mapování sloupců ${unverified.join(', ')} do LabSystemu nebylo odborně ověřeno (viz SPEC §11) a export přesto chci stáhnout.`
      ])
    ]);
  }

  function renderPreviewTable(profile, rows) {
    const headerCells = profile.columns.map((c) => h('th', {}, [c.header ?? '']));
    const previewRows = rows.length <= 10 ? rows : [...rows.slice(0, 5), null, ...rows.slice(-5)];
    const bodyRows = previewRows.map((row) => {
      if (row === null) return h('tr', {}, profile.columns.map(() => h('td', {}, ['…'])));
      return h(
        'tr',
        {},
        row.cells.map((cell) => h('td', { className: cell.column.type === 'number' ? 'hb-col--numeric' : null }, [formatPreviewValue(cell)]))
      );
    });
    return h('div', { className: 'hb-table-wrap' }, [h('table', { className: 'hb-data-table' }, [h('thead', {}, [h('tr', {}, headerCells)]), h('tbody', {}, bodyRows)])]);
  }

  function formatPreviewValue(cell) {
    if (cell.value === null || cell.value === undefined || cell.value === '') return '';
    return String(cell.value);
  }

  function doDownload(profile, rows) {
    const validation = validateExportRows(profile, rows, { acknowledgedUnverified: state.acknowledgedUnverified });
    if (!validation.ok) return;

    const sheetName = profile.sheetName ?? excelSheetSafeName('export');
    const workbook = buildWorkbook(profile, rows, { sheetName });
    const bytes = workbookToBytes(workbook);

    // Integrity check: re-read what we just wrote before offering it (plan §6a).
    const back = readBackWorkbook(bytes);
    if (back.rowCount !== rows.length || back.header.length !== profile.columns.length) {
      confirmDialog({
        title: 'Export zastaven',
        message: 'Interní kontrola zjistila, že vygenerovaný soubor neodpovídá očekávanému obsahu (počet řádků/sloupců). Export byl bezpečně zastaven, stažení neproběhlo.',
        confirmLabel: 'Rozumím',
        cancelLabel: 'Zavřít'
      });
      return;
    }

    const fileName = sanitizeFileName(state.fileName.trim() || defaultFileName());
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: fileName });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function sanitizeFileName(name) {
    const base = name.replace(/[\\/:*?"<>|]/g, '_');
    return base.toLowerCase().endsWith('.xlsx') ? base : `${base}.xlsx`;
  }

  render();
  return { el: root, setPreselection, refresh: render };
}
