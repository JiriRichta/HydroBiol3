// Byte-level decoding helpers (IMP-07: never guess text encoding by content
// heuristics beyond standard BOM sniffing — everything else is explicit).

const UTF8_BOM = [0xef, 0xbb, 0xbf];
const UTF16LE_BOM = [0xff, 0xfe];
const UTF16BE_BOM = [0xfe, 0xff];

function hasBom(bytes, bom) {
  if (bytes.length < bom.length) return false;
  for (let i = 0; i < bom.length; i += 1) {
    if (bytes[i] !== bom[i]) return false;
  }
  return true;
}

/**
 * Sniffs a byte-order-mark. Returns one of 'utf-8', 'utf-16le', 'utf-16be'
 * or null when no BOM is present.
 */
export function detectBom(bytes) {
  if (hasBom(bytes, UTF16LE_BOM)) return 'utf-16le';
  if (hasBom(bytes, UTF16BE_BOM)) return 'utf-16be';
  if (hasBom(bytes, UTF8_BOM)) return 'utf-8';
  return null;
}

/**
 * Decodes raw file bytes to text. If a BOM is present it always wins and
 * is stripped; otherwise `fallbackEncoding` is used (declared per adapter
 * from the known format, never guessed from content).
 *
 * @param {Uint8Array} bytes
 * @param {string} fallbackEncoding e.g. 'utf-8' or 'windows-1252'
 * @returns {{ text: string, encoding: string }}
 */
export function decodeBytes(bytes, fallbackEncoding = 'utf-8') {
  const bom = detectBom(bytes);
  const encoding = bom ?? fallbackEncoding;
  const bomLength = bom === 'utf-8' ? 3 : bom ? 2 : 0;
  const body = bytes.subarray(bomLength);
  const decoder = new TextDecoder(encoding, { fatal: encoding === 'utf-8' });
  const text = decoder.decode(body);
  return { text, encoding };
}
