import { UserGroupRelationship } from '../../index';
import { KnexRepository } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';
import { v4 as uuidV4 } from 'uuid';

export class KnexUserGroupRelationshipRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'rel_usuarios_grupos', readerConfig);
    }

    async startTransaction() {
        return this.connection.transaction();
    }

    /**
     * Saves a new userGroup in the database.
     * @param {UserGroupRelationship} userGroup
     * @param trx
     * @returns {Promise<void>}
     */
    async save(userGroup, trx = null) {
        DbRequestContext.markWrite();
        if (!trx) {
            trx = this.connection;
        }
        try {
            await this.trxTable(trx).insert({
                usuario_id: userGroup.usuario_id.value,
                grupo_id: userGroup.grupo_id.value,
            });
        } catch (error) {
            Helper.logError('Error saving user group relationship:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Find a user group relationship by ID.
     * @param {ValueObjectUuid} userId
     * @param {ValueObjectUuid} groupId
     * @returns {Promise<UserGroupRelationship | null>}
     */
    async find(userId, groupId) {
        try {
            const result = await this.read.table().where({ usuario_id: userId.value, grupo_id: groupId.value }).first();

            return result ? new UserGroupRelationship(result) : null;
        } catch (error) {
            Helper.logError('Error finding user group relationship:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `UserGroupRelationship` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<UserGroupRelationship[]>} A promise that resolves to an array of `UserGroupRelationship` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table());
            query
                .select(
                    'rel_usuarios_grupos.usuario_id',
                    'rel_usuarios_grupos.grupo_id',
                    'grupos.nombre',
                    this.read.raw(
                        "concat(trim( concat(usuarios.apellido1, ' ', usuarios.apellido2)), ' ', usuarios.nombres) as nombres"
                    )
                )
                .join(this.qualifiedName('grupos'), 'rel_usuarios_grupos.grupo_id', 'grupos.id')
                .join(this.qualifiedName('usuarios'), 'rel_usuarios_grupos.usuario_id', 'usuarios.id')
                .whereNull('usuarios.deleted_at')
                .whereNull('usuarios.deleted_by')
                .whereNull('grupos.deleted_at')
                .whereNull('grupos.deleted_by');

            const rows = await query;
            return rows.map((row) => new UserGroupRelationship(row));
        } catch (error) {
            Helper.logError('Error searching user group relationships:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of user group relationships based on the given criteria.
     * @param {Object} criteria - The criteria for the count operation.
     * @returns {Promise<number>} A promise that resolves to the count of `UserGroupRelationship` instances matching the criteria.
     */
    async count(criteria) {
        try {
            const query = criteria
                .convertToKnex(this.read.table().count())
                .join(this.qualifiedName('grupos'), 'rel_usuarios_grupos.grupo_id', 'grupos.id')
                .join(this.qualifiedName('usuarios'), 'rel_usuarios_grupos.usuario_id', 'usuarios.id')
                .whereNull('usuarios.deleted_at')
                .whereNull('usuarios.deleted_by')
                .whereNull('grupos.deleted_at')
                .whereNull('grupos.deleted_by');
            const [rows] = await query;

            return rows;
        } catch (error) {
            Helper.logError('Error counting user group relationships:', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Deletes a user group relationship from the database.
     * @param {UserGroupRelationship} userGroup
     * @param trx
     * @returns {Promise<void>}
     */
    async delete(userGroup, trx = null) {
        DbRequestContext.markWrite();
        if (!trx) {
            trx = this.connection;
        }
        try {
            await this.trxTable(trx)
                .where({
                    usuario_id: userGroup.usuario_id.value,
                    grupo_id: userGroup.grupo_id.value,
                })
                .del();
        } catch (error) {
            Helper.logError('Error deleting user group relationship:', error);
            throw new QueryDBError('delete');
        }
    }

    /**
     * Records a history row for a newly created user-group relationship.
     * entity_id = grupo_id (group-centric history axis).
     * @param {UserGroupRelationship} userGroup
     * @param {string} actorId
     * @param {string} createdAt - single timestamp shared across the whole block
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<void>}
     */
    async saveCreationHistory(userGroup, actorId, createdAt, trx = null) {
        DbRequestContext.markWrite();
        const relation = {
            usuario_id: userGroup.usuario_id.value,
            grupo_id: userGroup.grupo_id.value,
        };
        const data = {
            id: uuidV4(),
            entity_id: userGroup.grupo_id.value,
            changed_attributes: JSON.stringify(relation),
            new_attributes: JSON.stringify(relation),
            original_attributes: JSON.stringify({}),
            created_at: createdAt,
            created_by: actorId,
        };
        const table = trx
            ? this.trxTable(trx, 'history_rel_usuarios_grupos')
            : this.table('history_rel_usuarios_grupos');
        await table.insert(data);
    }

    /**
     * Records a history row for a deleted user-group relationship.
     * entity_id = grupo_id (group-centric history axis).
     * @param {UserGroupRelationship} userGroup
     * @param {string} actorId
     * @param {string} createdAt - single timestamp shared across the whole block
     * @param {import('knex').Knex.Transaction} [trx]
     * @returns {Promise<void>}
     */
    async saveDeletionHistory(userGroup, actorId, createdAt, trx = null) {
        DbRequestContext.markWrite();
        const relation = {
            usuario_id: userGroup.usuario_id.value,
            grupo_id: userGroup.grupo_id.value,
        };
        const data = {
            id: uuidV4(),
            entity_id: userGroup.grupo_id.value,
            changed_attributes: JSON.stringify({}),
            new_attributes: JSON.stringify({}),
            original_attributes: JSON.stringify(relation),
            created_at: createdAt,
            created_by: actorId,
        };
        const table = trx
            ? this.trxTable(trx, 'history_rel_usuarios_grupos')
            : this.table('history_rel_usuarios_grupos');
        await table.insert(data);
    }
}
