import { GroupList } from '../../index';
import { KnexRepository } from '../../../shared/index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexGroupListsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'lista_grupos', readerConfig);
    }

    /**
     * Save a new GroupList to the database.
     *
     * @param {GroupList} groupList
     * @returns {Promise<void>}
     * @throws {Error} If the operation fails.
     */
    async save(groupList) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: groupList.id.value,
                descripcion: groupList.descripcion.value,
                lista_grupos: JSON.stringify(groupList.lista_grupos.value),
                is_active: groupList.is_active.value,
                created_at: groupList.created_at.value,
                created_by: groupList.created_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving groupList:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Find a groupList by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<GroupList | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('lista_grupos').where({ id: id.value }).first();

            return result ? new GroupList(result) : null;
        } catch (error) {
            Helper.logError('Error finding groupList:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates an existing groupList.
     * @param {GroupList} groupList
     * @returns {Promise<void>}
     */
    async update(groupList) {
        if (Object.keys(groupList.changedAttributes).length === 0) {
            return;
        }
        groupList.changedAttributes.lista_grupos = JSON.stringify(groupList.changedAttributes.lista_grupos);
        try {
            DbRequestContext.markWrite();
            await this.table().update(groupList.changedAttributes).where({ id: groupList.id.value });
        } catch (error) {
            Helper.logError('Error updating groupList:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Searches for `GroupList` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<GroupList[]>} A promise that resolves to an array of `GroupList` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('lista_grupos').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new GroupList(row));
        } catch (error) {
            Helper.logError('Error searching groupList:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of groupList based on the given criteria.
     * @param {Object} criteria - The criteria for the count operation.
     * @returns {Promise<number>} A promise that resolves to the count of `GroupList` instances matching the criteria.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('lista_grupos').count());
            const [rows] = await query;

            // pg nombra la columna `count` y la entrega como string; `count(*)` era el alias
            // de mysql y aqui resolvia undefined siempre.
            return Number(rows.count);
        } catch (error) {
            Helper.logError('Error counting groupList:', error);
            throw new QueryDBError('count');
        }
    }
}
