import { CustomError } from '../../../shared';
import { WorkspaceResponse } from '../WorkspaceResponse.js';
import { WorkspacesFinder } from '../../domain/WorkspacesFinder.js';

export class WorkspaceFinder {
    /** @type {WorkspacesFinder} is initialized in the constructor*/
    #finder;

    /**
     *
     * @param {KnexWorkspacesRepository} repository
     */
    constructor(repository) {
        this.#finder = new WorkspacesFinder(repository);
    }

    /**
     *
     * @param {string} id id for search
     * @returns {Promise<WorkspaceResponse>}
     */
    async execute(id) {
        const workspaces = await this.#finder.execute(id);
        if (!workspaces || workspaces.isDeleted()) {
            throw new CustomError('Workspace not found', 404);
        }
        return new WorkspaceResponse(workspaces);
    }
}
