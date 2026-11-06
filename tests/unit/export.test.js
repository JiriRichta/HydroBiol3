import { describe, it, expect } from 'vitest';
import { EXPORT_PROFILES } from '../../src/core/export/profiles.js';
import { buildExportRows } from '../../src/core/export/buildRows.js';
import { validateExportRows, findUnitMismatchIds } from '../../src/core/export/validateExport.js';
import { buildWorkbook, workbookToBytes, readBackWorkbook } from '../../src/core/export/writeXlsx.js';
import { createImportedMeasurement, deepFreezeMeasurement } from '../../src/core/model/measurement.js';
import { resetIdCounterForTests } from '../../src/core/ids.js';

function m(fields) {
  const measurement = createImportedMeasurement(fields);
  deepFreezeMeasurement(measurement);
  return measurement;
}

describe('AT-18: ČB export — exact 14-column header, Date/Time appended', () => {
  it('writes and reads back the exact header in order', () => {
    resetIdCounterForTests(0);
    const measurement = m({
      date: '2026-02-04',
      time: '10:30:00',
      sampleNumber: '00852',
      parameters: {
        water_temperature: { value: 3.553, unit: '°C', raw: '3.553' },
        specific_conductance: { value: 8.11, unit: 'mS/m', raw: '81.1' },
        ph: { value: 6.35, unit: 'pH', raw: '6.35' }
      }
    });
    const profile = EXPORT_PROFILES.CB;
    const rows = buildExportRows(profile, [measurement]);
    const validation = validateExportRows(profile, rows, { acknowledgedUnverified: true });
    expect(validation.ok).toBe(true);

    const wb = buildWorkbook(profile, rows);
    const bytes = workbookToBytes(wb);
    const back = readBackWorkbook(bytes);

    expect(back.sheetName).toBe('LabSys_Export');
    expect(back.header).toEqual(['VZOREK', 'TEMP', 'COND', 'DO_%', 'DO_CONC', 'DEPTH', 'PH', 'CHLOROPHYL', 'ORP', 'TEMPA', 'TRANSP', 'FLOW', 'Date', 'Time']);
    expect(back.header).toHaveLength(14);

    const [row] = back.rows;
    expect(row[0]).toMatchObject({ t: 's', v: '00852' }); // VZOREK stays text, leading zero preserved
    expect(row[1]).toMatchObject({ t: 'n', v: 3.553 });
    expect(row[2]).toMatchObject({ t: 'n', v: 8.11 });
  });
});

describe('AT-19/AT-24: Praha export — A..N exact names, unnamed column O, text "K 4353"', () => {
  it('writes an unnamed header cell for column O and keeps vz as text', () => {
    resetIdCounterForTests(0);
    const measurement = m({
      date: '2026-08-10',
      site: 'VN Slapy ház',
      sampleNumber: 'K 4353',
      description: 'kontrolní vzorek',
      parameters: { ph: { value: 7.5, unit: 'pH', raw: '7.5' } }
    });
    const profile = EXPORT_PROFILES.PRAHA;
    const rows = buildExportRows(profile, [measurement]);
    const validation = validateExportRows(profile, rows, { acknowledgedUnverified: true });
    expect(validation.ok).toBe(true);

    const wb = buildWorkbook(profile, rows, { sheetName: 'export-test' });
    const bytes = workbookToBytes(wb);
    const back = readBackWorkbook(bytes);

    expect(back.header.slice(0, 14)).toEqual(['Date', 'Time', 'Site', 'Temp', 'DO %', 'DO Conc', 'SpCond', 'pH', 'ORP', 'Turbidity+', 'BGA', 'ch-isy', 'Depth', 'vz']);
    expect(back.header[14]).toBeNull(); // column O has no header cell at all

    const row = back.rows[0];
    expect(row[13]).toMatchObject({ t: 's', v: 'K 4353' });
    expect(row[14]).toMatchObject({ t: 's', v: 'kontrolní vzorek' });
  });
});

describe('AT-20: no artificial separator rows — row count matches measurement count exactly', () => {
  it('produces exactly N data rows for N measurements', () => {
    resetIdCounterForTests(0);
    const measurements = [1, 2, 3].map((i) => m({ date: '2026-01-01', sampleNumber: String(i), parameters: {} }));
    const profile = EXPORT_PROFILES.PRAHA;
    const rows = buildExportRows(profile, measurements);
    const wb = buildWorkbook(profile, rows);
    const bytes = workbookToBytes(wb);
    const back = readBackWorkbook(bytes);
    expect(back.rowCount).toBe(3);
  });
});

describe('AT-23/AT-26: blocking validation cannot be bypassed', () => {
  it('blocks export when conductivity is still in µS/cm (wrong unit for COND)', () => {
    resetIdCounterForTests(0);
    const measurement = m({ date: '2026-01-01', sampleNumber: '1', parameters: { specific_conductance: { value: 261.6, unit: 'uS/cm', raw: '261.6' } } });
    const profile = EXPORT_PROFILES.CB;
    const rows = buildExportRows(profile, [measurement]);
    const validation = validateExportRows(profile, rows, { acknowledgedUnverified: true });
    expect(validation.ok).toBe(false);
    expect(validation.blocking.some((b) => b.code === 'UNIT_MISMATCH' && b.field === 'COND')).toBe(true);
    expect(findUnitMismatchIds(validation, 'COND')).toEqual([measurement.measurementId]);
  });

  it('blocks export when a required sampleNumber is missing, with no way to override via acknowledgement', () => {
    resetIdCounterForTests(0);
    const measurement = m({ date: '2026-01-01', sampleNumber: null, parameters: {} });
    const profile = EXPORT_PROFILES.PRAHA;
    const rows = buildExportRows(profile, [measurement]);
    const validation = validateExportRows(profile, rows, { acknowledgedUnverified: true });
    expect(validation.ok).toBe(false);
    expect(validation.blocking.some((b) => b.code === 'REQUIRED_FIELD_MISSING' && b.field === 'vz')).toBe(true);
  });

  it('blocks export when unverified mappings are not acknowledged, even with otherwise-valid data', () => {
    resetIdCounterForTests(0);
    const measurement = m({ date: '2026-01-01', sampleNumber: '1', parameters: {} });
    const profile = EXPORT_PROFILES.CB;
    const rows = buildExportRows(profile, [measurement]);
    const validation = validateExportRows(profile, rows, { acknowledgedUnverified: false });
    expect(validation.ok).toBe(false);
    expect(validation.blocking.some((b) => b.code === 'UNVERIFIED_MAPPING_NOT_ACKNOWLEDGED')).toBe(true);
  });

  it('blocks export when a value is flagged invalid, regardless of acknowledgement', () => {
    resetIdCounterForTests(0);
    const measurement = m({ date: '2026-01-01', sampleNumber: '1', parameters: { ph: { value: null, unit: 'pH', raw: 'N/A', invalid: true } } });
    const profile = EXPORT_PROFILES.CB;
    const rows = buildExportRows(profile, [measurement]);
    const validation = validateExportRows(profile, rows, { acknowledgedUnverified: true });
    expect(validation.ok).toBe(false);
    expect(validation.blocking.some((b) => b.code === 'VALUE_INVALID' && b.field === 'PH')).toBe(true);
  });
});

describe('AT-26: empty values are empty cells, never 0, and no formula injection', () => {
  it('writes no cell for a null/absent value', () => {
    resetIdCounterForTests(0);
    const measurement = m({ date: '2026-01-01', sampleNumber: '1', parameters: {} });
    const profile = EXPORT_PROFILES.CB;
    const rows = buildExportRows(profile, [measurement]);
    const wb = buildWorkbook(profile, rows);
    const back = readBackWorkbook(workbookToBytes(wb));
    const tempCell = back.rows[0][1]; // TEMP column
    expect(tempCell).toBeNull();
  });

  it('a sampleNumber that looks like a formula is written as inert text', () => {
    resetIdCounterForTests(0);
    const measurement = m({ date: '2026-01-01', sampleNumber: '=1+1', parameters: {} });
    const profile = EXPORT_PROFILES.CB;
    const rows = buildExportRows(profile, [measurement]);
    const wb = buildWorkbook(profile, rows);
    const back = readBackWorkbook(workbookToBytes(wb));
    expect(back.rows[0][0]).toMatchObject({ t: 's', v: '=1+1', f: null });
  });
});
