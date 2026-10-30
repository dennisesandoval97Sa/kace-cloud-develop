import { Criteria } from '../../shared/criteria/Criteria.js';

export class FolioConfigurationCounter {
    /**
     * @type {KnexFolioConfigurationRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @param {KnexFolioConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {Object} dtoCriteria
     * @returns {Promise<number>}
     */
    async execute({ filter, relationship }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, null, 0, null, tablename);

        return this.#repository.count(criteria);
    }
}
