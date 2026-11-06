// Format detection by file content, never by file name alone (SPEC §3:
// "formát se musí ověřovat i podle obsahu"). The file name is only used as
// a secondary hint surfaced to the user when it conflicts with content.

import { detectBom } from './decode.js';

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

export function isZipContainer(bytes) {
  if (bytes.length < 4) return false;
  return ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

/**
 * Sniffs which text-based adapter should handle this file, purely from its
 * byte content. Returns one of 'EUREKA' | 'ISY_ANDROID_CB' | 'ISY_CB' |
 * 'ISY_PRH' | null (unrecognized).
 */
export function detectTextFormat(bytes) {
  const bom = detectBom(bytes);

  if (bom === 'utf-16le' || bom === 'utf-16be') {
    const body = bytes.subarray(2);
    const sniff = new TextDecoder(bom).decode(body.subarray(0, Math.min(body.length, 400)));
    const firstLine = sniff.split(/\r\n|\n/, 1)[0] ?? '';
    if (firstLine.startsWith('sep=;')) return 'ISY_PRH';
    if (firstLine.startsWith('sep=\t')) return 'ISY_CB';
    return null;
  }

  // No BOM: sniff with a single-byte decoder, which never throws regardless
  // of the file's real encoding, purely to read the first ASCII markers.
  const sniff = new TextDecoder('windows-1252').decode(bytes.subarray(0, Math.min(bytes.length, 400)));
  const firstLine = sniff.split(/\r\n|\n/, 1)[0] ?? '';
  if (firstLine.includes('"DATE"')) return 'EUREKA';
  if (firstLine.startsWith('sep=\t')) return 'ISY_ANDROID_CB';
  return null;
}
