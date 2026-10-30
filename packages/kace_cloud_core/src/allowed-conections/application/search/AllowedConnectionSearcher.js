import { Criteria } from '../../../shared/criteria/Criteria';
import { AllowedConnectionCollectionResponse } from '../AllowedConnectionCollectionResponse';
import { AllowedConnectionCounter } from '../../index.js';

export class AllowedConnectionSearcher {
    /**
     * @type {KnexAllowedConnectionsRepository}
     * is initialized in the constructor
     */
    #repository;
    /** @type {AllowedConnectionCounter} is initialized in the constructor*/
    #count;

    /**
     * Creates an instance of the `AllowedConnectionSearcher` class.
     *
     * @param {KnexAllowedConnectionsRepository} repository - An instance of the repository that manages client allowed connection records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#count = new AllowedConnectionCounter(repository);
    }

    /**
     * Searches for client allowed connections based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching client allowed connections. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<AllowedConnectionCollectionResponse>} A promise that resolves to an instance of `AllowedConnectionCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);
        const rows = await this.#repository.search(criteria);
        const counter = await this.#count.execute({ filter, relationship });

        return new AllowedConnectionCollectionResponse(rows, counter);
    }
}
