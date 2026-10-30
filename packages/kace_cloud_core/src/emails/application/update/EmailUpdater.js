import { ValidationFailError } from '@kace/core/src/shared';
import { EmailFinder } from '../../domain/EmailFinder.js';
import { KnexEmailsRepository } from '../../infrastructure/persistence/KnexEmailsRepository';
import { KnexEmailsBodyRepository } from '../../infrastructure/persistence/KnexEmailsBodyRepository';
import { KnexEmailAttachmentRepository } from '../../infrastructure/persistence/KnexEmailAttachmentRepository';
import { EmailAttachment } from '../../domain/EmailAttachments';
import { EmailBody } from '../../domain/EmailBody';

export class EmailUpdater {
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
     * @param emailBodyRepo
     * @param emailAttachmentRepo
     */
    constructor(repository, emailBodyRepo, emailAttachmentRepo) {
        this.#repository = repository;
        this.#finder = new EmailFinder(repository);
        this.#emailBodyRepository = emailBodyRepo;
        this.#emailAttachmentRepository = emailAttachmentRepo;
    }

    /**
     * Update an existing Board.
     * @param {object} dto - Data to update
     * @param {string} id - Identifier of the record to update
     * @returns {Promise<void>}
     */
    async execute(dto, id) {
        const email = await this.#finder.execute(id);

        if (!email) {
            throw new ValidationFailError('Email that you are trying to update does not exist', 'email');
        }

        email.update(dto);
        await this.#repository.update(email);

        if (dto.body) {
            const currentBody = await this.#emailBodyRepository.findByEmailBodyId(id);

            if (!currentBody) {
                const newBody = EmailBody.create({
                    ...dto.body,
                    email_id: id,
                    body_html: dto.body.body_html ?? null,
                    created_at: email.created_at.value,
                    created_by: email.created_by.value,
                });
                await this.#emailBodyRepository.save(newBody);
            } else {
                const updatedBody = EmailBody.create({
                    id: currentBody.id.value,
                    email_id: id,
                    body: dto.body.body,
                    body_html: dto.body.body_html ?? currentBody.body_html.value ?? null,
                    created_at: currentBody.created_at.value,
                    created_by: currentBody.created_by.value,
                });
                await this.#emailBodyRepository.update(updatedBody);
            }
        }

        if (dto.attachments?.length) {
            await this.#emailAttachmentRepository.deleteByEmailId(id);

            for (const att of dto.attachments) {
                const attachment = EmailAttachment.create({
                    ...att,
                    email_id: id,
                });
                await this.#emailAttachmentRepository.save(attachment);
            }
        }

        email.flushChanges();
    }
}
