/**
 * Freeze and one-shot description capture for edit dirty-diff snapshots.
 */

/**
 * Shallow copy of a case object without `id` or any `current_*` keys.
 * @param {Record<string, unknown>|null|undefined} caseObj
 * @returns {Record<string, unknown>}
 */
export function omitCurrentKeys(caseObj) {
  if (caseObj == null || typeof caseObj !== 'object') {
    return {};
  }
  const copy = { ...caseObj };
  delete copy.id;
  for (const key of Object.keys(copy)) {
    if (key.startsWith('current_')) {
      delete copy[key];
    }
  }
  return copy;
}

function auxCasesSnapshot(auxData, auxId) {
  const aux_cases = { data: auxData ?? {} };
  if (auxId != null) {
    aux_cases.id = auxId;
  }
  return aux_cases;
}

/**
 * Persist a deep clone of the load-time edit baseline into the store.
 * @param {{ get: Function, set: Function }} store
 * @param {{ case: unknown, auxData: unknown, auxId?: string, description?: string }} payload
 */
export function freezeEditSnapshot(
  store,
  { case: caseObj, auxData, auxId, description }
) {
  store.set(
    'cases.edit_snapshot',
    structuredClone({
      case: caseObj,
      aux_cases: auxCasesSnapshot(auxData, auxId),
      description,
    })
  );
}

/**
 * After a successful save, rebase the snapshot on the live form.
 * Fields the backend reported as stale keep the previous snapshot value.
 * @param {{ get: Function, set: Function }} store
 * @param {{ live?: { case?: object, aux_cases?: { id?: string, data?: object }, description?: string }, rejectedCaseFields?: string[] }} params
 */
export function refreshEditSnapshotAfterSave(
  store,
  { live, rejectedCaseFields = [] }
) {
  const prev = store.get('cases.edit_snapshot');
  if (prev == null && live == null) {
    return;
  }

  const prevCase = prev?.case ?? {};
  const nextCase = { ...prevCase, ...omitCurrentKeys(live?.case) };
  for (const field of rejectedCaseFields) {
    if (Object.prototype.hasOwnProperty.call(prevCase, field)) {
      nextCase[field] = prevCase[field];
    } else {
      delete nextCase[field];
    }
  }

  freezeEditSnapshot(store, {
    case: nextCase,
    auxData: live?.aux_cases?.data ?? prev?.aux_cases?.data ?? {},
    auxId: live?.aux_cases?.id ?? prev?.aux_cases?.id,
    description:
      live?.description !== undefined ? live.description : prev?.description,
  });
}

/**
 * Drop a leftover snapshot so it cannot leak into another case edit.
 * @param {{ set: Function }} store
 */
export function clearEditSnapshot(store) {
  store.set('cases.edit_snapshot', null);
}

/**
 * Capture description into the frozen snapshot exactly once.
 * No-op when there is no snapshot or description is already defined.
 * @param {{ get: Function, set: Function }} store
 * @param {string|null|undefined} html
 */
export function captureEditSnapshotDescription(store, html) {
  const snapshot = store.get('cases.edit_snapshot');
  if (!snapshot || snapshot.description !== undefined) {
    return;
  }
  store.set('cases.edit_snapshot', {
    ...snapshot,
    description: html ?? '',
  });
}
