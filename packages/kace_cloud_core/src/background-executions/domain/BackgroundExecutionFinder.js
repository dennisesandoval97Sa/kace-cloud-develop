import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid';
import { KnexBackgroundExecutionRepository } from '../infrastructure/persistence/KnexBackgroundExecutionRepository';
import { ValueObjectProccessDescription } from './value-objects/ValueObjectProccessDescription';

export class BackgroundExecutionFinder {
    /** @type {KnexBackgroundExecutionRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a BackgroundExecution by its ID.
     *
     * @param {string} id - The UUID of the BackgroundExecution to find.
     * @return {Promise<BackgroundExecution | null>} A promise that resolves to the `BackgroundExecution` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }

    async findByProccess(backgroundProccess) {
        return this.#repository.findByProcess(new ValueObjectProccessDescription(backgroundProccess));
    }
}
