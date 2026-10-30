import {
  CASE_RECLASSIFY_CASE_CLOSED,
  CASE_RECLASSIFY_CLASSIFICATION_INACTIVE,
  CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP,
  CASE_RECLASSIFY_CLASSIFICATION_STALE,
  CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM,
  CASE_RECLASSIFY_DISABLED,
  CASE_RECLASSIFY_PARENT_UNVERIFIABLE,
  CASE_RECLASSIFY_REASON_REQUIRED,
  CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED,
  CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW,
  CASE_RECLASSIFY_TRANSITION_REQUIRED,
} from '@kace/error-codes';

// Mismos textos que `app.errors.public.CASE_RECLASSIFY_*` en apps/kace-saas/src/locale/es.json.
const MESSAGES_BY_CODE = {
  [CASE_RECLASSIFY_CASE_CLOSED]:
    'El caso está cerrado y no se puede reclasificar.',
  [CASE_RECLASSIFY_CLASSIFICATION_INACTIVE]:
    'La clasificación seleccionada está inactiva.',
  [CASE_RECLASSIFY_CLASSIFICATION_NOT_IN_GROUP]:
    'La clasificación seleccionada no está disponible para el grupo del caso.',
  [CASE_RECLASSIFY_SUBCASE_NOT_ALLOWED]:
    'La clasificación seleccionada no es compatible con la relación de subcasos del caso.',
  [CASE_RECLASSIFY_TRANSITION_OUT_OF_FLOW]:
    'El estado seleccionado no pertenece al flujo de la clasificación de destino.',
  [CASE_RECLASSIFY_CLASSIFICATION_WITHOUT_FORM]:
    'La clasificación seleccionada no tiene un formulario configurado para el grupo del caso.',
  [CASE_RECLASSIFY_CLASSIFICATION_STALE]:
    'La clasificación del caso cambió después de cargar el formulario. Recargue el caso antes de reclasificar.',
  [CASE_RECLASSIFY_PARENT_UNVERIFIABLE]:
    'No se pudo verificar el caso padre de este subcaso. Inténtalo de nuevo en unos segundos; si persiste, hay que revisar su jerarquía.',
  [CASE_RECLASSIFY_DISABLED]:
    'La reclasificación de casos está deshabilitada en la configuración global.',
  [CASE_RECLASSIFY_REASON_REQUIRED]:
    'Debe indicar el motivo de la reclasificación (mínimo 3 caracteres).',
  [CASE_RECLASSIFY_TRANSITION_REQUIRED]:
    'Debe seleccionar un estado para reclasificar el caso.',
};

/**
 * Texto en español de un bloqueo de reclasificación, resuelto por su código público; si el
 * código no es de reclasificación devuelve el mensaje del backend.
 *
 * @param {{ code?: string|null, message?: string }|null|undefined} error
 * @returns {string|undefined}
 */
export const reclassificationErrorMessage = (error) =>
  MESSAGES_BY_CODE[error?.code] ?? error?.message;
