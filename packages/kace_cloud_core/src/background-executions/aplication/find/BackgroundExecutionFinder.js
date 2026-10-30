import { ValidationFailError } from '../../../shared/errors/ValidationFailError.js';
import { BackgroundExecutionFinder as DomainBackgroundExecutionFinder } from '../../domain/BackgroundExecutionFinder';
import { BackgroundExecutionResponse } from '../BackgroundExecutionResponse';

export class BackgroundExecutionFinder {
    /** @type {DomainBackgroundExecutionFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `BackgroundExecutionFinder` class.
     *
     * @param {KnexBackgroundExecutionRepository} repository - An instance of the repository that manages BackgroundExecution records.
     */
    constructor(repository) {
        this.#finder = new DomainBackgroundExecutionFinder(repository);
    }

    /**
     * Executes the finding of a `BackgroundExecution` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `BackgroundExecution` object to find.
     * @returns {Promise<BackgroundExecutionResponse>} A promise that resolves to a `BackgroundExecutionResponse` object containing the found endpoint data.
     */
    async execute(id) {
        const backgroundExecution = await this.#finder.execute(id);
        if (!backgroundExecution || backgroundExecution.isDeleted()) {
            throw new ValidationFailError('BackgroundExecution not found', 404);
        }

        return new BackgroundExecutionResponse(backgroundExecution);
    }

    async findByProccess(backgroundProccess) {
        const backgroundExecution = await this.#finder.findByProccess(backgroundProccess);
        if (!backgroundExecution || backgroundExecution.isDeleted()) {
            throw new ValidationFailError('BackgroundExecution not found', 404);
        }

        return new BackgroundExecutionResponse(backgroundExecution);
    }
}
