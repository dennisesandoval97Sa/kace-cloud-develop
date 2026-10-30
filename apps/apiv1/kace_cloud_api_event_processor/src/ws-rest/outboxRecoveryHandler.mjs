import { withTenantContext } from '@kace/api-common';
import { ChannelHubWorkspacePriorityReorderOutboxPublisher } from '@kace/core/src/channel-hub-workspace-priorities/application/publish/ChannelHubWorkspacePriorityReorderOutboxPublisher.js';
import { KnexChannelHubWorkspacePriorityReorderRepository } from '@kace/core/src/channel-hub-workspace-priorities/infrastructure/persistence/KnexChannelHubWorkspacePriorityReorderRepository.js';
import { buildRoutingEventBusFromTenant } from '@kace/core/src/shared/infrastructure/events/buildRoutingEventBusFromTenant.js';

export const createWorkspacePriorityOutboxRecoveryHandler = ({
    Repository = KnexChannelHubWorkspacePriorityReorderRepository,
    Publisher = ChannelHubWorkspacePriorityReorderOutboxPublisher,
    buildEventBus = buildRoutingEventBusFromTenant,
} = {}) => {
    return async (event) => {
        const { tenant, knexConfig: writerConfig } = event.tenantContext;
        const operationRepository = new Repository(writerConfig);
        try {
            const eventBus = buildEventBus(tenant);
            const publisher = new Publisher({ operationRepository, eventBus });
            return await publisher.publishDue({ limit: 25 });
        } finally {
            await operationRepository.destroyConnection();
        }
    };
};

export const handler = withTenantContext(createWorkspacePriorityOutboxRecoveryHandler());
