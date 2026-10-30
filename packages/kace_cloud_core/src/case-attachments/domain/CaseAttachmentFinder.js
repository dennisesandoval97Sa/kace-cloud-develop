import { ValueObjectUuid } from '../../shared/index.js';

export class CaseAttachmentFinder {
    /**
     * @type {KnexCaseAttachmentRepository}
     * is initialized in the constructor
     */
    #repository;

    /**
     * Creates an instance of the `CaseAttachmentFinder` class.
     *
     * @param {KnexCaseAttachmentRepository} repository - An instance of the repository that manages CaseAttachment records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a CaseAttachment record by its ID.
     *
     * @param {string} id - The UUID of the CaseAttachment record to find.
     * @return {Promise<CaseAttachment>} A promise that resolves to the `CaseAttachment` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
