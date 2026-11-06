// ISY_PRH (YSI EXO KorEXO export, Praha, plain columns) adapter.
//
// UTF-16LE with BOM, semicolon-delimited, decimal comma, DD/MM/YYYY dates.
// Shares the KorEXO canonical alias table with ISY_CB (korExoShared.js) —
// same probe software, just without per-sensor-id header suffixes.

import { decodeBytes } from '../decode.js';
import { parseDelimitedText, alignRowToHeader, isBlankRow } from '../delimited.js';
import { parseDateSlashDMY } from '../datetime.js';
import { parseNumber } from '../numbers.js';
import { parseKorExoRow } from './korExoShared.js';

export function looksLikeIsyPrh(text) {
  const lines = text.split(/\r\n|\n/);
  return Boolean(lines[0]?.startsWith('sep=;') && /^Date;Time;Site;Unit ID/.test(lines[1] ?? ''));
}

export function parseIsyPrh(bytes, fileName) {
  const { text, encoding } = decodeBytes(bytes, 'utf-8');
  const allRows = parseDelimitedText(text, ';');

  if (allRows.length < 2) {
    return {
      format: 'ISY_PRH',
      encoding,
      fileErrors: [{ code: 'EMPTY_FILE', message: `Soubor ${fileName} je prázdný nebo neobsahuje hlavičku.` }],
      rows: []
    };
  }

  const header = allRows[1].map((h) => String(h ?? '').trim());
  if (header[0] !== 'Date' || header[1] !== 'Time' || header[2] !== 'Site') {
    return {
      format: 'ISY_PRH',
      encoding,
      fileErrors: [{ code: 'HEADER_MISMATCH', message: `Soubor ${fileName} nemá očekávanou hlavičku formátu ISY_PRH.` }],
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
        format: 'ISY_PRH',
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
        parseDate: parseDateSlashDMY,
        decimalSeparator: ',',
        hasSensorSuffix: false,
        numberParser: parseNumber
      })
    );
  }

  return { format: 'ISY_PRH', encoding, fileErrors: [], rows };
}
