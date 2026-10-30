export class WorkspaceDeactivationApplication {
    #workspaceRepository;
    #serializeWorkspace;
    #targetResolver;
    #remoteDeactivator;
    #localDeactivator;

    constructor({ workspaceRepository, serializeWorkspace, targetResolver, remoteDeactivator, localDeactivator }) {
        this.#workspaceRepository = workspaceRepository;
        this.#serializeWorkspace = serializeWorkspace;
        this.#targetResolver = targetResolver;
        this.#remoteDeactivator = remoteDeactivator;
        this.#localDeactivator = localDeactivator;
    }

    async execute(workspaceId, update, workspaceSnapshot = undefined) {
        let previousWorkspace = workspaceSnapshot;
        if (previousWorkspace === undefined) {
            previousWorkspace = this.#serializeWorkspace(await this.#workspaceRepository.find({ value: workspaceId }));
        }
        if (update.is_active !== false) return false;

        if (previousWorkspace?.is_active === true) {
            const targets = this.#targetResolver(previousWorkspace);
            await this.#remoteDeactivator.execute(previousWorkspace, { targets });
        }
        await this.#localDeactivator.execute(update, workspaceId);
        return true;
    }
}
