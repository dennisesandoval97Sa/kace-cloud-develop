import { CustomError } from '../../../shared/index.js';
import { DomainActionJobProcessingFinder } from '../../index.js';

export class ActionJobProcessingUpdater {
    /**
     * @type {DomainActionJobProcessingFinder}
     * is initialized in the constructor
     */
    #actionExecutionFinder;

    /**
     * @type {KnexActionJobProcessingRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionJobProcessingUpdater` class.
     *
     * @param {KnexActionJobProcessingRepository} repository - An instance of the repository that manages ActionJobProcessing records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#actionExecutionFinder = new DomainActionJobProcessingFinder(repository);
    }

    /**
     * Updates an `ActionJobProcessing` object in the repository.
     *
     * @param {string} id - The unique identifier of the `ActionJobProcessing` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `ActionJobProcessing` object.
     * @returns {Promise<void>} A promise that resolves when the `ActionJobProcessing` object is updated.
     */
    async execute(id, dto) {
        const actionExecution = await this.#actionExecutionFinder.execute(id);

        if (!actionExecution) {
            throw new CustomError(`ActionJobProcessing with ID ${id} does not exist.`, 404);
        }

        actionExecution.update(dto);

        await this.#repository.update(actionExecution);

        actionExecution.flushChanges();
    }
}
