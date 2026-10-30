import { ValueObjectUuid } from '@kace/core/src/shared';
import { KnexEmailAttachmentRepository } from '../infrastructure/persistence/KnexEmailAttachmentRepository';
import { EmailAttachment } from './EmailAttachments';

export class EmailAttachmentFinder {
    /** @type {KnexEmailAttachmentRepository} is initialized in the constructor */
    #repository;

    /**
     * @param {KnexEmailAttachmentRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Busca un board por su ID.
     * @param {string} id
     * @returns {Promise<EmailAttachment|null>}
     */
    async execute(id) {
        return await this.#repository.find(new ValueObjectUuid('id', id));
    }
}
