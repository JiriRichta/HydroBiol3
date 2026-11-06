// Minimal DOM-building helper — intentionally not a framework. Builds one
// element per call, with the same ergonomics as JSX without any build
// step, diffing or component model (plan §7: "jednoduchý tabulkový editor,
// ne Excel-like framework").

const SVG_TAGS = new Set(['svg', 'path', 'circle', 'line', 'rect', 'g', 'polyline', 'polygon']);

/**
 * @param {string} tag
 * @param {object} [props]  attributes, plus `className`, `dataset`, `on<Event>` handlers, `html` (trusted-only, never user data)
 * @param {Array} [children]  strings, nodes, or falsy values to skip
 */
export function h(tag, props = {}, children = []) {
  const el = SVG_TAGS.has(tag) ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (key === 'className') {
      el.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dk, dv]) => {
        el.dataset[dk] = dv;
      });
    } else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      el.innerHTML = value; // caller-trusted static markup only, never raw user/measurement data
    } else if (value === true) {
      el.setAttribute(key, '');
    } else {
      el.setAttribute(key, String(value));
    }
  });
  (children || []).forEach((child) => {
    if (child === null || child === undefined || child === false) return;
    el.appendChild(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  });
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function replaceChildren(el, children) {
  clear(el);
  children.forEach((c) => c && el.appendChild(c));
}
