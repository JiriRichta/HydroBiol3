// Central canonical parameter dictionary (SPEC §3.3).
//
// Each canonical key has a fixed physical meaning, display unit and
// aggregation rule. Import adapters map their own source headers onto these
// keys via explicit alias tables (kept inside each adapter, because aliases
// are format-specific) — nothing here is guessed from header similarity.
//
// `aggregation`:
//   'mean'      – simple arithmetic mean of valid values (MIX-03)
//   'ph_hplus'  – pH aggregated through H+ concentration (MIX-03, §7a of plan)
//   'none'      – never averaged for a mixed sample (kept blank, DATA/MIX-03)
//
// `kind`:
//   'measured'      – a physically measured quantity, read-only outside bulk edit
//   'supplementary' – user-filled, always editable in the Working Set (DATA-01, §5.3)

export const PARAMETERS = Object.freeze({
  water_temperature: {
    label: 'Teplota vody',
    unit: '°C',
    kind: 'measured',
    aggregation: 'mean'
  },
  specific_conductance: {
    label: 'Specifická vodivost',
    unit: 'mS/m',
    rawUnit: 'µS/cm',
    kind: 'measured',
    aggregation: 'mean',
    unitConvertible: true // may require explicit µS/cm → mS/m conversion (§5a)
  },
  conductivity: {
    label: 'Vodivost (nekompenzovaná)',
    unit: 'µS/cm',
    kind: 'measured',
    aggregation: 'none'
  },
  nlf_conductivity: {
    label: 'Vodivost nLF',
    unit: 'µS/cm',
    kind: 'measured',
    aggregation: 'none'
  },
  do_saturation: {
    label: 'Nasycení kyslíkem',
    unit: '%',
    kind: 'measured',
    aggregation: 'mean'
  },
  do_concentration: {
    label: 'Koncentrace kyslíku',
    unit: 'mg/L',
    kind: 'measured',
    aggregation: 'mean'
  },
  depth: {
    label: 'Hloubka',
    unit: 'm',
    kind: 'measured',
    aggregation: 'none' // MIX-03: never averaged
  },
  ph: {
    label: 'pH',
    unit: 'pH',
    kind: 'measured',
    aggregation: 'ph_hplus'
  },
  ph_mv: {
    label: 'pH (elektrochemický signál)',
    unit: 'mV',
    kind: 'measured',
    aggregation: 'none'
  },
  orp: {
    label: 'ORP',
    unit: 'mV',
    kind: 'measured',
    aggregation: 'mean'
  },
  chlorophyll_ugl: {
    label: 'Chlorofyl',
    unit: 'µg/L',
    kind: 'measured',
    aggregation: 'mean'
  },
  chlorophyll_rfu: {
    label: 'Chlorofyl (RFU)',
    unit: 'RFU',
    kind: 'measured',
    aggregation: 'none'
  },
  chlorophyll_cells: {
    label: 'Chlorofyl (buňky)',
    unit: 'cells/mL',
    kind: 'measured',
    aggregation: 'none'
  },
  phycocyanin_ugl: {
    label: 'Sinice (fykocyanin, BGA-PC)',
    unit: 'µg/L',
    kind: 'measured',
    aggregation: 'mean'
  },
  phycocyanin_rfu: {
    label: 'Sinice (RFU)',
    unit: 'RFU',
    kind: 'measured',
    aggregation: 'none'
  },
  phycocyanin_cells: {
    label: 'Sinice (buňky)',
    unit: 'cells/mL',
    kind: 'measured',
    aggregation: 'none'
  },
  turbidity_ntu: {
    label: 'Zákal (NTU)',
    unit: 'NTU',
    kind: 'measured',
    aggregation: 'mean'
  },
  turbidity_fnu: {
    label: 'Zákal (FNU)',
    unit: 'FNU',
    kind: 'measured',
    aggregation: 'mean'
  }
});

// Supplementary fields (DATA-01: always editable directly in the Working Set table).
export const SUPPLEMENTARY_FIELDS = Object.freeze({
  air_temperature_c: { label: 'Teplota vzduchu', unit: '°C' },
  transparency_m: { label: 'Průhlednost', unit: 'm' },
  flow: { label: 'Průtok', unit: null } // unit intentionally unverified – SPEC §11 item 5
});

export function isKnownParameter(key) {
  return Object.prototype.hasOwnProperty.call(PARAMETERS, key);
}

export function getParameterDef(key) {
  return PARAMETERS[key] ?? null;
}

export function getAggregation(key) {
  return PARAMETERS[key]?.aggregation ?? 'none';
}

/**
 * Normalizes a free-form unit string so that different encodings of the
 * same physical unit compare equal (µ vs μ vs u, mg/l vs mg/L, spacing).
 * This performs no physical conversion — it only canonicalizes spelling.
 */
export function normalizeUnitToken(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === '') return null;
  s = s.replace(/[µμ]/g, 'u'); // µ (micro sign) / μ (Greek mu) → u
  s = s.replace(/\s+/g, '');
  s = s.replace(/^mg\/l$/i, 'mg/L');
  s = s.replace(/^us\/cm$/i, 'uS/cm');
  s = s.replace(/^ms\/m$/i, 'mS/m');
  s = s.replace(/^ntu$/i, 'NTU');
  s = s.replace(/^fnu$/i, 'FNU');
  s = s.replace(/^mv$/i, 'mV');
  s = s.replace(/^rfu$/i, 'RFU');
  s = s.replace(/^cells\/ml$/i, 'cells/mL');
  s = s.replace(/^ug\/l$/i, 'ug/L');
  s = s.replace(/^psu$/i, 'psu');
  return s;
}

export const UNIT_MICROSIEMENS = 'uS/cm'; // normalized spelling of µS/cm
export const UNIT_MILLISIEMENS_PER_M = 'mS/m';

// The three conductivity-family canonical keys that may require the
// explicit µS/cm → mS/m import conversion (plan §5a). They are listed
// together only for that one shared mechanical step — they remain distinct
// physical quantities everywhere else (never merged or substituted).
export const CONDUCTIVITY_PARAM_KEYS = ['specific_conductance', 'conductivity', 'nlf_conductivity'];
