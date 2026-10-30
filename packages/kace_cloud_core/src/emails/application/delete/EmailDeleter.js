import { ValidationFailError } from '@kace/core/src/shared/index.js';
import { KnexEmailsRepository } from '../../infrastructure/persistence/KnexEmailsRepository';
import { EmailFinder } from '../../domain/EmailFinder.js';
import { KnexEmailAttachmentRepository } from '../../infrastructure/persistence/KnexEmailAttachmentRepository.js';
import { KnexEmailsBodyRepository } from '../../infrastructure/persistence/KnexEmailsBodyRepository.js';

export class EmailDeleter {
    /** @type {KnexEmailsRepository} is initialized in the constructor */
    #repository;
    /** @type {EmailFinder} is initialized in the constructor */
    #finder;
    /** @type {KnexEmailsBodyRepository} is initialized in the constructor */
    #emailBodyRepository;
    /** @type {KnexEmailAttachmentRepository} is initialized in the constructor */
    #emailAttachmentRepository;

    /**
     * @param {KnexEmailsRepository} repository
     * @param {KnexEmailsBodyRepository} emailBodyRepository
     * @param {KnexEmailAttachmentRepository} emailAttachmentRepository
     */
    constructor(repository, emailBodyRepository, emailAttachmentRepository) {
        this.#repository = repository;
        this.#finder = new EmailFinder(repository);
        this.#emailBodyRepository = emailBodyRepository;
        this.#emailAttachmentRepository = emailAttachmentRepository;
    }

    /**
     * Deletes (temporarily deletes) an email address by updating deleted_at and deleted_by.
     * @param {string|object} id - Entity identifier
     * @param {Object} dto - Must contain deleted_at and deleted_by
     * @returns {Promise<void>}
     */
    async execute(id, dto) {
        const email = await this.#finder.execute(id);

        if (!email) {
            throw new ValidationFailError(`Email with id ${id} does not exist`);
        }

        email.delete(dto);
        await this.#repository.update(email);

        const body = await this.#emailBodyRepository.findByEmailBodyId(id);
        if (body) {
            body.delete(dto);
            await this.#emailBodyRepository.update(body);
        }

        const attachments = await this.#emailAttachmentRepository.findByEmailId(id);
        for (const att of attachments) {
            att.delete(dto);
            await this.#emailAttachmentRepository.update(att);
        }

        email.flushChanges();
    }
}
