import { ValidationFailError } from '../../../shared';
import { BackgroundExecution } from '../../domain/BackgroundExecution';
import { BackgroundExecutionFinder as DomainBackgroundExecutionFinder } from '../../domain/BackgroundExecutionFinder';

export class BackgroundExecutionCreator {
    /** @type {KnexBackgroundExecutionRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainBackgroundExecutionFinder} is initialized in the constructor */
    #backgroundExecutionFinder;

    constructor(repository) {
        this.#repository = repository;
        this.#backgroundExecutionFinder = new DomainBackgroundExecutionFinder(repository);
    }

    /**
     * Executes the creation of a BackgroundExecution object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the BackgroundExecution object.
     * @returns {Promise<void>} A promise that resolves when the BackgroundExecution object is saved.
     */
    async execute(dto) {
        const backgroundExecution = BackgroundExecution.create(dto);

        const result = await this.#backgroundExecutionFinder.execute(backgroundExecution.id.value);
        if (result) {
            throw new ValidationFailError(
                `BackgroundExecution with id ${backgroundExecution.id.value} already exists`,
                400
            );
        }

        await this.#repository.save(backgroundExecution);
    }
}
