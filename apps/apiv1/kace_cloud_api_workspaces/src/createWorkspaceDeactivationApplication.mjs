export const createWorkspaceDeactivationApplication = async ({
    workspaceRepository,
    workflowExecutor,
    workflowExecutorFactory,
    metadata,
    kaceApiBaseUrl,
    logger,
}) => {
    const { WorkspaceDeactivationApplication } =
        await import('@kace/core/src/workspaces/application/update/WorkspaceDeactivationApplication.js');
    const { WorkspaceDeactivator } =
        await import('@kace/core/src/workspaces/application/update/WorkspaceDeactivator.js');
    const { WorkspaceChannelHubTagDeactivator } = await import('./WorkspaceChannelHubTagDeactivator.mjs');
    const { channelHubRuleTargets, workspaceToJson } = await import('./WorkspaceTagUpdateFlowQueuer.mjs');

    return new WorkspaceDeactivationApplication({
        workspaceRepository,
        serializeWorkspace: workspaceToJson,
        targetResolver: channelHubRuleTargets,
        remoteDeactivator: new WorkspaceChannelHubTagDeactivator({
            workflowExecutor,
            workflowExecutorFactory,
            metadata,
            kaceApiBaseUrl,
            logger,
        }),
        localDeactivator: new WorkspaceDeactivator(workspaceRepository),
    });
};
