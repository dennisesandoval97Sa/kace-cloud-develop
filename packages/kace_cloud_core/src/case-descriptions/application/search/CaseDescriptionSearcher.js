import { Criteria } from '../../../shared/criteria/Criteria';
import { CaseDescriptionCollectionResponse } from '../CaseDescriptionCollectionResponse';

export class CaseDescriptionSearcher {
    /**
     * @type {KnexCaseDescriptionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `CaseDescriptionSearcher` class.
     *
     * @param {KnexCaseDescriptionRepository} repository - An instance of the repository that manages case description records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Searches for case descriptions based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching case descriptions. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<CaseDescriptionCollectionResponse>} A promise that resolves to an instance of `CaseDescriptionCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);
        const rows = await this.#repository.search(criteria);
        return new CaseDescriptionCollectionResponse(rows);
    }
}
