import { describe, it, expect } from 'vitest';
import { parseIsyCb, looksLikeIsyCb } from '../../src/core/import/adapters/ysiCb.js';
import { encodeUtf16LE } from '../../tests/helpers/encode.js';

const HEADER =
  'Date\tTime\tSite\tUnit ID\tUser ID\t°C-21J100620\tDO %-21K101267\tDO mg/L-21K101267\tDO mg/L-21K985476\tSPC-uS/cm-21J100620\tC-uS/cm-21J100620\tpH-21J104406\tDEP m-19K100111\t';

// Row 1: a single DO sensor populated -> fine (two sensor columns exist,
// only one has data). Row 2: BOTH DO sensors populated -> a real collision.
const ROW_OK = '03/24/2026\t09:55:02\tDefault\t19J102451\t\t8.099\t121.5\t14.33\t\t415.3\t281.2\t8.79\t0.100\t';
const ROW_COLLISION = '03/24/2026\t10:00:00\tDefault\t19J102451\t\t8.000\t120.0\t14.00\t14.50\t415.0\t281.0\t8.70\t0.090\t';

function buildText(includeCollisionRow) {
  const rows = ['sep=\t', HEADER, ROW_OK];
  if (includeCollisionRow) rows.push(ROW_COLLISION);
  return rows.join('\r\n');
}

describe('ISY_CB adapter (sensor-id-suffixed columns)', () => {
  it('detects the format', () => {
    expect(looksLikeIsyCb(buildText(false))).toBe(true);
  });

  it('parses a row where only one of two DO sensors has data (no collision)', () => {
    const bytes = encodeUtf16LE(buildText(false));
    const result = parseIsyCb(bytes, 'isy_cb.csv');
    expect(result.fileErrors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    const doCells = result.rows[0].cells.filter((c) => c.key === 'do_concentration');
    expect(doCells).toHaveLength(1);
    expect(doCells[0].sensorId).toBe('21K101267');
  });

  it('exposes both DO sensor cells (adapter level) when a second row has both populated', () => {
    const bytes = encodeUtf16LE(buildText(true));
    const result = parseIsyCb(bytes, 'isy_cb.csv');
    expect(result.fileErrors).toEqual([]); // the adapter itself does not reject — normalize.js does (IMP-04)
    const row2 = result.rows[1];
    const doCells = row2.cells.filter((c) => c.key === 'do_concentration');
    expect(doCells).toHaveLength(2);
    expect(doCells.map((c) => c.sensorId).sort()).toEqual(['21K101267', '21K985476']);
  });

  it('splits the specific vs. non-specific conductivity columns into distinct canonical keys', () => {
    const bytes = encodeUtf16LE(buildText(false));
    const result = parseIsyCb(bytes, 'isy_cb.csv');
    const keys = result.rows[0].cells.map((c) => c.key);
    expect(keys).toContain('specific_conductance');
    expect(keys).toContain('conductivity');
  });

  it('drops the trailing unnamed column produced by the trailing tab', () => {
    const bytes = encodeUtf16LE(buildText(false));
    const result = parseIsyCb(bytes, 'isy_cb.csv');
    expect(result.rows[0].extra.some((e) => e.sourceColumn === '')).toBe(false);
  });
});
