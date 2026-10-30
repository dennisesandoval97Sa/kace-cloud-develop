import { DomainTemplateAttachmentFinder } from '../../index.js';
import { CustomError } from '../../../shared/errors/CustomError';

export class TemplateAttachmentUpdater {
    /** @type {DomainTemplateAttachmentFinder} is initialized in the constructor */
    #TemplateAttachmentFinder;
    /** @type {KnexTemplateAttachmentRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `TemplateAttachmentUpdater` class.
     *
     * @param {KnexTemplateAttachmentRepository} repository - An instance of the repository that manages CaseAttachment records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#TemplateAttachmentFinder = new DomainTemplateAttachmentFinder(repository);
    }

    /**
     * Updates a `TemplateAttachment` object in the repository.
     *
     * @param {string} id - The unique identifier of the `TemplateAttachment` object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the `TemplateAttachment` object.
     * @returns {Promise<void>} A promise that resolves when the `TemplateAttachment` object is updated.
     */
    async execute(id, dto) {
        const templateAttachment = await this.#TemplateAttachmentFinder.execute(id);

        if (!templateAttachment) {
            throw new CustomError(`TemplateAttachment with ID ${id} does not exist.`, 404);
        }

        const originalValues = templateAttachment.toJson();
        templateAttachment.update(dto);

        await this.#repository.update(templateAttachment);
        await this.#repository.saveHistory(templateAttachment, originalValues);

        templateAttachment.flushChanges();
    }
}
