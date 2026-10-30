import { DomainEvent } from '../../../shared/domain/events/DomainEvent.js';

export class ChannelHubWorkspacePriorityReorderRequested extends DomainEvent {
    static EVENT_NAME = 'kace.core.channel_hub_workspace_priority_reorder.requested';

    constructor({ accountId, operationId, metadata = {}, eventId, occurredOn }) {
        super({
            eventName: ChannelHubWorkspacePriorityReorderRequested.EVENT_NAME,
            aggregateId: accountId,
            payload: { operationId },
            metadata,
            eventId,
            occurredOn,
        });
    }

    static fromJson(event) {
        return new ChannelHubWorkspacePriorityReorderRequested({
            accountId: event.aggregateId,
            operationId: event.payload.operationId,
            metadata: event.metadata,
            eventId: event.eventId,
            occurredOn: event.occurredOn,
        });
    }
}
