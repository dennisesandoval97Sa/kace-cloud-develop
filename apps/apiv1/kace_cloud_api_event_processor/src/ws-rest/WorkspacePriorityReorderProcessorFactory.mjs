export const loadWorkspacePriorityReorderProcessorDependencies = async () => {
    const [
        { ChannelHubRegistrationFlowValidator },
        { KnexChannelHubAccountRepository },
        { ChannelHubWorkspacePriorityManager },
        { ChannelHubWorkspacePriorityReorderProcessor },
        { ChannelHubMailRulesRestFlowAdapter },
        { KnexChannelHubWorkspacePriorityReorderRepository },
        { KnexWorkspacesRepository },
        { KnexWSRestFlowRepository },
    ] = await Promise.all([
        import('@kace/core/src/channel-hub-accounts/domain/ChannelHubRegistrationFlowValidator.js'),
        import('@kace/core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js'),
        import('@kace/core/src/channel-hub-workspace-priorities/application/ChannelHubWorkspacePriorityManager.js'),
        import('@kace/core/src/channel-hub-workspace-priorities/application/process/ChannelHubWorkspacePriorityReorderProcessor.js'),
        import('@kace/core/src/channel-hub-workspace-priorities/infrastructure/ChannelHubMailRulesRestFlowAdapter.js'),
        import('@kace/core/src/channel-hub-workspace-priorities/infrastructure/persistence/KnexChannelHubWorkspacePriorityReorderRepository.js'),
        import('@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js'),
        import('@kace/core/src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js'),
    ]);
    return {
        ChannelHubRegistrationFlowValidator,
        KnexChannelHubAccountRepository,
        ChannelHubWorkspacePriorityManager,
        ChannelHubWorkspacePriorityReorderProcessor,
        ChannelHubMailRulesRestFlowAdapter,
        KnexChannelHubWorkspacePriorityReorderRepository,
        KnexWorkspacesRepository,
        KnexWSRestFlowRepository,
    };
};

const LAMBDA_CLEANUP_BUFFER_MS = 15_000;
const REMOTE_CALL_TIMEOUT_MS = 30_000;
const boundedPoolConfig = (config) => (config ? { ...config, pool: { ...config.pool, min: 0, max: 1 } } : null);

export const createWorkspacePriorityReorderHandler = ({ processorFactory, EventHandler, findCurrentUser }) =>
    async function workspacePriorityReorderHandler(
        { userRepository, writerConfig, readerConfig, getRemainingTimeInMillis },
        event
    ) {
        const currentUser = await findCurrentUser(userRepository, event);
        const processorUnit = await processorFactory.create({
            writerConfig,
            readerConfig,
            currentUser,
            getRemainingTimeInMillis,
        });
        try {
            await new EventHandler(processorUnit.processor).handle(event);
        } finally {
            await processorUnit.dispose();
        }
    };

export class WorkspacePriorityReorderProcessorFactory {
    #createWorkflowExecutor;
    #loadDependencies;

    constructor({ createWorkflowExecutor, loadDependencies = loadWorkspacePriorityReorderProcessorDependencies }) {
        this.#createWorkflowExecutor = createWorkflowExecutor;
        this.#loadDependencies = loadDependencies;
    }

    async create({
        writerConfig,
        readerConfig,
        currentUser,
        getRemainingTimeInMillis = () => Number.POSITIVE_INFINITY,
    }) {
        const {
            ChannelHubRegistrationFlowValidator,
            KnexChannelHubAccountRepository,
            ChannelHubWorkspacePriorityManager,
            ChannelHubWorkspacePriorityReorderProcessor,
            ChannelHubMailRulesRestFlowAdapter,
            KnexChannelHubWorkspacePriorityReorderRepository,
            KnexWorkspacesRepository,
            KnexWSRestFlowRepository,
        } = await this.#loadDependencies();
        const availableRemoteCallMs = () => getRemainingTimeInMillis() - LAMBDA_CLEANUP_BUFFER_MS;
        const boundedWriterConfig = boundedPoolConfig(writerConfig);
        const boundedReaderConfig = boundedPoolConfig(readerConfig);
        const hasTimeForRemoteCall = () => availableRemoteCallMs() >= REMOTE_CALL_TIMEOUT_MS;
        let workflowExecutorPromise = null;
        const workflowExecutorProxy = {
            execute: async (dto) => (await workflowExecutorPromise).execute(dto),
            destroy: async () => {
                if (!workflowExecutorPromise) return;
                try {
                    await (await workflowExecutorPromise).destroy?.();
                } catch {
                    // Construction failures already settle partial cleanup before rejecting.
                }
            },
        };
        const createDeadlineBoundWorkflowExecutor = () => {
            const availableMs = availableRemoteCallMs();
            if (availableMs < REMOTE_CALL_TIMEOUT_MS) {
                throw new Error('Workspace priority reorder reached the Lambda cleanup buffer');
            }
            workflowExecutorPromise ??= this.#createWorkflowExecutor({
                writerConfig: boundedWriterConfig,
                readerConfig: boundedReaderConfig,
                currentUser,
                requestTimeoutMs: REMOTE_CALL_TIMEOUT_MS,
                requestTimeoutResolver: () => Math.min(REMOTE_CALL_TIMEOUT_MS, availableRemoteCallMs()),
            });
            return workflowExecutorProxy;
        };
        const ownedResources = [];
        try {
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
                mailRules: new ChannelHubMailRulesRestFlowAdapter(createDeadlineBoundWorkflowExecutor),
                restFlowValidator: new ChannelHubRegistrationFlowValidator(restFlowRepository),
            });
            const processor = new ChannelHubWorkspacePriorityReorderProcessor({
                priorityManager,
                operationRepository,
                maxDurationMs: 300_000,
                hasTimeForRemoteCall,
            });
            return {
                processor,
                dispose: async () => {
                    const resources = workflowExecutorPromise
                        ? [...ownedResources, workflowExecutorProxy]
                        : ownedResources;
                    const results = await Promise.allSettled(
                        resources.map((resource) => resource.destroy?.() ?? resource.destroyConnection?.())
                    );
                    const failure = results.find(({ status }) => status === 'rejected');
                    if (failure) throw failure.reason;
                },
            };
        } catch (error) {
            await Promise.allSettled(
                ownedResources.map((resource) => resource.destroy?.() ?? resource.destroyConnection?.())
            );
            throw error;
        }
    }
}
