import { CustomError } from '../../../shared/index.js';
import { DomainActionJobFinder } from '../../index.js';

export class ActionJobUpdater {
    /**
     * @type {DomainActionJobFinder}
     * is initialized in the constructor
     */
    #actionJobFinder;

    /**
     * @type {KnexActionJobRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionJobUpdater` class.
     *
     * @param {KnexActionJobRepository} repository - An instance of the repository that manages ActionJob records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#actionJobFinder = new DomainActionJobFinder(repository);
    }

    /**
     * Updates an `ActionJob` object in the repository.
     *
     * @param {string} id - The unique identifier of the `ActionJob` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `ActionJob` object.
     * @returns {Promise<void>} A promise that resolves when the `ActionJob` object is updated.
     */
    async execute(id, dto) {
        const actionJob = await this.#actionJobFinder.execute(id);

        if (!actionJob) {
            throw new CustomError(`ActionJob with ID ${id} does not exist.`, 404);
        }

        actionJob.update(dto);

        await this.#repository.update(actionJob);

        actionJob.flushChanges();
    }
}
