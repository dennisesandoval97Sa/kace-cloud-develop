import { ValidationFailError } from '../../../shared';
import { BackgroundExecutionFinder as DomainBackgroundExecutionFinder } from '../../domain/BackgroundExecutionFinder';

export class BackgroundExecutionDeleter {
    /** @type {KnexBackgroundExecutionRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainBackgroundExecutionFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `BackgroundExecutionDeleter` class.
     *
     * @param {KnexS3FileRepository} repository - An instance of the repository that manages BackgroundExecution.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainBackgroundExecutionFinder(repository);
    }

    /**
     * Deletes a BackgroundExecution object from the repository.
     *
     * @param {string} id - The unique identifier of the BackgroundExecution object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the deletion process.
     * @returns {Promise<void>} A promise that resolves when the BackgroundExecution object is deleted.
     */
    async execute(id, dto) {
        const backgroundExecution = await this.#finder.execute(id);

        if (!backgroundExecution) {
            throw new ValidationFailError(`BackgroundExecution with id ${id} does not exist.`, 404);
        }

        backgroundExecution.delete(dto);

        await this.#repository.delete(backgroundExecution);

        backgroundExecution.flushChanges();
    }
}
