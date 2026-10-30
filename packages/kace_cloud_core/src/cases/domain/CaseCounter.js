import { Criteria } from '../../shared/criteria/Criteria';

export class CaseCounter {
    /** @type {KnexCaseRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexCaseRepository} repository
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
