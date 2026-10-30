import { DomainEvent } from '../../../shared/domain/events/DomainEvent.js';

/**
 * Domain event emitted when a case requires its async post-processing
 * (fake-case creation + parent-relation) to be handled by a separate consumer.
 *
 * @example
 * const event = new CasePostProcessingRequested({
 *     caseId: 'uuid-of-case',
 *     parentId: 'uuid-of-parent-case',
 *     metadata: { tenant_id: 'acme', user_id: 'uuid-of-creator' },
 * });
 */
export class CasePostProcessingRequested extends DomainEvent {
    static EVENT_NAME = 'kace.core.case.post_processing.requested';

    /**
     * @param {Object} params
     * @param {string} params.caseId - ID of the case requiring post-processing
     * @param {string|null} [params.parentId=null] - ID of the parent case for relation, if any
     * @param {Object} [params.metadata={}] - Event metadata (tenant_id, user_id, etc.)
     */
    constructor({ caseId, parentId = null, metadata = {} }) {
        super({
            eventName: CasePostProcessingRequested.EVENT_NAME,
            aggregateId: caseId,
            payload: {
                parentId,
            },
            metadata,
        });
    }
}
