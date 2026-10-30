import { WSRestFlowExecution } from '../../domain/WSRestFlowExecution.js';
import { KnexRepository } from '../../../shared/index.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class KnexWSRestFlowExecutionRepository extends KnexRepository {
    constructor(config) {
        super(config, 'ws_rest_flow_executions');
    }

    /**
     * Saves a new execution record.
     * @param {WSRestFlowExecution} execution
     * @returns {Promise<WSRestFlowExecution>}
     */
    async save(execution) {
        try {
            await this.table().insert({
                id: execution.id.value,
                flow_id: execution.flow_id.value,
                external_code: execution.external_code.value,
                initial_context: JSON.stringify(execution.initial_context.value),
                status: execution.status.value,
                result: execution.result.value ? JSON.stringify(execution.result.value) : null,
                error: execution.error.value ? JSON.stringify(execution.error.value) : null,
                created_by: execution.created_by?.value,
                created_at: execution.created_at?.value || new Date(),
                started_at: execution.started_at.value,
                completed_at: execution.completed_at.value,
            });
            return execution;
        } catch (error) {
            Helper.logError(`Error saving WS REST flow execution: ${error}`);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds an execution by ID.
     * @param {string|{value: string}} id
     * @returns {Promise<WSRestFlowExecution|null>}
     */
    async find(id) {
        try {
            const idValue = typeof id === 'object' ? id.value : id;
            const result = await this.table().where({ id: idValue }).first();
            return result ? new WSRestFlowExecution(result) : null;
        } catch (error) {
            Helper.logError('Error finding WS REST flow execution:', error);
            throw new QueryDBError('find');
        }
    }
}
