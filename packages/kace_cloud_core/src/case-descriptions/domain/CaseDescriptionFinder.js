import { ValueObjectUuid } from '../../shared/index.js';

export class CaseDescriptionFinder {
    /**
     * @type {KnexCaseDescriptionRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `CaseDescriptionFinder` class.
     *
     * @param {KnexCaseDescriptionRepository} repository - An instance of the repository that manages case description records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a case description by its ID.
     *
     * @param {string} id - The UUID of the case description to find.
     * @return {Promise<caseDescription | null>} A promise that resolves to the `CaseDescription` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
