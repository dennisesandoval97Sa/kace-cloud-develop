const BASE_CASE_FIELDS = [
  'transicion_id',
  'responsable_id',
  'cliente_id',
  'clasificacion_id',
  'grupo_id',
];

/** Stale-check keys accepted by `caseStaleSnapshotFields`. */
const CURRENT_KEY_BY_FIELD = {
  transicion_id: 'current_transicion_id',
  responsable_id: 'current_responsable_id',
  cliente_id: 'current_cliente_id',
  clasificacion_id: 'current_clasificacion_id',
  grupo_id: 'current_grupo_id',
};

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    if (!isPlainObject(a) || !isPlainObject(b)) {
      return false;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Null-prototype bag so a `__proto__` form key cannot hit Object.prototype. */
function emptyObject() {
  return Object.create(null);
}

function diffObject(liveObj, snapObj) {
  const result = emptyObject();
  const live = liveObj ?? {};
  const snap = snapObj ?? {};

  for (const key of Object.keys(live)) {
    const liveVal = live[key];
    const snapVal = snap[key];

    if (deepEqual(liveVal, snapVal)) continue;

    if (isPlainObject(liveVal) && isPlainObject(snapVal)) {
      const nested = diffObject(liveVal, snapVal);
      if (Object.keys(nested).length > 0) {
        result[key] = nested;
      }
      continue;
    }

    result[key] = liveVal;
  }

  return result;
}

function diffCase(liveCase, snapCase) {
  const dirty = emptyObject();
  const live = liveCase ?? {};
  const snap = snapCase ?? {};

  for (const key of Object.keys(live)) {
    if (key === 'id' || key.startsWith('current_')) continue;

    const liveVal = live[key];
    const snapVal = snap[key];

    if (deepEqual(liveVal, snapVal)) continue;
    dirty[key] = liveVal;
  }

  for (const field of BASE_CASE_FIELDS) {
    const currentKey = CURRENT_KEY_BY_FIELD[field];
    if (currentKey && field in dirty && field in snap) {
      dirty[currentKey] = snap[field] ?? null;
    }
  }

  return dirty;
}

function toDescriptionPayload(live) {
  return {
    id: live?.case?.descripcion_caso_id,
    descripcion: live?.description,
  };
}

function toAuxCasesPayload(aux) {
  if (aux == null || typeof aux !== 'object') return {};
  const { caso_id: _casoId, ...rest } = aux;
  return rest;
}

/**
 * Diff the live case envelope against the load-time snapshot for POST /cases/auxiliary.
 *
 * When `snapshot` is missing the live envelope is returned uncut (legacy scripts),
 * but `description` is always `{ id, descripcion }` and `aux_cases.caso_id` is dropped
 * to match `auxiliaryUpdateSchema`.
 *
 * `current_*` keys are emitted only for fields listed in `caseStaleSnapshotFields`
 * (`@kace/api-common`). Absent live keys are not sent as deletes; clear with `null`.
 *
 * @param {{ case?: object, aux_cases?: { id?: string, data?: object, caso_id?: string }, description?: string }|null|undefined} live
 * @param {{ case?: object, aux_cases?: { id?: string, data?: object }, description?: string }|null|undefined} snapshot
 * @returns {{ case: object, aux_cases: object, description?: { id: string|undefined, descripcion: string|undefined } }}
 */
export function buildDirtyAuxiliaryPayload(live, snapshot) {
  if (snapshot == null) {
    const out = {
      case: live?.case ?? {},
      aux_cases: toAuxCasesPayload(live?.aux_cases),
    };
    if (live?.description !== undefined) {
      out.description = toDescriptionPayload(live);
    }
    return out;
  }

  const result = {
    case: diffCase(live?.case, snapshot?.case),
    aux_cases: {},
  };

  const auxDataDirty = diffObject(
    live?.aux_cases?.data,
    snapshot?.aux_cases?.data
  );

  if (Object.keys(auxDataDirty).length > 0) {
    const auxId = live?.aux_cases?.id ?? snapshot?.aux_cases?.id;
    if (auxId == null) {
      throw new Error(
        'No se pudo guardar la información auxiliar del caso. Recargue el formulario e intente de nuevo.'
      );
    }
    result.aux_cases = { id: auxId, data: auxDataDirty };
  }

  const hasDescriptionSnapshot = snapshot.description !== undefined;
  const descriptionChanged =
    !hasDescriptionSnapshot ||
    !deepEqual(live?.description, snapshot.description);

  if (live?.description !== undefined && descriptionChanged) {
    result.description = toDescriptionPayload(live);
  }

  return result;
}
