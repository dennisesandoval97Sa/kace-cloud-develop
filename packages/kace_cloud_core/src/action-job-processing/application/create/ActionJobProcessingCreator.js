import { ActionJobProcessing, DomainActionJobProcessingFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class ActionJobProcessingCreator {
    /**
     * @type {KnexActionJobProcessingRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainActionJobProcessingFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * @param {KnexActionJobProcessingRepository} repository - The repository for managing ActionJobProcessing records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainActionJobProcessingFinder(repository);
    }

    /**
     * Executes the process of creating a new ActionJobProcessing.
     * @param {Object} dto - The data transfer object containing the properties for the ActionJobProcessing object.
     * @returns {Promise<void>}
     */
    async execute(dto, trx = null) {
        if (!dto) throw new Error('DTO cannot be null or undefined');

        const actionExecution = new ActionJobProcessing(dto);

        const existingActionJobProcessing = await this.#finder.execute(actionExecution.id.value);
        if (existingActionJobProcessing) {
            throw new CustomError(`ActionJobProcessing with id ${actionExecution.id.value} already exists`, 400);
        }

        await this.#repository.save(actionExecution, trx);
    }
}
