import { Ans } from '../../index.js';
import { Helper, KnexRepository } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexAnsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'ans', readerConfig);
    }

    /**
     * Saves the given `Ans` instance to the database.
     *
     * @param {Ans} ans - The `Ans` instance to save.
     * @returns {Promise<void>} A promise that resolves when the `Ans` instance is saved.
     */
    async save(ans) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: ans.id.value,
                nombre: ans.nombre.value,
                intermedio: ans.intermedio.value,
                vencido: ans.vencido.value,
                color_ans_inicial: ans.color_ans_inicial.value,
                color_ans_intermedio: ans.color_ans_intermedio.value,
                color_ans_final: ans.color_ans_final.value,
                status: ans.status.value,
                medicion_ans_id: ans.medicion_ans_id.value,
                created_at: ans.created_at.value,
                updated_at: ans.updated_at.value,
                created_by: ans.created_by.value,
                updated_by: ans.updated_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving ans:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an `Ans` instance by its ID.
     *
     * @param {Object} id - The ID of the `Ans` instance to find.
     * @returns {Promise<Ans|null>} The found `Ans` instance or `null` if not found.
     */
    async find(id) {
        try {
            const result = await this.read.table('ans').where({ id: id.value }).first('*');
            return !result ? null : new Ans(result);
        } catch (error) {
            Helper.logError('Error finding ans:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates the given `Ans` instance in the database.
     *
     * @param {Ans} ans - The `Ans` instance to update.
     * @returns {Promise<void>} A promise that resolves when the `Ans` instance is updated.
     */
    async update(ans) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(ans.changedAttributes).where({ id: ans.id.value });
        } catch (error) {
            Helper.logError('Error updating ans:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Deletes the given `Ans` instance from the database.
     *
     * @param {Ans} ans - The `Ans` instance to delete.
     * @returns {Promise<void>} A promise that resolves when the `Ans` instance is deleted.
     */
    async delete(ans) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(ans.changedAttributes).where({ id: ans.id.value });
        } catch (error) {
            Helper.logError('Error deleting ans:', error);
            throw new QueryDBError('delete');
        }
    }

    /**
     * Searches for `Ans` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Ans[]>} A promise that resolves to an array of `Ans` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('ans').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');
            const rows = await queryBuilder;
            return rows.map((row) => new Ans(row));
        } catch (error) {
            Helper.logError('Error searching ans:', error);
            throw new QueryDBError('search');
        }
    }

    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('ans').count());
            query.whereNull(`deleted_at`);

            const [count] = await query;
            return count;
        } catch (error) {
            Helper.logError('Error counting ans:', error);
            throw new QueryDBError('count');
        }
    }
}
