// ISY_ANDROID_CB (YSI Android companion app export) adapter (IMP-03).
//
// Windows-1252, tab-delimited ("sep=\t"), decimal comma, 12-hour clock.
// The file repeats its header before each group of data rows and the
// column set/order can change between groups — every data row is parsed
// against the header of *its own* block, never a single "first" header.

import { decodeBytes } from '../decode.js';
import { parseDelimitedText, alignRowToHeader, isBlankRow } from '../delimited.js';
import { parseDateSlashMDY, parseTime12h } from '../datetime.js';
import { parseNumber } from '../numbers.js';

const METADATA_COLUMNS = new Set(['Date (MM/DD/YYYY)', 'Time (hh:mm:ss tt)', 'Site Name']);

const PARAM_ALIASES = {
  'pH ( pH )': { key: 'ph', unit: 'pH' },
  'Sp Cond ( µS/cm )': { key: 'specific_conductance', unit: 'uS/cm' },
  'Temp ( °C )': { key: 'water_temperature', unit: '°C' },
  'DO ( % Sat )': { key: 'do_saturation', unit: '%' },
  'DO ( mg/L )': { key: 'do_concentration', unit: 'mg/L' },
  'ORP ( mV )': { key: 'orp', unit: 'mV' },
  'Cond ( µS/cm )': { key: 'conductivity', unit: 'uS/cm' },
  'Turbidity ( FNU )': { key: 'turbidity_fnu', unit: 'FNU' },
  'pH ( mV )': { key: 'ph_mv', unit: 'mV' },
  'Chlorophyll ( µg/L )': { key: 'chlorophyll_ugl', unit: 'ug/L' },
  'nLFCond ( µS/cm )': { key: 'nlf_conductivity', unit: 'uS/cm' },
  'Chlorophyll ( RFU )': { key: 'chlorophyll_rfu', unit: 'RFU' },
  'Phycocyanin ( RFU )': { key: 'phycocyanin_rfu', unit: 'RFU' },
  'Depth ( m )': { key: 'depth', unit: 'm' },
  'Phycocyanin ( µg/L )': { key: 'phycocyanin_ugl', unit: 'ug/L' },
  'Chlorophyll ( cells/mL )': { key: 'chlorophyll_cells', unit: 'cells/mL' },
  'Phycocyanin ( cells/mL )': { key: 'phycocyanin_cells', unit: 'cells/mL' }
};

const EXTRA_UNITS = {
  'Barometer ( mmHg )': 'mmHg',
  'Sal ( psu )': 'psu',
  'Battery Power ( voltage )': 'V',
  'Cable Power ( voltage )': 'V',
  'TSS ( mg/L )': 'mg/L',
  'DO ( % CB )': '%',
  'TDS ( mg/L )': 'mg/L',
  'Resistivity ( ohms-cm )': 'ohms-cm',
  'Water Density ( Sigma-T )': null,
  'Vertical Position ( m )': 'm',
  'Absolute Pressure ( psi a )': 'psi',
  'Water Density ( Sigma )': null,
  'GPS Latitude ( ° )': '°',
  'GPS Longitude ( ° )': '°',
  'DO ( % RTB )': '%',
  'Altitude ( m )': 'm',
  'Fault Code': null,
  'Time (Fract. Sec)': null
};

export function looksLikeIsyAndroid(text) {
  const lines = text.split(/\r\n|\n/, 3);
  if (!lines[0]?.startsWith('sep=\t')) return false;
  return lines.slice(1).some((l) => l.startsWith('Date (MM/DD/YYYY)'));
}

function textOrNull(cell) {
  const t = String(cell ?? '').trim();
  return t === '' ? null : t;
}

function buildRow(header, rawCells, sourceRow) {
  const byName = {};
  header.forEach((name, idx) => {
    byName[name] = rawCells[idx];
  });

  const rowIssues = [];
  let date = null;
  let time = null;

  const dateRaw = textOrNull(byName['Date (MM/DD/YYYY)']);
  if (dateRaw) {
    const parsed = parseDateSlashMDY(dateRaw);
    if (parsed.ok) date = parsed.date;
    else rowIssues.push({ code: 'DATE_UNPARSEABLE', severity: 'error', field: 'date', message: `Nerozpoznané datum "${dateRaw}" (${sourceRow}).` });
  } else {
    rowIssues.push({ code: 'DATE_MISSING', severity: 'warning', field: 'date', message: `Chybí datum (${sourceRow}).` });
  }

  const timeRaw = textOrNull(byName['Time (hh:mm:ss tt)']);
  if (timeRaw) {
    const parsed = parseTime12h(timeRaw);
    if (parsed.ok) time = parsed.time;
    else rowIssues.push({ code: 'TIME_UNPARSEABLE', severity: 'error', field: 'time', message: `Nerozpoznaný čas "${timeRaw}" (${sourceRow}).` });
  }

  const site = textOrNull(byName['Site Name']);

  const cells = [];
  const extra = [];
  header.forEach((name, idx) => {
    if (METADATA_COLUMNS.has(name) || name === '') return;
    const raw = textOrNull(rawCells[idx]);
    if (raw === null) return;
    if (PARAM_ALIASES[name]) {
      const { key, unit } = PARAM_ALIASES[name];
      const num = parseNumber(raw, { decimalSeparator: ',' });
      cells.push({ key, value: num.value, unit, raw, sensorId: null, sourceColumn: name, invalid: num.invalid });
    } else if (Object.prototype.hasOwnProperty.call(EXTRA_UNITS, name)) {
      extra.push({ sourceColumn: name, raw, unit: EXTRA_UNITS[name] });
    } else {
      extra.push({ sourceColumn: name, raw, unit: null });
    }
  });

  return {
    sourceRow,
    date,
    time,
    site,
    sampleNumber: null,
    annotation: null,
    device: null,
    cells,
    extra,
    rowIssues,
    originalRaw: byName
  };
}

export function parseIsyAndroid(bytes, fileName) {
  const { text, encoding } = decodeBytes(bytes, 'windows-1252');
  const lines = text.split(/\r\n|\n/);

  if (lines.length === 0 || !lines[0].startsWith('sep=')) {
    return {
      format: 'ISY_ANDROID_CB',
      encoding,
      fileErrors: [{ code: 'HEADER_MISMATCH', message: `Soubor ${fileName} neobsahuje očekávaný řádek "sep=\\t".` }],
      rows: []
    };
  }

  let currentHeader = null;
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue; // block separator blank line — not a measurement
    const cells = parseDelimitedText(line, '\t')[0] ?? [];
    if (isBlankRow(cells)) continue;

    if (String(cells[0] ?? '').trim() === 'Date (MM/DD/YYYY)') {
      currentHeader = cells.map((c) => String(c ?? '').trim());
      continue;
    }

    if (!currentHeader) {
      return {
        format: 'ISY_ANDROID_CB',
        encoding,
        fileErrors: [{ code: 'DATA_BEFORE_HEADER', message: `Soubor ${fileName}, řádek ${i + 1}: datový řádek se objevil před první hlavičkou bloku.` }],
        rows: []
      };
    }

    const aligned = alignRowToHeader(currentHeader, cells);
    if (!aligned.ok) {
      return {
        format: 'ISY_ANDROID_CB',
        encoding,
        fileErrors: [
          { code: 'CELL_COUNT_MISMATCH', message: `Soubor ${fileName}, řádek ${i + 1}: počet hodnot neodpovídá aktuální blokové hlavičce.` }
        ],
        rows: []
      };
    }

    rows.push(buildRow(currentHeader, aligned.row, `řádek ${i + 1}`));
  }

  return { format: 'ISY_ANDROID_CB', encoding, fileErrors: [], rows };
}
