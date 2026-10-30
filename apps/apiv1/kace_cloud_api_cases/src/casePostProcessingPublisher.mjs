import { CasePostProcessingRequested } from '@kace/core/src/cases';
import { Helper } from '@kace/core/src/shared/index.js';

/**
 * Builds the CasePostProcessingRequested domain event for a freshly-created case.
 *
 * Mirrors the CaseCreated publish contract in CaseCreator.#publishDomainEvents:
 * the case id is the aggregateId (the consumer loads the case by it), and
 * tenant/user are carried in metadata exactly as CaseCreated does.
 *
 * @param {{ id: string, parent_id?: string|null }} caseValue - the persisted case
 * @param {string} tenantId - tenant id (this.tenant.id.value in the controller)
 * @param {string} userId - id of the creating user (this.user.id.value)
 * @returns {CasePostProcessingRequested}
 */
export function buildCasePostProcessingRequestedEvent(caseValue, tenantId, userId) {
    return new CasePostProcessingRequested({
        caseId: caseValue.id,
        parentId: caseValue.parent_id ?? null,
        metadata: {
            tenant_id: tenantId,
            user_id: userId,
        },
    });
}

/**
 * Best-effort publish of the CasePostProcessingRequested event for a created case.
 *
 * Called AFTER the case has been committed, so the row exists for the async
 * consumer to load by aggregateId. A publish failure MUST NOT propagate: the case
 * is already persisted and the request must still return 201. Failures are logged
 * via Helper.logError, matching CaseCreator's own best-effort publish.
 *
 * @param {{ publishAll: (events: object[]) => Promise<void> }|null} eventPublisher
 * @param {{ id: string, parent_id?: string|null }} caseValue - the persisted case
 * @param {string} tenantId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function publishCasePostProcessingRequested(eventPublisher, caseValue, tenantId, userId) {
    if (!eventPublisher) {
        return;
    }
    try {
        const event = buildCasePostProcessingRequestedEvent(caseValue, tenantId, userId);
        await eventPublisher.publishAll([event]);
    } catch (error) {
        Helper.logError(
            'actionCreateWithAux: failed to publish CasePostProcessingRequested (case already persisted)',
            error
        );
    }
}
