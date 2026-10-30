import { WSRestFlowDiagramHelper as Diagram } from '../../../src/ws-rest-flows/application/services/WSRestFlowDiagramHelper.js';
import { WSRestFlowStepManager } from '../../../src/ws-rest-flows/application/services/WSRestFlowStepManager.js';
import { v4 as uuid } from 'uuid';
import { User } from '../../../src/users/index.js';
import UsersMother from '../../users/domain/UsersMother.js';
import WSRestFlowMother from '../domain/WSRestFlowMother.js';
import { KnexWSRestWorkflowStepRepository } from '../../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexWSRestFlowRepository, WSRestFlowUpdater, WSRestFlow } from '../../../src/ws-rest-flows/index.js';
import { knexConfig } from '../../knexfile.js';
import { ensureParentRows } from '../../support/ensureParentRow.js';

describe('WSRestFlowStepManager Step Generation Logic', () => {
    describe('generateStepsForFlow', () => {
        const stepManager = new WSRestFlowStepManager({});

        it('generates steps following linear flow path from start to end', () => {
            const nodes = [
                { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                { id: 'ep1', data: { type: 'endpoint', id: 'endpoint-1' } },
                { id: 'ep2', data: { type: 'endpoint', id: 'endpoint-2' } },
                { id: 'ep3', data: { type: 'endpoint', id: 'endpoint-3' } },
            ];

            const edges = [
                { id: 'e1', source: '0', target: 'ep1' },
                { id: 'e2', source: 'ep1', target: 'ep2' },
                { id: 'e3', source: 'ep2', target: 'ep3' },
            ];

            const { nodes: nodesDedup, edges: edgesDedup } = Diagram.parseDiagram({ nodes, edges });
            const steps = stepManager.generateStepsForFlow(nodesDedup, edgesDedup, 'flow-1');

            expect(steps).toHaveLength(3);
            expect(steps[0].endpoint_id).toBe('endpoint-1');
            expect(steps[1].endpoint_id).toBe('endpoint-2');
            expect(steps[2].endpoint_id).toBe('endpoint-3');
        });

        it('steps include conditional nodes in the sequence and stop at conditionals', () => {
            const nodes = [
                { id: '0', type: 'input', data: { type: 'input' } },
                { id: 'ep1', data: { type: 'endpoint', id: 'endpoint-1' } },
                { id: 'cond', data: { type: 'conditional', id: 'conditional-1' } },
            ];

            const edges = [
                { id: 'e1', source: '0', target: 'ep1' },
                { id: 'e2', source: 'ep1', target: 'cond' },
            ];

            const { nodes: nodesDedup, edges: edgesDedup } = Diagram.parseDiagram({ nodes, edges });
            const steps = stepManager.generateStepsForFlow(nodesDedup, edgesDedup, 'flow-1');

            expect(steps).toHaveLength(2);
            expect(steps[0].endpoint_id).toBe('endpoint-1');
            expect(steps[1].conditional_id).toBe('conditional-1');
        });

        describe('startNodeId controls traversal entry point (branch-pointing-to-tail contract)', () => {
            const buildTailChainGraph = () => {
                const ids = {
                    ep1Node: 'ep1Node',
                    ep1Data: 'endpoint-1',
                    ep2Node: 'ep2Node',
                    ep2Data: 'endpoint-2',
                    fn1Node: 'fn1Node',
                    fn1Data: 'function-1',
                };
                const nodes = [
                    { id: ids.ep1Node, data: { type: 'endpoint', id: ids.ep1Data } },
                    { id: ids.ep2Node, data: { type: 'endpoint', id: ids.ep2Data } },
                    { id: ids.fn1Node, data: { type: 'function', id: ids.fn1Data } },
                ];
                const edges = [
                    { id: 'eA', source: ids.ep1Node, target: ids.ep2Node },
                    { id: 'eB', source: ids.ep2Node, target: ids.fn1Node },
                ];
                return { ids, nodes, edges };
            };

            it('generates a single step when startNodeId points to the tail (function) of an existing chain', () => {
                const { ids, nodes, edges } = buildTailChainGraph();
                const { nodes: nodesDedup, edges: edgesDedup } = Diagram.parseDiagram({ nodes, edges });

                const steps = stepManager.generateStepsForFlow(nodesDedup, edgesDedup, 'flow-tail', ids.fn1Node);

                expect(steps).toHaveLength(1);
                expect(steps[0].function_id).toBe(ids.fn1Data);
                expect(steps[0].endpoint_id).toBeNull();
                expect(steps[0].conditional_id).toBeNull();
            });

            it('generates the full chain when startNodeId points to the head (positive control)', () => {
                const { ids, nodes, edges } = buildTailChainGraph();
                const { nodes: nodesDedup, edges: edgesDedup } = Diagram.parseDiagram({ nodes, edges });

                const steps = stepManager.generateStepsForFlow(nodesDedup, edgesDedup, 'flow-head', ids.ep1Node);

                expect(steps).toHaveLength(3);
                expect(steps[0].endpoint_id).toBe(ids.ep1Data);
                expect(steps[1].endpoint_id).toBe(ids.ep2Data);
                expect(steps[2].function_id).toBe(ids.fn1Data);
            });
        });
    });

    describe('Step order regeneration after branch removal', () => {
        it('reassigns order numbers after node removal', () => {
            const oldSteps = [
                { order: 1, endpoint_id: 'ep-1' },
                { order: 2, endpoint_id: 'ep-2' },
                { order: 3, endpoint_id: 'ep-3' },
            ];

            const newSteps = oldSteps
                .filter((step) => step.endpoint_id !== 'ep-2')
                .map((step, index) => ({
                    ...step,
                    order: index + 1,
                }));

            expect(newSteps[0].order).toBe(1);
            expect(newSteps[1].order).toBe(2);
            expect(newSteps).toHaveLength(2);
            expect(newSteps[0].endpoint_id).toBe('ep-1');
            expect(newSteps[1].endpoint_id).toBe('ep-3');
        });
    });
});

describe('Orphaned subflow detection (integration)', () => {
    const repository = new KnexWSRestFlowRepository(knexConfig);
    const stepRepository = new KnexWSRestWorkflowStepRepository(repository.connection);
    const currentUser = new User(UsersMother.dto());

    it('soft-deletes the orphaned subflow when a conditional branch is removed', async () => {
        const condNodeId = uuid();
        const condDataId = uuid();
        const epSatisfiedId = uuid();
        const epUnsatisfiedId = uuid();
        const epSatisfiedEndpointId = uuid();
        const epUnsatisfiedEndpointId = uuid();
        const satisfiedSubflowId = uuid();
        const unsatisfiedSubflowId = uuid();
        const mainFlowDto = WSRestFlowMother.dto();

        // Los dos endpoints acaban en `ws_rest_workflow_steps.endpoint_id`,
        // que es clave foranea real: los ids se inventan aqui arriba y
        // postgres los exige existentes al guardar los pasos.
        await ensureParentRows(repository.connection, [
            { table: 'ws_rest_endpoints', id: epSatisfiedEndpointId },
            { table: 'ws_rest_endpoints', id: epUnsatisfiedEndpointId },
        ]);

        const mainFlow = WSRestFlow.create({
            ...mainFlowDto,
            is_primary: true,
            json_diagram_properties: {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: condNodeId,
                        data: {
                            type: 'conditional',
                            id: condDataId,
                            name: 'My Conditional',
                            subflows: {
                                satisfied: satisfiedSubflowId,
                                unsatisfied: unsatisfiedSubflowId,
                            },
                        },
                    },
                ],
                edges: [{ id: uuid(), source: '0', target: condNodeId }],
            },
        });
        await repository.save(mainFlow);

        const satisfiedSubflow = WSRestFlow.create({
            ...WSRestFlowMother.dto({
                id: satisfiedSubflowId,
                json_diagram_properties: {
                    nodes: [
                        { id: condNodeId, data: { type: 'conditional', id: condDataId } },
                        { id: epSatisfiedId, data: { type: 'endpoint', id: epSatisfiedEndpointId } },
                    ],
                    edges: [{ id: uuid(), source: condNodeId, target: epSatisfiedId }],
                },
            }),
            is_primary: false,
        });
        await repository.save(satisfiedSubflow);

        const unsatisfiedSubflow = WSRestFlow.create({
            ...WSRestFlowMother.dto({
                id: unsatisfiedSubflowId,
                json_diagram_properties: {
                    nodes: [
                        { id: condNodeId, data: { type: 'conditional', id: condDataId } },
                        { id: epUnsatisfiedId, data: { type: 'endpoint', id: epUnsatisfiedEndpointId } },
                    ],
                    edges: [{ id: uuid(), source: condNodeId, target: epUnsatisfiedId }],
                },
            }),
            is_primary: false,
        });
        await repository.save(unsatisfiedSubflow);

        const ourSubflowIds = [satisfiedSubflowId, unsatisfiedSubflowId];

        const subflowsBefore = await repository
            .connection('ws_rest_flows')
            .whereIn('id', ourSubflowIds)
            .whereNull('deleted_at');
        expect(subflowsBefore).toHaveLength(2);

        const updater = new WSRestFlowUpdater(repository, stepRepository);
        await updater.execute(mainFlowDto.id, {
            updated_at: new Date().toISOString(),
            updated_by: currentUser.id.value,
            json_diagram_properties: {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    { id: epSatisfiedId, data: { type: 'endpoint', id: epSatisfiedEndpointId } },
                ],
                edges: [{ id: uuid(), source: '0', target: epSatisfiedId }],
            },
        });

        const activeSubflowsAfter = await repository
            .connection('ws_rest_flows')
            .whereIn('id', ourSubflowIds)
            .whereNull('deleted_at');

        const deletedSubflowsAfter = await repository
            .connection('ws_rest_flows')
            .whereIn('id', ourSubflowIds)
            .whereNotNull('deleted_at');

        expect(activeSubflowsAfter).toHaveLength(0);
        expect(deletedSubflowsAfter).toHaveLength(2);
    });
});
