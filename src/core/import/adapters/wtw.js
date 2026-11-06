// WTW Multi 3630 IDS XLSX adapter (IMP-06).
//
// The source file lists one row per sensor reading. Rows that share the
// same (Device, Device serial, ID) pivot into a single measurement. The
// authoritative water temperature is always the Value2 reading on the row
// whose Mode is 'Cond' (the conductivity sensor) — never a fallback from
// the pH or O2 sensor rows, per the plan's revision 2 correction.

import * as XLSX from 'xlsx';
import { parseWtwDateTime } from '../datetime.js';
import { normalizeUnitToken } from '../../registry/parameters.js';

const REQUIRED_COLUMNS = [
  'Device',
  'Device serial',
  'ID',
  'Date/Time',
  'Value',
  'Unit',
  'Mode',
  'Value2',
  'Unit2',
  'Mode2'
];

function toCellText(value) {
  if (value === null || value === undefined) return null;
  return String(value).trim() === '' ? null : String(value).trim();
}

export function looksLikeWtw(headerRow) {
  if (!Array.isArray(headerRow)) return false;
  const present = new Set(headerRow.map((h) => String(h ?? '').trim()));
  return REQUIRED_COLUMNS.every((col) => present.has(col));
}

export function parseWtw(bytes, fileName) {
  const fileErrors = [];
  let workbook;
  try {
    workbook = XLSX.read(bytes, { type: 'array', cellDates: false });
  } catch (err) {
    return {
      format: 'WTW_CB',
      encoding: 'binary',
      fileErrors: [{ code: 'XLSX_UNREADABLE', message: `Soubor ${fileName} nelze otevřít jako XLSX: ${err.message}` }],
      rows: []
    };
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  if (grid.length === 0) {
    return {
      format: 'WTW_CB',
      encoding: 'binary',
      fileErrors: [{ code: 'XLSX_EMPTY', message: `Soubor ${fileName} je prázdný.` }],
      rows: []
    };
  }

  const header = grid[0].map((h) => String(h ?? '').trim());
  if (!looksLikeWtw(header)) {
    return {
      format: 'WTW_CB',
      encoding: 'binary',
      fileErrors: [
        {
          code: 'WTW_HEADER_MISMATCH',
          message: `Soubor ${fileName} neobsahuje očekávané sloupce WTW exportu (Device, ID, Date/Time, Value, Mode, Value2, Mode2...).`
        }
      ],
      rows: []
    };
  }

  const colIndex = {};
  header.forEach((name, i) => {
    if (name) colIndex[name] = i;
  });

  const groups = new Map();
  const order = [];

  for (let r = 1; r < grid.length; r += 1) {
    const rawRow = grid[r];
    if (!rawRow || rawRow.every((c) => c === null || c === undefined || String(c).trim() === '')) {
      continue; // blank line
    }
    const get = (name) => (colIndex[name] !== undefined ? rawRow[colIndex[name]] : null);

    const device = toCellText(get('Device'));
    const deviceSerial = toCellText(get('Device serial'));
    const groupId = toCellText(get('ID'));
    const dateTimeRaw = toCellText(get('Date/Time'));
    const mode = toCellText(get('Mode'));

    const key = `${device}|${deviceSerial}|${groupId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        device,
        deviceSerial,
        groupId,
        sourceRowStart: r + 1,
        sourceRowEnd: r + 1,
        dateTimeTexts: new Set(),
        entries: []
      });
      order.push(key);
    }
    const group = groups.get(key);
    group.sourceRowEnd = r + 1;
    if (dateTimeRaw) group.dateTimeTexts.add(dateTimeRaw);
    group.entries.push({
      mode,
      value: get('Value'),
      unit: toCellText(get('Unit')),
      value2: get('Value2'),
      unit2: toCellText(get('Unit2')),
      mode2: toCellText(get('Mode2')),
      measurement: toCellText(get('Measurement')),
      calibration: toCellText(get('Calibration')),
      additional: toCellText(get('Additional')),
      sensor: toCellText(get('Sensor')),
      sensorSerial: toCellText(get('Sensor serial'))
    });
  }

  const rows = order.map((key) => {
    const group = groups.get(key);
    const rowIssues = [];
    const cells = [];
    const extra = [];
    const sensorIds = {};
    const tempByMode = {};

    const dateTimeTexts = Array.from(group.dateTimeTexts);
    const primaryDateTime = dateTimeTexts[0] ?? null;
    if (dateTimeTexts.length > 1) {
      rowIssues.push({
        code: 'WTW_GROUP_DATETIME_MISMATCH',
        severity: 'error',
        field: 'date',
        message: `Skupina WTW (${group.device}, ${group.deviceSerial}, ID ${group.groupId}) má neshodné Date/Time hodnoty: ${dateTimeTexts.join(', ')}.`
      });
    }

    let date = null;
    let time = null;
    if (primaryDateTime) {
      const parsed = parseWtwDateTime(primaryDateTime);
      if (parsed.ok) {
        date = parsed.date;
        time = parsed.time;
      } else {
        rowIssues.push({
          code: 'DATE_TIME_UNPARSEABLE',
          severity: 'error',
          field: 'date',
          message: `Nerozpoznané Date/Time "${primaryDateTime}" ve skupině WTW (${group.device}, ID ${group.groupId}).`
        });
      }
    } else {
      rowIssues.push({
        code: 'DATE_MISSING',
        severity: 'warning',
        field: 'date',
        message: `Skupina WTW (${group.device}, ID ${group.groupId}) nemá datum/čas.`
      });
    }

    for (const entry of group.entries) {
      if (entry.sensor || entry.sensorSerial) {
        sensorIds[entry.mode ?? 'unknown'] = { sensor: entry.sensor, serial: entry.sensorSerial };
      }
      if (entry.mode2 === 'Temp' && typeof entry.value2 === 'number') {
        tempByMode[entry.mode ?? 'unknown'] = entry.value2;
      } else if (entry.value2 !== null && entry.value2 !== undefined) {
        extra.push({
          sourceColumn: `WTW Value2 (${entry.mode ?? '?'})`,
          raw: String(entry.value2),
          unit: normalizeUnitToken(entry.unit2)
        });
      }

      if (entry.mode === 'Cond') {
        const additionalHasTref = /tref/i.test(entry.additional ?? '');
        const key2 = additionalHasTref ? 'specific_conductance' : 'conductivity';
        if (!additionalHasTref) {
          rowIssues.push({
            code: 'WTW_COND_NO_TREF',
            severity: 'warning',
            field: key2,
            message: `Vodivost ve skupině WTW (${group.device}, ID ${group.groupId}) neobsahuje referenční teplotu (Tref) v poli Additional – uloženo jako nekompenzovaná vodivost, nikoli specifická vodivost.`
          });
        }
        if (typeof entry.value === 'number') {
          cells.push({
            key: key2,
            value: entry.value,
            unit: normalizeUnitToken(entry.unit) ?? 'uS/cm',
            raw: String(entry.value),
            sensorId: entry.sensorSerial,
            sourceColumn: 'Value (Cond)',
            invalid: false
          });
        }
      } else if (entry.mode === 'pH') {
        if (typeof entry.value === 'number') {
          cells.push({
            key: 'ph',
            value: entry.value,
            unit: 'pH',
            raw: String(entry.value),
            sensorId: entry.sensorSerial,
            sourceColumn: 'Value (pH)',
            invalid: false
          });
        }
      } else if (entry.mode === 'Ox') {
        if (typeof entry.value === 'number') {
          cells.push({
            key: 'do_concentration',
            value: entry.value,
            unit: normalizeUnitToken(entry.unit) ?? 'mg/L',
            raw: String(entry.value),
            sensorId: entry.sensorSerial,
            sourceColumn: 'Value (Ox)',
            invalid: false
          });
        }
      } else if (entry.mode) {
        extra.push({ sourceColumn: `WTW Value (${entry.mode})`, raw: String(entry.value ?? ''), unit: normalizeUnitToken(entry.unit) });
      }

      ['measurement', 'calibration', 'additional'].forEach((field) => {
        if (entry[field]) {
          extra.push({ sourceColumn: `WTW ${field} (${entry.mode ?? '?'})`, raw: entry[field], unit: null });
        }
      });
    }

    if (tempByMode.Cond !== undefined) {
      cells.push({
        key: 'water_temperature',
        value: tempByMode.Cond,
        unit: '°C',
        raw: String(tempByMode.Cond),
        sensorId: null,
        sourceColumn: 'Value2 (Cond)',
        invalid: false
      });
    } else {
      rowIssues.push({
        code: 'WTW_COND_TEMP_MISSING',
        severity: 'warning',
        field: 'water_temperature',
        message: `Skupina WTW (${group.device}, ID ${group.groupId}) neobsahuje teplotu z vodivostního čidla (Mode=Cond) – teplota vody zůstává prázdná, náhradní senzor nebyl použit.`
      });
    }
    ['pH', 'Ox'].forEach((mode) => {
      if (tempByMode[mode] !== undefined) {
        extra.push({ sourceColumn: `WTW Temp (${mode})`, raw: String(tempByMode[mode]), unit: '°C' });
      }
    });

    return {
      sourceRow:
        group.sourceRowStart === group.sourceRowEnd
          ? `řádek ${group.sourceRowStart}`
          : `řádky ${group.sourceRowStart}-${group.sourceRowEnd}`,
      date,
      time,
      site: null,
      sampleNumber: null,
      annotation: null,
      device: [group.device, group.deviceSerial].filter(Boolean).join(' / ') || null,
      sensorIds,
      cells,
      extra,
      rowIssues,
      originalRaw: { entries: group.entries, dateTimeTexts: Array.from(group.dateTimeTexts) }
    };
  });

  return { format: 'WTW_CB', encoding: 'binary', fileErrors, rows };
}
