import { auxiliaryDataErrorFromHttp } from './auxiliaryDataErrorMessage.js';
import { reclassificationErrorMessage } from './reclassificationErrorMessage.js';
import { transitionConditionsErrorFromHttp } from './transitionConditionsErrorMessage.js';

// Fuera de modo debug el backend oculta el detalle y responde con estos textos fijos
// (`SAFE_MESSAGES` de @kace/api-common); mismos textos que `app.errors.public.*` de kace-saas.
const SPANISH_BY_BACKEND_MESSAGE = {
  'Bad request': 'No se pudo procesar la solicitud.',
  'The request could not be processed.':
    'Revisa la información e inténtalo de nuevo.',
  'An unexpected error occurred. Please contact support.':
    'Ocurrió un error inesperado.',
  'An unexpected error occurred.': 'Ocurrió un error inesperado.',
  'Data processing error': 'Ocurrió un error inesperado.',
  Forbidden: 'No tienes permiso para realizar esta acción.',
  'Not found': 'No se encontró el recurso solicitado.',
  Conflict: 'Esta acción entra en conflicto con el estado actual del recurso.',
  'Request timeout': 'La solicitud tardó demasiado. Inténtalo de nuevo.',
  'The conditions configured for this transition are not met':
    'Las condiciones configuradas para esta transición no se cumplen',
};

/**
 * Texto en español para el asesor a partir del error de una petición al backend.
 *
 * @param {any} error - Error de axios o `Error` local.
 * @param {{ fieldLabel?: (field: string) => string|undefined }} [options]
 * @returns {string}
 */
export const httpErrorMessage = (error, { fieldLabel } = {}) => {
  const transitionMessage = transitionConditionsErrorFromHttp(error, {
    fieldLabel,
  });
  if (transitionMessage) return transitionMessage;

  const auxiliaryDataMessage = auxiliaryDataErrorFromHttp(error, {
    fieldLabel,
  });
  if (auxiliaryDataMessage) return auxiliaryDataMessage;

  const body = error?.response?.data;
  const errors = body?.errors;
  let message = 'An unexpected error occurred.';
  if (Array.isArray(errors) && errors.length > 0) {
    const [first] = errors;
    message =
      typeof first === 'string' ? first : reclassificationErrorMessage(first);
  } else if (errors && !Array.isArray(errors)) {
    message = errors;
  } else if (body?.message) {
    message = body.message;
  } else if (error?.message) {
    message = error.message;
  }
  return SPANISH_BY_BACKEND_MESSAGE[message] ?? message;
};
