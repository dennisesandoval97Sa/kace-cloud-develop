import { Criteria } from '../../shared/index.js';

export class WorkspacesCounter {
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
     * @param {object} dtoCriteria criteria for filter workspaces
     * @returns {Promise<number>} number of workspaces
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, undefined, tablename);
        return this.#repository.count(criteria);
    }
}
