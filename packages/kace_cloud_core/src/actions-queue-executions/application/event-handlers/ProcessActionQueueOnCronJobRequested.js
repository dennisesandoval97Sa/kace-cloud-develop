import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { ActionQueueExecutor } from '../executor/ActionQueueExecutor.js';
import { globalSystemUserId } from '@kace/database/seeds/20241125105900_usuario_base.js';

export class ProcessActionQueueOnCronJobRequested {
    /** @type {ActionQueueExecutor|null} */
    #actionQueueExecutor;

    /**
     * @param {ActionQueueExecutor} [actionQueueExecutor]
     */
    constructor(actionQueueExecutor) {
        this.#actionQueueExecutor = actionQueueExecutor;
    }

    /**
     * @param {import('../../../shared/domain/events/DomainEvent.js').DomainEvent} domainEvent
     * @returns {Promise<void>}
     */
    async handle(domainEvent) {
        const { executionId, actionId, caseId, clientId, triggerType } = domainEvent.payload || {};
        const resolvedExecutionId = executionId || domainEvent.aggregateId;

        if (!resolvedExecutionId || !actionId || !caseId) {
            throw new Error('ProcessActionQueueOnCronJobRequested: executionId, actionId and caseId are required');
        }

        Helper.logDebug('ProcessActionQueueOnCronJobRequested: Processing request', {
            executionId: resolvedExecutionId,
            actionId,
            caseId,
            tenantId: domainEvent.metadata?.tenant_id,
        });

        const response = await this.#actionQueueExecutor.executeByEventPayload({
            executionId: resolvedExecutionId,
            actionId,
            caseId,
            clientId,
            triggerType,
            created_at: domainEvent.occurredOn || new Date().toISOString(),
            created_by: domainEvent.metadata?.user_id || globalSystemUserId,
        });

        Helper.logDebug('ProcessActionQueueOnCronJobRequested: Request completed', {
            executionId: resolvedExecutionId,
            ...response.toJson().data,
        });
    }
}
