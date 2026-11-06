// Thin wrapper around lucide for the handful of icons this app uses
// (design system §8: Lucide, rounded strokes, never colored emoji).

import { createElement, Upload, Trash2, TriangleAlert, CircleCheck, Download, Pencil, FlaskConical } from 'lucide';

const ICONS = {
  upload: Upload,
  trash: Trash2,
  warning: TriangleAlert,
  success: CircleCheck,
  download: Download,
  edit: Pencil,
  mix: FlaskConical
};

/** Returns a small inline SVG element for the named icon, 16-18px per the design system. */
export function icon(name, { size = 16 } = {}) {
  const def = ICONS[name];
  if (!def) throw new Error(`Unknown icon "${name}"`);
  const el = createElement(def);
  el.setAttribute('width', String(size));
  el.setAttribute('height', String(size));
  el.setAttribute('aria-hidden', 'true');
  el.classList.add('hb-icon');
  return el;
}
