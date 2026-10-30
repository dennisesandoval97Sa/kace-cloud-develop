import { DomainActionJobFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class ActionJobDeleter {
    /**
     * @type {DomainActionJobFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @type {KnexActionJobRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionJobDeleter` class.
     *
     * @param {KnexActionJobRepository} repository - An instance of the repository that manages ActionJob records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainActionJobFinder(repository);
    }

    /**
     * Deletes an `ActionJob` object from the repository.
     *
     * This method finds the ActionJob entity by its ID, applies deletion operations (like setting deleted flags),
     * updates the repository with the modified entity, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the ActionJob entity to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `ActionJob` object (e.g., deleted_by, deleted_at).
     * @returns {Promise<void>} A promise that resolves when the `ActionJob` entity is deleted.
     * @throws {CustomError} Throws an error if the ActionJob entity does not exist or is already deleted.
     */
    async execute(id, dto) {
        const actionJob = await this.#finder.execute(id);

        if (!actionJob) {
            throw new CustomError(`ActionJob with ID ${id} does not exist.`, 404);
        }

        actionJob.delete(dto);

        await this.#repository.update(actionJob);

        actionJob.flushChanges();
    }
}
