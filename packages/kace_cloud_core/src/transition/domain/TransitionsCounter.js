import { Criteria } from '../../shared/criteria/Criteria';

export class TransitionsCounter {
    /** @type {KnexTransitionsRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexTransitinsRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {object} dtoCriteria object for filter transitions
     * @returns {Promise<number>}
     */
    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const counter = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 10, 0, undefined, tablename);
        return this.#repository.count(counter);
    }
}
