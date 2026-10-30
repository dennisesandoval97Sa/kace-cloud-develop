import { ValueObjectUuid } from '../../shared/index.js';

export class TemplateAttachmentFinder {
    /** @type {KnexTemplateAttachmentRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `TemplateAttachmentFinder` class.
     *
     * @param {KnexTemplateAttachmentRepository} repository - An instance of the repository that manages TemplateAttachment records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a TemplateAttachment record by its ID.
     *
     * @param {string} id - The UUID of the TemplateAttachment record to find.
     * @return {Promise<TemplateAttachment>} A promise that resolves to the `TemplateAttachment` instance if found, or `null` if not found.
     */
    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
