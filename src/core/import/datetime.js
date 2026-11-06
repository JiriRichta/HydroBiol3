// Strict, format-specific date/time parsing (IMP-07).
//
// Dates and times are parsed exactly according to the known source format
// and kept as local calendar strings ('YYYY-MM-DD' / 'HH:MM:SS') — never
// converted through a JS Date/UTC round-trip, which would risk shifting the
// day depending on the runtime's time zone.

function pad2(n) {
  return String(n).padStart(2, '0');
}

function daysInMonth(year, month) {
  // month is 1-based; using UTC here only to count days, the result is a
  // plain integer and never leaks a Date instance.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidYmd(year, month, day) {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

function formatDate(year, month, day) {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

function resolveTwoDigitYear(yy) {
  const n = Number(yy);
  return n >= 70 ? 1900 + n : 2000 + n;
}

/** Parses "M/D/YYYY" or "M/D/YY" (US order, as used by Android YSI / ISY CB). */
export function parseDateSlashMDY(text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(String(text).trim());
  if (!m) return { ok: false, error: 'DATE_FORMAT' };
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = m[3].length === 2 ? resolveTwoDigitYear(m[3]) : Number(m[3]);
  if (!isValidYmd(year, month, day)) return { ok: false, error: 'DATE_INVALID' };
  return { ok: true, date: formatDate(year, month, day) };
}

/** Parses "D/M/YYYY" (European order, as used by ISY Praha). */
export function parseDateSlashDMY(text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text).trim());
  if (!m) return { ok: false, error: 'DATE_FORMAT' };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!isValidYmd(year, month, day)) return { ok: false, error: 'DATE_INVALID' };
  return { ok: true, date: formatDate(year, month, day) };
}

/** Parses "D.M.YYYY" (WTW's Date/Time cell date portion). */
export function parseDateDotDMY(text) {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(text).trim());
  if (!m) return { ok: false, error: 'DATE_FORMAT' };
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!isValidYmd(year, month, day)) return { ok: false, error: 'DATE_INVALID' };
  return { ok: true, date: formatDate(year, month, day) };
}

/** Parses "HH:MM:SS" (optionally with fractional seconds), 24h, strict ranges. */
export function parseTime24h(text) {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})(?:[.,]\d+)?$/.exec(String(text).trim());
  if (!m) return { ok: false, error: 'TIME_FORMAT' };
  const h = Number(m[1]);
  const mi = Number(m[2]);
  const s = Number(m[3]);
  if (h > 23 || mi > 59 || s > 59) return { ok: false, error: 'TIME_INVALID' };
  return { ok: true, time: `${pad2(h)}:${pad2(mi)}:${pad2(s)}` };
}

/** Parses "hh:mm:ss tt" (12-hour clock with AM/PM), as used by Android YSI. */
export function parseTime12h(text) {
  const m = /^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i.exec(String(text).trim());
  if (!m) return { ok: false, error: 'TIME_FORMAT' };
  let h = Number(m[1]);
  const mi = Number(m[2]);
  const s = Number(m[3]);
  const meridiem = m[4].toUpperCase();
  if (h < 1 || h > 12 || mi > 59 || s > 59) return { ok: false, error: 'TIME_INVALID' };
  if (meridiem === 'AM') h = h === 12 ? 0 : h;
  else h = h === 12 ? 12 : h + 12;
  return { ok: true, time: `${pad2(h)}:${pad2(mi)}:${pad2(s)}` };
}

/** Parses WTW's combined "D.M.YYYY HH:MM:SS" cell (trailing space tolerated). */
export function parseWtwDateTime(text) {
  const trimmed = String(text).trim();
  const m = /^(\d{1,2}\.\d{1,2}\.\d{4})\s+(\d{1,2}:\d{2}:\d{2})$/.exec(trimmed);
  if (!m) return { ok: false, error: 'DATETIME_FORMAT' };
  const dateResult = parseDateDotDMY(m[1]);
  if (!dateResult.ok) return dateResult;
  const timeResult = parseTime24h(m[2]);
  if (!timeResult.ok) return timeResult;
  return { ok: true, date: dateResult.date, time: timeResult.time };
}

/**
 * Converts an Excel 1900-date-system serial number (as produced by SheetJS
 * for numeric date cells) into a local 'YYYY-MM-DD' string, with no time
 * zone involved anywhere in the computation.
 */
export function excelSerialToDateString(serial) {
  // Excel's epoch is 1899-12-30 for the (incorrect, but universally used)
  // 1900 leap-year-bug system. We only need integer day arithmetic.
  const epochUtcMs = Date.UTC(1899, 11, 30);
  const ms = epochUtcMs + Math.round(serial) * 86400000;
  const d = new Date(ms);
  return formatDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Converts a fractional-day Excel time serial into 'HH:MM:SS'. */
export function excelSerialToTimeString(serial) {
  const fractionalDay = serial - Math.floor(serial);
  const totalSeconds = Math.round(fractionalDay * 86400);
  const h = Math.floor(totalSeconds / 3600) % 24;
  const mi = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad2(h)}:${pad2(mi)}:${pad2(s)}`;
}

/** Converts a local 'YYYY-MM-DD' string into an Excel serial day number. */
export function dateStringToExcelSerial(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const epochUtcMs = Date.UTC(1899, 11, 30);
  const targetUtcMs = Date.UTC(year, month - 1, day);
  return Math.round((targetUtcMs - epochUtcMs) / 86400000);
}

/** Converts a local 'HH:MM:SS' string into an Excel fractional-day serial. */
export function timeStringToExcelSerial(timeStr) {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(timeStr);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  const s = Number(m[3]);
  return (h * 3600 + mi * 60 + s) / 86400;
}
