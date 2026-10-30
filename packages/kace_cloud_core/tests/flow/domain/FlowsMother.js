import { v4 as uuidv4 } from 'uuid';
import { Flow } from '../../../src/flow';
import Chance from 'chance';
import { StatusEnum } from '../../../src/shared';
import TestHelper from '../../TestHelper.js';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class FlowsMother {
    /**
     * `createRelationshipWithCase` inventa con `uuidv4()` los ids de estados,
     * cliente, responsable, clasificacion y descripcion, sin crear ninguna de las
     * filas padre; postgres exige que existan.
     *
     * Se garantizan SIEMPRE: `ensureParentRow` es idempotente y las columnas salen
     * de pg_constraint sobre `transiciones` y `cases`.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} transitionPayload - Fila que se insertara en `transiciones`.
     * @param {Object} casePayload - Fila que se insertara en `cases`.
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, transitionPayload, casePayload) {
        await ensureParentRows(connection, [
            { table: 'estados', id: transitionPayload.estado_actual_id },
            { table: 'estados', id: transitionPayload.siguiente_estado_id },
            { table: 'clients', id: casePayload.cliente_id },
            { table: 'usuarios', id: casePayload.responsable_id },
            { table: 'clasificaciones', id: casePayload.clasificacion_id },
            { table: 'descripciones_casos', id: casePayload.descripcion_caso_id },
        ]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `Flows` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Flows` entity.
     */
    static dto(override = {}) {
        const id = uuidv4();
        return {
            id: id,
            nombre: `Flujo Test ${id.replace(/[^a-zA-Z]/g, '')}`,
            json_flujo: JSON.parse(
                '{"edges": [{"id": "reactflow__edge-0-80a3f536-82dc-43a9-907a-c7a51e5b34b0top", "source": "0", "target": "80a3f536-82dc-43a9-907a-c7a51e5b34b0", "sourceHandle": null, "targetHandle": "top", "kace_transition": "285fed11-d90e-4843-9450-129821ee9291"}, {"id": "reactflow__edge-80a3f536-82dc-43a9-907a-c7a51e5b34b0bottom-51db0292-c81e-42e4-97d8-5cdf497bb16ctop", "source": "80a3f536-82dc-43a9-907a-c7a51e5b34b0", "target": "51db0292-c81e-42e4-97d8-5cdf497bb16c", "sourceHandle": "bottom", "targetHandle": "top", "kace_transition": "a9a3cbba-17f8-42c3-a140-7d92abeb27b1"}], "nodes": [{"id": "0", "data": {"label": "inicio"}, "type": "input", "width": 150, "height": 40, "dragging": false, "position": {"x": 300, "y": 0}, "selected": false, "positionAbsolute": {"x": 0, "y": 0}}, {"id": "80a3f536-82dc-43a9-907a-c7a51e5b34b0", "data": {"label": "Compra"}, "type": "custom", "style": {"color": "#A100C2", "border": "2px solid #A100C2", "background": "rgba(208, 192, 247, 0.5)", "fontWeight": "bold"}, "width": 4, "height": 4, "dragging": false, "position": {"x": 389, "y": 114}, "selected": false, "positionAbsolute": {"x": 0, "y": 0}}, {"id": "51db0292-c81e-42e4-97d8-5cdf497bb16c", "data": {"label": "Finalizado"}, "type": "custom", "style": {"color": "#A100C2", "border": "2px solid #A100C2", "background": "rgba(208, 192, 247, 0.5)", "fontWeight": "bold"}, "width": 4, "height": 4, "dragging": false, "position": {"x": 375, "y": 230}, "selected": false, "positionAbsolute": {"x": 0, "y": 0}}]}'
            ),
            status: 1,
            created_at: new Date().toISOString(),
            created_by: id,
            ...override,
        };
    }
    /**
     * Creates an `Flows` instance and saves it to the repository.
     *
     * @param {KnexFlowRepository} repository - The repository to save the `Flows` instance.
     * @returns {Flow} The created `Flows` instance.
     */
    static async createFlow(repository, override = {}) {
        const flow = Flow.create(FlowsMother.dto(override));
        await repository.save(flow);
        return flow;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `Flow` entity.
     *
     * @returns {Object} The DTO containing random properties for a `Flow` entity.
     */
    static randomDto() {
        const chance = new Chance();
        return {
            id: uuidv4(),
            nombre: TestHelper.generateSafeValue(() => chance.string({ length: 10, alpha: true })),
            json_flujo: JSON.parse(
                '{"nodes":[{"id":"0","type":"input","position":{"x":300,"y":0},"data":{"label":"inicio"},"selected":false,"positionAbsolute":{"x":0,"y":0},"dragging":false,"width":150,"height":40},{"id":"ba209c41-9311-4482-9c57-2398a0d1296a","position":{"x":175,"y":74},"data":{"label":"Radicado"},"selected":false,"positionAbsolute":{"x":175,"y":74},"dragging":false,"style":{"background":"rgba(208, 192, 247, 0.5)","color":"#A100C2","fontWeight":"bold","border":"2px solid #A100C2"},"width":150,"height":41},{"id":"b2c44291-18c4-4af2-9888-a7ddb0430b66","position":{"x":444,"y":126},"data":{"label":"En Trámite"},"selected":false,"positionAbsolute":{"x":444,"y":126},"dragging":false,"style":{"background":"rgba(208, 192, 247, 0.5)","color":"#A100C2","fontWeight":"bold","border":"2px solid #A100C2"},"width":150,"height":41},{"id":"5d51b141-1967-4fcb-ad8a-061c0b884f87","position":{"x":333,"y":234},"data":{"label":"Finalizado"},"selected":false,"positionAbsolute":{"x":333,"y":234},"dragging":false,"style":{"background":"rgba(208, 192, 247, 0.5)","color":"#A100C2","fontWeight":"bold","border":"2px solid #A100C2"},"width":150,"height":41},{"id":"0","type":"input","position":{"x":300,"y":0},"data":{"label":"inicio"},"selected":false,"positionAbsolute":{"x":0,"y":0},"dragging":false,"width":150,"height":40},{"id":"ba209c41-9311-4482-9c57-2398a0d1296a","position":{"x":175,"y":74},"data":{"label":"Radicado"},"selected":false,"positionAbsolute":{"x":175,"y":74},"dragging":false,"style":{"background":"rgba(208, 192, 247, 0.5)","color":"#A100C2","fontWeight":"bold","border":"2px solid #A100C2"},"width":150,"height":41},{"id":"b2c44291-18c4-4af2-9888-a7ddb0430b66","position":{"x":444,"y":126},"data":{"label":"En Trámite"},"selected":false,"positionAbsolute":{"x":444,"y":126},"dragging":false,"style":{"background":"rgba(208, 192, 247, 0.5)","color":"#A100C2","fontWeight":"bold","border":"2px solid #A100C2"},"width":150,"height":41},{"id":"5d51b141-1967-4fcb-ad8a-061c0b884f87","position":{"x":333,"y":234},"data":{"label":"Finalizado"},"selected":false,"positionAbsolute":{"x":333,"y":234},"dragging":false,"style":{"background":"rgba(208, 192, 247, 0.5)","color":"#A100C2","fontWeight":"bold","border":"2px solid #A100C2"},"width":150,"height":41}],"edges":[{"source":"0","sourceHandle":null,"target":"ba209c41-9311-4482-9c57-2398a0d1296a","targetHandle":null,"id":"reactflow__edge-0-ba209c41-9311-4482-9c57-2398a0d1296a"},{"source":"0","sourceHandle":null,"target":"b2c44291-18c4-4af2-9888-a7ddb0430b66","targetHandle":null,"id":"reactflow__edge-0-b2c44291-18c4-4af2-9888-a7ddb0430b66"},{"source":"b2c44291-18c4-4af2-9888-a7ddb0430b66","sourceHandle":null,"target":"5d51b141-1967-4fcb-ad8a-061c0b884f87","targetHandle":null,"id":"reactflow__edge-b2c44291-18c4-4af2-9888-a7ddb0430b66-5d51b141-1967-4fcb-ad8a-061c0b884f87"},{"source":"ba209c41-9311-4482-9c57-2398a0d1296a","sourceHandle":null,"target":"5d51b141-1967-4fcb-ad8a-061c0b884f87","targetHandle":null,"id":"reactflow__edge-ba209c41-9311-4482-9c57-2398a0d1296a-5d51b141-1967-4fcb-ad8a-061c0b884f87"},{"source":"0","sourceHandle":null,"target":"5d51b141-1967-4fcb-ad8a-061c0b884f87","targetHandle":null,"id":"reactflow__edge-0-5d51b141-1967-4fcb-ad8a-061c0b884f87"}]}'
            ),
            status: StatusEnum.ACTIVE.value,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    /**
     * Creates a `Flow` instance with random properties and saves it to the repository.
     *
     * @param {KnexFlowRepository} repository - The repository to save the `Flow` instance.
     * @returns {Promise<Flow>} The created `Flow` instance.
     */
    static async createRandomFlow(repository) {
        const flow = Flow.create(FlowsMother.randomDto());
        await repository.save(flow);
        return flow;
    }

    /**
     * Creates a `Flow` relation with cases and transitions, along with random properties and saves it to the repository.
     *
     * @param {KnexFlowRepository} repository - The repository to save the `Flow` instance.
     * @returns {Promise<Flow>} The created `Flow` instance.
     */
    static async createRelationshipWithCase(repository) {
        const flow = await FlowsMother.createRandomFlow(repository);

        const transitionPayload = {
            id: uuidv4(),
            estado_actual_id: uuidv4(),
            siguiente_estado_id: uuidv4(),
            flujo_id: flow.id.value,
            status: StatusEnum.ACTIVE.value,
        };

        const casePayload = {
            id: uuidv4(),
            cliente_id: uuidv4(),
            transicion_id: transitionPayload.id,
            responsable_id: uuidv4(),
            clasificacion_id: uuidv4(),
            descripcion_caso_id: uuidv4(),
        };

        await FlowsMother.ensureRelations(repository.connection, transitionPayload, casePayload);
        await repository.connection('transiciones').insert(transitionPayload);
        await repository.connection('cases').insert(casePayload);

        return flow;
    }
}
