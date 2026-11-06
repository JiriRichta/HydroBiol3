// EUREKA probe CSV adapter (IMP-02).
//
// UTF-8, comma-delimited, quoted text fields with a space after the comma
// (",  \"...\""), decimal point, MM/DD/YY dates. `Annotation` is kept as
// plain original text and never copied into sampleNumber automatically —
// that copy is an explicit, optional Working Set action (see editSession).

import { decodeBytes } from '../decode.js';
import { parseDelimitedText } from '../delimited.js';
import { parseNumber } from '../numbers.js';
import { parseDateSlashMDY, parseTime24h } from '../datetime.js';

const METADATA_COLUMNS = new Set(['DATE', 'TIME', 'Annotation']);

const PARAM_ALIASES = {
  Temp_deg_C: { key: 'water_temperature', unit: '°C' },
  Depth_m: { key: 'depth', unit: 'm' },
  pH_units: { key: 'ph', unit: 'pH' },
  ORP_mV: { key: 'orp', unit: 'mV' },
  'SpCond_uS/cm': { key: 'specific_conductance', unit: 'uS/cm' },
  'Chl_ug/l': { key: 'chlorophyll_ugl', unit: 'ug/L' },
  Turb_NTU: { key: 'turbidity_ntu', unit: 'NTU' },
  'HDO_%Sat': { key: 'do_saturation', unit: '%' },
  'HDO_mg/l': { key: 'do_concentration', unit: 'mg/L' }
};

const EXTRA_UNITS = {
  Latitude: '°',
  Longitude: '°',
  Altitude: 'm'
};

export function looksLikeEureka(text) {
  const firstLine = text.split(/\r\n|\n/, 1)[0] ?? '';
  return firstLine.includes('"DATE"') && /Temp_deg_C/.test(text.split(/\r\n|\n/, 2)[0] ?? '');
}

// Papa Parse only recognizes a quote as a field-start when it directly
// follows the delimiter. This source consistently writes ", \"field\""
// (comma, space, quote) — RFC4180-valid intent, just with incidental
// whitespace — so we collapse that one whitespace pattern before parsing.
// This never touches content inside already-open quoted fields differently
// than content outside them would be touched, because it only matches a
// delimiter immediately followed by whitespace and an opening quote.
function normalizeQuoteSpacing(line) {
  return line.replace(/,\s+"/g, ',"');
}

function stripQuotes(cell) {
  const trimmed = String(cell ?? '').trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseEureka(bytes, fileName) {
  const { text, encoding } = decodeBytes(bytes, 'utf-8');
  const lines = text.split(/\r\n|\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { format: 'EUREKA', encoding, fileErrors: [{ code: 'EMPTY_FILE', message: `Soubor ${fileName} je prázdný.` }], rows: [] };
  }

  const fixedLines = lines.map(normalizeQuoteSpacing);
  const parsedLines = fixedLines.map((l) => parseDelimitedText(l, ',')[0] ?? []);
  const header = parsedLines[0].map(stripQuotes);

  const colIndex = {};
  header.forEach((name, i) => {
    colIndex[name] = i;
  });

  const required = ['DATE', 'TIME'];
  const missing = required.filter((c) => !(c in colIndex));
  if (missing.length > 0) {
    return {
      format: 'EUREKA',
      encoding,
      fileErrors: [{ code: 'HEADER_MISSING_COLUMNS', message: `Soubor ${fileName}: chybí povinné sloupce ${missing.join(', ')}.` }],
      rows: []
    };
  }

  const rows = [];
  for (let i = 1; i < parsedLines.length; i += 1) {
    const rawCells = parsedLines[i];
    if (rawCells.length === 1 && rawCells[0].trim() === '') continue; // blank line
    if (rawCells.length !== header.length) {
      return {
        format: 'EUREKA',
        encoding,
        fileErrors: [
          {
            code: 'CELL_COUNT_MISMATCH',
            message: `Soubor ${fileName}, řádek ${i + 1}: počet hodnot (${rawCells.length}) neodpovídá počtu sloupců hlavičky (${header.length}).`
          }
        ],
        rows: []
      };
    }
    const cellsByName = {};
    header.forEach((name, idx) => {
      cellsByName[name] = stripQuotes(rawCells[idx]);
    });

    const rowIssues = [];
    let date = null;
    let time = null;
    const dateRaw = cellsByName.DATE;
    const timeRaw = cellsByName.TIME;
    if (dateRaw && dateRaw.trim() !== '') {
      const parsed = parseDateSlashMDY(dateRaw);
      if (parsed.ok) date = parsed.date;
      else rowIssues.push({ code: 'DATE_UNPARSEABLE', severity: 'error', field: 'date', message: `Nerozpoznané datum "${dateRaw}" na řádku ${i + 1}.` });
    } else {
      rowIssues.push({ code: 'DATE_MISSING', severity: 'warning', field: 'date', message: `Chybí datum na řádku ${i + 1}.` });
    }
    if (timeRaw && timeRaw.trim() !== '') {
      const parsed = parseTime24h(timeRaw);
      if (parsed.ok) time = parsed.time;
      else rowIssues.push({ code: 'TIME_UNPARSEABLE', severity: 'error', field: 'time', message: `Nerozpoznaný čas "${timeRaw}" na řádku ${i + 1}.` });
    }

    const cells = [];
    const extra = [];
    header.forEach((name) => {
      if (METADATA_COLUMNS.has(name)) return;
      const raw = cellsByName[name];
      if (PARAM_ALIASES[name]) {
        const { key, unit } = PARAM_ALIASES[name];
        if (raw === '' || raw === undefined) return; // genuinely absent, not an error
        const num = parseNumber(raw, { decimalSeparator: '.' });
        cells.push({ key, value: num.value, unit, raw, sensorId: null, sourceColumn: name, invalid: num.invalid });
      } else if (Object.prototype.hasOwnProperty.call(EXTRA_UNITS, name)) {
        if (raw === '' || raw === undefined) return;
        extra.push({ sourceColumn: name, raw, unit: EXTRA_UNITS[name] });
      } else {
        if (raw === '' || raw === undefined) return;
        extra.push({ sourceColumn: name, raw, unit: null });
      }
    });

    rows.push({
      sourceRow: i + 1,
      date,
      time,
      site: null,
      sampleNumber: null,
      annotation: cellsByName.Annotation && cellsByName.Annotation !== '' ? cellsByName.Annotation : null,
      device: null,
      cells,
      extra,
      rowIssues,
      originalRaw: cellsByName
    });
  }

  return { format: 'EUREKA', encoding, fileErrors: [], rows };
}
