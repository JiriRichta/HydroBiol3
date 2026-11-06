// Full-record detail dialog (SPEC §5.3 Mode B). Every user value and
// metadata field is editable here except measurementId and the raw
// provenience/originalRaw audit payload (DATA invariant). Save/Storno only
// — nothing is written until Save is pressed.

import { h, clear } from './dom.js';
import { openDialog } from './dialogs.js';
import { PARAMETERS } from '../core/registry/parameters.js';
import { PARAM_COLUMN_ORDER } from './grid/columns.js';
import { parseNumber } from '../core/import/numbers.js';
import { parseTime24h } from '../core/import/datetime.js';

function textField(label, value, onChange) {
  const input = h('input', { className: 'hb-field', type: 'text', value: value ?? '', onInput: (e) => onChange(e.target.value) });
  return h('div', { className: 'hb-field-group' }, [h('label', {}, [label]), input]);
}

function numberField(label, value, unit, onChange, invalid) {
  const input = h('input', {
    className: `hb-field${invalid ? ' is-invalid' : ''}`,
    type: 'text',
    inputmode: 'decimal',
    value: value === null || value === undefined ? '' : String(value),
    onInput: (e) => onChange(e.target.value)
  });
  return h('div', { className: 'hb-field-group' }, [h('label', {}, [`${label}${unit ? ` (${unit})` : ''}`]), input]);
}

/**
 * @param {object} measurement  a draft already cloned by the caller's edit session
 * @param {(updated: object) => { ok: boolean, issues?: object[] }} onSave  must return the validation outcome
 */
export function openDetailDialog(measurement, { onSave, onCancel } = {}) {
  const draft = {
    sampleNumber: measurement.sampleNumber,
    date: measurement.date,
    time: measurement.time,
    site: measurement.site,
    device: measurement.device,
    description: measurement.description,
    supplementary: { ...measurement.supplementary },
    // Every canonical parameter gets a draft slot (not just the ones this
    // record already has) so a manual/calculated record can have any of
    // them filled in here for the first time (AT-10).
    parameters: Object.fromEntries(
      PARAM_COLUMN_ORDER.map((key) => [
        key,
        measurement.parameters[key] ? { ...measurement.parameters[key] } : { value: null, unit: PARAMETERS[key].unit, raw: null, sourceColumn: null, sensorId: null }
      ])
    )
  };
  const fieldErrors = {};

  const errorBox = h('div', { className: 'hb-issue-list' });

  function renderErrors() {
    clear(errorBox);
    Object.values(fieldErrors)
      .flat()
      .forEach((msg) => errorBox.appendChild(h('div', { className: 'hb-issue-list__item' }, [msg])));
  }

  const identitySection = h('div', { className: 'hb-dialog__grid' }, [
    h('div', { className: 'hb-field-group' }, [h('label', {}, ['ID (neměnné)']), h('input', { className: 'hb-field', type: 'text', value: measurement.measurementId, disabled: true })]),
    textField('Číslo vzorku', draft.sampleNumber, (v) => (draft.sampleNumber = v || null)),
    h('div', { className: 'hb-field-group' }, [
      h('label', {}, ['Datum']),
      h('input', {
        className: 'hb-field',
        type: 'text',
        placeholder: 'RRRR-MM-DD',
        value: draft.date ?? '',
        onInput: (e) => {
          const text = e.target.value.trim();
          if (text === '') {
            draft.date = null;
            delete fieldErrors.date;
          } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            draft.date = text;
            delete fieldErrors.date;
          } else {
            fieldErrors.date = ['Datum musí být ve formátu RRRR-MM-DD.'];
          }
          renderErrors();
        }
      })
    ]),
    h('div', { className: 'hb-field-group' }, [
      h('label', {}, ['Čas']),
      h('input', {
        className: 'hb-field',
        type: 'text',
        placeholder: 'HH:MM:SS',
        value: draft.time ?? '',
        onInput: (e) => {
          const text = e.target.value.trim();
          if (text === '') {
            draft.time = null;
            delete fieldErrors.time;
          } else {
            const parsed = parseTime24h(text);
            if (parsed.ok) {
              draft.time = parsed.time;
              delete fieldErrors.time;
            } else {
              fieldErrors.time = ['Čas musí být ve formátu HH:MM:SS.'];
            }
          }
          renderErrors();
        }
      })
    ]),
    textField('Lokalita', draft.site, (v) => (draft.site = v || null)),
    textField('Přístroj', draft.device, (v) => (draft.device = v || null)),
    textField('Popis', draft.description, (v) => (draft.description = v || null))
  ]);

  const supplementarySection = h('div', { className: 'hb-dialog__grid' }, [
    numberField('Teplota vzduchu', draft.supplementary.air_temperature_c, '°C', (v) => setSupplementary('air_temperature_c', v)),
    numberField('Průhlednost', draft.supplementary.transparency_m, 'm', (v) => setSupplementary('transparency_m', v)),
    numberField('Průtok', draft.supplementary.flow, null, (v) => setSupplementary('flow', v))
  ]);

  function setSupplementary(key, text) {
    const trimmed = text.trim();
    if (trimmed === '') {
      draft.supplementary[key] = null;
      delete fieldErrors[`supp:${key}`];
    } else {
      const parsed = parseNumber(trimmed, { decimalSeparator: '.' });
      if (parsed.invalid) {
        fieldErrors[`supp:${key}`] = [`Neplatná hodnota pole "${key}".`];
      } else {
        draft.supplementary[key] = parsed.value;
        delete fieldErrors[`supp:${key}`];
      }
    }
    renderErrors();
  }

  const paramFields = PARAM_COLUMN_ORDER.map((key) => {
    const param = draft.parameters[key];
    return numberField(PARAMETERS[key].label, param.value, param.unit, (text) => {
      const trimmed = text.trim();
      if (trimmed === '') {
        param.value = null;
        param.invalid = false;
      } else {
        const parsed = parseNumber(trimmed, { decimalSeparator: '.' });
        param.value = parsed.value;
        param.invalid = parsed.invalid;
      }
    });
  });

  const annotationNote = measurement.annotation
    ? h('p', { className: 'hb-field-group' }, [h('label', {}, ['Annotation (původní, needitovatelné)']), h('span', {}, [measurement.annotation])])
    : null;

  const body = h('div', {}, [
    identitySection,
    h('div', { className: 'hb-dialog__section-title' }, ['Doplňkové parametry']),
    supplementarySection,
    h('div', { className: 'hb-dialog__section-title' }, ['Naměřené hodnoty']),
    h('div', { className: 'hb-dialog__grid' }, paramFields),
    annotationNote,
    errorBox
  ]);

  const { close } = openDialog({
    title: `Detail záznamu ${measurement.measurementId}`,
    wide: true,
    body,
    actions: [
      h('button', { className: 'hb-button hb-button--secondary', onClick: () => { close(); onCancel?.(); } }, ['Storno']),
      h(
        'button',
        {
          className: 'hb-button hb-button--primary',
          onClick: () => {
            if (Object.keys(fieldErrors).length > 0) {
              renderErrors();
              return;
            }
            // Drop placeholder parameter slots that were never touched (no
            // stored value and nothing entered here) so empty records
            // don't accumulate dozens of null entries.
            const cleanedParameters = Object.fromEntries(
              Object.entries(draft.parameters).filter(([, p]) => p.value !== null || p.raw !== null)
            );
            const updated = {
              ...measurement,
              sampleNumber: draft.sampleNumber,
              date: draft.date,
              time: draft.time,
              site: draft.site,
              device: draft.device,
              description: draft.description,
              supplementary: draft.supplementary,
              parameters: cleanedParameters
            };
            const result = onSave(updated);
            if (result?.ok === false) {
              fieldErrors.save = (result.issues ?? []).map((i) => i.message);
              renderErrors();
              return;
            }
            close();
          }
        },
        ['Uložit']
      )
    ]
  });
}
