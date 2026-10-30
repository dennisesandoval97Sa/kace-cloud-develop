import { ValueObjectUuid } from '../../shared/index.js';

export class ActionJobProcessingFinder {
    /**
     * @type {KnexModelRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `ActionJobProcessingFinder` class.
     *
     * @param {KnexModelRepository} repository - An instance of the repository that manages ActionJobProcessing records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds an ActionJobProcessing record by its ID.
     *
     * @param {string} id - The UUID of the ActionJobProcessing record to find.
     * @return {Promise<ActionJobProcessing | null>} A promise that resolves to the `ActionJobProcessing` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }

    /**
     * Finds ActionJobProcessing records that are pending.
     *
     * @param {number} [limit=25] - The maximum number of records to return (defaults to 25).
     * @return {Promise<Array<ActionJobProcessing>>} A promise that resolves to an array of `ActionJobProcessing` instances in the "pending" status.
     */
    async findPending(limit = 25) {
        return this.#repository.findPending(limit);
    }

    /**
     * Finds ActionJobProcessing records that are pending by their associated BatchExecution ID.
     *
     * @param {string} id - The UUID of the BatchExecution record.
     * @param {number} [limit=25] - The maximum number of records to return (defaults to 25).
     * @param {string[]} [excludeIds=[]] - ids ya procesados, para paginar sin repetirlos.
     * @return {Promise<Array<ActionJobProcessing>>} A promise that resolves to an array of `ActionJobProcessing` instances that are pending and associated with the provided BatchExecution ID.
     */
    async findByBatchExecutionId(id, limit = 25, excludeIds = []) {
        return this.#repository.findByBatchExecutionId(new ValueObjectUuid('id', id), limit, excludeIds);
    }
}
