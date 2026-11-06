// Thin, explicit wrapper around Papa Parse for CSV/TSV tokenization.
//
// We never use Papa's header/dynamic-typing/auto-delimiter-detection
// features: adapters declare the exact delimiter for their known format,
// and interpret headers/blocks themselves (IMP-02..IMP-07).

import Papa from 'papaparse';

/**
 * Tokenizes delimited text into an array of raw string-cell rows. Quoted
 * fields are unescaped by Papa Parse; nothing is type-coerced.
 *
 * @param {string} text
 * @param {string} delimiter single character, e.g. ',' '\t' ';'
 * @returns {string[][]}
 */
export function parseDelimitedText(text, delimiter) {
  const result = Papa.parse(text, {
    delimiter,
    dynamicTyping: false,
    skipEmptyLines: false,
    newline: undefined // auto-detect \r\n vs \n
  });
  return result.data;
}

/** True if a tokenized row has no non-empty cells (a separator/blank line). */
export function isBlankRow(row) {
  return !row || row.every((cell) => String(cell ?? '').trim() === '');
}

/**
 * Aligns a data row to its header length. Several real-world exports add a
 * stray trailing delimiter (producing one extra empty cell) or omit the
 * final delimiter on the very last line (producing one cell too few) —
 * neither of those represents an actual data discrepancy, so they're
 * reconciled here. Any other length mismatch is reported as a real error
 * because we must not misalign values with the wrong column header.
 *
 * @returns {{ ok: true, row: string[] } | { ok: false, error: string }}
 */
export function alignRowToHeader(header, row) {
  if (row.length === header.length) return { ok: true, row };
  if (row.length === header.length + 1 && String(row[row.length - 1] ?? '').trim() === '') {
    return { ok: true, row: row.slice(0, header.length) };
  }
  if (row.length === header.length - 1) {
    return { ok: true, row: [...row, ''] };
  }
  return { ok: false, error: 'CELL_COUNT_MISMATCH' };
}
