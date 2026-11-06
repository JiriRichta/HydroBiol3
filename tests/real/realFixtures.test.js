// Runs only when the real lab fixtures are present locally (fixtures/ is
// git-ignored and never shipped — README_HANDOFF.md). This is the
// authoritative check for AT-01/AT-02/AT-03 against the actual sample
// files, not synthetic stand-ins.

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeFile } from '../../src/core/import/pipeline.js';
import { resetIdCounterForTests, resetImportCounterForTests } from '../../src/core/ids.js';

const FIXTURES_DIR = path.resolve(process.cwd(), 'fixtures', 'input');
const hasFixtures = fs.existsSync(FIXTURES_DIR);

const FILES = {
  EUREKA: 'EUREKA_PLZ_BelskyMlyn 3.4.25.csv',
  ISY_ANDROID_CB: 'ISY_ANDROID_CB_Kor Measurement File Export - 033126085850.csv',
  ISY_CB: 'ISY_CB_jorKorEXO Measurement File Export - 032426 135022.csv',
  ISY_PRH: 'ISY_PRH_exobackup-260330-142128.csv',
  WTW_CB: 'WTW_CB_wtw 24.3.2026.xlsx'
};

const EXPECTED_COUNTS = { EUREKA: 17, ISY_ANDROID_CB: 29, ISY_CB: 32, ISY_PRH: 170, WTW_CB: 5 };

function readBytes(fileName) {
  const buf = fs.readFileSync(path.join(FIXTURES_DIR, fileName));
  return new Uint8Array(buf);
}

describe.skipIf(!hasFixtures)('real fixtures (AT-01/AT-02/AT-03)', () => {
  beforeEach(() => {
    resetIdCounterForTests(0);
    resetImportCounterForTests(0);
  });

  it('AT-01: every real sample file is importable with the exact expected measurement count', async () => {
    let total = 0;
    for (const [format, fileName] of Object.entries(FILES)) {
      const analysis = await analyzeFile({ bytes: readBytes(fileName), fileName });
      expect(analysis.importable, `${fileName} should be importable (errors: ${JSON.stringify(analysis.fileErrors)})`).toBe(true);
      expect(analysis.format).toBe(format);
      expect(analysis.measurementCount).toBe(EXPECTED_COUNTS[format]);
      total += analysis.measurementCount;
    }
    expect(total).toBe(253);
  });

  it('AT-02: Android YSI block headers never produce a spurious extra measurement from a header/blank line', async () => {
    const analysis = await analyzeFile({ bytes: readBytes(FILES.ISY_ANDROID_CB), fileName: FILES.ISY_ANDROID_CB });
    expect(analysis.measurementCount).toBe(29);
    expect(analysis.fileErrors).toEqual([]);
  });

  it('AT-03: WTW pivots 5 groups, each with a water_temperature sourced from the Cond sensor row', async () => {
    const analysis = await analyzeFile({ bytes: readBytes(FILES.WTW_CB), fileName: FILES.WTW_CB });
    expect(analysis.measurementCount).toBe(5);
    expect(analysis.detectedParams).toContain('water_temperature');
    expect(analysis.detectedParams).toContain('specific_conductance');
    expect(analysis.detectedParams).toContain('ph');
    expect(analysis.detectedParams).toContain('do_concentration');
  });

  it('ISY_CB real file has no sensor collisions despite two DO sensor columns existing', async () => {
    const analysis = await analyzeFile({ bytes: readBytes(FILES.ISY_CB), fileName: FILES.ISY_CB });
    expect(analysis.importable).toBe(true);
    expect(analysis.measurementCount).toBe(32);
  });
});
