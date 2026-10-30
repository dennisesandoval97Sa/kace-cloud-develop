import { CustomError } from '../../../shared/index.js';
import { ActionJobProcessingResponse, DomainActionJobProcessingFinder } from '../../index.js';

export class ActionJobProcessingFinder {
    /**
     * @type {DomainActionJobProcessingFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * Creates an instance of the `ActionJobProcessingFinder` class.
     *
     * @param {KnexModelRepository} repository - An instance of the repository that manages ActionJobProcessing records.
     */
    constructor(repository) {
        this.#finder = new DomainActionJobProcessingFinder(repository);
    }

    /**
     * Executes the finding of an ActionJobProcessing object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the ActionJobProcessing object to find.
     * @returns {Promise<ActionJobProcessingResponse>} A promise that resolves to an ActionJobProcessingResponse object containing the found ActionJobProcessing data.
     */
    async execute(id) {
        const actionExecution = await this.#finder.execute(id);

        if (!actionExecution || actionExecution.isDeleted()) {
            throw new CustomError('Action execution not found', 404);
        }

        return new ActionJobProcessingResponse(actionExecution);
    }
}
