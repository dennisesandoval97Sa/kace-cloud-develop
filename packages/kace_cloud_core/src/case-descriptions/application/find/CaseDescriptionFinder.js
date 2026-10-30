import { CustomError } from '../../../shared/errors/CustomError.js';
import { CaseDescriptionResponse, DomainCaseDescriptionFinder } from '../../index.js';

export class CaseDescriptionFinder {
    /**
     * @type {DomainCaseDescriptionFinder}
     * is initialized in the constructor
     */
    #finder;

    /**
     * Creates an instance of the `CaseDescriptionFinder` class.
     *
     * @param {KnexCaseDescriptionRepository} repository - An instance of the repository that manages case description records.
     */
    constructor(repository) {
        this.#finder = new DomainCaseDescriptionFinder(repository);
    }

    /**
     * Executes the finding of a `CaseDescription` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `CaseDescription` object to find.
     * @returns {Promise<CaseDescriptionResponse>} A promise that resolves to a `CaseDescriptionResponse` object containing the found description data.
     */
    async execute(id) {
        const caseDescription = await this.#finder.execute(id);
        if (!caseDescription) {
            throw new CustomError(`Case description with ID ${id} does not exist.`, 404);
        }
        return new CaseDescriptionResponse(caseDescription);
    }
}
