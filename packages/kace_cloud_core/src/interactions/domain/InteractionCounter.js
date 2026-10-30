import { Criteria } from '../../shared/index.js';

export class InteractionCounter {
    /**
     * @type {KnexInteractionRepository}
     * is initialized in the constructor
     */
    #repository;
    /**
     *
     * @param {KnexInteractionRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {object} dtoCriteria criteria for filter interactions
     * @returns {Promise<object>} database count aggregate
     */
    async execute(dtoCriteria, activeGroupScope = null) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, undefined, tablename);
        return activeGroupScope
            ? this.#repository.countForActiveGroup(criteria, activeGroupScope)
            : this.#repository.count(criteria);
    }

    /**
     * Counts the same Admin-search eligibility set used by the row query.
     *
     * @param {object} dtoCriteria criteria for filter interactions
     * @returns {Promise<object>} database count aggregate
     */
    async executeForAdminSearch(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, undefined, tablename);
        return this.#repository.countForAdminActiveWorkspaces(criteria);
    }
}
