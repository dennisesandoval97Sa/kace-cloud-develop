import { CustomError } from '../../../shared/index.js';
import { DomainTemplateAttachmentFinder, TemplateAttachmentResponse } from '../../index.js';

export class TemplateAttachmentFinder {
    /** @type {DomainTemplateAttachmentFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `TemplateAttachmentFinder` class.
     *
     * @param {KnexTemplateAttachmentRepository} repository - An instance of the repository that manages TemplateAttachment records.
     */
    constructor(repository) {
        this.#finder = new DomainTemplateAttachmentFinder(repository);
    }

    /**
     * Executes the finding of a TemplateAttachment object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the TemplateAttachment object to find.
     * @returns {Promise<TemplateAttachmentResponse>} A promise that resolves to a TemplateAttachmentResponse object containing the found TemplateAttachment data.
     */
    async execute(id) {
        const templateAttachment = await this.#finder.execute(id);
        if (!templateAttachment || templateAttachment.isDeleted()) {
            throw new CustomError('Template attachment not found', 404);
        }
        return new TemplateAttachmentResponse(templateAttachment);
    }
}
