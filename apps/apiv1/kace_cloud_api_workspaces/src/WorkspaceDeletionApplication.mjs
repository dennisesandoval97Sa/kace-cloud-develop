export class WorkspaceDeletionApplication {
    #tagFlowQueuer;
    #workspaceDeleter;

    constructor({ tagFlowQueuer, workspaceDeleter }) {
        this.#tagFlowQueuer = tagFlowQueuer;
        this.#workspaceDeleter = workspaceDeleter;
    }

    async execute(workspaceId, deletion) {
        await this.#tagFlowQueuer.execute(workspaceId, 'delete');
        await this.#workspaceDeleter.execute(workspaceId, deletion);
    }
}
