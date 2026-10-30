import {
  CASE_TRANSITION_STALE,
  CASE_RESPONSIBLE_STALE,
  CASE_CLIENT_STALE,
  CASE_CLASSIFICATION_STALE,
  CASE_GROUP_STALE,
} from '@kace/error-codes';
import { refreshEditSnapshotAfterSave } from './editSnapshot.js';

export const STALE_CODE_TO_FIELD = {
  [CASE_TRANSITION_STALE]: 'transicion_id',
  [CASE_RESPONSIBLE_STALE]: 'responsable_id',
  [CASE_CLIENT_STALE]: 'cliente_id',
  [CASE_CLASSIFICATION_STALE]: 'clasificacion_id',
  [CASE_GROUP_STALE]: 'grupo_id',
};

export function extractStaleCodes(response) {
  const warnings = response?.data?.data?.warnings;
  if (!Array.isArray(warnings)) return [];
  const known = new Set(Object.keys(STALE_CODE_TO_FIELD));
  return warnings.map((item) => item?.code).filter((code) => known.has(code));
}

/**
 * Rebase the edit snapshot after POST /cases/auxiliary, keeping rejected CAS
 * fields at their load-time values so a retry does not overwrite a concurrent write.
 *
 * @param {object} store
 * @param {{ case?: object, aux_cases?: object, description?: string }} live
 * @param {object} response
 */
export function applySaveOutcomeToSnapshot(store, live, response) {
  refreshEditSnapshotAfterSave(store, {
    live,
    rejectedCaseFields: extractStaleCodes(response)
      .map((code) => STALE_CODE_TO_FIELD[code])
      .filter(Boolean),
  });
}
