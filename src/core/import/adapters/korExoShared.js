// Shared alias table for the YSI EXO / KorEXO export family.
//
// ISY_CB and ISY_PRH come from the same probe software and use identical
// column labels — ISY_CB simply suffixes each with a "-<sensorId>" tag
// (IMP-04). Sharing this table avoids duplicating the same explicit,
// hand-verified alias list twice; each adapter still owns its own parsing
// (delimiter, encoding, sensor-suffix handling) separately.
//
// Every entry here was verified against the real header text in
// fixtures/input/ISY_CB_*.csv and fixtures/input/ISY_PRH_*.csv — nothing is
// inferred from name similarity (IMP-05).

export const KOREXO_METADATA_COLUMNS = new Set(['Date', 'Time', 'Site', 'Unit ID', 'User ID']);

export const KOREXO_PARAM_ALIASES = {
  '°C': { key: 'water_temperature', unit: '°C' },
  'DO %': { key: 'do_saturation', unit: '%' },
  'DO mg/L': { key: 'do_concentration', unit: 'mg/L' },
  'SPC-uS/cm': { key: 'specific_conductance', unit: 'uS/cm' },
  'C-uS/cm': { key: 'conductivity', unit: 'uS/cm' },
  pH: { key: 'ph', unit: 'pH' },
  'pH mV': { key: 'ph_mv', unit: 'mV' },
  'ORP mV': { key: 'orp', unit: 'mV' },
  FNU: { key: 'turbidity_fnu', unit: 'FNU' },
  NTU: { key: 'turbidity_ntu', unit: 'NTU' },
  'BGA-PC RFU': { key: 'phycocyanin_rfu', unit: 'RFU' },
  'BGA-PCug/L': { key: 'phycocyanin_ugl', unit: 'ug/L' }, // ISY_CB spelling (no space)
  'BGA-PC ug/L': { key: 'phycocyanin_ugl', unit: 'ug/L' }, // ISY_PRH spelling (with space)
  'Chl RFU': { key: 'chlorophyll_rfu', unit: 'RFU' },
  'Chl ug/L': { key: 'chlorophyll_ugl', unit: 'ug/L' },
  'DEP m': { key: 'depth', unit: 'm' }
};

// Known-but-unmapped instrument columns: kept as extraParameters (DATA-08),
// never merged into a canonical key.
export const KOREXO_EXTRA_UNITS = {
  mmHg: 'mmHg',
  'Batt V': 'V',
  'ALT m': 'm', // altitude — a different physical quantity than Depth
  Lat: '°',
  Lon: '°'
};

/**
 * Splits a KorEXO sensor-suffixed header like "DO mg/L-21K101267" into its
 * base label and sensor id. Sensor ids follow the fixed "NNLNNNNNN" shape
 * observed in every ISY_CB sample (e.g. "21J100620", "19K100111").
 */
const SENSOR_SUFFIX = /^(.*)-(\d{2}[A-Za-z]\d{6})$/;

export function splitSensorSuffix(header) {
  const match = SENSOR_SUFFIX.exec(header);
  if (!match) return { base: header, sensorId: null };
  return { base: match[1], sensorId: match[2] };
}

/**
 * Resolves a base header label (already stripped of any sensor suffix) to
 * either a canonical parameter alias or a known "extra" unit. Returns null
 * for genuinely unrecognized headers, which callers must route to
 * extraParameters with no assumed unit (DATA-08).
 */
export function resolveKorExoColumn(base) {
  if (KOREXO_PARAM_ALIASES[base]) {
    return { kind: 'parameter', ...KOREXO_PARAM_ALIASES[base] };
  }
  if (Object.prototype.hasOwnProperty.call(KOREXO_EXTRA_UNITS, base)) {
    return { kind: 'extra', unit: KOREXO_EXTRA_UNITS[base] };
  }
  return null;
}

function textOrNull(cell) {
  const t = String(cell ?? '').trim();
  return t === '' ? null : t;
}

/**
 * Builds one normalized adapter row from a tokenized data line, shared by
 * the ISY_CB and ISY_PRH adapters (they differ only in delimiter, encoding,
 * decimal separator, date order and whether headers carry a sensor
 * suffix — all supplied by the caller).
 */
export function parseKorExoRow({ header, rawCells, sourceRow, parseDate, decimalSeparator, hasSensorSuffix, numberParser }) {
  const byName = {};
  header.forEach((name, idx) => {
    byName[name] = rawCells[idx];
  });

  const rowIssues = [];
  let date = null;
  let time = null;

  const dateRaw = textOrNull(byName.Date);
  if (dateRaw) {
    const parsed = parseDate(dateRaw);
    if (parsed.ok) date = parsed.date;
    else rowIssues.push({ code: 'DATE_UNPARSEABLE', severity: 'error', field: 'date', message: `Nerozpoznané datum "${dateRaw}" (${sourceRow}).` });
  } else {
    rowIssues.push({ code: 'DATE_MISSING', severity: 'warning', field: 'date', message: `Chybí datum (${sourceRow}).` });
  }

  const timeRaw = textOrNull(byName.Time);
  if (timeRaw) {
    const parsedTime = { ok: /^\d{1,2}:\d{2}:\d{2}$/.test(timeRaw) };
    if (parsedTime.ok) {
      const [h, mi, s] = timeRaw.split(':').map(Number);
      if (h <= 23 && mi <= 59 && s <= 59) {
        time = `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      } else {
        rowIssues.push({ code: 'TIME_UNPARSEABLE', severity: 'error', field: 'time', message: `Nerozpoznaný čas "${timeRaw}" (${sourceRow}).` });
      }
    } else {
      rowIssues.push({ code: 'TIME_UNPARSEABLE', severity: 'error', field: 'time', message: `Nerozpoznaný čas "${timeRaw}" (${sourceRow}).` });
    }
  }

  const site = textOrNull(byName.Site);
  const device = textOrNull(byName['Unit ID']);
  const userId = textOrNull(byName['User ID']);

  const cells = [];
  const extra = [];
  header.forEach((h, idx) => {
    if (KOREXO_METADATA_COLUMNS.has(h) || h === '') return;
    const raw = textOrNull(rawCells[idx]);
    if (raw === null) return;
    const { base, sensorId } = hasSensorSuffix ? splitSensorSuffix(h) : { base: h, sensorId: null };
    const resolved = resolveKorExoColumn(base);
    if (resolved?.kind === 'parameter') {
      const num = numberParser(raw, { decimalSeparator });
      cells.push({ key: resolved.key, value: num.value, unit: resolved.unit, raw, sensorId, sourceColumn: h, invalid: num.invalid });
    } else if (resolved?.kind === 'extra') {
      extra.push({ sourceColumn: h, raw, unit: resolved.unit });
    } else {
      extra.push({ sourceColumn: h, raw, unit: null });
    }
  });
  if (userId) extra.push({ sourceColumn: 'User ID', raw: userId, unit: null });

  return {
    sourceRow,
    date,
    time,
    site,
    sampleNumber: null,
    annotation: null,
    device,
    cells,
    extra,
    rowIssues,
    originalRaw: byName
  };
}
