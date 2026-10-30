import { BackgroundExecutionCounter } from '../../domain/BackgroundExecutionCounter';
import { Criteria } from '../../../shared/criteria/Criteria';
import { BackgroundExecutionCollectionResponse } from '../BackgroundExecutionCollectionResponse';

export class BackgroundExecutionSearcher {
    /** @type {KnexBackgroundExecutionRepository} is initialized in the constructor */
    #repository;
    /** @type {BackgroundExecutionCounter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `BackgroundExecution` class.
     *
     * @param {KnexBackgroundExecutionRepository} repository - An instance of the repository that manages BackgroundExecution records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new BackgroundExecutionCounter(repository);
    }

    /**
     * Searches for BackgroundExecution based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching BackgroundExecution. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<BackgroundExecutionCollectionResponse>} A promise that resolves to an instance of `BackgroundExecutionCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);

        const rows = await this.#repository.search(criteria);
        const counter = await this.#counter.execute({ filter, relationship });

        return new BackgroundExecutionCollectionResponse(rows, counter.count);
    }
}
