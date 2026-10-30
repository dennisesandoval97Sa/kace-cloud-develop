import { Helper, QueryDBError } from '../../../shared/index.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexAutomatedAssignmentBacklogSnapshotsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'automated_assignment_backlog_snapshots', readerConfig);
    }

    /**
     * @param {{ action_id: string, backlog: number, computed_at: Date, duration_ms: number }} snapshot
     * @returns {Promise<void>}
     */
    async upsert({ action_id, backlog, computed_at, duration_ms }) {
        try {
            DbRequestContext.markWrite();
            await this.table()
                .insert({ action_id, backlog, computed_at, duration_ms, updated_at: new Date() })
                .onConflict('action_id')
                .merge(['backlog', 'computed_at', 'duration_ms', 'updated_at']);
        } catch (error) {
            Helper.logError('Error upserting automated assignment backlog snapshot:', error);
            throw new QueryDBError('upsert');
        }
    }

    /**
     * @param {string[]} ids
     * @returns {Promise<Map<string, { backlog: number|null, computed_at: string }>>} computed_at en ISO
     */
    async findByActionIds(ids) {
        if (!ids || ids.length === 0) return new Map();
        try {
            const rows = await this.read
                .table(this.tableName)
                .select('action_id', 'backlog', 'computed_at')
                .whereIn('action_id', ids);
            return new Map(
                rows.map((row) => [
                    String(row.action_id),
                    {
                        backlog: row.backlog === null ? null : Number(row.backlog),
                        computed_at: new Date(row.computed_at).toISOString(),
                    },
                ])
            );
        } catch (error) {
            Helper.logError('Error reading automated assignment backlog snapshots:', error);
            throw new QueryDBError('findByActionIds');
        }
    }

    /**
     * @param {string[]} ids - reglas vigentes; con lista vacía borra todas las filas.
     * @returns {Promise<number>} filas borradas
     */
    async deleteNotIn(ids) {
        try {
            DbRequestContext.markWrite();
            const query = this.table();
            if (ids.length > 0) query.whereNotIn('action_id', ids);
            return await query.del();
        } catch (error) {
            Helper.logError('Error deleting stale automated assignment backlog snapshots:', error);
            throw new QueryDBError('deleteNotIn');
        }
    }
}
