import { S3File } from '../../index';
import { KnexRepository } from '../../../shared';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexS3FileRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 's3_files', readerConfig);
    }

    /**
     * Saves a new S3 file in the database.
     * @param {S3File} file
     * @returns {Promise<void>}
     */
    async save(file) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: file.id.value,
                description: file.description.value,
                file_name: file.file_name.value,
                s3_file_name: file.s3_file_name.value,
                url: file.url.value,
                size: file.size.value,
                expired_at: file.expired_at.value,
                origin: file.origin.value,
                is_active: file.is_active.value,
                created_at: file.created_at.value,
                updated_at: file.updated_at.value,
                created_by: file.created_by.value,
                updated_by: file.updated_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving S3 file:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an S3 file by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<S3File | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('s3_files').where({ id: id.value }).first();

            return result ? new S3File(result) : null;
        } catch (error) {
            Helper.logError('Error finding S3 file:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `S3File` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<S3File[]>} A promise that resolves to an array of `S3File` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('s3_files').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new S3File(row));
        } catch (error) {
            Helper.logError('Error searching S3 files:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts S3 files matching the criteria. Read-only list counter routed to the replica.
     * @param {Object} criteria
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('s3_files').count());
            query.whereNull('s3_files.deleted_at');

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting S3 files:', error);
            throw new QueryDBError('count');
        }
    }
}
