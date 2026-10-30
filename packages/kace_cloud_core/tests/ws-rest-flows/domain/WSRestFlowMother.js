import { v4 as uuidv4 } from 'uuid';
import { WSRestFlow } from '../../../src/ws-rest-flows';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class WSRestFlowMother {
    /**
     * Los nodos de un diagrama acaban en `ws_rest_workflow_steps.endpoint_id` y
     * `.function_id`, que son claves foraneas reales contra `ws_rest_endpoints`
     * y `ws_rest_functions`. Los tests inventan esos ids con `uuid()` dentro
     * del propio archivo y nunca los respaldaron: sqlite no comprobaba la clave
     * foranea y postgres si.
     *
     * El reparto copia el de `WSRestFlowStepManager.generateStepsForFlow`, que
     * es quien decide en que columna cae cada nodo: `function` va a
     * `function_id`, `conditional` a `conditional_id` -que no tiene clave
     * foranea pese a parecerlo- y TODO LO DEMAS a `endpoint_id`. Por eso aqui
     * no se filtra por `data.type === 'endpoint'`: los nodos `task` o
     * `standard` tambien acaban en `ws_rest_endpoints`. Se saltan los mismos
     * que se salta el generador: el nodo de entrada y el nodo `'0'`.
     *
     * Es idempotente, asi que da igual llamarlo dos veces con el mismo
     * diagrama, y los nodos sin `data.id` los ignora `ensureParentRow`.
     *
     * @param {import('knex').Knex} connection
     * @param {?{nodes?: Array<Object>}} diagram
     * @returns {Promise<void>}
     */
    static async ensureDiagramRelations(connection, diagram) {
        const rows = (diagram?.nodes ?? []).flatMap((node) => {
            if (!node?.data || node.type === 'input' || node.id === '0' || node.data.type === 'conditional') {
                return [];
            }

            const table = node.data.type === 'function' ? 'ws_rest_functions' : 'ws_rest_endpoints';

            return [{ table, id: node.data.id }];
        });

        await ensureParentRows(connection, rows);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `WSRestFlow` entity.
     *
     * @returns {Object} The DTO containing the properties for a `WSRestFlow` entity.
     */
    static dto({ id, description, external_code, json_diagram_properties, created_at, created_by } = {}) {
        return {
            id: id ?? uuidv4(),
            description: description ?? `Default flow description ${uuidv4()}`,
            external_code: external_code ?? `flow_external_code_${uuidv4()}`,
            json_diagram_properties: json_diagram_properties ?? {
                nodes: [{ id: uuidv4(), data: { label: 'Node 1' } }],
            },
            is_active: true,
            is_primary: true,
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
        };
    }

    /**
     * Creates a `WSRestFlow` instance and saves it to the repository.
     *
     * @param {KnexWSRestFlowRepository} repository - The repository to save the `WSRestFlow` instance.
     * @param data
     * @returns {Promise<WSRestFlow>} The created `WSRestFlow` instance.
     */
    static async create(repository, data = {}) {
        const wsRestFlow = WSRestFlow.create(WSRestFlowMother.dto(data));
        await repository.save(wsRestFlow);
        return wsRestFlow;
    }
}
