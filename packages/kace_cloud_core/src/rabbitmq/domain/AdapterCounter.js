import { Criteria } from '../../shared/criteria/Criteria.js';

export class AdapterCounter {
    /** @type {Object} repository */
    #repository;

    /**
     * @param {Object} repository - repository used to perform counts
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Count adapters matching the provided filter/relationship.
     * @param {Object} dtoCriteria - { filter, relationship }
     * @returns {Promise<{count:number}>}
     */
    async execute({ filter, relationship }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, null, 0, null, tablename);

        const count = await this.#repository.count(criteria);

        return { count };
    }
}
