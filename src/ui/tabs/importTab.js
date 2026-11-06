// Import tab (SPEC §5.1): drop/select files, show per-file diagnostics,
// collect the required explicit conductivity/depth options, then commit
// every ready file atomically into the source store.

import { h, replaceChildren } from '../dom.js';
import { icon } from '../icon.js';
import { analyzeFile, commitAnalysis } from '../../core/import/pipeline.js';
import { PARAMETERS } from '../../core/registry/parameters.js';

const FORMAT_LABELS = {
  EUREKA: 'EUREKA',
  ISY_ANDROID_CB: 'ISY Android (ČB)',
  ISY_CB: 'ISY KorEXO (ČB)',
  ISY_PRH: 'ISY KorEXO (Praha)',
  WTW_CB: 'WTW Multi 3630 (ČB)'
};

export function createImportTab({ sourceStore, onCommitted }) {
  const pending = []; // { key, fileName, bytes, analysis, options }
  let keyCounter = 0;

  const listEl = h('div', { className: 'hb-import-list' });
  const commitBtn = h('button', { className: 'hb-button hb-button--primary', onClick: commitReady, disabled: true }, ['Načíst data']);

  const fileInput = h('input', {
    type: 'file',
    multiple: true,
    accept: '.csv,.xlsx',
    onChange: (e) => handleFiles(Array.from(e.target.files ?? []))
  });

  const dropzone = h(
    'div',
    {
      className: 'hb-dropzone',
      onDragover: (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      },
      onDragleave: () => dropzone.classList.remove('is-dragover'),
      onDrop: (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        handleFiles(Array.from(e.dataTransfer?.files ?? []));
      },
      onClick: () => fileInput.click()
    },
    [
      icon('upload', { size: 28 }),
      h('p', {}, ['Přetáhněte soubory sem, nebo klikněte pro výběr (CSV, XLSX).']),
      h('button', { className: 'hb-button hb-button--secondary', type: 'button', onClick: (e) => { e.stopPropagation(); fileInput.click(); } }, ['Vybrat soubory']),
      fileInput
    ]
  );

  const root = h('div', { className: 'hb-panel__body' }, [
    dropzone,
    listEl,
    h('div', { className: 'hb-panel__toolbar' }, [h('div', { className: 'hb-panel__toolbar-spacer' }), commitBtn])
  ]);

  async function handleFiles(files) {
    for (const file of files) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const analysis = await analyzeFile({ bytes, fileName: file.name }, sourceStore);
      pending.push({
        key: `f${keyCounter++}`,
        fileName: file.name,
        bytes,
        analysis,
        options: { convertConductivity: null, correctNegativeDepth: null }
      });
    }
    fileInput.value = '';
    render();
  }

  function isReady(entry) {
    if (!entry.analysis.importable) return false;
    if (entry.analysis.needsOptions.conductivity && entry.options.convertConductivity === null) return false;
    if (entry.analysis.needsOptions.depth && entry.options.correctNegativeDepth === null) return false;
    return true;
  }

  function render() {
    replaceChildren(listEl, pending.map(renderCard));
    commitBtn.disabled = !pending.some(isReady);
  }

  function renderCard(entry) {
    const { analysis } = entry;
    const isError = !analysis.importable;

    const issues = [...analysis.fileErrors.map((e) => ({ ...e, severity: 'error' })), ...(analysis.rowDiagnostics ?? []).filter((d) => d.severity !== 'info')];

    const issuesEl = issues.length
      ? h(
          'div',
          { className: 'hb-import-card__issues' },
          issues.slice(0, 8).map((issue) => h('div', { className: `hb-status--${issue.severity}` }, [icon('warning', { size: 14 }), ` ${issue.message}`]))
        )
      : null;

    const paramsSummary = analysis.detectedParams?.length
      ? `Parametry: ${analysis.detectedParams.map((k) => PARAMETERS[k]?.label ?? k).join(', ')}`
      : null;

    const optionsEl = h('div', { className: 'hb-import-card__options' }, [
      analysis.needsOptions?.conductivity ? renderConductivityOptions(entry) : null,
      analysis.needsOptions?.depth ? renderDepthOptions(entry) : null
    ]);

    return h('div', { className: `hb-import-card${isError ? ' is-error' : ''}` }, [
      h('div', { className: 'hb-import-card__head' }, [
        h('span', { className: 'hb-import-card__name' }, [entry.fileName]),
        h('span', { className: 'hb-import-card__meta' }, [
          analysis.format ? FORMAT_LABELS[analysis.format] ?? analysis.format : 'nerozpoznaný formát',
          analysis.importable ? ` • ${analysis.measurementCount} měření` : ''
        ]),
        h('div', { className: 'hb-import-card__spacer' }),
        h('button', { className: 'hb-button hb-button--secondary', onClick: () => removeEntry(entry.key) }, ['Odstranit'])
      ]),
      paramsSummary ? h('div', { className: 'hb-import-card__meta' }, [paramsSummary]) : null,
      issuesEl,
      analysis.importable ? optionsEl : null
    ]);
  }

  function renderConductivityOptions(entry) {
    const name = `cond-${entry.key}`;
    return h('div', { className: 'hb-option-group' }, [
      h('div', { className: 'hb-option-group__label' }, ['Vodivost (µS/cm nalezena)']),
      h('label', {}, [
        h('input', {
          type: 'radio',
          name,
          checked: entry.options.convertConductivity === true,
          onChange: () => { entry.options.convertConductivity = true; render(); }
        }),
        'Převést na mS/m (÷10)'
      ]),
      h('label', {}, [
        h('input', {
          type: 'radio',
          name,
          checked: entry.options.convertConductivity === false,
          onChange: () => { entry.options.convertConductivity = false; render(); }
        }),
        'Ponechat původní jednotku (µS/cm)'
      ])
    ]);
  }

  function renderDepthOptions(entry) {
    const name = `depth-${entry.key}`;
    return h('div', { className: 'hb-option-group' }, [
      h('div', { className: 'hb-option-group__label' }, ['Záporná hloubka nalezena']),
      h('label', {}, [
        h('input', {
          type: 'radio',
          name,
          checked: entry.options.correctNegativeDepth === true,
          onChange: () => { entry.options.correctNegativeDepth = true; render(); }
        }),
        'Korigovat záporné hodnoty na 0 m'
      ]),
      h('label', {}, [
        h('input', {
          type: 'radio',
          name,
          checked: entry.options.correctNegativeDepth === false,
          onChange: () => { entry.options.correctNegativeDepth = false; render(); }
        }),
        'Ponechat původní hodnoty'
      ])
    ]);
  }

  function removeEntry(key) {
    const idx = pending.findIndex((e) => e.key === key);
    if (idx >= 0) pending.splice(idx, 1);
    render();
  }

  function commitReady() {
    const ready = pending.filter(isReady);
    let committedAny = false;
    ready.forEach((entry) => {
      const result = commitAnalysis(entry.analysis, entry.options, sourceStore);
      if (result.ok) {
        committedAny = true;
        const idx = pending.indexOf(entry);
        pending.splice(idx, 1);
      } else {
        entry.analysis.importable = false;
        entry.analysis.fileErrors = [result.error];
      }
    });
    render();
    if (committedAny) onCommitted();
  }

  render();
  return { el: root };
}
