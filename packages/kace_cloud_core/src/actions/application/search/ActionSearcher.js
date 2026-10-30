import { Criteria } from '../../../shared/criteria/Criteria.js';
import { ActionCollectionResponse } from '../ActionCollectionResponse.js';
import { ActionCounter } from '../../index.js';

export class ActionSearcher {
    /**
     * @type {KnexActionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {ActionCounter}
     * is initialized in the constructor
     */
    #count;

    /**
     * Creates an instance of the `ActionSearcher` class.
     *
     * @param {KnexActionRepository} repository - An instance of the repository that manages Action records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#count = new ActionCounter(repository);
    }

    /**
     * Searches for Action records based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching Action records. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<ActionCollectionResponse>} A promise that resolves to an instance of `ActionCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#count.execute({ filter, relationship });

        return new ActionCollectionResponse(rows, counter);
    }
}
