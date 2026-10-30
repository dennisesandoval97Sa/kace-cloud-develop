import { CustomError, ValueObjectUuid } from '@kace/core/src/shared';
import { EmailResponse } from '../EmailResponse';
import { EmailFinder as DomainEmailFinder } from '../../domain/EmailFinder';
import { EmailAttachmentFinder } from '../../domain/EmailAttachmentFinder';
import { EmailBodyFinder } from '../../domain/EmailBodyFinder';
import { KnexEmailAttachmentRepository } from '../../infrastructure/persistence/KnexEmailAttachmentRepository.js';

export class EmailFinder {
    /** @type {DomainEmailFinder} is initialized in the constructor */
    #finder;
    /** @type {EmailBodyFinder} is initialized in the constructor */
    #emailBodyFinder;
    /** @type {KnexEmailAttachmentRepository} is initialized in the constructor */
    #attachmentsRepository;

    constructor(repository, emailBodyRepository, attachmentsRepository) {
        this.#finder = new DomainEmailFinder(repository);
        this.#emailBodyFinder = new EmailBodyFinder(emailBodyRepository);
        this.#attachmentsRepository = attachmentsRepository;
    }

    /**
     * Searches for an email by its ID and returns a standard response.
     * @param {string} id
     * @returns {Promise<EmailResponse>}
     */
    async execute(id) {
        const email = await this.#finder.execute(id);
        if (!email || email.isDeleted()) {
            throw new CustomError('Email not found', 404);
        }

        const emailId = email.id.value;

        const body = await this.#emailBodyFinder.execute(emailId);
        const attachments = await this.#attachmentsRepository.findAllByEmailId(emailId);

        return new EmailResponse(email, body, attachments);
    }
}
