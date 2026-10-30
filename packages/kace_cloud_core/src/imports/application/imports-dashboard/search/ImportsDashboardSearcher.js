import { Criteria } from '../../../../shared/criteria/Criteria';
import { UnfilteredCounter } from '../../../domain/UnfilteredCounter.js';
import { ImportsDashboardSearchResponse } from '../../ImportsDashboardSearchResponse.js';

export class ImportsDashboardSearcher {
    /** @type {KnexRepository} is initialized in the constructor*/
    #repository;
    /** @type {UnfilteredCounter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `ImportsDashboardSearcher` class.
     *
     * @param {KnexRepository} repository - An instance of the repository that manages S3 import file records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new UnfilteredCounter(repository);
    }

    /**
     * Searches for groupLists based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching groupLists. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<ImportsDashboardSearchResponse>} A promise that resolves to an instance of `ImportsDashboardSearchResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({ filter, relationship });
        const countResult = count.count || count['count(*)'];
        return new ImportsDashboardSearchResponse(rows, countResult);
    }
}
