import { Criteria } from '../../shared/criteria/Criteria.js';

export class AllowedConnectionCounter {
    /** @type {KnexAllowedConnectionsRepository} is initialized in the constructor */
    #repository;

    /**
     * Constructs a new instance of AllowedConnectionCounter.
     * @param {KnexAllowedConnectionsRepository} repository - The repository used to count allowed connections.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the operation to count the number of allowed connections based on the given criteria.
     * @param {Object} dtoCriteria - The data transfer object containing the criteria for the count operation.
     * - `filter`: An object specifying the filter conditions.
     * - `relationship`: An object specifying relationships to include in the search results.
     * @returns {Promise<number>} A promise that resolves to the count of allowed connections matching the criteria.
     */
    async execute({ filter, relationship }) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(filter, relationship, null, 0, null, tablename);

        return this.#repository.count(criteria);
    }
}
