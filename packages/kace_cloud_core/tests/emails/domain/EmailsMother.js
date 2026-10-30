import { v4 as uuidV4 } from 'uuid';
import { Email } from '../../../src/emails/domain/Email';
import { EmailBody } from '../../../src/emails/domain/EmailBody';
import { EmailAttachment } from '../../../src/emails/domain/EmailAttachments';
import { ensureParentRows } from '../../support/ensureParentRow.js';

/**
 * Mother object para generar datos de prueba del dominio Email,
 * incluyendo Email, EmailBody y EmailAttachment.
 */
export default class EmailMother {
    /**
     * Postgres exige que exista la fila padre de `workspace_id`. Se garantiza
     * siempre, tambien cuando el llamador fijo el id: `ensureParentRow` es
     * idempotente.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [{ table: 'workspaces', id: dto.workspace_id }]);
    }

    /**
     * DTO base (válido y totalmente controlado)
     */
    static dto(overrides = {}) {
        const email_id = uuidV4();
        return {
            id: email_id,
            s3_key: `http://localhost/emails/${uuidV4()}.json`,
            subject: 'Example Subject',
            sender: 'user@example.com',
            to: [{ name: 'User To', email: 'to@example.com' }],
            cc: [{ name: 'User CC', email: 'cc@example.com' }],
            bcc: [],
            priority: 'normal',
            workspace_id: overrides.workspace_id ?? uuidV4(),
            message_id: `${uuidV4()}`,
            account_id: overrides.account_id ?? uuidV4(),
            received_at: new Date().toISOString(),
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
            deleted_at: null,
            deleted_by: null,
            ...overrides,
        };
    }

    /**
     * Crea un email completo en BD (email)
     */
    static async createEmail(repository, overrides = {}) {
        const creatorDto = EmailMother.dto(overrides);
        await EmailMother.ensureRelations(repository.connection, creatorDto);
        const email = Email.create(creatorDto);
        await repository.save(email);

        return creatorDto;
    }

    static async createEmailWithRelations(emailRepository, emailBodyRepository, emailAttachmentRepository) {
        const dto = EmailMother.dto();
        await EmailMother.ensureRelations(emailRepository.connection, dto);
        const email = Email.create(dto);

        await emailRepository.save(email);

        // BODY
        const body = EmailBody.create({
            id: uuidV4(),
            email_id: dto.id,
            body: '<p>Body de prueba</p>',
            body_html: '<article><p>HTML Body de prueba</p></article>',
            created_at: new Date().toISOString(),
            created_by: dto.created_by,
            updated_at: null,
            updated_by: null,
        });

        await emailBodyRepository.save(body);

        // ATTACHMENT
        const attachment = EmailAttachment.create({
            id: uuidV4(),
            email_id: dto.id,
            url: 'https://s3.amazonaws.com/bucket/file.pdf',
            size: 2048,
            filename: 'file.pdf',
            created_at: new Date().toISOString(),
            created_by: dto.created_by,
            updated_at: null,
            updated_by: null,
        });

        await emailAttachmentRepository.save(attachment);

        return dto;
    }
}
