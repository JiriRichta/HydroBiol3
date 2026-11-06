import { describe, it, expect } from 'vitest';
import { parseIsyAndroid, looksLikeIsyAndroid } from '../../src/core/import/adapters/ysiAndroid.js';
import { encodeWindows1252 } from '../../tests/helpers/encode.js';

const HEADER_A =
  'Date (MM/DD/YYYY)\tTime (hh:mm:ss tt)\tTime (Fract. Sec)\tSite Name\tpH ( pH )\tSp Cond ( µS/cm )\tTemp ( °C )\tDO ( % Sat )\tDO ( mg/L )\tORP ( mV )\tVertical Position ( m )\tDepth ( m )\tFault Code';

const HEADER_B =
  'Date (MM/DD/YYYY)\tTime (hh:mm:ss tt)\tTime (Fract. Sec)\tSite Name\tpH ( pH )\tSp Cond ( µS/cm )\tTemp ( °C )\tDO ( % Sat )\tDO ( mg/L )\tORP ( mV )\tSal ( psu )\tFault Code';

// Block A has a negative depth reading; block B has a different column set
// entirely (no Depth column at all) — the parser must use each block's own
// header, never a single "first" header (IMP-03).
const TEXT = [
  'sep=\t',
  HEADER_A,
  '02/03/2025\t11:21:29 AM\t0\tDefault\t5,85\t51,8\t255,9\t104,7\t8,98\t23,023\t-0,2\t-0,057\t0',
  '',
  HEADER_B,
  '07/19/2025\t04:19:48 PM\t0\tDefault\t7,86\t388,3\t10,818\t95,5\t10,56\t203,1\t0,19\t0',
  '07/19/2025\t04:38:01 PM\t0\tDefault\t7,50\t390,1\t10,900\t96,0\t10,60\t204,0\t0,20\t0'
].join('\r\n');

describe('ISY_ANDROID_CB adapter (repeated block headers)', () => {
  it('detects the format', () => {
    expect(looksLikeIsyAndroid(TEXT)).toBe(true);
  });

  it('parses each block against its own header, skipping blank separator lines', () => {
    const bytes = encodeWindows1252(TEXT);
    const result = parseIsyAndroid(bytes, 'android.csv');
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(3); // blank line is not counted as a measurement
  });

  it('keeps a negative depth value unless the user opts to correct it (VAL-03)', () => {
    const bytes = encodeWindows1252(TEXT);
    const result = parseIsyAndroid(bytes, 'android.csv');
    const depth = result.rows[0].cells.find((c) => c.key === 'depth');
    expect(depth.value).toBe(-0.057);
  });

  it("block B's row has no depth cell at all (its header doesn't include Depth)", () => {
    const bytes = encodeWindows1252(TEXT);
    const result = parseIsyAndroid(bytes, 'android.csv');
    const row2 = result.rows[1];
    expect(row2.cells.find((c) => c.key === 'depth')).toBeUndefined();
    // but Sal (psu), present only in block B's header, is captured as extra
    expect(row2.extra.some((e) => e.sourceColumn === 'Sal ( psu )')).toBe(true);
  });

  it('parses 12h time with the correct AM/PM conversion', () => {
    const bytes = encodeWindows1252(TEXT);
    const result = parseIsyAndroid(bytes, 'android.csv');
    expect(result.rows[0].time).toBe('11:21:29'); // 11:21:29 AM stays 11:21:29
    expect(result.rows[1].time).toBe('16:19:48');
  });
});
