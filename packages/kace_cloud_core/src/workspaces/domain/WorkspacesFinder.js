import { ValueObjectUuid } from '../../shared/index.js';

export class WorkspacesFinder {
    /**
     * @type {KnexWorkspacesRepository}
     * is initialized in the constructor
     */
    #repository;
    /**
     *
     * @param {KnexWorkspacesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {string} id id for find group
     * @returns {Promise<Workspaces|null>}
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
