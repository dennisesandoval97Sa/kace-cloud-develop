import { v4 as uuidV4 } from 'uuid';
import { ActionJobProcessing } from '../../../src/action-job-processing';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class ActionJobProcessingMother {
    /**
     * Postgres exige que existan las filas padre de estas claves foraneas, y
     * esta factoria inventaba los ids sin respaldarlos con ninguna fila.
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo el id:
     * `ensureParentRow` es idempotente. Las columnas salen de pg_constraint.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            { table: 'cases', id: dto.case_id },
            { table: 'clients', id: dto.client_id },
            { table: 'actions', id: dto.action_id },
        ]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `ActionJobProcessing` entity.
     *
     * @param {Object} params - Optional parameters to override default values.
     * @returns {Object} The DTO containing the properties for an `ActionJobProcessing` entity.
     */
    static dto({
        id,
        job_id,
        action_id,
        restflow_id,
        case_id,
        client_id,
        is_in_progress,
        is_completed,
        is_failed,
        start_at,
        end_at,
        details,
        evaluate_conditions,
        created_by,
        created_at,
    } = {}) {
        return {
            id: id ?? uuidV4(),
            job_id: job_id ?? null,
            action_id: action_id ?? uuidV4(),
            restflow_id: restflow_id ?? null,
            case_id: case_id ?? uuidV4(),
            client_id: client_id ?? null,
            is_in_progress: is_in_progress ?? false,
            is_completed: is_completed ?? false,
            is_failed: is_failed ?? false,
            start_at: start_at ?? new Date().toISOString(),
            end_at: end_at ?? null,
            details: details ?? {},
            evaluate_conditions: evaluate_conditions ?? null,
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidV4(),
        };
    }

    /**
     * Creates an `ActionJobProcessing` instance and saves it to the repository.
     *
     * @param {KnexActionJobProcessingRepository} repository - The repository to save the `ActionJobProcessing` instance.
     * @param {Object} data - The data to create the `ActionJobProcessing` instance.
     * @returns {ActionJobProcessing} The created `ActionJobProcessing` instance.
     */
    static async create(repository, data = {}) {
        const dto = ActionJobProcessingMother.dto(data);
        await ActionJobProcessingMother.ensureRelations(repository.connection, dto);
        const actionExecution = ActionJobProcessing.create(dto);
        await repository.save(actionExecution);
        return actionExecution;
    }
}
