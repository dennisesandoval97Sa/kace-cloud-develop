import {
    DeleteFieldsDoNotExistError,
    Helper,
    InvalidArgumentError,
    QueryDBError,
    ValidationFailError,
} from '@kace/core/src/shared';
import { EmailAttachment } from '../../domain/EmailAttachments';
import { KnexRepository } from '../../../shared/index.js';
import { isUniqueViolation } from './EmailPersistenceErrors.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexEmailAttachmentRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'emails_attachments', readerConfig);
    }

    /**
     * Save an instance of email attachment in the database.
     * @param {EmailAttachment} emailAttachment
     * @returns {Promise<void>}
     */
    async save(emailAttachment, trx = null) {
        try {
            DbRequestContext.markWrite();
            const table = trx ? this.trxTable(trx) : this.table();
            await table.insert({
                id: emailAttachment.id.value,
                email_id: emailAttachment.email_id.value,
                url: emailAttachment.url.value,
                size: emailAttachment.size.value,
                filename: emailAttachment.filename.value,
                created_at: emailAttachment.created_at.value,
                created_by: emailAttachment.created_by.value,
                updated_at: emailAttachment.updated_at.value,
                updated_by: emailAttachment.updated_by.value,
                deleted_at: emailAttachment.deleted_at.value,
                deleted_by: emailAttachment.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving email attachment', error);
            if (isUniqueViolation(error)) {
                throw new ValidationFailError(
                    `Email attachment with id ${emailAttachment.id.value} already exists`,
                    'attachments.id'
                );
            }
            throw new QueryDBError('save');
        }
    }

    async update(emailAttachment) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .update({
                    id: emailAttachment.id.value,
                    email_id: emailAttachment.email_id.value,
                    url: emailAttachment.url.value,
                    size: emailAttachment.size.value,
                    filename: emailAttachment.filename.value,
                    created_at: emailAttachment.created_at.value,
                    created_by: emailAttachment.created_by.value,
                    updated_at: emailAttachment.updated_at.value,
                    updated_by: emailAttachment.updated_by.value,
                    deleted_at: emailAttachment.deleted_at.value,
                    deleted_by: emailAttachment.deleted_by.value,
                })
                .where({ id: emailAttachment.id.value })
                .whereNull('deleted_at');
        } catch (error) {
            Helper.logError('Error updating email attachment', error);
            throw new QueryDBError('update');
        }
    }

    async findByEmailId(emailId) {
        return this.read.table('emails_attachments').where({ email_id: emailId }).whereNull('deleted_at');
    }

    async deleteByEmailId(emailId) {
        DbRequestContext.markWrite();
        return this.table().where({ email_id: emailId }).update({ deleted_at: new Date() });
    }

    /**
     * Marks the Client object as deleted by setting the deleted_at and deleted_by properties.
     *
     * @param {Object} dto - The data transfer object containing the deleted_at and deleted_by properties.
     * @returns {void} This method does not return a value.
     */
    async delete(dto) {
        if (!dto.hasOwnProperty('deleted_at') || !dto.hasOwnProperty('deleted_by')) {
            throw new DeleteFieldsDoNotExistError(this.constructor.name);
        }
        this.deleted_at = dto.deleted_at;
        this.deleted_by = dto.deleted_by;
    }

    /**
     * Finds an `emails` instance by its ID.
     * @param {ValueObjectUuid} emailId - The ID of the `emails` to find.
     * @returns {Promise<EmailAttachment|null>} A promise that resolves to the `emails` instance if found, or null if not found.
     * @throws {QueryDBError} If there is an error finding the `emails`.
     */
    async find(emailId) {
        try {
            const idValue = typeof emailId === 'string' ? emailId : emailId?.value;

            if (!idValue) {
                throw new InvalidArgumentError('Email Id is required');
            }

            const result = await this.read.table('emails_attachments').where({ email_id: idValue }).first();
            return result ? new EmailAttachment(result) : null;
        } catch (error) {
            Helper.logError('Error finding email attachment', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Retrieves all records from the database associated with a given email ID.
     *
     * @param {string} email_id - The email ID to filter the records by.
     * @return {Promise<EmailAttachment[]>} A promise that resolves to an array of EmailAttachment objects.
     */
    async findAllByEmailId(email_id) {
        const rows = await this.read.table('emails_attachments').select().where({ email_id: email_id });

        return rows.map((row) => {
            return new EmailAttachment(row);
        });
    }
}
