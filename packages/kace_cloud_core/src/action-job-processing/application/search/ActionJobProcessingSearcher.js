import { Criteria } from '../../../shared/criteria/Criteria.js';
import { ActionJobProcessingCollectionResponse, ActionJobProcessingCounter } from '../../index.js';

export class ActionJobProcessingSearcher {
    /**
     * @type {KnexActionJobProcessingRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {ActionJobProcessingCounter}
     * is initialized in the constructor
     */
    #count;

    /**
     * Creates an instance of the `ActionJobProcessingSearcher` class.
     *
     * @param {KnexActionJobProcessingRepository} repository - An instance of the repository that manages ActionJobProcessing records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#count = new ActionJobProcessingCounter(repository);
    }

    /**
     * Searches for ActionJobProcessing records based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching ActionJobProcessing records. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<ActionJobProcessingCollectionResponse>} A promise that resolves to an instance of `ActionJobProcessingCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#count.execute({ filter, relationship });

        return new ActionJobProcessingCollectionResponse(rows, counter);
    }
}
