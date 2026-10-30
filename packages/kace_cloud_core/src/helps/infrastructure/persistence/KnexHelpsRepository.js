import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { CustomError } from '../../../shared/errors/CustomError.js';
import { Helps } from '../../domain/Helps.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexHelpsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'helps', readerConfig);
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
                titulo: dto.titulo.value,
                descripcion: dto.descripcion.value,
                color: dto.color.value,
                is_active: dto.is_active.value,
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
            const result = await this.read.table('helps').where({ id: id.value }).first('*');
            return !result ? null : new Helps(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
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
            const queryBuilder = this.read.table('helps').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((help) => new Helps(help));
        } catch (error) {
            Helper.logError('Error searching userList:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Updates the given `Help` instance in the database.
     *
     * @param {Helps} help - The `Help` instance to update.
     * @returns {Promise<void>} A promise that resolves when the `Help` instance is updated.
     */
    async update(help) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(help.changedAttributes).whereNull('deleted_by').where({ id: help.id.value });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Deletes the given `Helps` instance from the database.
     *
     * @param {Helps} help - The `Helps` instance to delete.
     * @returns {Promise<void>} A promise that resolves when the `Helps` instance is deleted.
     */
    async delete(help) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(help.changedAttributes).where({ id: help.id.value });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('delete');
        }
    }
}
