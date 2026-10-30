import {
    DeleteFieldsDoNotExistError,
    Helper,
    InvalidArgumentError,
    QueryDBError,
    ValidationFailError,
} from '@kace/core/src/shared';
import { EmailBody } from '../../domain/EmailBody';
import { KnexRepository } from '../../../shared/index.js';
import { isUniqueViolation } from './EmailPersistenceErrors.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';
export class KnexEmailsBodyRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'emails_body', readerConfig);
    }

    /**
     * Save an instance of emails in the database.
     * @param {EmailBody} emailBody
     * @returns {Promise<void>}
     */
    async save(emailBody, trx = null) {
        try {
            DbRequestContext.markWrite();
            const table = trx ? this.trxTable(trx) : this.table();
            await table.insert({
                id: emailBody.id.value,
                email_id: emailBody.email_id.value,
                body: emailBody.body.value,
                body_html: emailBody.body_html.value,
                body_text_storage_mode: emailBody.body_text_storage_mode.value,
                body_text_s3_key: emailBody.body_text_s3_key.value,
                body_text_size_bytes: emailBody.body_text_size_bytes.value,
                body_text_content_type: emailBody.body_text_content_type.value,
                body_text_sha256: emailBody.body_text_sha256.value,
                body_text_preview_truncated: emailBody.body_text_preview_truncated.value,
                body_html_storage_mode: emailBody.body_html_storage_mode.value,
                body_html_s3_key: emailBody.body_html_s3_key.value,
                body_html_size_bytes: emailBody.body_html_size_bytes.value,
                body_html_content_type: emailBody.body_html_content_type.value,
                body_html_sha256: emailBody.body_html_sha256.value,
                body_html_preview_truncated: emailBody.body_html_preview_truncated.value,
                created_at: emailBody.created_at.value,
                created_by: emailBody.created_by.value,
                updated_at: emailBody.updated_at.value,
                updated_by: emailBody.updated_by.value,
                deleted_at: emailBody.deleted_at.value,
                deleted_by: emailBody.deleted_by.value,
            });
        } catch (error) {
            Helper.logError(error.message, error);
            if (isUniqueViolation(error)) {
                throw new ValidationFailError(`Email body with id ${emailBody.id.value} already exists`, 'body.id');
            }
            throw new QueryDBError('save');
        }
    }

    async update(emailBody) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .update({
                    id: emailBody.id.value,
                    email_id: emailBody.email_id.value,
                    body: emailBody.body.value,
                    body_html: emailBody.body_html.value,
                    body_text_storage_mode: emailBody.body_text_storage_mode.value,
                    body_text_s3_key: emailBody.body_text_s3_key.value,
                    body_text_size_bytes: emailBody.body_text_size_bytes.value,
                    body_text_content_type: emailBody.body_text_content_type.value,
                    body_text_sha256: emailBody.body_text_sha256.value,
                    body_text_preview_truncated: emailBody.body_text_preview_truncated.value,
                    body_html_storage_mode: emailBody.body_html_storage_mode.value,
                    body_html_s3_key: emailBody.body_html_s3_key.value,
                    body_html_size_bytes: emailBody.body_html_size_bytes.value,
                    body_html_content_type: emailBody.body_html_content_type.value,
                    body_html_sha256: emailBody.body_html_sha256.value,
                    body_html_preview_truncated: emailBody.body_html_preview_truncated.value,
                    created_at: emailBody.created_at.value,
                    created_by: emailBody.created_by.value,
                    updated_at: emailBody.updated_at.value,
                    updated_by: emailBody.updated_by.value,
                    deleted_at: emailBody.deleted_at.value,
                    deleted_by: emailBody.deleted_by.value,
                })
                .where({ id: emailBody.id.value })
                .whereNull('deleted_at');
        } catch (error) {
            Helper.logError('Error updating emails', error);
            throw new QueryDBError('update');
        }
    }

    async findByEmailBodyId(emailId) {
        const record = await this.read
            .table('emails_body')
            .where({ email_id: emailId })
            .whereNull('deleted_at')
            .first();
        return record ? new EmailBody(record) : null;
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
     * @returns {Promise<EmailBody|null>} A promise that resolves to the `emails` instance if found, or null if not found.
     * @throws {QueryDBError} If there is an error finding the `emails`.
     */
    async find(emailId) {
        try {
            const idValue = typeof emailId === 'string' ? emailId : emailId?.value;

            if (!idValue) {
                throw new InvalidArgumentError('Email ID is required');
            }

            const result = await this.read.table('emails_body').where({ email_id: idValue }).first();
            return result ? new EmailBody(result) : null;
        } catch (error) {
            Helper.logError('Error finding email body', error);
            throw new QueryDBError('find');
        }
    }
}
