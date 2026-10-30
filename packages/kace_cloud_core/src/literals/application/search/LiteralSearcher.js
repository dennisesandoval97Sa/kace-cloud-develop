import { Criteria } from '../../../shared/criteria/Criteria';
import { Counter } from '../../../shared/domain/Counter';
import { LiteralCollectionResponse } from '../LiteralCollectionResponse';

export class LiteralSearcher {
    /** @type {KnexLiteralRepository} is initialized in the constructor*/
    #repository;
    /** @type {Counter} is initialized in the constructor */
    #counter;

    /**
     * Creates an instance of the `LiteralSearcher` class.
     *
     * @param {KnexLiteralRepository} repository - An instance of the repository that manages literal records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    /**
     * Searches for literals based on the provided criteria.
     *
     * @param {Object} dtoCriteria - The criteria for searching literals. This object should include:
     *   - `filter`: An object specifying the filter conditions.
     *   - `relationship`: An object specifying relationships to include in the search results.
     *   - `limit`: The maximum number of records to return.
     *   - `offset`: The number of records to skip before starting to collect results.
     *   - `order`: An object specifying the sorting order of the results.
     * @return {Promise<LiteralCollectionResponse>} A promise that resolves to an instance of `LiteralCollectionResponse` containing the search results.
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, limit, offset, order, tablename);
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({ filter, relationship });
        return new LiteralCollectionResponse(rows, count);
    }
}
