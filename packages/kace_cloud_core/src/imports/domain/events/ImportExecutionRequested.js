import { DomainEvent } from '../../../shared/domain/events/DomainEvent.js';

/**
 * Domain event emitted when an import file execution is requested asynchronously.
 */
export class ImportExecutionRequested extends DomainEvent {
    static EVENT_NAME = 'kace.core.import_execution.requested';

    /**
     * @param {Object} params
     * @param {string} params.fileId - ID of the S3ImportFile record
     * @param {string} [params.targetTable] - Target table ('usuarios' or 'aux_*')
     * @param {string} [params.actionType='CREATE'] - Action type ('CREATE', 'DELETE')
     * @param {Object} [params.metadata={}] - Event metadata (tenant_id, user_id, etc.)
     * @param {string} [params.eventId] - Optional event ID
     * @param {string} [params.occurredOn] - Optional timestamp
     */
    constructor({ fileId, targetTable, actionType = 'CREATE', metadata = {}, eventId, occurredOn }) {
        super({
            eventName: ImportExecutionRequested.EVENT_NAME,
            aggregateId: fileId,
            payload: {
                fileId,
                targetTable: targetTable || null,
                actionType: actionType || 'CREATE',
            },
            metadata,
            eventId,
            occurredOn,
        });
    }

    get fileId() {
        return this.aggregateId;
    }

    get targetTable() {
        return this.payload.targetTable;
    }

    get actionType() {
        return this.payload.actionType;
    }

    get messageGroupId() {
        return this.metadata?.tenant_id ?? this.aggregateId;
    }

    get messageDeduplicationId() {
        return this.fileId ?? this.eventId;
    }

    /**
     * Reconstructs an ImportExecutionRequested event from primitives.
     * @param {Object} primitives
     * @returns {ImportExecutionRequested}
     */
    static fromPrimitives({ eventId, occurredOn, aggregateId, payload = {}, metadata = {} }) {
        return new ImportExecutionRequested({
            fileId: aggregateId || payload.fileId,
            targetTable: payload.targetTable,
            actionType: payload.actionType,
            metadata,
            eventId,
            occurredOn,
        });
    }
}
