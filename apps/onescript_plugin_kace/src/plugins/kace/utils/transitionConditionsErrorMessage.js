import { CASE_TRANSITION_CONDITIONS_NOT_MET } from '@kace/error-codes';
import { conditionFieldLabel } from './conditionFieldLabel.js';

const GENERIC =
  'Las condiciones configuradas para esta transición no se cumplen';

const LEGACY_MESSAGE =
  'The conditions configured for this transition are not met';

const PREFIX = 'No se puede cambiar el estado: ';

const UNMET = 'no cumple la condición configurada';

const quoteList = (values) => values.map(quote).join(', ');

/** Cada operador recibe el valor esperado ya formateado (texto o lista). */
const REQUIREMENT_BY_OPERATOR = {
  '=': (expected) => `debe ser ${quote(expected)}`,
  '!=': (expected) => `no debe ser ${quote(expected)}`,
  '<': (expected) => `debe ser menor que ${quote(expected)}`,
  '>': (expected) => `debe ser mayor que ${quote(expected)}`,
  '<=': (expected) => `debe ser menor o igual que ${quote(expected)}`,
  '>=': (expected) => `debe ser mayor o igual que ${quote(expected)}`,
  contains: (expected) => `debe contener ${quote(expected)}`,
  doesNotContain: (expected) => `no debe contener ${quote(expected)}`,
  beginsWith: (expected) => `debe comenzar con ${quote(expected)}`,
  doesNotBeginWith: (expected) => `no debe comenzar con ${quote(expected)}`,
  endsWith: (expected) => `debe terminar en ${quote(expected)}`,
  doesNotEndWith: (expected) => `no debe terminar en ${quote(expected)}`,
  in: (expected) => `debe ser uno de: ${quoteList(asList(expected))}`,
  notIn: (expected) => `no debe ser ninguno de: ${quoteList(asList(expected))}`,
  between: (expected) => rangeRequirement('debe estar entre', expected),
  notBetween: (expected) => rangeRequirement('no debe estar entre', expected),
};

const VALUELESS_REQUIREMENT = {
  null: 'no debe tener valor',
  notNull: 'debe tener un valor',
  isEmpty: 'debe estar vacío',
  isNotEmpty: 'no debe estar vacío',
};

/**
 * Texto en español de un bloqueo por reglas de transición. Si el código (o el
 * mensaje legado) no es de condiciones incumplidas, devuelve undefined.
 *
 * El motivo concreto sale de `toPublicData().conditions.failed`: en producción
 * el mensaje HTTP se sana y solo sobreviven el código y esos datos. Cuando el
 * backend nombra la entidad (`expected_label`/`actual_label`) se muestra el
 * nombre y no el id.
 *
 * @param {{
 *   code?: string|null,
 *   message?: string,
 *   conditions?: { combinator?: string|null, failed?: Array<object> }
 * }|null|undefined} error
 * @param {{ fieldLabel?: (field: string) => string }} [options] - Cómo nombrar
 *   el campo; por defecto, sin etiquetas del tenant ni del formulario.
 * @returns {string|undefined}
 */
export const transitionConditionsErrorMessage = (error, options = {}) => {
  if (!isTransitionConditionsError(error)) return undefined;

  const failed = Array.isArray(error.conditions?.failed)
    ? error.conditions.failed.filter((item) => item && item.field)
    : [];

  if (failed.length === 0) return GENERIC;

  const phrases = failed.map((condition) =>
    conditionPhrase(condition, options.fieldLabel)
  );
  if (error.conditions.combinator === 'or') {
    return `${PREFIX}se requiere al menos una de estas condiciones: ${phrases.join('; ')}.`;
  }

  return `${PREFIX}${joinAll(phrases)}.`;
};

/**
 * Misma traducción, pero leyendo el 400 HTTP: el código y el diagnóstico
 * viajan en `errors[0]` y `data.conditions` (el mensaje se sana en producción).
 *
 * @param {{ response?: { data?: object }, message?: string }|null|undefined} error
 * @param {{ fieldLabel?: (field: string) => string }} [options]
 * @returns {string|undefined}
 */
export const transitionConditionsErrorFromHttp = (error, options = {}) => {
  const body = error?.response?.data;
  const firstError = Array.isArray(body?.errors) ? body.errors[0] : null;
  const publicData =
    body?.data && typeof body.data === 'object' ? body.data : {};

  return transitionConditionsErrorMessage(
    {
      code: firstError?.code ?? publicData.code,
      message:
        (typeof firstError?.message === 'string' && firstError.message) ||
        (typeof body?.errors === 'string' ? body.errors : error?.message),
      conditions: publicData.conditions,
    },
    options
  );
};

const isTransitionConditionsError = (error) =>
  error?.code === CASE_TRANSITION_CONDITIONS_NOT_MET ||
  error?.message === LEGACY_MESSAGE;

const joinAll = (phrases) =>
  phrases.length <= 1
    ? phrases.join('')
    : `${phrases.slice(0, -1).join(', ')} y ${phrases[phrases.length - 1]}`;

const subjectOf = (field, fieldLabel) => {
  if (fieldLabel) {
    try {
      const label = fieldLabel(field);
      if (typeof label === 'string' && label !== '') return label;
    } catch {
      // Nombrar el campo es un extra: el bloqueo se explica igual sin él.
    }
  }
  return conditionFieldLabel(field);
};

const conditionPhrase = (condition, fieldLabel) => {
  const subject = subjectOf(condition.field, fieldLabel);
  const hasExpected = Object.hasOwn(condition, 'expected');
  const hasActual = Object.hasOwn(condition, 'actual');

  const valueless = VALUELESS_REQUIREMENT[condition.operator];
  const requirement =
    valueless ??
    (hasExpected
      ? REQUIREMENT_BY_OPERATOR[condition.operator]?.(
          displayValue(condition.expected, condition.expected_label)
        )
      : undefined);

  if (!requirement) return `${subject} ${UNMET}`;

  return `${subject} ${requirement}${hasActual ? actualSuffix(condition) : ''}`;
};

const actualSuffix = ({ actual, actual_label: actualLabel }) => {
  if (actual === null || actual === undefined || actual === '') {
    return ' (actualmente está vacío)';
  }
  return ` (actualmente es ${quote(displayValue(actual, actualLabel))})`;
};

/** El nombre que publicó el backend cuando lo hay; si no, el valor tal cual. */
const displayValue = (value, label) => {
  if (Array.isArray(value)) {
    const labels = Array.isArray(label) ? label : [];
    return value.map((item, index) => formatValue(labels[index] ?? item));
  }
  return formatValue(label ?? value);
};

const asList = (value) => (Array.isArray(value) ? value : [value]);

const rangeRequirement = (verb, expected) => {
  const [from, to] = asList(expected);
  return to === undefined
    ? `${verb} ${quote(from)}`
    : `${verb} ${quote(from)} y ${quote(to)}`;
};

const formatValue = (value) => {
  if (value === null || value === undefined) return 'vacío';
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'boolean') return value ? 'sí' : 'no';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const quote = (value) => `«${value}»`;
