// Builds and reads back the export XLSX workbook (SPEC §7.3, plan §6a).
//
// Cells are written manually (not via a generic array-of-arrays helper) so
// every type decision is explicit: text is always `t:'s'` with a literal
// value (never a formula — Excel only ever executes a cell that carries
// an `<f>` element, which this module never emits, so a value that merely
// *starts* with "=" stays inert plain text); numbers are plain `t:'n'`
// with full precision; empty values simply get no cell at all, never a
// written 0; dates/times are numeric serials with an explicit built-in
// number format, computed with pure UTC-day arithmetic so no runtime time
// zone can shift the calendar day.

import * as XLSX from 'xlsx';
import { dateStringToExcelSerial, timeStringToExcelSerial } from '../import/datetime.js';

function cellForColumn(column, value) {
  if (value === null || value === undefined || value === '') return undefined;
  if (column.type === 'text') {
    return { t: 's', v: String(value) };
  }
  if (column.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return { t: 'n', v: value };
  }
  if (column.type === 'date') {
    const serial = dateStringToExcelSerial(value);
    if (serial === null) return undefined;
    return { t: 'n', v: serial, z: 'm/d/yyyy' }; // resolves to built-in numFmtId 14
  }
  if (column.type === 'time') {
    const serial = timeStringToExcelSerial(value);
    if (serial === null) return undefined;
    return { t: 'n', v: serial, z: 'h:mm:ss' }; // resolves to built-in numFmtId 21
  }
  throw new Error(`Unknown export column type "${column.type}"`);
}

/**
 * @param {object} profile
 * @param {{measurementId:string, cells:object[]}[]} rows  from buildExportRows
 * @param {{ sheetName?: string }} [options]
 */
export function buildWorkbook(profile, rows, { sheetName } = {}) {
  const header = profile.columns.map((c) => c.header);
  const ws = {};

  header.forEach((h, c) => {
    if (h === null || h === undefined) return; // e.g. Praha column O: no header cell at all
    ws[XLSX.utils.encode_cell({ r: 0, c })] = { t: 's', v: h };
  });

  rows.forEach((row, r) => {
    row.cells.forEach((cell, c) => {
      const built = cellForColumn(cell.column, cell.value);
      if (!built) return;
      ws[XLSX.utils.encode_cell({ r: r + 1, c })] = built;
    });
  });

  const lastRow = rows.length; // 0 = header; data occupies rows 1..rows.length
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: header.length - 1 } });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, sheetName ?? profile.sheetName ?? 'Export');
  return workbook;
}

export function workbookToBytes(workbook) {
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx', cellDates: false });
}

/**
 * Re-reads a just-written workbook's bytes back into a plain header/rows
 * structure, used both by export-time integrity checks and by tests that
 * verify the exact written file (not just the in-memory model).
 */
export function readBackWorkbook(bytes) {
  const workbook = XLSX.read(bytes, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const header = [];
  for (let c = range.s.c; c <= range.e.c; c += 1) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
    header.push(cell ? cell.v : null);
  }

  const rows = [];
  for (let r = 1; r <= range.e.r; r += 1) {
    const row = [];
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      row.push(cell ? { t: cell.t, v: cell.v, f: cell.f ?? null, z: cell.z ?? null } : null);
    }
    rows.push(row);
  }

  return { sheetName, header, rows, columnCount: range.e.c - range.s.c + 1, rowCount: range.e.r };
}
