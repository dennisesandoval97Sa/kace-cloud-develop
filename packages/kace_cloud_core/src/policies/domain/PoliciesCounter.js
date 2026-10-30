import { Criteria } from '../../shared/criteria/Criteria';

export class PoliciesCounter {
    /**
     * @type {KnexPoliciesRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     *
     * @param {KnexPoliciesRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationships, 0, 0, undefined, tablename);
        return this.#repository.count(criteria);
    }
}
