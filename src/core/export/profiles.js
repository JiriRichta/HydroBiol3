// Declarative export profile definitions (SPEC §7, plan §6/§6a).
//
// Each column is a plain description of where its value comes from and
// what is required of it — buildRows.js reads these, validateExport.js
// enforces them. Adding a third lab later means adding one more profile
// here, not touching the importers.
//
// `mapping: 'unverified'` marks a column whose target meaning/unit in the
// real LabSystem has not been confirmed (SPEC §11); these require the
// user's explicit, conscious acknowledgement before export, but — per the
// plan's revision 2 — that acknowledgement can never waive an actual
// blocking error (wrong unit, invalid value, missing required field).

export const EXPORT_PROFILES = {
  CB: {
    id: 'CB',
    label: 'LabSystem ČB',
    sheetName: 'LabSys_Export',
    columns: [
      { header: 'VZOREK', source: 'sampleNumber', type: 'text', required: true },
      { header: 'TEMP', source: 'param:water_temperature', type: 'number' },
      { header: 'COND', source: 'param:specific_conductance', type: 'number', requireUnit: 'mS/m' },
      { header: 'DO_%', source: 'param:do_saturation', type: 'number' },
      { header: 'DO_CONC', source: 'param:do_concentration', type: 'number' },
      { header: 'DEPTH', source: 'param:depth', type: 'number' },
      { header: 'PH', source: 'param:ph', type: 'number' },
      { header: 'CHLOROPHYL', source: 'param:chlorophyll_ugl', type: 'number', mapping: 'unverified' },
      { header: 'ORP', source: 'param:orp', type: 'number' },
      { header: 'TEMPA', source: 'supp:air_temperature_c', type: 'number' },
      { header: 'TRANSP', source: 'supp:transparency_m', type: 'number' },
      { header: 'FLOW', source: 'supp:flow', type: 'number', mapping: 'unverified' },
      { header: 'Date', source: 'field:date', type: 'date', mapping: 'unverified' },
      { header: 'Time', source: 'field:time', type: 'time', mapping: 'unverified' }
    ]
  },
  PRAHA: {
    id: 'PRAHA',
    label: 'LabSystem Praha',
    columns: [
      { header: 'Date', source: 'field:date', type: 'date' },
      { header: 'Time', source: 'field:time', type: 'time' },
      { header: 'Site', source: 'field:site', type: 'text' },
      { header: 'Temp', source: 'param:water_temperature', type: 'number' },
      { header: 'DO %', source: 'param:do_saturation', type: 'number' },
      { header: 'DO Conc', source: 'param:do_concentration', type: 'number' },
      { header: 'SpCond', source: 'param:specific_conductance', type: 'number', requireUnit: 'mS/m', mapping: 'unverified' },
      { header: 'pH', source: 'param:ph', type: 'number' },
      { header: 'ORP', source: 'param:orp', type: 'number' },
      { header: 'Turbidity+', source: 'param:turbidity_ntu', type: 'number', mapping: 'unverified' },
      { header: 'BGA', source: 'param:phycocyanin_ugl', type: 'number', mapping: 'unverified' },
      { header: 'ch-isy', source: 'param:chlorophyll_ugl', type: 'number', mapping: 'unverified' },
      { header: 'Depth', source: 'param:depth', type: 'number' },
      { header: 'vz', source: 'sampleNumber', type: 'text', required: true },
      { header: null, source: 'field:description', type: 'text' } // column O — no header cell (vzor leaves it unnamed)
    ]
  }
};

export function getProfile(id) {
  const profile = EXPORT_PROFILES[id];
  if (!profile) throw new Error(`Unknown export profile "${id}"`);
  return profile;
}
