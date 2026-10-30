import { Criteria } from '../../../shared/criteria/Criteria.js';
import { ShiftManagementCollectionResponse } from '../ShiftManagementCollectionResponse.js';
import { Counter } from '../../../shared/domain/Counter';

export class ShiftManagementSearcher {
    /** @type {KnexShiftManagementRepository} is initialized in the constructor */
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `ShiftManagementSearcher` class.
     *
     * @param {KnexShiftManagementRepository} repository - An instance of the repository that manages ShiftManagement records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Searches for ShiftManagement records based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching ShiftManagement records. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<ShiftManagementCollectionResponse>} A promise that resolves to an instance of `ShiftManagementCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#counter.execute({
            filter,
            relationship,
        });

        return new ShiftManagementCollectionResponse(rows, counter);
    }
}
