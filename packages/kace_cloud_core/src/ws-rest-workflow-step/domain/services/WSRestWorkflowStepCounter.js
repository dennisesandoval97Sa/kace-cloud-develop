import { Criteria } from '../../../shared/criteria/Criteria.js';

export class WSRestWorkflowStepCounter {
    /** @type {KnexWSRestWorkflowStepRepository} is initialized in the constructor */
    #repository;

    /**
     * Constructs a new instance of WSRestWorkflowStepCounter.
     * @param {KnexWSRestWorkflowStepRepository} repository - The repository used to count WS REST workflow steps.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Executes the operation to count the number of WS REST workflow steps based on the given criteria.
     * @param {Object} dtoCriteria - The data transfer object containing the criteria for the count operation.
     * - `filter`: An object specifying the filter conditions.
     * - `relationship`: An object specifying relationships to include in the search results.
     * - `tablename`: The name of the table to query.
     * @returns {Promise<number>} A promise that resolves to the count of WS REST workflow steps matching the criteria.
     */
    async execute({ filter, relationship, tablename = null }) {
        const criteria = new Criteria(filter, relationship, null, 0, null, tablename);

        return this.#repository.count(criteria);
    }
}
