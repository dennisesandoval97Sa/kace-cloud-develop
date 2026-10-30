import { Criteria } from '../../../shared/criteria/Criteria.js';
import { ActionUpdateModelCollectionResponse, ActionUpdateModelCounter } from '../../index.js';

export class ActionUpdateModelSearcher {
    /**
     * @type {KnexActionUpdateModelRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {ActionUpdateModelCounter}
     * is initialized in the constructor
     */
    #count;

    /**
     * Creates an instance of the `ActionUpdateModelSearcher` class.
     *
     * @param {KnexActionUpdateModelRepository} repository - An instance of the repository that manages ActionUpdateModel records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#count = new ActionUpdateModelCounter(repository);
    }

    /**
     * Searches for ActionUpdateModel records based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching ActionUpdateModel records. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<ActionUpdateModelCollectionResponse>} A promise that resolves to an instance of `ActionUpdateModelCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#count.execute({ filter, relationship });

        return new ActionUpdateModelCollectionResponse(rows, counter);
    }
}
