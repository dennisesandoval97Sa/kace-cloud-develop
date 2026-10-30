import { v4 as uuidv4 } from 'uuid';
import { StatusEnum } from '../../../src/actions-queue-executions/domain/enum/StatusEnum';
import { ActionTriggers } from '../../../src/shared/domain/enum/ActionTriggersEnum';
import { ActionsQueueExecutions } from '../../../src/actions-queue-executions/domain/ActionsQueueExecutions';
import { ensureParentRow } from '../../support/ensureParentRow.js';

export class ActionsQueueExecutionsMother {
    static dto({
        action_id,
        case_id,
        client_id,
        status,
        trigger_type,
        start_execution = null,
        end_execution = null,
    } = {}) {
        return {
            id: uuidv4(),
            action_id: action_id || uuidv4(),
            case_id: case_id || uuidv4(),
            client_id: client_id || uuidv4(),
            status: status || StatusEnum.PENDING.value,
            trigger_type: trigger_type || ActionTriggers.CRON_JOB.value,
            start_execution: start_execution ?? new Date(),
            end_execution: end_execution ?? new Date(Date.now() + 86400000),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    /**
     * Create a new ActionsQueueExecutions object with the given properties
     *
     * @param {KnexActionsQueueExecutionsRepository} repository - The repository to save the object
     * @param {Object} overrideDto - The properties to override in the default DTO
     * @returns {Promise<ActionsQueueExecutions>} The created ActionsQueueExecutions object
     */
    static async create(repository, overrideDto) {
        const dto = this.dto(overrideDto);
        // Se garantiza SIEMPRE la fila padre, tambien cuando el llamador fijo `action_id`:
        // `ensureParentRow` es idempotente (`onConflict('id').ignore()`), asi que respaldar
        // un id que ya existe no pisa nada, mientras que saltarselo deja el insert al borde
        // de una violacion de clave foranea. Una version anterior lo omitia si el llamador
        // fijaba el id, asumiendo que ya habria creado la fila; casi siempre es un uuid
        // inventado que no respalda nada.
        await ensureParentRow(repository.connection, 'actions', dto.action_id);
        const actionQueueExecution = ActionsQueueExecutions.create(dto);
        await repository.save(actionQueueExecution);
        return actionQueueExecution;
    }
}
