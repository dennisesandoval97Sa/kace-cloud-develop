import { Criteria } from '../../shared/criteria/Criteria';

export class GlobalConfigCounter {
    /** @type {KnexGlobalConfigurationRepository} is initialized in the constructor */
    #repository;

    /**
     *
     * @param {KnexGlobalConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     *
     * @param {Object} dtoCriteria
     * @returns {Promise<object>}
     */

    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(dtoCriteria.filter, dtoCriteria.relationship, 0, 0, undefined, tablename);
        const counter = await this.#repository.count(criteria);

        return {
            ...counter,
            count: Number(counter.count ?? counter['count(*)'] ?? 0),
        };
    }
}
