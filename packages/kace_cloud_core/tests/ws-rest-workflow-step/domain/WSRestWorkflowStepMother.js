import { v4 as uuidv4 } from 'uuid';
import { WSRestWorkflowStep } from '../../../src/ws-rest-workflow-step/domain/WSRestWorkflowStep.js';
import { ensureParentRows } from '../../support/ensureParentRow.js';
export class WSRestWorkflowStepMother {
    /**
     * Postgres exige que existan las filas padre de `flow_id`, `endpoint_id` y
     * `function_id`, y esta factoria lleva anos inventando ids con `uuidv4()`
     * sin respaldarlos con ninguna fila. Las tres columnas salen de
     * pg_constraint, no de mirar el dto: `conditional_id` lo parece y no tiene
     * clave foranea.
     *
     * `ensureParentRows` ignora los ids nulos y es idempotente, asi que da igual
     * llamarlo con un dto que solo rellene una de las tres.
     *
     * @param {import('knex').Knex} connection
     * @param {{flow_id: string, endpoint_id: ?string, function_id: ?string}} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            { table: 'ws_rest_flows', id: dto.flow_id },
            { table: 'ws_rest_endpoints', id: dto.endpoint_id },
            { table: 'ws_rest_functions', id: dto.function_id },
        ]);
    }

    static dto(endpoint_id = null, function_id = null) {
        return {
            id: uuidv4(),
            flow_id: uuidv4(),
            endpoint_id: endpoint_id || null,
            function_id: function_id || (endpoint_id ? null : uuidv4()), // Only set function_id if endpoint_id is not provided
            conditional_id: null,
            order: 1,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };
    }

    static dtoWithRelationshipOverride(endpoint_id = null, function_id = null) {
        return {
            id: uuidv4(),
            flow_id: uuidv4(),
            endpoint_id: endpoint_id || null,
            function_id: function_id || (endpoint_id ? null : uuidv4()), // Only set function_id if endpoint_id is not provided
            conditional_id: null,
            order: 1,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };
    }

    /**
     * Creates a `WSRestWorkflowStep` instance and saves it to the repository.
     *
     * @param {KnexWSRestWorkflowStepRepository} repository - The repository to save the `WSRestWorkflowStep` instance.
     * @param endpoint_id {Boolean} - The endpoint_id to set. If null,  it will not be generated.
     * @param function_id {Boolean} - The function_id to set. If null,  it will not be generated.
     * @returns {Promise<WSRestWorkflowStep>} The created `WSRestWorkflowStep` instance.
     */
    static async create(repository, endpoint_id = null, function_id = null) {
        const dto = WSRestWorkflowStepMother.dto(endpoint_id, function_id);
        await WSRestWorkflowStepMother.ensureRelations(repository.connection, dto);
        const wsRestWorkflowStep = WSRestWorkflowStep.create(dto);
        await repository.save(wsRestWorkflowStep);
        return wsRestWorkflowStep;
    }

    static async createEndpointStep(repository, options = {}) {
        const base = {
            id: uuidv4(),
            flow_id: uuidv4(),
            endpoint_id: null,
            function_id: null,
            conditional_id: null,
            order: 1,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };
        const dto = { ...base, ...options };
        await WSRestWorkflowStepMother.ensureRelations(repository.connection, dto);
        const wsRestWorkflowStep = WSRestWorkflowStep.create(dto);
        await repository.save(wsRestWorkflowStep);
        return wsRestWorkflowStep;
    }
}
