import { CASE_AUXILIARY_DATA_INVALID } from '@kace/error-codes';
import { conditionFieldLabel } from './conditionFieldLabel.js';

const GENERIC =
  'Revisa los campos del formulario: hay valores que no son válidos.';

const PROBLEM_BY_REASON = {
  required: 'es obligatorio',
  invalid: 'no tiene un valor válido',
  past_date: 'no puede tener una fecha anterior a la actual',
  duplicate: 'ya está registrado en otro caso',
};

const fieldName = (field, fieldLabel) =>
  fieldLabel?.(field) || conditionFieldLabel(field);

/**
 * Texto en español del rechazo de los datos del formulario auxiliar, a partir
 * del 400 HTTP: los campos viajan en `data.fields` (el mensaje se sana en
 * producción). Si el error es de otro tipo, devuelve undefined.
 *
 * @param {{ response?: { data?: object } }|null|undefined} error
 * @param {{ fieldLabel?: (field: string) => string|undefined }} [options]
 * @returns {string|undefined}
 */
export const auxiliaryDataErrorFromHttp = (error, { fieldLabel } = {}) => {
  const publicData = error?.response?.data?.data;
  if (publicData?.code !== CASE_AUXILIARY_DATA_INVALID) return undefined;

  const fields = Array.isArray(publicData.fields)
    ? publicData.fields.filter((item) => item?.field)
    : [];
  if (fields.length === 0) return GENERIC;

  const phrases = fields.map(
    ({ field, reason }) =>
      `${fieldName(field, fieldLabel)} ${PROBLEM_BY_REASON[reason] ?? PROBLEM_BY_REASON.invalid}`
  );
  return `Revisa el formulario: ${phrases.join('; ')}.`;
};
