import { DomainEvent } from '../../../shared/domain/events/DomainEvent.js';

/**
 * Domain event emitted when a report execution is requested asynchronously.
 */
export class ReportExecutionRequested extends DomainEvent {
    static EVENT_NAME = 'kace.core.report_execution.requested';

    /**
     * @param {Object} params
     * @param {string} params.executionId - ID of the execution record
     * @param {string} params.reportName - Report/View name
     * @param {Object} params.parameters - Report parameters (period, conditions)
     * @param {Object} [params.metadata={}] - Event metadata (tenant_id, user_id, etc.)
     */
    constructor({ executionId, reportName, parameters, metadata = {} }) {
        super({
            eventName: ReportExecutionRequested.EVENT_NAME,
            aggregateId: executionId,
            payload: {
                reportName: reportName || null,
                parameters: parameters || {},
            },
            metadata,
        });
    }
}
