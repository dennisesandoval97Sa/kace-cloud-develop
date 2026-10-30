import { RECLASSIFICATION_REASON_MIN_LENGTH } from '#plugins/kace/shared/reclassification.constants.js';

/**
 * El contrato compartido vive en `shared/` —lo consumen también los servicios— y se reexporta
 * aquí para que el componente lo importe de un solo sitio.
 */
export {
  RECLASSIFICATION_PRECHECK_STORE_PATH,
  RECLASSIFICATION_REASON_MAX_LENGTH,
  RECLASSIFICATION_REASON_MIN_LENGTH,
  RECLASSIFICATION_REASON_STORE_PATH,
  RECLASSIFIED_EVENT,
} from '#plugins/kace/shared/reclassification.constants.js';

/**
 * Decide si el desplegable de clasificación se desbloquea en un caso ya clasificado.
 *
 * Vive fuera de React para poder probarse sin montar el componente: es la condición que
 * gobierna las cuatro guardas de `Classifications.jsx`.
 *
 * @param {Object} params
 * @param {unknown} params.globalFlagEnabled - Flag por tenant `allow_case_reclassification`.
 * @param {unknown} params.hasReclassifyPermission - Permiso de rol `CaseReclassify` del agente
 *   (el mismo que exige el backend). AMBOS checks son obligatorios: el flag global por sí solo
 *   desbloquearía el desplegable para cualquier agente, tenga o no el permiso.
 * @param {boolean} params.caseHasClassification - El caso ya tiene `clasificacion_id`.
 * @param {boolean} params.caseIsClosed - El caso tiene `fecha_resolucion`.
 * @returns {boolean}
 */
export function isReclassificationUnlocked({
  globalFlagEnabled,
  hasReclassifyPermission,
  caseHasClassification,
  caseIsClosed,
}) {
  // `=== true` y no truthiness: mientras la configuración global no resuelve, el store devuelve
  // `undefined`, y un tenant puede tener el flag serializado como string.
  if (globalFlagEnabled !== true) return false;
  if (hasReclassifyPermission !== true) return false;
  if (!caseHasClassification) return false;
  // El backend rechaza un caso cerrado con CASE_RECLASSIFY_CASE_CLOSED (0x030056).
  if (caseIsClosed) return false;
  return true;
}

/**
 * El asesor eligió una clasificación distinta de la que tiene el caso.
 *
 * Se compara contra `clasificacion_id` y no contra "tocó el desplegable": volver a la rama original
 * no es una reclasificación.
 *
 * @param {Object} params
 * @param {boolean} params.reclassifyUnlocked - Resultado de `isReclassificationUnlocked`.
 * @param {unknown} params.selectedClasificacionId - Hoja elegida ahora mismo.
 * @param {unknown} params.caseClasificacionId - La que tiene el caso guardado.
 * @returns {boolean}
 */
export function isReclassifying({
  reclassifyUnlocked,
  selectedClasificacionId,
  caseClasificacionId,
}) {
  if (!reclassifyUnlocked) return false;
  if (selectedClasificacionId == null || selectedClasificacionId === '') {
    return false;
  }
  if (caseClasificacionId == null || caseClasificacionId === '') return false;
  return String(selectedClasificacionId) !== String(caseClasificacionId);
}

/**
 * El motivo es obligatorio: vacío o más corto que `RECLASSIFICATION_REASON_MIN_LENGTH`, lo mismo
 * que rechaza `assertAuxiliaryReclassificationReason` al guardar.
 *
 * @param {unknown} reason
 * @returns {boolean}
 */
export function isReclassificationReasonInvalid(reason) {
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  return trimmed.length < RECLASSIFICATION_REASON_MIN_LENGTH;
}

/**
 * El precheck guardado quedó huérfano: se confirmó una reclasificación que nunca se guardó.
 *
 * El marcador vive en localStorage y sobrevive a cerrar la pestaña, navegar o recargar; solo se
 * limpiaba al cancelar explícitamente o tras aplicarse. Un asesor que confirma y se va deja el
 * marcador vivo, y al reabrir el caso la UI ya ha vuelto a la clasificación original —el remount
 * pierde la sesión de reclasificación y re-sincroniza con el caso—, pero `custom-submit` sigue
 * encontrando el marcador y aborta CUALQUIER guardado posterior de ese caso pidiendo un estado
 * que ya no hay: el caso queda bloqueado.
 *
 * Huérfano = es de ESTE caso, apunta a una clasificación que el caso todavía no tiene, y en esta
 * sesión no hay ninguna reclasificación viva. Las tres condiciones juntas: la primera sola
 * borraría el marcador de otro caso (que `applyPendingReclassification` ya descarta por su
 * cuenta), la segunda sola borraría uno ya aplicado pendiente de guardado auxiliar, y sin la
 * tercera se borraría el marcador que el asesor acaba de confirmar.
 *
 * @param {Object} params
 * @param {{ case_id?: unknown, clasificacion_id?: unknown }|null|undefined} params.precheck - Lo
 *   guardado en `RECLASSIFICATION_PRECHECK_STORE_PATH`.
 * @param {unknown} params.caseId - Caso que el formulario tiene abierto.
 * @param {unknown} params.caseClasificacionId - Clasificación persistida de ese caso.
 * @param {boolean} params.hasLiveReclassification - Hay una confirmación viva en esta sesión.
 * @returns {boolean}
 */
export function isPrecheckAbandoned({
  precheck,
  caseId,
  caseClasificacionId,
  hasLiveReclassification,
}) {
  if (hasLiveReclassification) return false;
  const target = precheck?.clasificacion_id;
  if (target == null || target === '') return false;
  if (caseId == null || caseId === '') return false;
  if (String(precheck?.case_id ?? '') !== String(caseId)) return false;
  if (caseClasificacionId == null || caseClasificacionId === '') return false;

  return String(target) !== String(caseClasificacionId);
}

/** Propagar la hoja al formulario, como siempre. */
export const SELECTION_PROPAGATE = 'propagate';

/** Pedir confirmación antes de reemplazar el formulario: hay cambios sin guardar en juego. */
export const SELECTION_CONFIRM = 'confirm';

/**
 * Qué hacer cuando la selección llega a una hoja del árbol.
 *
 * Es el seam de la reclasificación: mientras devuelva `SELECTION_CONFIRM`, el componente NO propaga
 * `clasificacion_id` ni `flujo_id`, que es lo que dispara la recarga del formulario. OS-8 mete el
 * precheck entre la confirmación y la propagación.
 *
 * @param {Object} params
 * @param {unknown} params.leafClasificacionId - Clasificación de la hoja elegida.
 * @param {unknown} params.caseClasificacionId - La que tiene el caso guardado.
 * @param {boolean} params.reclassifyUnlocked - Resultado de `isReclassificationUnlocked`.
 * @param {unknown} params.confirmedClasificacionId - La que el asesor ya confirmó, si hay.
 * @returns {typeof SELECTION_PROPAGATE | typeof SELECTION_CONFIRM}
 */
export function resolveLeafSelectionAction({
  leafClasificacionId,
  caseClasificacionId,
  reclassifyUnlocked,
  confirmedClasificacionId,
}) {
  if (
    !isReclassifying({
      reclassifyUnlocked,
      selectedClasificacionId: leafClasificacionId,
      caseClasificacionId,
    })
  ) {
    // Creación, gate bloqueado o la misma clasificación del caso: el comportamiento de siempre.
    return SELECTION_PROPAGATE;
  }
  if (
    confirmedClasificacionId != null &&
    String(confirmedClasificacionId) === String(leafClasificacionId)
  ) {
    return SELECTION_PROPAGATE;
  }
  return SELECTION_CONFIRM;
}
