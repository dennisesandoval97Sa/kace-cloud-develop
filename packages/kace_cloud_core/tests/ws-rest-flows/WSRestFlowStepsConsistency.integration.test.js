import { v4 as uuid } from 'uuid';
import { User } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import WSRestFlowMother from './domain/WSRestFlowMother.js';
import { knexConfig } from '../knexfile.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexWSRestFlowRepository, WSRestFlowCreator, WSRestFlowUpdater } from '../../src/ws-rest-flows/index.js';

describe('WSRestFlow Step Consistency on Complex Updates', () => {
    const repository = new KnexWSRestFlowRepository(knexConfig);
    const stepRepository = new KnexWSRestWorkflowStepRepository(repository.connection);
    const currentUser = new User(UsersMother.dto());

    /**
     * Toda alta y toda actualizacion pasan por estos envoltorios para respaldar
     * antes los endpoints que nombra el diagrama: son ids inventados en este
     * archivo con `uuid()` y postgres los exige existentes al guardar los pasos.
     *
     * @param {WSRestFlowCreator} creator
     * @param {Object} flowDto
     * @returns {Promise<*>}
     */
    const createFlow = async (creator, flowDto) => {
        await WSRestFlowMother.ensureDiagramRelations(repository.connection, flowDto.json_diagram_properties);

        return creator.execute(flowDto);
    };

    /**
     * @param {WSRestFlowUpdater} updater
     * @param {string} flowId
     * @param {Object} payload
     * @returns {Promise<*>}
     */
    const updateFlow = async (updater, flowId, payload) => {
        await WSRestFlowMother.ensureDiagramRelations(repository.connection, payload.json_diagram_properties);

        return updater.execute(flowId, payload);
    };

    it('regenerates steps correctly when intermediate node is removed', async () => {
        const nodeAId = uuid();
        const nodeBId = uuid();
        const nodeCId = uuid();
        const endpointAId = uuid();
        const endpointBId = uuid();
        const endpointCId = uuid();

        const initialDto = WSRestFlowMother.dto({
            json_diagram_properties: {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    { id: nodeAId, data: { type: 'endpoint', id: endpointAId } },
                    { id: nodeBId, data: { type: 'endpoint', id: endpointBId } },
                    { id: nodeCId, data: { type: 'endpoint', id: endpointCId } },
                ],
                edges: [
                    { id: uuid(), source: '0', target: nodeAId },
                    { id: uuid(), source: nodeAId, target: nodeBId },
                    { id: uuid(), source: nodeBId, target: nodeCId },
                ],
            },
        });

        const creator = new WSRestFlowCreator(repository, stepRepository);
        await createFlow(creator, initialDto);

        const initialSteps = await repository
            .connection('ws_rest_workflow_steps')
            .where({ flow_id: initialDto.id })
            .orderBy('order', 'asc');

        expect(initialSteps).toHaveLength(3);
        expect(initialSteps[0].endpoint_id).toBe(endpointAId);
        expect(initialSteps[1].endpoint_id).toBe(endpointBId);
        expect(initialSteps[2].endpoint_id).toBe(endpointCId);

        const updater = new WSRestFlowUpdater(repository, stepRepository);
        await updateFlow(updater, initialDto.id, {
            updated_at: new Date().toISOString(),
            updated_by: currentUser.id.value,
            json_diagram_properties: {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    { id: nodeAId, data: { type: 'endpoint', id: endpointAId } },
                    { id: nodeCId, data: { type: 'endpoint', id: endpointCId } },
                ],
                edges: [
                    { id: uuid(), source: '0', target: nodeAId },
                    { id: uuid(), source: nodeAId, target: nodeCId },
                ],
            },
        });

        const stepsAfterUpdate = await repository
            .connection('ws_rest_workflow_steps')
            .where({ flow_id: initialDto.id })
            .orderBy('order', 'asc');

        expect(stepsAfterUpdate).toHaveLength(2);
        expect(stepsAfterUpdate[0].order).toBe(1);
        expect(stepsAfterUpdate[1].order).toBe(2);
        expect(stepsAfterUpdate[0].endpoint_id).toBe(endpointAId);
        expect(stepsAfterUpdate[1].endpoint_id).toBe(endpointCId);
    });

    it('maintains step order when simplifying flow without conditionals', async () => {
        const node1Id = uuid();
        const node2Id = uuid();
        const node3Id = uuid();
        const endpoint1Id = uuid();
        const endpoint2Id = uuid();
        const endpoint3Id = uuid();

        const initialDto = WSRestFlowMother.dto({
            json_diagram_properties: {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input' } },
                    { id: node1Id, data: { type: 'endpoint', id: endpoint1Id } },
                    { id: node2Id, data: { type: 'endpoint', id: endpoint2Id } },
                    { id: node3Id, data: { type: 'endpoint', id: endpoint3Id } },
                ],
                edges: [
                    { id: uuid(), source: '0', target: node1Id },
                    { id: uuid(), source: node1Id, target: node2Id },
                    { id: uuid(), source: node2Id, target: node3Id },
                ],
            },
        });

        const creator = new WSRestFlowCreator(repository, stepRepository);
        await createFlow(creator, initialDto);

        const initialSteps = await repository
            .connection('ws_rest_workflow_steps')
            .where({ flow_id: initialDto.id })
            .orderBy('order', 'asc');

        expect(initialSteps.length).toBe(3);
        expect(initialSteps[0].order).toBe(1);
        expect(initialSteps[1].order).toBe(2);
        expect(initialSteps[2].order).toBe(3);
        expect(initialSteps[0].endpoint_id).toBe(endpoint1Id);
        expect(initialSteps[1].endpoint_id).toBe(endpoint2Id);
        expect(initialSteps[2].endpoint_id).toBe(endpoint3Id);

        const updater = new WSRestFlowUpdater(repository, stepRepository);
        await updateFlow(updater, initialDto.id, {
            updated_at: new Date().toISOString(),
            updated_by: currentUser.id.value,
            json_diagram_properties: {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input' } },
                    { id: node1Id, data: { type: 'endpoint', id: endpoint1Id } },
                    { id: node3Id, data: { type: 'endpoint', id: endpoint3Id } },
                ],
                edges: [
                    { id: uuid(), source: '0', target: node1Id },
                    { id: uuid(), source: node1Id, target: node3Id },
                ],
            },
        });

        const stepsAfterUpdate = await repository
            .connection('ws_rest_workflow_steps')
            .where({ flow_id: initialDto.id })
            .orderBy('order', 'asc');

        expect(stepsAfterUpdate.length).toBe(2);
        expect(stepsAfterUpdate[0].order).toBe(1);
        expect(stepsAfterUpdate[1].order).toBe(2);
        expect(stepsAfterUpdate[0].endpoint_id).toBe(endpoint1Id);
        expect(stepsAfterUpdate[1].endpoint_id).toBe(endpoint3Id);
    });
});
