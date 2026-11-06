// Explicit, format-aware number parsing (IMP-07).
//
// An empty string is never the same as zero, and an unparsable value is
// flagged as invalid rather than silently coerced to 0.

/**
 * @param {string|null|undefined} raw
 * @param {{ decimalSeparator?: '.'|',' }} [options]
 * @returns {{ value: number|null, invalid: boolean, empty: boolean, raw: string }}
 */
export function parseNumber(raw, { decimalSeparator = '.' } = {}) {
  if (raw === null || raw === undefined) {
    return { value: null, invalid: false, empty: true, raw: '' };
  }
  const text = String(raw).trim();
  if (text === '') {
    return { value: null, invalid: false, empty: true, raw: text };
  }
  let normalized = text;
  if (decimalSeparator === ',') {
    // These sources never use a thousands separator alongside a comma
    // decimal, so a straight swap is safe and explicit.
    normalized = normalized.replace(',', '.');
  }
  // Reject anything that still isn't a plain signed decimal/scientific number
  // (guards against stray units or text leaking through as "numbers").
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(normalized)) {
    return { value: null, invalid: true, empty: false, raw: text };
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { value: null, invalid: true, empty: false, raw: text };
  }
  return { value, invalid: false, empty: false, raw: text };
}
