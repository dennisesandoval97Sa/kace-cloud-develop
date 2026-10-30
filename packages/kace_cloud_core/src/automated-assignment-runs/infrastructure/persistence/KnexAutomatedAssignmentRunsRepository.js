import { Helper, QueryDBError } from '../../../shared/index.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';
import { AutomatedAssignmentRun } from '../../domain/AutomatedAssignmentRun.js';

const LIST_COLUMNS = [
    'id',
    'started_at',
    'finished_at',
    'duration_ms',
    'status',
    'actions_evaluated',
    'candidates_total',
    'candidates_backlog_total',
    'assigned',
    'skipped',
    'errors',
    'groups_without_capacity',
    'created_at',
];

export class KnexAutomatedAssignmentRunsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'automated_assignment_runs', readerConfig);
    }

    /**
     * @param {AutomatedAssignmentRun} run
     * @returns {Promise<void>}
     */
    async save(run) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: run.id.value,
                started_at: run.started_at.value,
                finished_at: run.finished_at.value,
                duration_ms: run.duration_ms.value,
                status: run.status.value,
                actions_evaluated: run.actions_evaluated.value,
                candidates_total: run.candidates_total.value,
                candidates_backlog_total: run.candidates_backlog_total.value,
                assigned: run.assigned.value,
                skipped: run.skipped.value,
                errors: run.errors.value,
                groups_without_capacity: run.groups_without_capacity.value,
                actions_detail: run.actions_detail.value ? JSON.stringify(run.actions_detail.value) : null,
                capacity_snapshot: run.capacity_snapshot.value ? JSON.stringify(run.capacity_snapshot.value) : null,
                error_detail: run.error_detail.value ? JSON.stringify(run.error_detail.value) : null,
            });
        } catch (error) {
            Helper.logError('Error saving AutomatedAssignmentRun:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * @param {ValueObjectUuid} id
     * @returns {Promise<AutomatedAssignmentRun | null>}
     */
    async find(id) {
        try {
            const row = await this.read.table(this.tableName).where({ id: id.value }).whereNull('deleted_at').first();
            return row ? new AutomatedAssignmentRun(row) : null;
        } catch (error) {
            Helper.logError('Error finding AutomatedAssignmentRun:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Listado liviano: solo columnas planas, sin los jsonb de detalle.
     * @param {Criteria} criteria
     * @returns {Promise<AutomatedAssignmentRun[]>}
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table(this.tableName).select(LIST_COLUMNS);
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_at');
            const rows = await queryBuilder;
            return rows.map((row) => new AutomatedAssignmentRun(row));
        } catch (error) {
            Helper.logError('Error searching AutomatedAssignmentRun:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * @param {Criteria} criteria - SIN limit/offset (el caller construye una criteria aparte).
     * @returns {Promise<{count: number}>}
     */
    async count(criteria) {
        try {
            const queryBuilder = this.read.table(this.tableName).count('id as count');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_at');
            const [row] = await queryBuilder;
            return { count: Number(row.count) };
        } catch (error) {
            Helper.logError('Error counting AutomatedAssignmentRun:', error);
            throw new QueryDBError('count');
        }
    }

    /**
     * Nombres de grupos para enriquecer el capacity_snapshot en la vista de detalle.
     * Best-effort: un fallo aquí no debe tumbar el find del run.
     * @param {string[]} ids
     * @returns {Promise<Map<string, string>>} grupo_id → nombre
     */
    async findGroupNames(ids) {
        try {
            if (!ids || ids.length === 0) return new Map();
            const rows = await this.read.table('grupos').select('id', 'nombre').whereIn('id', ids);
            return new Map(rows.map((row) => [String(row.id), row.nombre]));
        } catch (error) {
            Helper.logError('Error fetching group names for AutomatedAssignmentRun:', error);
            return new Map();
        }
    }

    /**
     * @param {string[]} ids
     * @returns {Promise<Map<string, string>>} usuario_id → "nombres apellido1"
     */
    async findUserNames(ids) {
        try {
            if (!ids || ids.length === 0) return new Map();
            const rows = await this.read.table('usuarios').select('id', 'nombres', 'apellido1').whereIn('id', ids);
            return new Map(rows.map((row) => [String(row.id), [row.nombres, row.apellido1].filter(Boolean).join(' ')]));
        } catch (error) {
            Helper.logError('Error fetching user names for AutomatedAssignmentRun:', error);
            return new Map();
        }
    }

    /**
     * Retención: borra ejecuciones con started_at anterior a N días. Best-effort en el caller.
     * @param {number} days
     * @returns {Promise<number>} filas borradas
     */
    async purgeOlderThan(days) {
        try {
            DbRequestContext.markWrite();
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            return await this.table().where('started_at', '<', cutoff).del();
        } catch (error) {
            Helper.logError('Error purging AutomatedAssignmentRun:', error);
            throw new QueryDBError('purgeOlderThan');
        }
    }
}
