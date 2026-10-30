import { Comment } from '../../domain/Comment.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import Creator from '../../../shared/domain/aggregates/Creator.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexCommentsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'comentarios', readerConfig);
    }

    /**
     * Saves the given `Comment` instance to the database.
     *
     * NOTE: `saveHistory` is inherited from KnexRepository and is already transactional via
     * its third argument. If it is ever overridden here it MUST keep accepting and
     * propagating `trx`, otherwise the history row would escape the caller's transaction.
     *
     * @param {Comment} comment - The `Comment` instance to save.
     * @param {import('knex').Knex.Transaction|null} [trx] - Optional transaction to run the insert within.
     * @returns {Promise<void>} A promise that resolves when the `Comment` instance is saved.
     *
     */
    async save(comment, trx = null) {
        try {
            DbRequestContext.markWrite();
            if (!trx) {
                trx = this.connection;
            }
            await this.trxTable(trx).insert({
                id: comment.id.value,
                descripcion: comment.descripcion.value,
                calificacion: comment.calificacion.value,
                caso_id: comment.caso_id.value,
                created_at: comment.created_at.value,
                updated_at: comment.updated_at.value,
                created_by: comment.created_by.value,
                updated_by: comment.updated_by.value,
            });
        } catch (error) {
            Helper.logInfo('Error saving comment:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an `Comment` instance by its ID.
     *
     * @param {Object} id - The ID of the `Comment` instance to find.
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<Comment|null>} The found `Comment` instance or `null` if not found.
     */
    async find(id, trx = null) {
        try {
            const result = await (trx ? this.trxTable(trx) : this.read.table('comentarios'))
                .first('*')
                .where({ id: id.value });
            if (!result) {
                return null;
            }
            return new Comment(result);
        } catch (error) {
            Helper.logInfo('Error finding comment:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates the given `Comment` instance in the database.
     *
     * @param {Comment} comment - The `Comment` instance to update.
     * @returns {Promise<void>} A promise that resolves when the `Comment` instance is updated.
     */
    async update(comment) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(comment.changedAttributes).where({ id: comment.id.value });
        } catch (error) {
            Helper.logInfo('Error updating comment:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Deletes the given `Comment` instance from the database.
     *
     * @param {Comment} comment - The `Comment` instance to delete.
     * @returns {Promise<void>} A promise that resolves when the `Comment` instance is deleted.
     */
    async delete(comment) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(comment.changedAttributes).where({ id: comment.id.value });
        } catch (error) {
            Helper.logInfo('Error deleting comment:', error);
            throw new QueryDBError('delete');
        }
    }

    /**
     * Searches for `Comment` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Comment[]>} A promise that resolves to an array of `Comment` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read
                .table('comentarios')
                .select(
                    `${this.tableName}.id as id`,
                    `${this.tableName}.descripcion as descripcion`,
                    `${this.tableName}.calificacion as calificacion`,
                    `${this.tableName}.caso_id as caso_id`,
                    `${this.tableName}.created_at as created_at`,
                    `${this.tableName}.created_by as created_by`,
                    `${this.tableName}.updated_at as updated_at`,
                    `${this.tableName}.updated_by as updated_by`,
                    'usuarios.id as creator_id',
                    'usuarios.nombres',
                    'usuarios.apellido1',
                    'usuarios.apellido2'
                )
                .leftJoin(this.qualifiedName('usuarios'), `${this.tableName}.created_by`, 'usuarios.id');

            criteria.convertToKnex(queryBuilder, this.tableName);

            const rows = await queryBuilder;

            return rows.map((row) => new Comment({ ...row, id: row.id }, new Creator({ ...row, id: row.creator_id })));
        } catch (error) {
            Helper.logInfo(`Error searching comments: ${error}`);
            throw new QueryDBError('search');
        }
    }

    async count(criteria) {
        try {
            const queryBuilder = this.read.table('comentarios').count('* as count');

            criteria.convertToKnex(queryBuilder, this.tableName);

            const rows = await queryBuilder;
            return rows[0].count;
        } catch (error) {
            Helper.logInfo('Error counting comments:', error);
            throw new QueryDBError('count');
        }
    }
}
