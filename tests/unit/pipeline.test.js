import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeFile, commitAnalysis } from '../../src/core/import/pipeline.js';
import { createSourceStore } from '../../src/core/store/sourceStore.js';
import { encodeUtf8 } from '../../tests/helpers/encode.js';
import { resetIdCounterForTests, resetImportCounterForTests } from '../../src/core/ids.js';

const EUREKA_TEXT = [
  '"DATE", "TIME", "Temp_deg_C", "Depth_m", "pH_units", "ORP_mV", "SpCond_uS/cm", "Chl_ug/l", "Turb_NTU", "HDO_%Sat", "HDO_mg/l", "Annotation", "Latitude", "Longitude", "Altitude"',
  ' 04/02/25, 13:42:06, 21.42, -0.006, 7.35, 205.9, 261.6, -2.05, 8.53, 87.6, 7.47, "zakal", 49.74, 13.38, 0.0'
].join('\n');

function bytesOf(text) {
  return encodeUtf8(text);
}

describe('import pipeline (analyze -> commit)', () => {
  beforeEach(() => {
    resetIdCounterForTests(0);
    resetImportCounterForTests(0);
  });

  it('detects the format, counts measurements and flags both import options as relevant', async () => {
    const analysis = await analyzeFile({ bytes: bytesOf(EUREKA_TEXT), fileName: 'e.csv' });
    expect(analysis.format).toBe('EUREKA');
    expect(analysis.importable).toBe(true);
    expect(analysis.measurementCount).toBe(1);
    expect(analysis.needsOptions).toEqual({ conductivity: true, depth: true });
  });

  it('AT-05: converts µS/cm to mS/m by dividing by 10, with an audit transformation, applied exactly once', async () => {
    const store = createSourceStore();
    const analysis = await analyzeFile({ bytes: bytesOf(EUREKA_TEXT), fileName: 'e.csv' }, store);
    const commitResult = commitAnalysis(analysis, { convertConductivity: true, correctNegativeDepth: false }, store);
    expect(commitResult.ok).toBe(true);

    const measurement = store.get(commitResult.measurementIds[0]);
    const cond = measurement.parameters.specific_conductance;
    expect(cond.value).toBeCloseTo(26.16);
    expect(cond.unit).toBe('mS/m');
    const transform = measurement.source.transformations.find((t) => t.type === 'unit_conversion');
    expect(transform).toBeDefined();
    expect(transform.originalValue).toBe(261.6);
    expect(transform.operation).toBe('÷10');

    // Depth was NOT corrected (option off) — the negative raw value is preserved.
    expect(measurement.parameters.depth.value).toBe(-0.006);
  });

  it('AT-06: corrects negative depth to 0 when the option is enabled, leaving it untouched otherwise', async () => {
    const storeOn = createSourceStore();
    const analysisOn = await analyzeFile({ bytes: bytesOf(EUREKA_TEXT), fileName: 'e.csv' }, storeOn);
    const resOn = commitAnalysis(analysisOn, { convertConductivity: false, correctNegativeDepth: true }, storeOn);
    const mOn = storeOn.get(resOn.measurementIds[0]);
    expect(mOn.parameters.depth.value).toBe(0);
    expect(mOn.source.transformations.some((t) => t.type === 'depth_correction')).toBe(true);

    resetIdCounterForTests(100);
    resetImportCounterForTests(100);
    const storeOff = createSourceStore();
    const analysisOff = await analyzeFile({ bytes: bytesOf(EUREKA_TEXT), fileName: 'e2.csv' }, storeOff);
    const resOff = commitAnalysis(analysisOff, { convertConductivity: false, correctNegativeDepth: false }, storeOff);
    const mOff = storeOff.get(resOff.measurementIds[0]);
    expect(mOff.parameters.depth.value).toBe(-0.006);
  });

  it('AT-22: rejects importing byte-identical content a second time', async () => {
    const store = createSourceStore();
    const analysis1 = await analyzeFile({ bytes: bytesOf(EUREKA_TEXT), fileName: 'e.csv' }, store);
    commitAnalysis(analysis1, { convertConductivity: false, correctNegativeDepth: false }, store);

    const analysis2 = await analyzeFile({ bytes: bytesOf(EUREKA_TEXT), fileName: 'e_again.csv' }, store);
    expect(analysis2.importable).toBe(false);
    expect(analysis2.fileErrors[0].code).toBe('DUPLICATE_FILE');
    expect(store.size()).toBe(1); // still just the first import
  });

  it('AT-21: importing a second, different file preserves the first batch', async () => {
    const store = createSourceStore();
    const analysis1 = await analyzeFile({ bytes: bytesOf(EUREKA_TEXT), fileName: 'e.csv' }, store);
    commitAnalysis(analysis1, { convertConductivity: false, correctNegativeDepth: false }, store);

    const secondText = EUREKA_TEXT.replace('13:42:06', '14:00:00');
    const analysis2 = await analyzeFile({ bytes: bytesOf(secondText), fileName: 'e2.csv' }, store);
    expect(analysis2.importable).toBe(true);
    commitAnalysis(analysis2, { convertConductivity: false, correctNegativeDepth: false }, store);
    expect(store.size()).toBe(2);
  });

  it('reports an unrecognized format without throwing', async () => {
    const analysis = await analyzeFile({ bytes: bytesOf('this is not any known format\njust text'), fileName: 'mystery.txt' });
    expect(analysis.importable).toBe(false);
    expect(analysis.fileErrors[0].code).toBe('FORMAT_UNRECOGNIZED');
  });
});
