// App bootstrap. No framework, no bundler magic beyond Vite's plain ESM
// handling — every module here is a small factory function wired together
// in one place.

import '@fontsource/quicksand/500.css';
import '@fontsource/quicksand/600.css';
import '@fontsource/quicksand/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles/app.css';

import { h, clear } from './ui/dom.js';
import { createShell } from './ui/shell.js';
import { createImportTab } from './ui/tabs/importTab.js';
import { createDataTab } from './ui/tabs/dataTab.js';
import { createWorkingTab } from './ui/tabs/workingTab.js';
import { createExportTab } from './ui/tabs/exportTab.js';
import { createSourceStore } from './core/store/sourceStore.js';
import { createWorkingSet } from './core/store/workingSet.js';
import { createEditSession } from './core/store/editSession.js';
import { validateMeasurement } from './core/validation/validate.js';

const sourceStore = createSourceStore();
const workingSet = createWorkingSet();
const editSession = createEditSession();

function computeWarningCount() {
  return workingSet
    .getAll()
    .reduce((sum, m) => sum + validateMeasurement(m).filter((i) => i.severity !== 'info').length, 0);
}

function refreshCounts() {
  shell.updateCounts({ data: sourceStore.size(), working: workingSet.size(), warnings: computeWarningCount() });
}

const importTab = createImportTab({
  sourceStore,
  onCommitted: () => {
    refreshCounts();
    dataTab.refresh();
    shell.setActiveTab('data');
    showPanel('data');
  }
});

const dataTab = createDataTab({
  sourceStore,
  workingSet,
  onAdded: () => {
    refreshCounts();
    workingTab.refresh();
  }
});

const workingTab = createWorkingTab({
  workingSet,
  editSession,
  onChanged: () => {
    refreshCounts();
    dataTab.refresh(); // "already in Working Set" badges may have changed
  },
  onRequestExport: (selectedIds) => {
    exportTab.setPreselection(selectedIds);
    shell.requestTabChange('export');
  }
});

const exportTab = createExportTab({ workingSet, editSession });

const panels = {
  import: h('div', { className: 'hb-panel is-active' }, [importTab.el]),
  data: h('div', { className: 'hb-panel' }, [dataTab.el]),
  working: h('div', { className: 'hb-panel' }, [workingTab.el]),
  export: h('div', { className: 'hb-panel' }, [exportTab.el])
};

function showPanel(tabId) {
  Object.entries(panels).forEach(([id, el]) => {
    el.classList.toggle('is-active', id === tabId);
  });
  if (tabId === 'data') dataTab.refresh();
  if (tabId === 'working') workingTab.refresh();
  if (tabId === 'export') exportTab.refresh();
}

const shell = createShell({
  onTabChange: (tabId) => showPanel(tabId),
  canLeaveTab: async (fromTabId) => {
    if (fromTabId === 'working') return workingTab.confirmLeave();
    return true;
  }
});

const mainEl = h('main', { className: 'hb-main' }, Object.values(panels));
const app = document.getElementById('app');
clear(app);
app.appendChild(shell.headerEl);
app.appendChild(mainEl);

refreshCounts();

// UI-06: the whole session lives only in memory — warn before an
// accidental reload/close if there is unexported work.
window.addEventListener('beforeunload', (e) => {
  if (sourceStore.size() > 0 || workingSet.size() > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});
