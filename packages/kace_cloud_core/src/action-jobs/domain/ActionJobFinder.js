import { ValueObjectUuid } from '../../shared/index.js';

export class ActionJobFinder {
    /** @type {import('../infrastructure/KnexActionJobRepository.js').KnexActionJobRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `BatchExecutionFinder` class.
     *
     * @param {KnexActionJobRepository} repository - An instance of the repository that manages BatchExecution records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a BatchExecution record by its ID.
     *
     * @param {string} id - The UUID of the BatchExecution record to find.
     * @return {Promise<import('../domain/ActionJob.js').ActionJob>} A promise that resolves to the `BatchExecution` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }

    /**
     * Finds the first pending BatchExecution.
     *
     * @return {Promise<BatchExecution|null>} A promise that resolves to the `BatchExecution` instance if found, or `null` if not found.
     */
    async findPending() {
        return this.#repository.findPending();
    }
}
