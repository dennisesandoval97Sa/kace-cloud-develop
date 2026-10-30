import { DomainTemplateAttachmentFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError';

export class TemplateAttachmentDeleter {
    /** @type {DomainTemplateAttachmentFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexTemplateAttachmentRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `TemplateAttachmentDeleter` class.
     *
     * @param {KnexTemplateAttachmentRepository} repository - An instance of the repository that manages TemplateAttachment records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainTemplateAttachmentFinder(repository);
    }

    /**
     * Deletes a `TemplateAttachment` object from the repository.
     *
     * This method finds the TemplateAttachment entity by its ID, applies deletion operations, updates the repository with the modified entity, and then flushes any changes.
     *
     * @param {string} id - The unique identifier of the TemplateAttachment entity to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `TemplateAttachment` object (e.g., deleted_by, deleted_at).
     * @returns {Promise<void>} A promise that resolves when the `TemplateAttachment` entity is deleted.
     * @throws {Error} Throws an error if the TemplateAttachment entity does not exist.
     */
    async execute(id, dto) {
        const templateAttachment = await this.#finder.execute(id);

        if (!templateAttachment) {
            throw new CustomError(`TemplateAttachment with ID ${id} does not exist.`, 404);
        }

        const originalValues = templateAttachment.toJson();
        templateAttachment.delete(dto);

        await this.#repository.update(templateAttachment);
        await this.#repository.saveHistory(templateAttachment, originalValues);

        templateAttachment.flushChanges();
    }
}
