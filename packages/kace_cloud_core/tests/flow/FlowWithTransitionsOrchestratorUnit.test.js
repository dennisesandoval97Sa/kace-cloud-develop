import { v4 as uuidv4 } from 'uuid';
import { jest } from '@jest/globals';
import { FlowWithTransitionsOrchestrator } from '../../src/flow';
import { Transitions } from '../../src/transition';

const buildEdge = ({ source, target, ansId = null, ruleId = null, isVisible = true }) => ({
    id: `reactflow__edge-${source}-${target}`,
    source,
    target,
    ans_id: ansId,
    rule_id: ruleId,
    data: { is_visible: isVisible },
});

const makeFlowRepo = () => ({
    find: jest.fn(),
    saveHistory: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    updateTransitionStatus: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue(undefined),
});

const makeTransitionRepo = ({ existing = [] } = {}) => {
    const store = existing.map((row) => new Transitions(row));

    const byTriplet = (flujoId, estadoActualId, siguienteEstadoId) => {
        const matches = store
            .filter((t) => {
                const data = t.toJson();
                return (
                    data.flujo_id === flujoId &&
                    data.siguiente_estado_id === siguienteEstadoId &&
                    (estadoActualId === null
                        ? data.estado_actual_id === null
                        : data.estado_actual_id === estadoActualId)
                );
            })
            .sort((a, b) => {
                const ad = a.toJson().created_at;
                const bd = b.toJson().created_at;
                return ad < bd ? 1 : -1;
            });
        return matches[0] || null;
    };

    return {
        findByFlowAndTriplet: jest.fn().mockImplementation(byTriplet),
        save: jest.fn().mockImplementation(async (transition) => {
            store.push(transition);
            return transition;
        }),
        update: jest.fn().mockImplementation(async (transition) => {
            const idx = store.findIndex((t) => t.id.value === transition.id.value);
            if (idx === -1) throw new Error('not found');
            store[idx] = transition;
            return transition;
        }),
        // for assertions
        _store: store,
    };
};

describe('FlowWithTransitionsOrchestrator', () => {
    const flowId = uuidv4();
    const userId = uuidv4();
    const stateA = uuidv4();
    const stateB = uuidv4();
    const stateC = uuidv4();
    const ansId = uuidv4();
    const ruleId = uuidv4();

    const flowDto = (edges) => ({
        id: flowId,
        nombre: 'Test flow',
        json_flujo: { nodes: [], edges },
        status: 1,
        created_at: new Date().toISOString(),
        created_by: userId,
    });

    it('updates an existing transition and never deletes a missing one', async () => {
        const existingTransitionId = uuidv4();
        const orphanTransitionId = uuidv4();

        const transitionRepo = makeTransitionRepo({
            existing: [
                {
                    id: existingTransitionId,
                    estado_actual_id: stateA,
                    siguiente_estado_id: stateB,
                    flujo_id: flowId,
                    status: 1,
                    ans_id: null,
                    rule_id: null,
                    is_visible: true,
                    created_at: new Date(Date.now() - 60_000).toISOString(),
                    created_by: userId,
                },
                {
                    id: orphanTransitionId,
                    estado_actual_id: stateB,
                    siguiente_estado_id: stateC,
                    flujo_id: flowId,
                    status: 1,
                    ans_id: null,
                    rule_id: null,
                    is_visible: true,
                    created_at: new Date(Date.now() - 30_000).toISOString(),
                    created_by: userId,
                },
            ],
        });
        const flowRepo = makeFlowRepo();

        const orchestrator = new FlowWithTransitionsOrchestrator({ flowRepo, transitionRepo });
        const now = new Date().toISOString();
        await orchestrator.executeUpdate(
            flowDto([buildEdge({ source: stateA, target: stateB, ansId, ruleId, isVisible: false })]),
            { userId, now }
        );

        expect(transitionRepo.update).toHaveBeenCalledTimes(1);
        expect(transitionRepo.save).not.toHaveBeenCalled();

        const updated = transitionRepo._store.find((t) => t.id.value === existingTransitionId);
        expect(updated.ans_id.value).toBe(ansId);
        expect(updated.rule_id.value).toBe(ruleId);
        expect(updated.is_visible.value).toBe(false);

        const orphan = transitionRepo._store.find((t) => t.id.value === orphanTransitionId);
        expect(orphan).toBeDefined();

        expect(flowRepo.updateTransitionStatus).toHaveBeenCalledWith(
            flowId,
            expect.arrayContaining([existingTransitionId]),
            null
        );
    });

    it('creates a transition when the tripleta has no match', async () => {
        const newState = uuidv4();
        const transitionRepo = makeTransitionRepo({ existing: [] });
        const flowRepo = makeFlowRepo();

        const orchestrator = new FlowWithTransitionsOrchestrator({ flowRepo, transitionRepo });
        await orchestrator.executeUpdate(flowDto([buildEdge({ source: stateA, target: newState, ansId, ruleId })]), {
            userId,
            now: new Date().toISOString(),
        });

        expect(transitionRepo.save).toHaveBeenCalledTimes(1);
        const created = transitionRepo.save.mock.calls[0][0];
        expect(created.flujo_id.value).toBe(flowId);
        expect(created.estado_actual_id.value).toBe(stateA);
        expect(created.siguiente_estado_id.value).toBe(newState);
        expect(created.ans_id.value).toBe(ansId);
        expect(created.rule_id.value).toBe(ruleId);
    });

    it('passes the trx to transitionRepo.save and flowRepo.updateTransitionStatus', async () => {
        const trx = { __trx: 'fake-trx' };
        const newState = uuidv4();
        const transitionRepo = makeTransitionRepo({ existing: [] });
        const flowRepo = makeFlowRepo();

        const orchestrator = new FlowWithTransitionsOrchestrator({ flowRepo, transitionRepo });
        await orchestrator.executeUpdate(flowDto([buildEdge({ source: stateA, target: newState, ansId, ruleId })]), {
            userId,
            now: new Date().toISOString(),
            trx,
        });

        expect(transitionRepo.save.mock.calls[0][1]).toBe(trx);
        expect(flowRepo.updateTransitionStatus.mock.calls[0][2]).toBe(trx);
    });

    it('treats source "0" as a null estado_actual_id', async () => {
        const initialTransitionId = uuidv4();
        const transitionRepo = makeTransitionRepo({
            existing: [
                {
                    id: initialTransitionId,
                    estado_actual_id: null,
                    siguiente_estado_id: stateA,
                    flujo_id: flowId,
                    status: 1,
                    ans_id: null,
                    rule_id: null,
                    is_visible: true,
                    created_at: new Date().toISOString(),
                    created_by: userId,
                },
            ],
        });
        const flowRepo = makeFlowRepo();

        const initialEdge = {
            id: 'reactflow__edge-0-initial',
            source: '0',
            target: stateA,
            ans_id: null,
            rule_id: null,
            data: { is_visible: true },
        };

        const orchestrator = new FlowWithTransitionsOrchestrator({ flowRepo, transitionRepo });
        await orchestrator.executeUpdate(flowDto([initialEdge]), {
            userId,
            now: new Date().toISOString(),
        });

        expect(transitionRepo.findByFlowAndTriplet).toHaveBeenCalledWith(flowId, null, stateA);
        expect(transitionRepo.update).toHaveBeenCalledTimes(1);
    });
});
