import { ValueObjectUuid } from '../../../shared';
import { CustomError } from '../../../shared/errors/CustomError';

export class HelpsAttachmentsDeleter {
    /** @type {KnexHelpsRepository} is initialized in the constructor */
    #repository;
    constructor(repository) {
        this.#repository = repository;
    }

    async execute(id, dto) {
        const helpAttachment = await this.#repository.find(new ValueObjectUuid('id', id));

        if (helpAttachment.deleted_by.value) {
            throw new CustomError(`Help Attachment with id ${id} does not exist.`, 404);
        }

        const originalValues = helpAttachment.toJson();
        helpAttachment.delete(dto);

        await this.#repository.delete(helpAttachment);
        await this.#repository.saveHistory(helpAttachment, originalValues);
        helpAttachment.flushChanges();
    }
}
