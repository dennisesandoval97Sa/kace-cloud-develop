import es from '../locale/es.json';

const JOI_MESSAGES = Object.freeze({ ...es.joiMessages });
const FORMIO_MESSAGES = Object.freeze({ ...es.formioMessages });
const ALERT_PREFIX = es.alertPrefix;
const DEFAULT_FIELD_LABEL = es.defaultFieldLabel;
const INVALID_FALLBACK = es.invalidFallback;

// Nombres de patrón hardcodeados en inglés en @kace/schemabuilder's DateSchemaBuilder
// (paquete compartido con el backend). Joi interpola {#name} tal cual en el mensaje,
// sin pasar por joiMessages, así que se traducen aquí en el punto de renderizado.
const PATTERN_NAME_TRANSLATIONS = Object.freeze({
  'ISO 8601 with timezone': 'ISO 8601 con zona horaria',
  'ISO 8601 without timezone': 'ISO 8601 sin zona horaria',
});

export const getJoiMessages = () => JOI_MESSAGES;
export const getFormioMessages = () => FORMIO_MESSAGES;
export const getAlertPrefix = () => ALERT_PREFIX;
export const getDefaultFieldLabel = () => DEFAULT_FIELD_LABEL;
export const getInvalidFallback = () => INVALID_FALLBACK;

export const localizePatternName = (message) => {
  if (typeof message !== 'string') return message;
  let result = message;
  for (const [en, esName] of Object.entries(PATTERN_NAME_TRANSLATIONS)) {
    result = result.split(en).join(esName);
  }
  return result;
};
