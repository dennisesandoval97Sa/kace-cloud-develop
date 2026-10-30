import { DomainEvent } from '../../../shared/domain/events/DomainEvent.js';

/**
 * Domain event emitted when a new case is created in the system.
 *
 * @example
 * const event = new CaseCreated({
 *     caseId: 'uuid-of-case',
 *     clientId: 'uuid-of-client',
 *     responsibleId: 'uuid-of-responsible',
 *     classificationId: 'uuid-of-classification',
 *     groupId: 'uuid-of-group',
 *     transitionId: 'uuid-of-transition',
 *     metadata: { tenant_id: 'acme', user_id: 'uuid-of-creator' },
 * });
 */
export class CaseCreated extends DomainEvent {
    static EVENT_NAME = 'kace.core.case.created';

    /**
     * @param {Object} params
     * @param {string} params.caseId - ID of the created case
     * @param {string} params.clientId - ID of the client
     * @param {string} params.responsibleId - ID of the responsible user
     * @param {string} params.classificationId - ID of the classification
     * @param {string} params.groupId - ID of the group
     * @param {string} params.transitionId - ID of the initial transition/state
     * @param {Object} [params.metadata={}] - Event metadata (tenant_id, user_id, etc.)
     */
    constructor({ caseId, clientId, responsibleId, classificationId, groupId, transitionId, metadata = {} }) {
        super({
            eventName: CaseCreated.EVENT_NAME,
            aggregateId: caseId,
            payload: {
                clientId,
                responsibleId,
                classificationId,
                groupId,
                transitionId,
            },
            metadata,
        });
    }
}
