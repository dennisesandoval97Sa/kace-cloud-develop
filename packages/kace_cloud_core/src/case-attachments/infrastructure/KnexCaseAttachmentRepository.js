import { CaseAttachment } from '..';
import { KnexRepository } from '../../shared/index';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';

export class KnexCaseAttachmentRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'case_attachments', readerConfig);
    }

    /**
     * Saves a new case attachment record in the database.
     * @param {CaseAttachment} caseAttachment
     * @returns {Promise<void>}
     */
    async save(caseAttachment) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: caseAttachment.id.value,
                case_id: caseAttachment.case_id.value,
                description: caseAttachment.description.value,
                size: caseAttachment.size.value,
                path: caseAttachment.path.value,
                type: caseAttachment.type.value,
                is_active: caseAttachment.is_active.value,
                attachment_type: caseAttachment.attachment_type ?? null,
                created_at: caseAttachment.created_at.value,
                created_by: caseAttachment.created_by.value,
            });
        } catch (error) {
            Helper.logInfo('Error saving case attachments', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a case attachment record by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<CaseAttachment | null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();

            return result ? new CaseAttachment(result) : null;
        } catch (error) {
            Helper.logInfo('Error finding case attachments', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `CaseAttachment` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<CaseAttachment[]>} A promise that resolves to an array of `CaseAttachment` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('case_attachments').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new CaseAttachment(row));
        } catch (error) {
            Helper.logInfo('Error searching case attachments', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Finds active, non-deleted case attachments for a case.
     *
     * @param {string} caseId
     * @returns {Promise<CaseAttachment[]>}
     */
    async findActiveByCaseId(caseId) {
        try {
            const rows = await this.table()
                .select('*')
                .where({ case_id: caseId, is_active: true })
                .whereNull('deleted_by')
                .whereNull('deleted_at');

            return rows.map((row) => new CaseAttachment(row));
        } catch (error) {
            Helper.logInfo('Error finding active case attachments', error);
            throw new QueryDBError('findActiveByCaseId');
        }
    }

    /**
     * Counts case attachments matching the criteria. Read-only list counter routed to the replica.
     * @param {Object} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('case_attachments').count());
            query.whereNull('case_attachments.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logInfo('Error counting case attachments', error);
            throw new QueryDBError('count');
        }
    }
}
