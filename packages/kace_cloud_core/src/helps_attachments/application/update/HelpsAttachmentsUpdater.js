import { HelpsAttachmentsFinderDomain } from '../../index';
import { CustomError } from '../../../shared/errors/CustomError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';

export class HelpsAttachmentsUpdater {
    /** @type {KnexHelpsAttachmentsRepository} is initialized in the constructor */
    #repository;

    /** @type {HelpsAttachmentsFinder} is initialized in the constructor */
    #finder;

    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new HelpsAttachmentsFinderDomain(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates an HelpsAttachments object in the repository.
     *
     * @param {string} id - The unique identifier of the HelpsAttachments object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the HelpsAttachments object.
     * @returns {Promise<void>} A promise that resolves when the HelpsAttachments object is updated.
     */
    async execute(dto, id) {
        const helpAttachment = await this.#finder.execute(id);

        if (!helpAttachment) {
            throw new CustomError(`Help attachment with id ${id} does not exist.`, 404);
        }
        if (dto.titulo) {
            await this.#uniquenessValidator.validate('titulo', dto.titulo, id);
        }

        const originalValues = helpAttachment.toJson();
        helpAttachment.update(dto);

        await this.#repository.update(helpAttachment);
        await this.#repository.saveHistory(helpAttachment, originalValues);

        helpAttachment.flushChanges();
    }
}
