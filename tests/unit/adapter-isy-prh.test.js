import { describe, it, expect } from 'vitest';
import { parseIsyPrh, looksLikeIsyPrh } from '../../src/core/import/adapters/ysiPrh.js';
import { encodeUtf16LE } from '../../tests/helpers/encode.js';

const HEADER = 'Date;Time;Site;Unit ID;User ID;°C;DO %;DO mg/L;SPC-uS/cm;pH;pH mV;ORP mV;NTU;BGA-PC ug/L;Chl ug/L;DEP m;Batt V';
// Note the trailing ';' producing one more cell than the header has — a
// real artifact of this export that must be tolerated, not treated as a
// structural error.
const ROW = '30/03/2026;09:23:56;VN Svihov HRAZ;A 273;;4,561;100,7;13,00;291,4;7,89;-50,6;319,0;0,18;1,14;11,60;0,214;2,90;';

const TEXT = ['sep=;', HEADER, ROW].join('\r\n');

describe('ISY_PRH adapter', () => {
  it('detects the format', () => {
    expect(looksLikeIsyPrh(TEXT)).toBe(true);
  });

  it('tolerates the trailing-delimiter extra empty cell and parses correctly', () => {
    const bytes = encodeUtf16LE(TEXT);
    const result = parseIsyPrh(bytes, 'isy_prh.csv');
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].date).toBe('2026-03-30'); // DD/MM/YYYY
    expect(result.rows[0].site).toBe('VN Svihov HRAZ');
  });

  it('parses comma-decimal values correctly', () => {
    const bytes = encodeUtf16LE(TEXT);
    const result = parseIsyPrh(bytes, 'isy_prh.csv');
    const temp = result.rows[0].cells.find((c) => c.key === 'water_temperature');
    expect(temp.value).toBeCloseTo(4.561);
  });

  it('maps NTU to turbidity_ntu, distinct from the FNU key used by ISY_CB', () => {
    const bytes = encodeUtf16LE(TEXT);
    const result = parseIsyPrh(bytes, 'isy_prh.csv');
    const keys = result.rows[0].cells.map((c) => c.key);
    expect(keys).toContain('turbidity_ntu');
    expect(keys).not.toContain('turbidity_fnu');
  });
});
