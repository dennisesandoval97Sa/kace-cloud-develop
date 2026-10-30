import { DomainEvent } from '../../../shared/domain/events/DomainEvent.js';

/**
 * Domain event emitted when a cron-job action execution is queued.
 */
export class AutomatedActionsRequested extends DomainEvent {
    static EVENT_NAME = 'kace.core.automated_actions.requested';

    /**
     * @param {Object} params
     * @param {string} params.executionId
     * @param {string} params.actionId
     * @param {string} params.caseId
     * @param {string} params.clientId
     * @param {string} params.triggerType
     * @param {Object} [params.metadata={}]
     */
    constructor({ executionId, actionId, caseId, clientId, triggerType, metadata = {} }) {
        super({
            eventName: AutomatedActionsRequested.EVENT_NAME,
            aggregateId: executionId,
            payload: {
                executionId,
                actionId,
                caseId,
                clientId,
                triggerType,
            },
            metadata,
        });
    }
}
