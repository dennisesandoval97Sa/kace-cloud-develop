import { Criteria } from '../../../shared/criteria/Criteria';
import { WSRestConditionalCounter, WSRestConditionalCollectionResponse } from '../../index';

export class WSRestConditionalSearcher {
    /** @type {KnexWSRestConditionalRepository} is initialized in the constructor */
    #repository;
    /** @type {WSRestConditionalCounter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `WSRestConditionalSearcher` class.
     *
     * @param {KnexWSRestConditionalRepository} repository - An instance of the repository that manages WS REST conditional records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new WSRestConditionalCounter(repository);
    }

    /**
     * Searches for WS REST conditionals based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching WS REST conditionals. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<WSRestConditionalCollectionResponse>} A promise that resolves to an instance of `WSRestConditionalCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#counter.execute({ filter, relationship });

        return new WSRestConditionalCollectionResponse(rows, counter.count);
    }
}
