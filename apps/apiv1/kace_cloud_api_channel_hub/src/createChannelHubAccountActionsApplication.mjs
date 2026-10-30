import { v4 as uuidv4 } from 'uuid';
import { ChannelHubAccountActionsApplication } from './ChannelHubAccountActionsApplication.mjs';
import { ChannelHubCreateSchema, ChannelHubUpdateSchema } from './schemas.mjs';

export const createChannelHubAccountActionsApplication = async ({
    repository,
    registrationFlowValidator,
    workflowExecutor,
    createdAt,
}) => {
    const [
        { ChannelHubAccountCreator },
        { ChannelHubAccountUpdater },
        { ChannelHubAccountDeleter },
        { ChannelHubAccountRegistrar },
        { ChannelHubAccountFinder },
        { ChannelHubAccountSearcher },
    ] = await Promise.all([
        import('@kace/core/src/channel-hub-accounts/application/create/ChannelHubAccountCreator.js'),
        import('@kace/core/src/channel-hub-accounts/application/update/ChannelHubAccountUpdater.js'),
        import('@kace/core/src/channel-hub-accounts/application/delete/ChannelHubAccountDeleter.js'),
        import('@kace/core/src/channel-hub-accounts/application/register/ChannelHubAccountRegistrar.js'),
        import('@kace/core/src/channel-hub-accounts/application/find/ChannelHubAccountFinder.js'),
        import('@kace/core/src/channel-hub-accounts/application/search/ChannelHubAccountSearcher.js'),
    ]);

    return new ChannelHubAccountActionsApplication({
        creator: new ChannelHubAccountCreator(repository, registrationFlowValidator),
        updater: new ChannelHubAccountUpdater(repository, registrationFlowValidator),
        deleter: new ChannelHubAccountDeleter(repository),
        registrar: new ChannelHubAccountRegistrar(repository, workflowExecutor, registrationFlowValidator),
        finder: new ChannelHubAccountFinder(repository),
        searcher: new ChannelHubAccountSearcher(repository),
        createSchema: ChannelHubCreateSchema,
        updateSchema: ChannelHubUpdateSchema,
        idGenerator: uuidv4,
        createdAt,
        ownedResources: [workflowExecutor],
    });
};
