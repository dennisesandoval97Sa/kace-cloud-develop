import {
  RECLASSIFICATION_APPLIED_STORE_PATH,
  RECLASSIFICATION_PRECHECK_STORE_PATH,
  RECLASSIFICATION_REASON_STORE_PATH,
} from '#plugins/kace/shared/reclassification.constants.js';
import { clearReclassificationSession } from '#plugins/kace/shared/reclassificationSession.js';

/**
 * Paso 1 del guardado de una reclasificación (MSKT-1392 OS-11).
 *
 * Corre desde `custom-submit` y no desde los OS-SCHEMAS: el guardado del formulario lo dispara
 * código OneScript del tenant, así que orquestar aquí es lo único que garantiza el orden —y que la
 * reclasificación no se repita en un reintento— para todos los tenants sin editar sus esquemas.
 *
 * Fuera de React a propósito: así se prueba sin montar el formulario.
 *
 * @param {Object} params
 * @param {{ getService: (name: string) => any }} params.kaceEngine
 * @param {{ get: (path: string) => any, set: (path: string, value: any) => void }} params.storeService
 * @returns {Promise<{skipped?: boolean, applied?: boolean, failed?: boolean, message?: string,
 *   reasonDiscarded?: boolean}>} `reasonDiscarded`: la reclasificación se aplicó, pero el motivo
 *   que el asesor escribió era demasiado corto para el backend y no se guardó.
 */
export async function applyPendingReclassification({
  kaceEngine,
  storeService,
}) {
  const precheck = storeService?.get?.(RECLASSIFICATION_PRECHECK_STORE_PATH);
  const clasificacionId = precheck?.clasificacion_id;
  if (!clasificacionId) return { skipped: true };

  const caseRow = storeService.get('cases.case_data');
  const caseId = storeService.get('cases.case_id') ?? caseRow?.id;
  if (!caseId) return { skipped: true };

  /*
   * El store vive en localStorage y sobrevive al cambio de caso. Un precheck que no sea de ESTE
   * caso es basura de una reclasificación anterior, y aplicarlo reclasificaría el caso
   * equivocado sin que nadie lo pida: el snapshot de concurrencia que viaja en el POST es el del
   * caso actual, así que el backend tampoco lo frenaría. Se descarta, no se aplica.
   *
   * Sin `case_id` tampoco se puede verificar —sólo lo escriben versiones anteriores a este
   * guard—, así que se trata igual.
   */
  if (String(precheck.case_id ?? '') !== String(caseId)) {
    storeService.set(RECLASSIFICATION_PRECHECK_STORE_PATH, null);
    return { skipped: true };
  }

  // Reintento tras un guardado auxiliar fallido: la reclasificación ya está aplicada y repetirla
  // duplicaría el comentario de motivo.
  const applied = storeService.get(RECLASSIFICATION_APPLIED_STORE_PATH);
  if (
    applied &&
    String(applied.case_id) === String(caseId) &&
    String(applied.clasificacion_id) === String(clasificacionId)
  ) {
    return { skipped: true };
  }

  // El caso ya está en la clasificación destino: no hay nada que reclasificar.
  if (
    caseRow?.clasificacion_id != null &&
    String(caseRow.clasificacion_id) === String(clasificacionId)
  ) {
    return { skipped: true };
  }

  const transicionId = storeService.get(
    'states.current_transition'
  )?.transition_id;
  if (!transicionId) {
    return {
      failed: true,
      message: 'Debe seleccionar un estado para reclasificar el caso.',
    };
  }

  const caseService = kaceEngine?.getService?.('cases');
  if (!caseService?.reclassifyCase) {
    return {
      failed: true,
      message: 'No se pudo reclasificar el caso: servicio no disponible.',
    };
  }

  try {
    const outcome = await caseService.reclassifyCase({
      caseId,
      clasificacionId,
      transicionId,
      currentClasificacionId: caseRow?.clasificacion_id ?? null,
      motivo: storeService.get(RECLASSIFICATION_REASON_STORE_PATH) ?? '',
      updatedAt: caseRow?.updated_at ?? null,
      updatedBy: caseRow?.updated_by ?? null,
    });
    // El precheck se consume al aplicarse. Dejarlo vivo lo convierte en lo que este mismo guard
    // tiene que descartar en el caso siguiente; quien traza la reclasificación a medias es
    // `RECLASSIFICATION_APPLIED_STORE_PATH`, que sí sobrevive hasta que el auxiliar aterrice.
    storeService.set(RECLASSIFICATION_PRECHECK_STORE_PATH, null);
    clearReclassificationSession();
    return {
      applied: true,
      reasonDiscarded: outcome?.reasonDiscarded === true,
    };
  } catch (error) {
    return {
      failed: true,
      message:
        typeof caseService.handleErrorMessage === 'function'
          ? caseService.handleErrorMessage(error)
          : (error?.message ?? 'No se pudo reclasificar el caso.'),
    };
  }
}
