import { RECLASSIFICATION_REASON_MIN_LENGTH } from '#plugins/kace/shared/reclassification.constants.js';

export function hasAuxiliaryReclassificationIntent(caseObj) {
  const destino = caseObj?.clasificacion_id;
  const origen = caseObj?.current_clasificacion_id;
  return (
    destino != null &&
    destino !== '' &&
    origen != null &&
    origen !== '' &&
    String(destino) !== String(origen)
  );
}

export function attachAuxiliaryReclassificationComment(envelope, reason) {
  if (!hasAuxiliaryReclassificationIntent(envelope?.case)) {
    return envelope;
  }
  const descripcion = typeof reason === 'string' ? reason.trim() : '';
  return {
    ...envelope,
    comment: { descripcion },
  };
}

export function assertAuxiliaryReclassificationReason(envelope, reason) {
  if (!hasAuxiliaryReclassificationIntent(envelope?.case)) {
    return;
  }
  const descripcion = typeof reason === 'string' ? reason.trim() : '';
  if (descripcion.length < RECLASSIFICATION_REASON_MIN_LENGTH) {
    throw new Error(
      `El motivo de la reclasificación debe tener al menos ${RECLASSIFICATION_REASON_MIN_LENGTH} caracteres.`
    );
  }
}

export function ensureAuxiliaryReclassificationTransition(
  payload,
  fallbacks = {}
) {
  if (
    !hasAuxiliaryReclassificationIntent(payload?.case) &&
    payload?.comment == null
  ) {
    return payload;
  }
  const transicionId =
    payload.case?.transicion_id ??
    fallbacks.live ??
    fallbacks.storeTransition ??
    fallbacks.snapshot;
  if (transicionId == null || String(transicionId).trim() === '') {
    throw new Error('Debe seleccionar un estado para reclasificar el caso.');
  }
  if (payload.case?.transicion_id != null) {
    return payload;
  }
  return {
    ...payload,
    case: { ...payload.case, transicion_id: transicionId },
  };
}
