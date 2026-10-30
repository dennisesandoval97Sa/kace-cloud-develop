import { v4 as uuidv4 } from 'uuid';

/**
 * Resolves description row id for submit (`caseData.description.id` comes from `case.descripcion_caso_id`).
 *
 * @param {Record<string, unknown> | null | undefined} loaded
 * @returns {string | null}
 */
export function resolveDescripcionCasoId(loaded) {
  if (!loaded || typeof loaded !== 'object') return null;
  const direct = loaded.descripcion_caso_id;
  if (direct != null && String(direct).trim() !== '') return String(direct);
  const nested = loaded.descripcion_caso;
  if (nested && typeof nested === 'object') {
    const rec = /** @type {Record<string, unknown>} */ (nested);
    const nid = rec.id;
    if (nid != null && String(nid).trim() !== '') return String(nid);
  }
  return null;
}

/**
 * Resolves aux_cases row id (GET `/aux-cases/:caseId` returns `data.id`).
 *
 * @param {Record<string, unknown> | null | undefined} loaded
 * @param {string | number | null | undefined} auxCaseIdFromFetch
 * @returns {string | null}
 */
export function resolveAuxCaseId(loaded, auxCaseIdFromFetch) {
  if (auxCaseIdFromFetch != null && String(auxCaseIdFromFetch).trim() !== '') {
    return String(auxCaseIdFromFetch);
  }
  if (!loaded || typeof loaded !== 'object') return null;
  const a = loaded.aux_cases;
  if (a && typeof a === 'object') {
    const ar = /** @type {Record<string, unknown>} */ (a);
    const aid = ar.id;
    if (aid != null && String(aid).trim() !== '') return String(aid);
  }
  const b = loaded.aux_case;
  if (b && typeof b === 'object') {
    const br = /** @type {Record<string, unknown>} */ (b);
    const bid = br.id;
    if (bid != null && String(bid).trim() !== '') return String(bid);
  }
  return null;
}

/**
 * Flat case payload from GET `/cases/:id` (what lives in `cases.case_data`) → inner `case` object for `submission.case_data.case`.
 *
 * @param {Record<string, unknown>} flat
 * @param {{ currentCaseId: string, grupoId: unknown, payload: { client_id?: string | null, user_id?: string | null, parent_id?: string | null }, descripcionCasoId: string }} ctx
 * @returns {Record<string, unknown>}
 */
export function flatCaseToSubmissionCase(flat, ctx) {
  const { currentCaseId, grupoId, payload, descripcionCasoId } = ctx;
  const snapshots = {};
  if ('transicion_id' in flat) {
    snapshots.current_transicion_id = flat.transicion_id ?? null;
  }
  if ('responsable_id' in flat) {
    snapshots.current_responsable_id = flat.responsable_id ?? null;
  }
  if ('cliente_id' in flat) {
    snapshots.current_cliente_id = flat.cliente_id ?? null;
  }
  if ('clasificacion_id' in flat) {
    snapshots.current_clasificacion_id = flat.clasificacion_id ?? null;
  }
  if ('grupo_id' in flat) {
    snapshots.current_grupo_id = flat.grupo_id ?? null;
  }
  return {
    id: flat.id ?? currentCaseId,
    cliente_id: flat.cliente_id ?? payload.client_id ?? null,
    transicion_id: flat.transicion_id ?? null,
    ...snapshots,
    clasificacion_id: flat.clasificacion_id ?? null,
    responsable_id: flat.responsable_id ?? payload.user_id ?? null,
    descripcion_caso_id: descripcionCasoId,
    grupo_id: flat.grupo_id ?? grupoId,
    parent_id: flat.parent_id ?? payload.parent_id ?? null,
  };
}

/**
 * Builds `case_data` for Form.io: new case (UUIDs) vs edit (preserve ids from API + aux fetch).
 *
 * @param {Object} params
 * @param {boolean} params.isEdit
 * @param {string} params.currentCaseId
 * @param {unknown} params.grupoId
 * @param {{ client_id?: string | null, user_id?: string | null, parent_id?: string | null }} params.payload
 * @param {Record<string, unknown> | null | undefined} params.loadedCase - `storeService.get('cases.case_data')` after `fetchCaseData`
 * @param {string | number | null | undefined} params.auxCaseIdFromFetch
 * @param {Record<string, unknown> | null | undefined} params.auxCaseDataFromFetch
 * @returns {{ case: Record<string, unknown>, aux_cases: { id?: string, caso_id: string, data: Record<string, unknown> } }}
 */
export function buildInitialCaseData({
  isEdit,
  currentCaseId,
  grupoId,
  payload,
  loadedCase,
  auxCaseIdFromFetch,
  auxCaseDataFromFetch,
}) {
  if (!isEdit) {
    return {
      case: {
        id: currentCaseId,
        cliente_id: payload.client_id ?? null,
        transicion_id: null,
        clasificacion_id: null,
        responsable_id: payload.user_id ?? null,
        descripcion_caso_id: uuidv4(),
        grupo_id: grupoId,
        parent_id: payload.parent_id ?? null,
      },
      aux_cases: {
        id: uuidv4(),
        caso_id: currentCaseId,
        data: {},
      },
    };
  }

  const loaded = loadedCase && typeof loadedCase === 'object' ? loadedCase : {};
  const hasNestedCase = Boolean(loaded.case && typeof loaded.case === 'object');
  /** Merge root + nested `case` so ids present only at root are kept */
  const innerCaseObj = hasNestedCase ? loaded.case : null;
  const flat = /** @type {Record<string, unknown>} */ (
    hasNestedCase && innerCaseObj && typeof innerCaseObj === 'object'
      ? { ...loaded, ...innerCaseObj }
      : loaded
  );

  const descripcionCasoId =
    resolveDescripcionCasoId(loaded) ?? resolveDescripcionCasoId(flat);
  const auxId =
    resolveAuxCaseId(loaded, auxCaseIdFromFetch) ??
    resolveAuxCaseId(flat, null);

  const ac = loaded.aux_cases;
  const acRec =
    ac && typeof ac === 'object'
      ? /** @type {Record<string, unknown>} */ (ac)
      : null;
  const ax = loaded.aux_case;
  const axRec =
    ax && typeof ax === 'object'
      ? /** @type {Record<string, unknown>} */ (ax)
      : null;
  const auxDataFromLoaded =
    (acRec && acRec.data && typeof acRec.data === 'object'
      ? acRec.data
      : null) ||
    (axRec && axRec.data && typeof axRec.data === 'object'
      ? axRec.data
      : null) ||
    {};

  const data =
    (auxCaseDataFromFetch &&
    typeof auxCaseDataFromFetch === 'object' &&
    Object.keys(auxCaseDataFromFetch).length
      ? auxCaseDataFromFetch
      : auxDataFromLoaded) || {};

  const innerCase = flatCaseToSubmissionCase(flat, {
    currentCaseId,
    grupoId,
    payload,
    descripcionCasoId: descripcionCasoId ?? uuidv4(),
  });

  /** @type {{ id?: string, caso_id: string, data: Record<string, unknown> }} */
  const aux_cases = {
    caso_id: currentCaseId,
    data: /** @type {Record<string, unknown>} */ (
      typeof data === 'object' && data !== null ? { ...data } : {}
    ),
  };
  if (auxId != null && String(auxId).trim() !== '') {
    aux_cases.id = String(auxId);
  }

  return /** @type {{ case: Record<string, unknown>, aux_cases: { id?: string, caso_id: string, data: Record<string, unknown> } }} */ ({
    case: innerCase,
    aux_cases,
  });
}
