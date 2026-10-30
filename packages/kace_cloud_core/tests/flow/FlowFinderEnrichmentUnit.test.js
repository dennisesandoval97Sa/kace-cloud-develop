import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { FlowFinder } from '../../src/flow';
import { Transitions } from '../../src/transition';

const makeFlowMock = ({ flowId, edges }) => {
    const createdAt = new Date().toISOString();
    return {
        id: { value: flowId },
        nombre: { value: 'Test' },
        json_flujo: { value: { nodes: [], edges } },
        status: { value: 1 },
        created_by: { value: uuidv4() },
        created_at: { value: createdAt },
        updated_at: { value: null },
        updated_by: { value: null },
        deleted_at: { value: null },
        deleted_by: { value: null },
    };
};

const makeTransitionRow = ({ id, estadoActualId, siguienteEstadoId, flujoId }) => ({
    id,
    estado_actual_id: estadoActualId,
    siguiente_estado_id: siguienteEstadoId,
    flujo_id: flujoId,
    status: 1,
    created_at: new Date().toISOString(),
    created_by: uuidv4(),
    ans_id: null,
    rule_id: null,
    is_visible: true,
});

describe('FlowFinder enrichment', () => {
    it('attaches kace_transition to each edge based on the tripleta', async () => {
        const flowId = uuidv4();
        const stateA = uuidv4();
        const stateB = uuidv4();
        const stateC = uuidv4();
        const transitionAtoB = uuidv4();
        const transition0toA = uuidv4();

        const flowRepo = {
            find: jest.fn().mockResolvedValue(
                makeFlowMock({
                    flowId,
                    edges: [
                        { id: 'e1', source: '0', target: stateA },
                        { id: 'e2', source: stateA, target: stateB },
                        { id: 'e3', source: stateB, target: stateC },
                    ],
                })
            ),
        };

        const transitionRows = [
            makeTransitionRow({
                id: transition0toA,
                estadoActualId: null,
                siguienteEstadoId: stateA,
                flujoId: flowId,
            }),
            makeTransitionRow({
                id: transitionAtoB,
                estadoActualId: stateA,
                siguienteEstadoId: stateB,
                flujoId: flowId,
            }),
        ];
        const transitionRepo = {
            findByFlowId: jest.fn().mockResolvedValue(transitionRows.map((r) => new Transitions(r))),
        };

        const finder = new FlowFinder(flowRepo, transitionRepo);
        const result = await finder.execute(flowId);
        const json = result.toJson();
        const edges = json.data.json_flujo.edges;

        expect(edges[0].kace_transition).toBe(transition0toA);
        expect(edges[1].kace_transition).toBe(transitionAtoB);
        expect(edges[2].kace_transition).toBeUndefined();

        expect(transitionRepo.findByFlowId).toHaveBeenCalledWith(flowId);
    });

    it('picks the most recent transition when multiple exist for the same tripleta', async () => {
        const flowId = uuidv4();
        const stateA = uuidv4();
        const stateB = uuidv4();
        const olderTransitionId = uuidv4();
        const newerTransitionId = uuidv4();

        const flowRepo = {
            find: jest.fn().mockResolvedValue({
                id: { value: flowId },
                nombre: { value: 'Test' },
                json_flujo: {
                    value: {
                        nodes: [],
                        edges: [{ id: 'e1', source: stateA, target: stateB }],
                    },
                },
                status: { value: 1 },
                created_by: { value: uuidv4() },
                created_at: { value: new Date().toISOString() },
                updated_at: { value: null },
                updated_by: { value: uuidv4() },
                deleted_at: { value: null },
                deleted_by: { value: null },
            }),
        };

        // Most recent first (matches the repository's ORDER BY created_at DESC).
        const transitionRows = [
            {
                id: newerTransitionId,
                estado_actual_id: stateA,
                siguiente_estado_id: stateB,
                flujo_id: flowId,
                status: 1,
                created_at: new Date().toISOString(),
                created_by: uuidv4(),
                updated_at: null,
                updated_by: null,
                ans_id: null,
                rule_id: null,
                is_visible: true,
            },
            {
                id: olderTransitionId,
                estado_actual_id: stateA,
                siguiente_estado_id: stateB,
                flujo_id: flowId,
                status: 1,
                created_at: new Date(Date.now() - 60_000).toISOString(),
                created_by: uuidv4(),
                updated_at: null,
                updated_by: null,
                ans_id: null,
                rule_id: null,
                is_visible: true,
            },
        ];
        const transitionRepo = {
            findByFlowId: jest.fn().mockResolvedValue(transitionRows.map((r) => new Transitions(r))),
        };

        const finder = new FlowFinder(flowRepo, transitionRepo);
        const result = await finder.execute(flowId);
        const json = result.toJson();
        const edges = json.data.json_flujo.edges;

        expect(edges[0].kace_transition).toBe(newerTransitionId);
    });

    it('returns null when the flow does not exist (no enrichment call)', async () => {
        const flowRepo = {
            find: jest.fn().mockResolvedValue(null),
        };
        const transitionRepo = {
            findByFlowId: jest.fn(),
        };

        const finder = new FlowFinder(flowRepo, transitionRepo);
        const result = await finder.execute(uuidv4());

        expect(result).toBeNull();
        expect(transitionRepo.findByFlowId).not.toHaveBeenCalled();
    });

    it('skips enrichment when transitionRepo is not provided (back-compat)', async () => {
        const flowId = uuidv4();
        const flowRepo = {
            find: jest
                .fn()
                .mockResolvedValue(makeFlowMock({ flowId, edges: [{ id: 'e1', source: '0', target: uuidv4() }] })),
        };

        const finder = new FlowFinder(flowRepo);
        const result = await finder.execute(flowId);
        const json = result.toJson();

        expect(json.data.json_flujo.edges[0].kace_transition).toBeUndefined();
    });
});
