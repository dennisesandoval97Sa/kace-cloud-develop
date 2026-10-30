import { Criteria } from '../criteria/Criteria';

export class Counter {
    /**@type {KnexRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {object} dtoCriteria criteria object for search
     * @returns {Promise<number>}
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, undefined, tablename);
        return this.#repository.count(criteria);
    }
}
