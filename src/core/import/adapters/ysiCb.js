// ISY_CB (YSI EXO KorEXO export, ČB, per-sensor-id columns) adapter (IMP-04).
//
// UTF-16LE with BOM, tab-delimited, decimal point, MM/DD/YYYY dates.
// Column headers carry a "-<sensorId>" suffix so that two sensors reporting
// the same physical quantity are distinguishable; a genuine collision (both
// populated in the same row) is detected generically in normalize.js and
// rejects the whole file (IMP-04), never silently prioritized or averaged.

import { decodeBytes } from '../decode.js';
import { parseDelimitedText, alignRowToHeader, isBlankRow } from '../delimited.js';
import { parseDateSlashMDY } from '../datetime.js';
import { parseNumber } from '../numbers.js';
import { parseKorExoRow } from './korExoShared.js';

export function looksLikeIsyCb(text) {
  const lines = text.split(/\r\n|\n/);
  return Boolean(lines[0]?.startsWith('sep=') && /^Date\tTime\tSite\tUnit ID/.test(lines[1] ?? ''));
}

export function parseIsyCb(bytes, fileName) {
  const { text, encoding } = decodeBytes(bytes, 'utf-8');
  const allRows = parseDelimitedText(text, '\t');

  if (allRows.length < 2) {
    return {
      format: 'ISY_CB',
      encoding,
      fileErrors: [{ code: 'EMPTY_FILE', message: `Soubor ${fileName} je prázdný nebo neobsahuje hlavičku.` }],
      rows: []
    };
  }

  const header = allRows[1].map((h) => String(h ?? '').trim());
  if (header[0] !== 'Date' || header[1] !== 'Time' || header[2] !== 'Site') {
    return {
      format: 'ISY_CB',
      encoding,
      fileErrors: [{ code: 'HEADER_MISMATCH', message: `Soubor ${fileName} nemá očekávanou hlavičku formátu ISY_CB.` }],
      rows: []
    };
  }

  const rows = [];
  for (let i = 2; i < allRows.length; i += 1) {
    const rawCells = allRows[i];
    if (isBlankRow(rawCells)) continue;
    const aligned = alignRowToHeader(header, rawCells);
    if (!aligned.ok) {
      return {
        format: 'ISY_CB',
        encoding,
        fileErrors: [
          { code: 'CELL_COUNT_MISMATCH', message: `Soubor ${fileName}, řádek ${i + 1}: počet hodnot neodpovídá hlavičce.` }
        ],
        rows: []
      };
    }
    rows.push(
      parseKorExoRow({
        header,
        rawCells: aligned.row,
        sourceRow: `řádek ${i + 1}`,
        parseDate: parseDateSlashMDY,
        decimalSeparator: '.',
        hasSensorSuffix: true,
        numberParser: parseNumber
      })
    );
  }

  return { format: 'ISY_CB', encoding, fileErrors: [], rows };
}
