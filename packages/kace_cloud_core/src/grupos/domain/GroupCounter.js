import { Criteria } from '../../shared/index.js';

export class GroupCounter {
    /**
     * @type {KnexGroupsRepository}
     * is initialized in the constructor
     */
    #repository;
    /**
     *
     * @param {KnexGroupsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {object} dtoCriteria criteria for filter groups
     * @returns {Promise<number>} number of groups
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, undefined, tablename);
        return this.#repository.count(criteria);
    }
}
