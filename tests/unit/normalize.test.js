import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseIsyCb } from '../../src/core/import/adapters/ysiCb.js';
import { parseWtw } from '../../src/core/import/adapters/wtw.js';
import { normalizeAdapterResult } from '../../src/core/import/normalize.js';
import { encodeUtf16LE } from '../../tests/helpers/encode.js';

const CB_HEADER =
  'Date\tTime\tSite\tUnit ID\tUser ID\t°C-21J100620\tDO mg/L-21K101267\tDO mg/L-21K985476\tSPC-uS/cm-21J100620\t';

describe('normalize.js — sensor collision rejects the whole file (IMP-04, VAL-06, AT-04)', () => {
  it('rejects a file where two sensor columns both report the same canonical parameter on one row', () => {
    const collisionRow = '03/24/2026\t10:00:00\tDefault\t19J102451\t\t8.000\t14.00\t14.50\t415.0\t';
    const okRow = '03/24/2026\t09:55:02\tDefault\t19J102451\t\t8.099\t14.33\t\t415.3\t';
    const text = ['sep=\t', CB_HEADER, okRow, collisionRow].join('\r\n');
    const bytes = encodeUtf16LE(text);
    const adapterResult = parseIsyCb(bytes, 'collision.csv');

    const normalized = normalizeAdapterResult(adapterResult, { fileName: 'collision.csv', importId: 'IMP0001', fingerprint: 'fp' });

    expect(normalized.importable).toBe(false);
    expect(normalized.measurements).toHaveLength(0); // all-or-nothing: the valid first row is NOT partially imported
    expect(normalized.fileErrors.some((e) => e.code === 'SENSOR_COLLISION')).toBe(true);
    expect(normalized.fileErrors[0].message).toContain('do_concentration');
  });

  it('does not reject a file where two sensors exist but never collide on the same row', () => {
    const okRow1 = '03/24/2026\t09:55:02\tDefault\t19J102451\t\t8.099\t14.33\t\t415.3\t';
    const okRow2 = '03/24/2026\t09:56:00\tDefault\t19J102451\t\t8.050\t\t14.40\t415.1\t';
    const text = ['sep=\t', CB_HEADER, okRow1, okRow2].join('\r\n');
    const bytes = encodeUtf16LE(text);
    const adapterResult = parseIsyCb(bytes, 'ok.csv');

    const normalized = normalizeAdapterResult(adapterResult, { fileName: 'ok.csv', importId: 'IMP0002', fingerprint: 'fp2' });
    expect(normalized.importable).toBe(true);
    expect(normalized.measurements).toHaveLength(2);
  });

  it('rejects a WTW file where the same Mode appears twice in one group (a collision too)', () => {
    const header = ['Device', 'Device serial', 'ID', 'Date/Time', 'Value', 'Unit', 'Mode', 'Value2', 'Unit2', 'Mode2'];
    const rows = [
      header,
      ['Multi 3630 IDS', '24301817', 1, '24.03.2026 09:50:34 ', 384, 'µS/cm', 'Cond', 6.6, '°C', 'Temp'],
      ['Multi 3630 IDS', '24301817', 1, '24.03.2026 09:50:34 ', 390, 'µS/cm', 'Cond', 6.5, '°C', 'Temp']
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'List1');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const adapterResult = parseWtw(bytes, 'wtw_dup.xlsx');
    const normalized = normalizeAdapterResult(adapterResult, { fileName: 'wtw_dup.xlsx', importId: 'IMP0003', fingerprint: 'fp3' });
    expect(normalized.importable).toBe(false);
    expect(normalized.fileErrors.some((e) => e.code === 'SENSOR_COLLISION')).toBe(true);
  });
});
