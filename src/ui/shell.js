// App shell: header (brand, tabs, session note) + tab-switch guard against
// an active bulk-edit session (SPEC §5, UI-05, AT-25). The actual
// save/discard/continue decision lives in workingTab.confirmLeave(), which
// the caller passes in as `canLeaveTab`.

import { h } from './dom.js';

const TABS = [
  { id: 'import', label: 'Import' },
  { id: 'data', label: 'Data' },
  { id: 'working', label: 'Pracovní sada' },
  { id: 'export', label: 'Export' }
];

export function createShell({ onTabChange, canLeaveTab }) {
  let activeTab = 'import';
  const counts = { data: 0, working: 0, warnings: 0 };

  const tabButtons = new Map();

  const tabsEl = h(
    'div',
    { className: 'hb-tabs', role: 'tablist', 'aria-label': 'Hlavní navigace' },
    TABS.map((tab) => {
      const btn = h(
        'button',
        {
          className: 'hb-tab',
          role: 'tab',
          'aria-selected': tab.id === activeTab ? 'true' : 'false',
          onClick: () => requestTabChange(tab.id)
        },
        [tab.label, h('span', { className: 'hb-tab__count' }, [String(countFor(tab.id))])]
      );
      tabButtons.set(tab.id, btn);
      return btn;
    })
  );

  const headerEl = h('header', { className: 'hb-header' }, [
    h('div', { className: 'hb-header__brand' }, [
      h('img', { className: 'hb-header__symbol', src: '/assets/hydrobiol3-symbol.svg', alt: '', width: '32', height: '32' }),
      h('span', { className: 'hb-header__wordmark' }, ['HydroBiol', h('span', { className: 'hb-three' }, ['3'])])
    ]),
    tabsEl,
    h('div', { className: 'hb-header__session' }, [
      h('span', { className: 'hb-header__session-dot' }),
      'Lokální relace – data se neukládají na server',
      h('span', { className: 'hb-header__warnings' })
    ])
  ]);
  const warningsEl = headerEl.querySelector('.hb-header__warnings');

  function countFor(tabId) {
    if (tabId === 'data') return counts.data;
    if (tabId === 'working') return counts.working;
    return 0;
  }

  function updateCounts(next) {
    Object.assign(counts, next);
    TABS.forEach((tab) => {
      const btn = tabButtons.get(tab.id);
      const countSpan = btn.querySelector('.hb-tab__count');
      countSpan.textContent = String(countFor(tab.id));
    });
    warningsEl.textContent = counts.warnings > 0 ? ` • ${counts.warnings} varování` : '';
  }

  async function requestTabChange(tabId) {
    if (tabId === activeTab) return;
    const allowed = canLeaveTab ? await canLeaveTab(activeTab, tabId) : true;
    if (!allowed) return;
    setActiveTab(tabId);
    onTabChange(tabId);
  }

  function setActiveTab(tabId) {
    activeTab = tabId;
    TABS.forEach((tab) => {
      tabButtons.get(tab.id).setAttribute('aria-selected', tab.id === tabId ? 'true' : 'false');
    });
  }

  return { headerEl, updateCounts, requestTabChange, getActiveTab: () => activeTab, setActiveTab };
}
