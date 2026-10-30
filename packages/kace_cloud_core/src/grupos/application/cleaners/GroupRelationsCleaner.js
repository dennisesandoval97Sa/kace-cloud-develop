import { v4 as uuidV4 } from 'uuid';
import { Helper } from '../../../shared/index.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class GroupRelationsCleaner {
    #connection;
    #schema;

    /**
     * @param {import('knex').Knex} knexConnection
     */
    constructor(knexConnection) {
        this.#connection = knexConnection;
        this.#schema = knexConnection?.client?.config?.schema;
    }

    #qualify(table) {
        return this.#schema ? `${this.#schema}.${table}` : table;
    }

    /**
     * Hard-deletes all rel_usuarios_grupos rows for the given group and records
     * one history row per deleted relationship.
     *
     * @param {string} groupId
     * @param {{ actorId: string, reason: 'group_deleted' | 'group_deactivated', trx?: import('knex').Knex.Transaction }} ctx
     * @returns {Promise<number>} number of relationships removed
     */
    async execute(groupId, { actorId, reason, trx }) {
        const conn = trx ?? this.#connection;
        try {
            const rows = await conn(this.#qualify('rel_usuarios_grupos'))
                .where({ grupo_id: groupId })
                .select('usuario_id', 'grupo_id');

            if (rows.length === 0) return 0;

            const now = new Date().toISOString();
            const history = rows.map((row) => ({
                id: uuidV4(),
                condition: JSON.stringify({ groupId, reason }),
                changed_attributes: JSON.stringify({}),
                new_attributes: JSON.stringify({}),
                original_attributes: JSON.stringify(row),
                created_at: now,
                created_by: actorId,
            }));

            await conn(this.#qualify('rel_usuarios_grupos_history')).insert(history);
            await conn(this.#qualify('rel_usuarios_grupos')).where({ grupo_id: groupId }).del();

            return rows.length;
        } catch (error) {
            Helper.logError('Error cleaning user-group relationships', error);
            throw new QueryDBError('GroupRelationsCleaner.execute');
        }
    }
}
