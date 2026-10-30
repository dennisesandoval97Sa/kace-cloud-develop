import { CustomError } from '../../../shared/index.js';
import { ActionJobResponse, DomainActionJobFinder } from '../../index.js';

export class ActionJobFinder {
    /**
     * @type {DomainActionJobFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * Creates an instance of the `ActionJobFinder` class.
     *
     * @param {KnexActionJobRepository} repository - An instance of the repository that manages ActionJob records.
     */
    constructor(repository) {
        this.#finder = new DomainActionJobFinder(repository);
    }

    /**
     * Executes the finding of an ActionJob object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the ActionJob object to find.
     * @returns {Promise<ActionJobResponse>} A promise that resolves to an ActionJobResponse object containing the found ActionJob data.
     */
    async execute(id) {
        const actionJob = await this.#finder.execute(id);

        if (!actionJob || actionJob.isDeleted()) {
            throw new CustomError('Action batch execution not found', 404);
        }

        return new ActionJobResponse(actionJob);
    }
}
