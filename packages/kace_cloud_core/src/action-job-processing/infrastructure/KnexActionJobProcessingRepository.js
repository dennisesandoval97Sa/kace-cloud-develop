import { ActionJobProcessing } from '..';
import { KnexRepository, QueryDBError } from '../../shared/index';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';

export class KnexActionJobProcessingRepository extends KnexRepository {
    constructor(config) {
        super(config, 'action_job_processing');
    }

    /**
     * Saves a new ActionJobProcessing record in the database.
     * @param {ActionJobProcessing} actionExecution
     * @returns {Promise<void>}
     */
    async save(actionExecution, trx = null) {
        if (!trx) {
            trx = this.connection;
        }
        try {
            await this.trxTable(trx).insert({
                id: actionExecution.id.value,
                job_id: actionExecution.job_id.value,
                action_id: actionExecution.action_id.value,
                restflow_id: actionExecution.restflow_id.value,
                case_id: actionExecution.case_id.value,
                client_id: actionExecution.client_id.value,
                is_in_progress: actionExecution.is_in_progress.value,
                is_completed: actionExecution.is_completed.value,
                is_failed: actionExecution.is_failed.value,
                start_at: actionExecution.start_at.value,
                end_at: actionExecution.end_at.value,
                details: JSON.stringify(actionExecution.details.value),
                evaluate_conditions: actionExecution.evaluate_conditions.value,
                created_by: actionExecution.created_by.value,
                created_at: actionExecution.created_at.value,
            });
        } catch (error) {
            Helper.logError('Error saving ActionJobProcessing:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a ActionJobProcessing record by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<ActionJobProcessing | null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();

            return result ? new ActionJobProcessing(result) : null;
        } catch (error) {
            Helper.logError('Error finding ActionJobProcessing:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds a ActionJobProcessing by BatchExecutionId.
     *
     * El filtro es por estado (ni en curso, ni completada, ni fallida), asi que una ejecucion
     * marcada para reintento sigue saliendo. `excludeIds` es lo que permite paginar sin volver
     * a traerlas: quien recorre el lote acumula lo que ya ha visto en esta pasada.
     *
     * @param {ValueObjectUuid} jobId
     * @param {number|null} [limit=null]
     * @param {string[]} [excludeIds=[]] - ids ya procesados en esta pasada
     * @returns {Promise<ActionJobProcessing[]>}
     */
    async findByBatchExecutionId(jobId, limit = null, excludeIds = []) {
        try {
            let query = this.table()
                .where({
                    is_in_progress: false,
                    is_completed: false,
                    is_failed: false,
                    job_id: jobId.value,
                })
                .whereNull('deleted_at')
                .orderBy('created_at', 'asc');

            if (excludeIds.length) {
                query = query.whereNotIn('id', excludeIds);
            }

            if (limit && limit > 0) {
                query = query.limit(limit);
            }

            const rows = await query;
            return rows.map((row) => new ActionJobProcessing(row));
        } catch (error) {
            Helper.logError('Error searching ActionJobProcessings:', error);
            throw new QueryDBError('find');
        }
    }

    async findPending(limit = 25) {
        try {
            const rows = await this.table()
                .where({ is_in_progress: false, is_completed: false, is_failed: false })
                .whereNull('deleted_at')
                .orderBy('created_at', 'asc')
                .limit(limit);

            return rows.map((row) => new ActionJobProcessing(row));
        } catch (error) {
            Helper.logError('Error find pending ActionJobProcessings:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for ActionJobProcessing instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<ActionJobProcessing[]>} A promise that resolves to an array of ActionJobProcessing instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.table().select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new ActionJobProcessing(row));
        } catch (error) {
            Helper.logError('Error searching ActionJobProcessings:', error);
            throw new QueryDBError('search');
        }
    }
}
