import { ValueObjectUuid } from '../../../shared/domain/value-object/ValueObjectUuid.js';
import { ChannelHubWorkspacePriorityReorderConflict } from '../../domain/channelHubWorkspacePriorityReorderConflict.js';
import { ChannelHubWorkspacePriorityReorderRequested } from '../../domain/events/ChannelHubWorkspacePriorityReorderRequested.js';
import { ChannelHubWorkspacePriorityReorderOutboxPublisher } from '../publish/ChannelHubWorkspacePriorityReorderOutboxPublisher.js';

export class ChannelHubWorkspacePriorityReorderRequester {
    #priorityManager;
    #operationRepository;
    #outboxPublisher;

    constructor({ priorityManager, operationRepository, eventBus, outboxPublisher = null }) {
        this.#priorityManager = priorityManager;
        this.#operationRepository = operationRepository;
        this.#outboxPublisher =
            outboxPublisher ?? new ChannelHubWorkspacePriorityReorderOutboxPublisher({ operationRepository, eventBus });
    }

    async execute(accountId, { revision, orderedWorkspaceIds, requestedBy = null, metadata = {} }) {
        const activeOperation = await this.#operationRepository.findActiveByAccountId(accountId);
        if (activeOperation) throw new ChannelHubWorkspacePriorityReorderConflict(activeOperation);

        const operationId = ValueObjectUuid.random();
        const event = new ChannelHubWorkspacePriorityReorderRequested({ accountId, operationId, metadata });
        await this.#operationRepository.create({
            operationId,
            accountId,
            revision,
            orderedWorkspaceIds,
            requestedBy: requestedBy ?? metadata.user_id ?? null,
            event,
        });

        try {
            await this.#priorityManager.validateReorderRequest(accountId, { revision, orderedWorkspaceIds });
        } catch (error) {
            await this.#operationRepository.markFailed(operationId, error);
            throw error;
        }

        await this.#outboxPublisher.publishOperation(operationId);

        return { operationId, status: 'pending' };
    }
}
