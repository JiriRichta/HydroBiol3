// Import pipeline orchestration (SPEC §3.2, §5.1, IMP-01, IMP-09, VAL-06).
//
// Two-phase flow matching the required UI: `analyzeFile` only reads and
// diagnoses a file (safe to call repeatedly, never touches the store);
// `commitAnalysis` applies the user's confirmed per-file options and
// appends the result to the source store — atomically, per file.

import { isZipContainer, detectTextFormat } from './detect.js';
import { fingerprintBytes } from './fingerprint.js';
import { parseEureka } from './adapters/eureka.js';
import { parseIsyAndroid } from './adapters/ysiAndroid.js';
import { parseIsyCb } from './adapters/ysiCb.js';
import { parseIsyPrh } from './adapters/ysiPrh.js';
import { parseWtw } from './adapters/wtw.js';
import { normalizeAdapterResult } from './normalize.js';
import { applyImportTransforms } from './transforms.js';
import { nextImportId } from '../ids.js';
import { deepFreezeMeasurement } from '../model/measurement.js';
import { CONDUCTIVITY_PARAM_KEYS } from '../registry/parameters.js';

const TEXT_ADAPTERS = {
  EUREKA: parseEureka,
  ISY_ANDROID_CB: parseIsyAndroid,
  ISY_CB: parseIsyCb,
  ISY_PRH: parseIsyPrh
};

/**
 * Reads and diagnoses one file without mutating any store. Safe to call
 * any number of times while the user reviews the Import tab.
 *
 * @param {{ bytes: Uint8Array, fileName: string }} file
 * @param {{ hasFingerprint: (fp: string) => boolean }} [sourceStore]
 */
export async function analyzeFile({ bytes, fileName }, sourceStore) {
  const fingerprint = await fingerprintBytes(bytes);

  if (sourceStore?.hasFingerprint(fingerprint)) {
    return {
      importId: null,
      fileName,
      fingerprint,
      format: null,
      importable: false,
      fileErrors: [
        { code: 'DUPLICATE_FILE', message: `Soubor "${fileName}" má stejný obsah jako již dříve naimportovaný soubor. Import byl odmítnut.` }
      ],
      rowDiagnostics: [],
      measurementCount: 0,
      detectedParams: [],
      detectedUnits: {},
      needsOptions: { conductivity: false, depth: false },
      draftMeasurements: []
    };
  }

  let format;
  let adapterResult;
  if (isZipContainer(bytes)) {
    format = 'WTW_CB';
    adapterResult = parseWtw(bytes, fileName);
  } else {
    format = detectTextFormat(bytes);
    if (!format) {
      return {
        importId: null,
        fileName,
        fingerprint,
        format: null,
        importable: false,
        fileErrors: [{ code: 'FORMAT_UNRECOGNIZED', message: `Formát souboru "${fileName}" nebyl rozpoznán podle obsahu.` }],
        rowDiagnostics: [],
        measurementCount: 0,
        detectedParams: [],
        detectedUnits: {},
        needsOptions: { conductivity: false, depth: false },
        draftMeasurements: []
      };
    }
    adapterResult = TEXT_ADAPTERS[format](bytes, fileName);
  }

  const importId = nextImportId();
  const normalized = normalizeAdapterResult(adapterResult, { fileName, importId, fingerprint });

  let hasMicrosiemens = false;
  let hasNegativeDepth = false;
  const detectedParams = new Set();
  const detectedUnits = {};
  normalized.measurements.forEach((m) => {
    Object.entries(m.parameters).forEach(([key, p]) => {
      detectedParams.add(key);
      detectedUnits[key] = p.unit;
      if (CONDUCTIVITY_PARAM_KEYS.includes(key) && p.unit === 'uS/cm') hasMicrosiemens = true;
      if (key === 'depth' && typeof p.value === 'number' && p.value < 0) hasNegativeDepth = true;
    });
  });

  return {
    importId,
    fileName,
    fingerprint,
    format: normalized.format,
    encoding: normalized.encoding,
    importable: normalized.importable,
    fileErrors: normalized.fileErrors,
    rowDiagnostics: normalized.rowDiagnostics,
    measurementCount: normalized.measurements.length,
    detectedParams: Array.from(detectedParams),
    detectedUnits,
    needsOptions: { conductivity: hasMicrosiemens, depth: hasNegativeDepth },
    draftMeasurements: normalized.measurements
  };
}

/**
 * Applies the user's confirmed per-file options and appends the resulting
 * measurements to the source store as one atomic batch. Returns
 * `{ ok:false, error }` without touching the store on any failure.
 *
 * @param {object} analysis   result of `analyzeFile`
 * @param {{ convertConductivity?: boolean, correctNegativeDepth?: boolean }} options
 * @param {object} sourceStore
 */
export function commitAnalysis(analysis, options, sourceStore) {
  if (!analysis.importable) {
    return { ok: false, error: { code: 'NOT_IMPORTABLE', message: 'Tento soubor nelze importovat.' } };
  }
  if (sourceStore.hasFingerprint(analysis.fingerprint)) {
    return {
      ok: false,
      error: { code: 'DUPLICATE_FILE', message: `Soubor "${analysis.fileName}" byl mezitím již importován.` }
    };
  }

  const confirmedOptions = {
    convertConductivity: options.convertConductivity === true,
    correctNegativeDepth: options.correctNegativeDepth === true
  };

  const finalized = analysis.draftMeasurements.map((measurement) => {
    applyImportTransforms(measurement, {
      convert: confirmedOptions.convertConductivity,
      correctNegative: confirmedOptions.correctNegativeDepth
    });
    measurement.source.options = confirmedOptions;
    return deepFreezeMeasurement(measurement);
  });

  sourceStore.addBatch({
    importId: analysis.importId,
    fileName: analysis.fileName,
    fingerprint: analysis.fingerprint,
    format: analysis.format,
    measurements: finalized
  });

  return { ok: true, count: finalized.length, measurementIds: finalized.map((m) => m.measurementId) };
}
