import { storeService } from '#plugins/kace/services/storeService.js';
import { getHandshakeParams } from '#plugins/kace/utils/withHandshakeEvaluatorContext.js';

function getUrlSearchParams() {
  if (typeof window === 'undefined') {
    return { entity_id: null, primary_entity: null, case_id: null };
  }
  const params = new URL(window.location.href).searchParams;
  return {
    entity_id: params.get('entity_id'),
    primary_entity: params.get('primary_entity'),
    case_id: params.get('case_id'),
  };
}

function pickString(value) {
  if (value == null || value === '') return null;
  return String(value);
}

/**
 * @param {{ contextCaseId?: string | null }} [options]
 * @returns {{ entityId: string | null, primaryEntity: string | null }}
 */
export function resolveEventLogContext(options = {}) {
  const contextCaseId = options.contextCaseId ?? null;
  const handshake = getHandshakeParams() ?? {};
  const urlParams = getUrlSearchParams();
  const storeCaseId = storeService.get('cases.case_id');

  const entity_id = pickString(handshake.entity_id ?? urlParams.entity_id);
  const primary_entity = pickString(
    handshake.primary_entity ?? urlParams.primary_entity
  );
  const case_id = pickString(
    handshake.case_id ?? storeCaseId ?? urlParams.case_id
  );

  const contextId = pickString(contextCaseId);
  const entityId = contextId ?? entity_id ?? case_id;
  const primaryEntity = contextId || case_id ? 'cases' : primary_entity;

  return { entityId, primaryEntity };
}
