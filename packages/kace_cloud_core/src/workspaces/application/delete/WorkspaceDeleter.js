import { CustomError } from '../../../shared/index.js';
import { WorkspacesFinder } from '../../domain/WorkspacesFinder.js';

export class WorkspaceDeleter {
    /** @type {KnexWorkspacesRepository} is initialized in the constructor */
    #repository;

    /** @type {WorkspacesFinder} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexWorkspacesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new WorkspacesFinder(repository);
    }

    /**
     *
     * @param {string} id id workspace for delete
     * @param {object} deleteDto object with data for delete the workspace, example {deletedAt: new Date(), deletedBy: 'user_id'}
     * @returns {Promise<Any>}
     */
    async execute(id, deleteDto) {
        const workspace = await this.#finder.execute(id);

        if (workspace === null) {
            throw new CustomError(`The workspace you are trying delete does not exist`, 404);
        }

        workspace.delete(deleteDto);
        await this.#repository.delete(workspace);

        workspace.flushChanges();
    }
}
