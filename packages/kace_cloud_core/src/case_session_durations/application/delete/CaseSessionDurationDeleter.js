import { CaseSessionDurationFinder as DomainCaseSessionDurationFinder } from '../../domain/CaseSessionDurationFinder.js';
import { CustomError } from '../../../shared/errors/CustomError.js';

export class CaseSessionDurationDeleter {
    /** @type {DomainCaseSessionDurationFinder} is initialized in the constructor */
    #caseSessionDurationFinder;
    /** @type {KnexCaseSessionDurationRepository} is initialized in the constructor */
    #repository;

    constructor(repository) {
        this.#repository = repository;
        this.#caseSessionDurationFinder = new DomainCaseSessionDurationFinder(repository);
    }

    /**
     * Deletes a CaseSessionDuration object from the repository.
     *
     * @param {string} id - The unique identifier of the CaseSessionDuration object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the CaseSessionDuration object.
     * @returns {Promise<void>} A promise that resolves when the CaseSessionDuration object is deleted.
     */
    async execute(id, dto) {
        const caseSessionDuration = await this.#caseSessionDurationFinder.execute(id);

        if (!caseSessionDuration) {
            throw new CustomError(`CaseSessionDuration with id ${id} does not exist.`, 404);
        }
        caseSessionDuration.delete(dto);
        
        await this.#repository.delete(caseSessionDuration);

        caseSessionDuration.flushChanges();
    }
}
