import { Criteria } from '../../../shared/criteria/Criteria';
import { WSRestEndpointCollectionResponse, WSRestEndpointCounter } from '../../index';

export class WSRestEndpointSearcher {
    /** @type {KnexWSRestEndpointRepository} is initialized in the constructor */
    #repository;
    /** @type {WSRestEndpointCounter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `WSRestEndpointSearcher` class.
     *
     * @param {KnexWSRestEndpointRepository} repository - An instance of the repository that manages WS REST endpoint records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new WSRestEndpointCounter(repository);
    }

    /**
     * Searches for WS REST endpoints based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching WS REST endpoints. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<WSRestEndpointCollectionResponse>} A promise that resolves to an instance of `WSRestEndpointCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#counter.execute({ filter, relationship });

        return new WSRestEndpointCollectionResponse(rows, counter.count);
    }
}
