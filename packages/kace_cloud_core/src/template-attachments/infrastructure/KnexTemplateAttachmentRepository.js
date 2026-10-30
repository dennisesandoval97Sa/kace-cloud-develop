import { TemplateAttachment, TEMPLATE_ATTACHMENT_USAGE_TYPE_INLINE } from '..';
import { KnexRepository } from '../../shared/index';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';

export class KnexTemplateAttachmentRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'template_attachments', readerConfig);
    }

    /**
     * Saves a new template attachment record in the database.
     * @param {TemplateAttachment} templateAttachment
     * @returns {Promise<void>}
     */
    async save(templateAttachment) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: templateAttachment.id.value,
                template_id: templateAttachment.template_id.value,
                path: templateAttachment.path.value,
                type: templateAttachment.type.value,
                is_active: templateAttachment.is_active.value,
                usage_type: templateAttachment.usage_type,
                created_at: templateAttachment.created_at.value,
                created_by: templateAttachment.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving template attachment:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a template attachment record by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<TemplateAttachment | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('template_attachments').where({ id: id.value }).first();

            return result ? new TemplateAttachment(result) : null;
        } catch (error) {
            Helper.logError('Error finding template attachment:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds active, non-inline attachments for a template - the "real" file attachments
     * uploaded via the template's "Includes Attachments" toggle, as opposed to the
     * `template-attachment://` images referenced inline in the body (`usage_type: 'inline'`).
     * @param {string} templateId
     * @returns {Promise<TemplateAttachment[]>}
     */
    async findActiveByTemplateId(templateId) {
        try {
            const rows = await this.read
                .table('template_attachments')
                .select('*')
                .where({ template_id: templateId, is_active: true })
                .whereNot({ usage_type: TEMPLATE_ATTACHMENT_USAGE_TYPE_INLINE })
                .whereNull('deleted_by')
                .whereNull('deleted_at');

            return rows.map((row) => new TemplateAttachment(row));
        } catch (error) {
            Helper.logError('Error finding active template attachments:', error);
            throw new QueryDBError('findActiveByTemplateId');
        }
    }

    /**
     * Searches for `templateAttachment` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<TemplateAttachment[]>} A promise that resolves to an array of `templateAttachment` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('template_attachments').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new TemplateAttachment(row));
        } catch (error) {
            Helper.logError('Error searching template attachments:', error);
            throw new QueryDBError('search');
        }
    }
}
