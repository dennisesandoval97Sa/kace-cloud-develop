import { DomainActionJobProcessingFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class ActionJobProcessingDeleter {
    /**
     * @type {DomainActionJobProcessingFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {KnexActionJobProcessingRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionJobProcessingDeleter` class.
     *
     * @param {KnexActionJobProcessingRepository} repository - An instance of the repository that manages ActionJobProcessing records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainActionJobProcessingFinder(repository);
    }

    /**
     * Deletes an `ActionJobProcessing` object from the repository.
     *
     * This method finds the ActionJobProcessing entity by its ID, applies deletion operations, updates the repository with the modified entity, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the ActionJobProcessing entity to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `ActionJobProcessing` object (e.g., deleted_by, deleted_at).
     * @returns {Promise<void>} A promise that resolves when the `ActionJobProcessing` entity is deleted.
     * @throws {CustomError} Throws an error if the ActionJobProcessing entity does not exist or is already deleted.
     */
    async execute(id, dto) {
        const actionExecution = await this.#finder.execute(id);

        if (!actionExecution) {
            throw new CustomError(`ActionJobProcessing with ID ${id} does not exist.`, 404);
        }

        actionExecution.delete(dto);

        await this.#repository.update(actionExecution);

        actionExecution.flushChanges();
    }
}
