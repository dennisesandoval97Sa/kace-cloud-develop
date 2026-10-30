import { DomainEvent } from '../../../shared/domain/events/DomainEvent';

export default class CaseUpdated extends DomainEvent {
    static EVENT_NAME = 'kace.core.case.updated';

    /**
     * Constructs an instance of the CaseUpdated class, initializing its properties and invoking the parent class constructor.
     *
     * @param {Object} params - The parameters for the constructor.
     * @param {string} params.caseId - The unique identifier for the case.
     * @param {Object} [params.changedAttributes={}] - An object containing the attributes that have been updated.
     * @param {string} [params.trigger]
     * @param {Object} [params.metadata={}] - Additional metadata related to the event.
     * @param {string} [params.metadata.tenant_id] - The tenant identifier associated with the event.
     * @param {string} [params.metadata.user_id] - The user identifier associated with the event.
     * @param {string | null} [params.metadata.correlation_id] - The correlation identifier for tracing related events.
     * @param {string | null} [params.metadata.causation_id] - The causation identifier for the triggering event.
     * @return {CaseUpdated} An instance of the CaseUpdated class.
     */
    constructor({ caseId, changedAttributes = {}, trigger, metadata = {} }) {
        super({
            eventName: CaseUpdated.EVENT_NAME,
            aggregateId: caseId,
            payload: {
                trigger,
                changedAttributes,
            },
            metadata,
        });
    }
}
