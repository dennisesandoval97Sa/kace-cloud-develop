import { KnexRepository } from '../../shared/infrastructure/persistence/KnexRepository.js';
import { CustomError } from '../../shared/errors/CustomError.js';
import { HelpsAttachments } from '../domain/HelpsAttachments.js';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../shared/infrastructure/context/DbRequestContext.js';

export class KnexHelpsAttachmentsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'helps_attachments', readerConfig);
    }

    /**
     *
     * @param {object} dto data to save
     * @returns {Promise<void>}
     */
    async save(dto) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: dto.id.value,
                path: dto.path.value,
                tipo: dto.tipo.value,
                help_id: dto.help_id.value,
                created_at: dto.created_at.value,
                created_by: dto.created_by.value,
            });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     *
     * @param {ValueObjectUuid} id
     * @returns {Promise<Helps>}
     * @throws {CustomError}
     */
    async find(id) {
        try {
            const result = await this.read.table('helps_attachments').where({ id: id.value }).first('*');
            return !result ? null : new HelpsAttachments(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Deletes the given `HelpsAttachment` instance from the database.
     *
     * @param {HelpsAttachments} helpAttachment - The `HelpsAttachment` instance to delete.
     * @returns {Promise<void>} A promise that resolves when the `HelpsAttachment` instance is deleted.
     */
    async delete(helpAttachment) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(helpAttachment.changedAttributes).where({ id: helpAttachment.id.value });
        } catch (error) {
            Helper.logError('Error searching userList:', error);
            throw new QueryDBError('delete');
        }
    }

    /**
     *
     * @param {Criteria} criteria
     * @returns {Promise<Helps[]>}
     * @throws {CustomError}
     */
    async search(criteria) {
        try {
            const helpsAttachments = await criteria.convertToKnex(
                this.read.table('helps_attachments').select('*').whereNull('deleted_by')
            );
            return helpsAttachments.map((help) => new HelpsAttachments(help));
        } catch (error) {
            Helper.logError('Error searching userList:', error);
            throw new QueryDBError('search');
        }
    }
}
