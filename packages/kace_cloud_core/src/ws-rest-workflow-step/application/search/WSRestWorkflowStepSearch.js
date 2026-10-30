import { WSRestWorkflowStepCollectionResponse } from '../WSRestWorkflowStepCollectionResponse.js';
import { WSRestWorkflowStepCounter } from '../../domain/services/WSRestWorkflowStepCounter.js';
import { WSRestWorkflowStepFinderService } from '../../domain/services/WSRestWorkflowStepFinderService.js';

/**
 * Class responsible for searching RestWorkflowSteps.
 */
export class WSRestWorkflowStepSearch {
    /**
     * @type {WSRestWorkflowStepFinderService} is initialized in the constructor
     */
    #finderService;

    /**
     * @type {WSRestWorkflowStepCounter} is initialized in the constructor
     */
    #counter;

    /**
     * @param {KnexWSRestWorkflowStepRepository} repository
     */
    constructor(repository) {
        this.#finderService = new WSRestWorkflowStepFinderService(repository);
        this.#counter = new WSRestWorkflowStepCounter(repository);
    }

    /**
     * Execute the search for RestWorkflowSteps
     * @param {Object} params
     * @param {Object} params.filter
     * @param {Object} params.relationship
     * @param {number} params.limit
     * @param {number} params.offset
     * @param {string} params.order
     * @returns {Promise<WSRestWorkflowStepCollectionResponse>}
     */
    async execute({ filter, relationship, limit, offset, order }) {
        const tablename = this.#finderService.repository.tableName;
        const restWorkflowStep = await this.#finderService.search(
            filter,
            relationship,
            order,
            offset,
            limit,
            tablename
        );
        const restWorkflowStepCount = this.#counter.execute({
            filter,
            relationship,
            limit,
            offset,
            order,
            tablename,
        });

        return new WSRestWorkflowStepCollectionResponse(restWorkflowStep, restWorkflowStepCount);
    }
}
