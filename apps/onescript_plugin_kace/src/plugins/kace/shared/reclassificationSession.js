/**
 * Sesión viva de reclasificación, en memoria del módulo.
 *
 * El precheck y el motivo viven en localStorage porque OS-11 los lee al guardar. Ese store
 * sobrevive a recargar la pestaña, y por eso el efecto de "precheck abandonado" los borra si
 * al montar no hay confirmación local. El problema: confirmar emite `kaceCaseReclassified` y
 * recarga el formulario destino. Ese remount nace con `confirmedClasificacionId` vacío, el
 * efecto trata la sesión como abandonada y borra el motivo. El POST sale sin `comment` y el
 * timeline pinta "No reason recorded"; `applyPendingReclassification` ni siquiera corre, así
 * que tampoco se escribe `case.reclassified`.
 *
 * Esta bandera vive en el heap del plugin —sobrevive al remount de React, muere al recargar
 * la página— y es lo que distingue "sigo reclasificando" de "volví después y esto quedó
 * huérfano".
 */

let liveSession = null;

/**
 * @param {unknown} caseId
 * @param {unknown} clasificacionId
 */
export function markReclassificationSession(caseId, clasificacionId) {
  if (
    caseId == null ||
    caseId === '' ||
    clasificacionId == null ||
    clasificacionId === ''
  ) {
    liveSession = null;
    return;
  }
  liveSession = {
    caseId: String(caseId),
    clasificacionId: String(clasificacionId),
  };
}

export function clearReclassificationSession() {
  liveSession = null;
}

/**
 * @param {unknown} caseId
 * @returns {boolean}
 */
export function hasReclassificationSession(caseId) {
  if (!liveSession || caseId == null || caseId === '') return false;
  return liveSession.caseId === String(caseId);
}

/**
 * @param {unknown} caseId
 * @returns {string|null}
 */
export function reclassificationSessionTarget(caseId) {
  if (!hasReclassificationSession(caseId)) return null;
  return liveSession.clasificacionId;
}
