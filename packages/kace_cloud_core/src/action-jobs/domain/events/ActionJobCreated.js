import { DomainEvent } from '../../../shared/domain/events/DomainEvent.js';

/**
 * Domain event emitted when a new action job is created in the system.
 *
 * @example
 * const event = new ActionJobCreated({
 *     actionJobId: 'uuid-of-action-job',
 *     type: 'filter',
 *     actionId: 'uuid-of-action',
 *     restflowId: null,
 *     totalRecords: 150,
 *     metadata: { tenant_id: 'acme', user_id: 'uuid-of-creator' },
 * });
 */
export class ActionJobCreated extends DomainEvent {
    static EVENT_NAME = 'kace.core.action_job.created';

    /**
     * @param {Object} params
     * @param {string} params.actionJobId - ID of the created action job
     * @param {string} params.type - Type of the job (e.g., 'filter', 'filter_clients', 'file', 'file_clients')
     * @param {string|null} params.actionId - ID of the related action (mutually exclusive with restflowId)
     * @param {string|null} params.restflowId - ID of the related restflow (mutually exclusive with actionId)
     * @param {number} params.totalRecords - Total records to process
     * @param {Object} [params.metadata={}] - Event metadata (tenant_id, user_id, etc.)
     */
    constructor({ actionJobId, type, actionId, restflowId, totalRecords, metadata = {} }) {
        super({
            eventName: ActionJobCreated.EVENT_NAME,
            aggregateId: actionJobId,
            payload: {
                type,
                actionId,
                restflowId,
                totalRecords,
            },
            metadata,
        });
    }
}
