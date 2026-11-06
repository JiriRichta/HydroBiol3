import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWtw } from '../../src/core/import/adapters/wtw.js';

const HEADER = ['Device', 'Device serial', 'ID', 'Date/Time', 'Value', 'Unit', 'Mode', 'Value2', 'Unit2', 'Mode2', 'Measurement', 'Calibration', 'Additional', 'Sensor', 'Sensor serial', 'User'];

function buildWtwBytes(rows) {
  const sheet = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'List1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

describe('WTW adapter (pivot by Device/serial/ID, authoritative Cond temperature)', () => {
  it('pivots three sensor rows into one measurement, temperature from the Cond row only', () => {
    const bytes = buildWtwBytes([
      ['Multi 3630 IDS', '24301817', 1, '24.03.2026 09:50:34 ', 384, 'µS/cm', 'Cond', 6.6, '°C', 'Temp', 'AR', null, 'C = 0.475 1/cm   Tref25   nLF', 'TetraCon 925', ' 24330409', null],
      ['Multi 3630 IDS', '24301817', 1, '24.03.2026 09:50:34 ', 7.219, null, 'pH', 6.8, '°C', 'Temp', 'AR', '+', null, 'SenTix 940', ' B243111051', null],
      ['Multi 3630 IDS', '24301817', 1, '24.03.2026 09:50:34 ', 10.82, 'mg/l', 'Ox', 6.7, '°C', 'Temp', 'AR', '+++', 'SC-FDO   24300276', 'FDO 925', ' 24321650', null]
    ]);
    const result = parseWtw(bytes, 'wtw.xlsx');
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.date).toBe('2026-03-24');
    expect(row.time).toBe('09:50:34');

    const temp = row.cells.find((c) => c.key === 'water_temperature');
    expect(temp.value).toBe(6.6); // from the Cond row's Value2, not pH's (6.8) or Ox's (6.7)

    const cond = row.cells.find((c) => c.key === 'specific_conductance');
    expect(cond.value).toBe(384); // Additional contains "Tref25" -> specific, not raw conductivity

    const ph = row.cells.find((c) => c.key === 'ph');
    expect(ph.value).toBe(7.219);

    const ox = row.cells.find((c) => c.key === 'do_concentration');
    expect(ox.value).toBe(10.82);

    // pH/Ox sensor temperatures are preserved in provenance, never silently used as water_temperature.
    expect(row.extra.some((e) => e.sourceColumn === 'WTW Temp (pH)' && e.raw === '6.8')).toBe(true);
    expect(row.extra.some((e) => e.sourceColumn === 'WTW Temp (Ox)' && e.raw === '6.7')).toBe(true);
  });

  it('leaves water_temperature empty with a warning when the group has no Cond row (no fallback to pH/O2)', () => {
    const bytes = buildWtwBytes([
      ['Multi 3630 IDS', '24301817', 2, '24.03.2026 10:32:49 ', 7.374, null, 'pH', 4.7, '°C', 'Temp', 'AR', '+', null, 'SenTix 940', ' B243111051', null],
      ['Multi 3630 IDS', '24301817', 2, '24.03.2026 10:32:49 ', 12.02, 'mg/l', 'Ox', 4.8, '°C', 'Temp', 'AR', '+++', 'SC-FDO   24300276', 'FDO 925', ' 24321650', null]
    ]);
    const result = parseWtw(bytes, 'wtw.xlsx');
    const row = result.rows[0];
    expect(row.cells.find((c) => c.key === 'water_temperature')).toBeUndefined();
    expect(row.rowIssues.some((i) => i.code === 'WTW_COND_TEMP_MISSING')).toBe(true);
  });

  it('stores Cond as non-compensated "conductivity" (with a warning) when Additional has no Tref reference', () => {
    const bytes = buildWtwBytes([
      ['Multi 3630 IDS', '24301817', 3, '24.03.2026 11:00:00 ', 420, 'µS/cm', 'Cond', 6.0, '°C', 'Temp', 'AR', null, 'no reference here', 'TetraCon 925', ' 24330409', null]
    ]);
    const result = parseWtw(bytes, 'wtw.xlsx');
    const row = result.rows[0];
    expect(row.cells.find((c) => c.key === 'specific_conductance')).toBeUndefined();
    const cond = row.cells.find((c) => c.key === 'conductivity');
    expect(cond.value).toBe(420);
    expect(row.rowIssues.some((i) => i.code === 'WTW_COND_NO_TREF')).toBe(true);
  });
});
