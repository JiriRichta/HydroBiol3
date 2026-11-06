// Generic modal dialog helpers (design system §7.3). No backdrop-click-to-
// dismiss — every dialog closes only through an explicit, labeled button,
// so a draft is never silently discarded (UI-05).

import { h } from './dom.js';

let openCount = 0;

/**
 * @param {{ title: string, wide?: boolean, body: Node, actions: Node[], onClose?: () => void }} options
 * @returns {{ close: () => void, dialogEl: Node }}
 */
export function openDialog({ title, wide = false, body, actions = [], onClose }) {
  const titleId = `hb-dialog-title-${++openCount}`;
  const dialogEl = h(
    'div',
    { className: `hb-dialog${wide ? ' hb-dialog--wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    [h('h2', { id: titleId }, [title]), body, h('div', { className: 'hb-dialog__actions' }, actions)]
  );
  const overlay = h('div', { className: 'hb-dialog-overlay' }, [dialogEl]);

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
    onClose?.();
  }
  function onKeydown(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKeydown);

  document.body.appendChild(overlay);
  const firstFocusable = dialogEl.querySelector('input, select, textarea, button');
  firstFocusable?.focus();

  return { close, dialogEl };
}

/** Simple OK/Cancel confirmation. Resolves true/false. */
export function confirmDialog({ title, message, confirmLabel = 'Potvrdit', cancelLabel = 'Storno', danger = false }) {
  return new Promise((resolve) => {
    let resolved = false;
    const { close } = openDialog({
      title,
      body: h('p', {}, [message]),
      actions: [
        h('button', {
          className: 'hb-button hb-button--secondary',
          onClick: () => {
            resolved = true;
            close();
            resolve(false);
          }
        }, [cancelLabel]),
        h('button', {
          className: `hb-button hb-button--primary${danger ? ' hb-button--danger' : ''}`,
          onClick: () => {
            resolved = true;
            close();
            resolve(true);
          }
        }, [confirmLabel])
      ],
      onClose: () => {
        if (!resolved) resolve(false);
      }
    });
  });
}

/**
 * The three-way "Uložit změny / Zahodit změny / Pokračovat v editaci" guard
 * required wherever an active bulk-edit session is interrupted (SPEC §5.3
 * mode C, UI-05, AT-25).
 * @returns {Promise<'save'|'discard'|'continue'>}
 */
export function saveDiscardContinueDialog({ title = 'Nedokončená hromadná editace', message } = {}) {
  return new Promise((resolve) => {
    let resolved = false;
    const { close } = openDialog({
      title,
      body: h('p', {}, [message ?? 'Máte rozpracovanou hromadnou editaci. Co s ní chcete udělat?']),
      actions: [
        h('button', {
          className: 'hb-button hb-button--secondary',
          onClick: () => {
            resolved = true;
            close();
            resolve('continue');
          }
        }, ['Pokračovat v editaci']),
        h('button', {
          className: 'hb-button hb-button--secondary',
          onClick: () => {
            resolved = true;
            close();
            resolve('discard');
          }
        }, ['Zahodit změny']),
        h('button', {
          className: 'hb-button hb-button--primary',
          onClick: () => {
            resolved = true;
            close();
            resolve('save');
          }
        }, ['Uložit změny'])
      ],
      onClose: () => {
        if (!resolved) resolve('continue');
      }
    });
  });
}

export { h };
