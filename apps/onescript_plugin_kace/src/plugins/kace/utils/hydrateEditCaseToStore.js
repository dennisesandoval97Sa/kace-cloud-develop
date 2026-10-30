/**
 * Normaliza `transitions_available` del `GET /cases/:id`: puede ser array plano (legacy)
 * o `{ transitions: [...], states: [...] }` con nombres de estado ya resueltos.
 *
 * @param {unknown} raw
 * @returns {{ transitionRows: Record<string, unknown>[], embeddedStates: Record<string, unknown>[] }}
 */
function normalizeTransitionsAvailable(raw) {
  if (!raw) {
    return { transitionRows: [], embeddedStates: [] };
  }
  if (Array.isArray(raw)) {
    return { transitionRows: raw, embeddedStates: [] };
  }
  if (typeof raw !== 'object') {
    return { transitionRows: [], embeddedStates: [] };
  }
  const ta = /** @type {Record<string, unknown>} */ (raw);
  const trs = ta.transitions;
  const sts = ta.states;
  return {
    transitionRows: Array.isArray(trs) ? trs : [],
    embeddedStates: Array.isArray(sts) ? sts : [],
  };
}

/**
 * Arma la lista de transiciones como `POST /transitions/search` + fila actual del caso,
 * a partir de `transicion` + `transitions_available` del `GET /cases/:id`.
 *
 * @param {Record<string, unknown> | null | undefined} caseRow
 * @returns {{ flowId: string, transitionsData: Record<string, unknown>[] } | null}
 */
export function buildEmbeddedTransitionsListFromCase(caseRow) {
  if (!caseRow || typeof caseRow !== 'object') {
    return null;
  }

  const clasificacion = caseRow.clasificacion;
  const clasFlujo =
    clasificacion && typeof clasificacion === 'object'
      ? /** @type {Record<string, unknown>} */ (clasificacion).flujo_id
      : null;

  const transicion = caseRow.transicion;
  const tr =
    transicion && typeof transicion === 'object'
      ? /** @type {Record<string, unknown>} */ (transicion)
      : null;

  const flujoIdRaw =
    (clasFlujo != null && String(clasFlujo).trim() !== '' ? clasFlujo : null) ??
    (tr?.flujo_id != null && String(tr.flujo_id).trim() !== ''
      ? tr.flujo_id
      : null) ??
    (caseRow.flujo_id != null && String(caseRow.flujo_id).trim() !== ''
      ? caseRow.flujo_id
      : null);

  if (flujoIdRaw == null || String(flujoIdRaw).trim() === '') {
    return null;
  }

  const transicionIdRaw = caseRow.transicion_id ?? tr?.id;
  const transicionId =
    transicionIdRaw != null && String(transicionIdRaw).trim() !== ''
      ? String(transicionIdRaw)
      : null;

  if (!tr || !transicionId) {
    return null;
  }

  const estadoActualId = tr.estado_actual_id;
  const siguienteEstadoId = tr.siguiente_estado_id;
  if (siguienteEstadoId == null) {
    return null;
  }

  const { transitionRows } = normalizeTransitionsAvailable(
    caseRow.transitions_available
  );
  if (!transitionRows.length) {
    return null;
  }

  const currentTransitionEntry = {
    id: transicionId,
    estado_actual_id: estadoActualId,
    siguiente_estado_id: siguienteEstadoId,
    flujo_id: tr.flujo_id ?? flujoIdRaw,
    status: tr.status ?? 1,
  };

  return {
    flowId: String(flujoIdRaw),
    transitionsData: [currentTransitionEntry, ...transitionRows],
  };
}

/**
 * Pre-seeds store paths used by `useStates` from an enriched `GET /cases/:id` row
 * (aux_case, transitions_available, transicion, clasificacion).
 * Evita `POST /transitions/search` y las llamadas `GET /states/:id` cuando el caso trae
 * `transitions_available.states` con `id` + `nombre`.
 *
 * Los nombres se escriben en `states.names_cache` incluso si no se puede armar
 * `transitions_data` (p. ej. falta `transicion_id` pero sí hay `transicion` + estados embebidos).
 *
 * @param {{ set: (path: string, value: unknown) => void, get?: (path: string) => unknown }} storeService
 * @param {Record<string, unknown> | null | undefined} caseRow - `response.data.data` from cases API
 * @returns {void}
 */
export function hydrateEditCaseToStore(storeService, caseRow) {
  try {
    if (!storeService || typeof storeService.set !== 'function') {
      return;
    }
    if (!caseRow || typeof caseRow !== 'object') {
      return;
    }

    const transicion = caseRow.transicion;
    const tr =
      transicion && typeof transicion === 'object'
        ? /** @type {Record<string, unknown>} */ (transicion)
        : null;

    /** @type {Record<string, string>} */
    const namesCache = {};
    const existing = storeService.get?.('states.names_cache');
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      Object.assign(
        namesCache,
        /** @type {Record<string, string>} */ (existing)
      );
    }

    if (tr) {
      const estadoActualId = tr.estado_actual_id;
      const siguienteEstadoId = tr.siguiente_estado_id;

      const ea = tr.estado_actual;
      if (ea && typeof ea === 'object' && estadoActualId != null) {
        const n = /** @type {Record<string, unknown>} */ (ea).nombre;
        if (n != null) {
          namesCache[String(estadoActualId)] = String(n);
        }
      }
      const se = tr.siguiente_estado;
      if (se && typeof se === 'object' && siguienteEstadoId != null) {
        const ser = /** @type {Record<string, unknown>} */ (se);
        const n = ser.nombre;
        if (n != null) {
          const sid =
            ser.id != null ? String(ser.id) : String(siguienteEstadoId);
          namesCache[sid] = String(n);
        }
      }
    }

    const { transitionRows, embeddedStates } = normalizeTransitionsAvailable(
      caseRow.transitions_available
    );
    for (const s of embeddedStates) {
      if (!s || typeof s !== 'object') continue;
      const st = /** @type {Record<string, unknown>} */ (s);
      const sid = st.id;
      const nom = st.nombre;
      if (sid != null && nom != null) {
        namesCache[String(sid)] = String(nom);
      }
    }

    storeService.set('states.names_cache', namesCache);

    const embeddedTransitions = buildEmbeddedTransitionsListFromCase(caseRow);
    if (!embeddedTransitions) {
      return;
    }

    storeService.set('states.current_flow_id', embeddedTransitions.flowId);
    storeService.set(
      'states.transitions_data',
      embeddedTransitions.transitionsData
    );
  } catch (e) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[hydrateEditCaseToStore]', e);
    }
  }
}
