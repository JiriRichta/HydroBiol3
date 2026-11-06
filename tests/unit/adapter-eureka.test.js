import { describe, it, expect } from 'vitest';
import { parseEureka, looksLikeEureka } from '../../src/core/import/adapters/eureka.js';
import { encodeUtf8 } from '../../tests/helpers/encode.js';

const SAMPLE = [
  '"DATE", "TIME", "Temp_deg_C", "Depth_m", "pH_units", "ORP_mV", "SpCond_uS/cm", "Chl_ug/l", "Turb_NTU", "HDO_%Sat", "HDO_mg/l", "Annotation", "Latitude", "Longitude", "Altitude"',
  ' 04/02/25, 13:42:06, 21.42, 0.02, 7.35, 205.9, 34.3, -2.05, 8.53, 87.6, 7.47, "zakal", 49.74, 13.38, 0.0',
  ' 04/03/25, 09:55:01, 6.46, 0.00, 7.79, 215.1, 279.5, 0.65, 0.47, 79.6, 9.45, "1", 49.57, 15.25, 423.0',
  ' 04/03/25, 12:35:05, N/A, 0.42, 7.88, 198.6, 285.8, 0.29, 1.51, 89.6, 10.48, "2", 49.57, 15.25, 438.0'
].join('\n');

describe('EUREKA adapter', () => {
  it('detects the format from content', () => {
    expect(looksLikeEureka(SAMPLE)).toBe(true);
  });

  it('parses all data rows with correct date/time/annotation handling', () => {
    const result = parseEureka(encodeUtf8(SAMPLE), 'test.csv');
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(3);

    const [row1, row2, row3] = result.rows;
    expect(row1.date).toBe('2025-04-02');
    expect(row1.time).toBe('13:42:06');
    expect(row1.annotation).toBe('zakal'); // kept verbatim, never copied to sampleNumber
    expect(row1.sampleNumber).toBeNull();

    const chl = row1.cells.find((c) => c.key === 'chlorophyll_ugl');
    expect(chl.value).toBe(-2.05); // negative values are preserved, not "corrected"

    expect(row2.annotation).toBe('1');
  });

  it('flags an unparsable number as invalid without discarding the row', () => {
    const result = parseEureka(encodeUtf8(SAMPLE), 'test.csv');
    const row3 = result.rows[2];
    const temp = row3.cells.find((c) => c.key === 'water_temperature');
    expect(temp.invalid).toBe(true);
    expect(temp.value).toBeNull();
    expect(temp.raw).toBe('N/A');
  });

  it('routes Latitude/Longitude/Altitude to extraParameters, not merged into any canonical key', () => {
    const result = parseEureka(encodeUtf8(SAMPLE), 'test.csv');
    const extraCols = result.rows[0].extra.map((e) => e.sourceColumn);
    expect(extraCols).toEqual(expect.arrayContaining(['Latitude', 'Longitude', 'Altitude']));
  });
});
