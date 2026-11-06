// Minimal test-only byte encoders for building synthetic legacy-encoding
// fixtures (windows-1252 / UTF-16LE). Not used by the application itself —
// production code only ever *decodes* these encodings (src/core/import/decode.js).

/** Encodes a string to windows-1252 bytes. Every char code must be <= 0xFF
 * (true for all ASCII plus the handful of Latin-1-range symbols — µ, °,
 * ±1 chars at the same code point in windows-1252 — that these fixtures use). */
export function encodeWindows1252(str) {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code > 0xff) {
      throw new Error(`encodeWindows1252: char code ${code} at index ${i} is out of range`);
    }
    bytes[i] = code;
  }
  return bytes;
}

/** Encodes a string to UTF-16LE bytes, with an optional BOM. */
export function encodeUtf16LE(str, { bom = true } = {}) {
  const extra = bom ? 1 : 0;
  const bytes = new Uint8Array((str.length + extra) * 2);
  let offset = 0;
  if (bom) {
    bytes[0] = 0xff;
    bytes[1] = 0xfe;
    offset = 2;
  }
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    bytes[offset + i * 2] = code & 0xff;
    bytes[offset + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return bytes;
}

/** Encodes a string to UTF-8 bytes, with an optional BOM. */
export function encodeUtf8(str, { bom = false } = {}) {
  const body = new TextEncoder().encode(str);
  if (!bom) return body;
  const out = new Uint8Array(body.length + 3);
  out[0] = 0xef;
  out[1] = 0xbb;
  out[2] = 0xbf;
  out.set(body, 3);
  return out;
}
