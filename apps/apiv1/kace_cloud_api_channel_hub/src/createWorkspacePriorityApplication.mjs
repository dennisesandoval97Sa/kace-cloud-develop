import { WorkspacePriorityApplication } from './WorkspacePriorityApplication.mjs';

const boundedPoolConfig = (config) => (config ? { ...config, pool: { ...config.pool, min: 0, max: 1 } } : null);

export const createWorkspacePriorityApplication = async ({
    writerConfig,
    readerConfig,
    workflowExecutor,
    eventBus,
}) => {
    const ownedResources = [workflowExecutor];
    try {
        const [
            { ChannelHubRegistrationFlowValidator },
            { KnexChannelHubAccountRepository },
            { ChannelHubWorkspacePriorityManager },
            { ChannelHubWorkspacePriorityReorderRequester },
            { ChannelHubMailRulesRestFlowAdapter },
            { KnexChannelHubWorkspacePriorityReorderRepository },
            { KnexWorkspacesRepository },
            { KnexWSRestFlowRepository },
            { ChannelHubWorkspacePriorityReorderConflict },
        ] = await Promise.all([
            import('@kace/core/src/channel-hub-accounts/domain/ChannelHubRegistrationFlowValidator.js'),
            import('@kace/core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js'),
            import('@kace/core/src/channel-hub-workspace-priorities/application/ChannelHubWorkspacePriorityManager.js'),
            import('@kace/core/src/channel-hub-workspace-priorities/application/request/ChannelHubWorkspacePriorityReorderRequester.js'),
            import('@kace/core/src/channel-hub-workspace-priorities/infrastructure/ChannelHubMailRulesRestFlowAdapter.js'),
            import('@kace/core/src/channel-hub-workspace-priorities/infrastructure/persistence/KnexChannelHubWorkspacePriorityReorderRepository.js'),
            import('@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js'),
            import('@kace/core/src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js'),
            import('@kace/core/src/channel-hub-workspace-priorities/domain/channelHubWorkspacePriorityReorderConflict.js'),
        ]);

        const boundedWriterConfig = boundedPoolConfig(writerConfig);
        const boundedReaderConfig = boundedPoolConfig(readerConfig);
        const operationRepository = new KnexChannelHubWorkspacePriorityReorderRepository(
            boundedWriterConfig,
            boundedReaderConfig
        );
        ownedResources.push(operationRepository);
        const accountRepository = new KnexChannelHubAccountRepository(boundedWriterConfig, boundedReaderConfig);
        ownedResources.push(accountRepository);
        const workspaceRepository = new KnexWorkspacesRepository(boundedWriterConfig, boundedReaderConfig);
        ownedResources.push(workspaceRepository);
        const restFlowRepository = new KnexWSRestFlowRepository(boundedWriterConfig, boundedReaderConfig);
        ownedResources.push(restFlowRepository);
        const priorityManager = new ChannelHubWorkspacePriorityManager({
            accountRepository,
            workspaceRepository,
            mailRules: new ChannelHubMailRulesRestFlowAdapter(workflowExecutor),
            restFlowValidator: new ChannelHubRegistrationFlowValidator(restFlowRepository),
        });
        const reorderRequester = new ChannelHubWorkspacePriorityReorderRequester({
            priorityManager,
            operationRepository,
            eventBus,
        });

        return new WorkspacePriorityApplication({
            priorityManager,
            reorderRequester,
            operationRepository,
            reorderConflictType: ChannelHubWorkspacePriorityReorderConflict,
            ownedResources,
        });
    } catch (error) {
        await Promise.allSettled(
            ownedResources.map((resource) => resource.destroy?.() ?? resource.destroyConnection?.())
        );
        throw error;
    }
};
