import { KnexRepository } from '../../../shared';
import { State } from '../../index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexStateRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'estados', readerConfig);
    }

    /**
     * Saves the given `State` instance to the database.
     *
     * @param {State} state - The `State` instance to save.
     * @returns {Promise<void>} A promise that resolves when the `State` instance is saved.
     */
    async save(state) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: state.id.value,
                nombre: state.nombre.value,
                descripcion: state.descripcion.value,
                icon_class: state.icon_class.value,
                status: state.status.value,
                color: state.color.value,
                require_observation: state.require_observation.value,
                created_by: state.created_by.value,
                updated_by: state.updated_by.value,
                created_at: state.created_at.value,
                updated_at: state.updated_at.value,
            });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an `State` instance by its ID.
     *
     * @param {Object} id - The ID of the `State` instance to find.
     * @returns {Promise<State|null>} The found `State` instance or `null` if not found.
     */
    async find(id) {
        try {
            const result = await this.read.table('estados').where({ id: id.value }).whereNull('deleted_by').first('*');

            return !result ? null : new State(result);
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates the given `State` instance in the database.
     *
     * @param {State} state - The `State` instance to update.
     * @returns {Promise<void>} A promise that resolves when the `State` instance is updated.
     */
    async update(state) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(state.changedAttributes).whereNull('deleted_by').where({ id: state.id.value });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Deletes the given `State` instance from the database.
     *
     * @param {State} state - The `{State}` instance to delete.
     * @returns {Promise<void>} A promise that resolves when the `State` instance is deleted.
     */
    async delete(state) {
        try {
            DbRequestContext.markWrite();
            await this.table().update(state.changedAttributes).where({ id: state.id.value });
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('delete');
        }
    }

    /**
     * Searches for `State` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<State[]>} A promise that resolves to an array of `State` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('estados').select('*'));
            const rows = await query;
            return rows.map((row) => new State(row));
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counter for `State` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<Count>} A promise that resolves to an array of `State` instances matching the criteria.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('estados').count());
            const [count] = await query;

            return count;
        } catch (error) {
            Helper.logInfo(error);
            throw new QueryDBError('count');
        }
    }
}
