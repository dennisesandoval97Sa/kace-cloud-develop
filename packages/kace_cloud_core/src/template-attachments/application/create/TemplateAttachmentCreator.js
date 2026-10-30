import { isAllowedExtension } from '@kace/file-extensions';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { TEMPLATE_ATTACHMENT_EXTENSION_NOT_ALLOWED } from '@kace/error-codes';
import { DomainTemplateAttachmentFinder, TemplateAttachment } from '../../index.js';

export class TemplateAttachmentCreator {
    /** @type {KnexTemplateAttachmentRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainTemplateAttachmentFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of `TemplateAttachmentCreator`.
     *
     * @param {KnexTemplateAttachmentRepository} repository - The repository used to save TemplateAttachment records.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainTemplateAttachmentFinder(repository);
    }

    /**
     * Executes the process of creating a new TemplateAttachment entity.
     *
     * This method takes a data transfer object (DTO) containing the necessary properties to create
     * a new `TemplateAttachment` object and then saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the `TemplateAttachment` object.
     * @returns {Promise<void>} A promise that resolves when the `TemplateAttachment` object is successfully created.
     */
    async execute(dto) {
        const { allowed_file_extensions, ...cleanDto } = dto;
        const templateAttachment = TemplateAttachment.create(cleanDto);

        const isValidExtension = isAllowedExtension(templateAttachment.path.value, allowed_file_extensions);
        if (!isValidExtension) {
            throw new CustomError(
                `This file extension is not allowed`,
                400,
                [],
                TEMPLATE_ATTACHMENT_EXTENSION_NOT_ALLOWED
            );
        }

        const result = await this.#finder.execute(templateAttachment.id.value);
        if (result) {
            throw new CustomError(`TemplateAttachment with id ${templateAttachment.id.value} already exists`, 400);
        }

        await this.#repository.save(templateAttachment);
        await this.#repository.saveHistory(templateAttachment);
    }
}
