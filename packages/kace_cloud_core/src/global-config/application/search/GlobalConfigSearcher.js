import { Criteria } from '../../../shared/criteria/Criteria';
import { GlobalConfigCounter } from '../../index';
import { GlobalConfigCollectionResponse } from '../GlobalConfigCollectionResponse';

export class GlobalConfigSearcher {
    /**
     * @type {KnexGlobalConfigurationRepository} is initialized in the constructor
     * is initialized in the constructor
     */
    #repository;

    /** @type {Array} is initialized in the constructor */
    #count;

    /**
     *
     * @param {KnexGlobalConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#count = new GlobalConfigCounter(this.#repository);
    }

    /**
     *
     * @param {object} dtoCriteria
     * @returns {GlobalConfigCollectionResponse}
     */

    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );
        const results = await this.#repository.search(criteria);
        const { count } = await this.#count.execute(dtoCriteria);

        return new GlobalConfigCollectionResponse(results, count);
    }
}
