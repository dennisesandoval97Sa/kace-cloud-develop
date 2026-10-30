import { DomainEvent } from '../../../shared/domain/events/DomainEvent.js';

/**
 * Domain event emitted when a ws rest flow execution is requested asynchronously.
 */
export class WSRestFlowExecutionRequested extends DomainEvent {
    static EVENT_NAME = 'kace.core.ws_rest_flow_execution.requested';

    /**
     * @param {Object} params
     * @param {string} params.executionId - ID of the execution record
     * @param {string|null} params.flowId - Flow ID to execute
     * @param {string|null} params.externalCode - External code to identify the flow
     * @param {Object|null} params.initialContext - Initial context for the workflow
     * @param {Object} [params.metadata={}] - Event metadata (tenant_id, user_id, etc.)
     */
    constructor({ executionId, flowId, externalCode, initialContext, metadata = {} }) {
        super({
            eventName: WSRestFlowExecutionRequested.EVENT_NAME,
            aggregateId: executionId,
            payload: {
                flowId: flowId || null,
                externalCode: externalCode || null,
                initialContext: initialContext || null,
            },
            metadata,
        });
    }
}
