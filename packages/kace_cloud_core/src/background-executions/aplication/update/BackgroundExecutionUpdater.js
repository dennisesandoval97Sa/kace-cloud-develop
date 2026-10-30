import { BackgroundExecutionFinder as DomainBackgroundExecutionFinder } from '../../domain/BackgroundExecutionFinder';
import { ValidationFailError } from '../../../shared/index.js';

export class BackgroundExecutionUpdater {
    /** @type {KnexBackgroundExecutionRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainBackgroundExecutionFinder} is initialized in the constructor */
    #backgroundExecutionFinder;

    /**
     * Creates an instance of the `BackgroundExecutionUpdater` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages BackgorundExecution.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#backgroundExecutionFinder = new DomainBackgroundExecutionFinder(repository);
    }

    /**
     * Updates a BackgroundExecution object in the repository.
     *
     * @param {string} id - The unique identifier of the BackgroundExecution object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the BackgroundExecution object.
     * @returns {Promise<void>} A promise that resolves when the BackgroundExecution object is updated.
     */
    async execute(id, dto) {
        const backgroundExecution = await this.#backgroundExecutionFinder.execute(id);

        if (!backgroundExecution) {
            throw new ValidationFailError(`backgroundExecution with id ${id} does not exist.`, 404);
        }

        backgroundExecution.update(dto);

        await this.#repository.update(backgroundExecution);

        backgroundExecution.flushChanges();
    }
}
