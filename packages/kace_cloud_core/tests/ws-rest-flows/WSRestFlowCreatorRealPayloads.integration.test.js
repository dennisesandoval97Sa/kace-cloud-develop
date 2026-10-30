import { jest } from '@jest/globals';
import { v4 as uuid } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexWSRestFlowRepository, WSRestFlowCreator } from '../../src/ws-rest-flows/index.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { EventLogger } from '../../src/shared/EventLogger.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { ValidationFailError } from '../../src/shared/index.js';
import WSRestFlowMother from './domain/WSRestFlowMother.js';

const buildBaseFlowDto = (diagram, overrides = {}) => ({
    id: uuid(),
    description: `test-flow-${uuid()}`,
    external_code: `test_flow_${uuid()}`,
    json_diagram_properties: diagram,
    is_active: true,
    is_primary: true,
    created_at: new Date().toISOString(),
    created_by: uuid(),
    ...overrides,
});

const buildLinearDiagram = () => {
    const ids = { input: '0', node1: uuid(), ep1: uuid() };
    return {
        ids,
        diagram: {
            nodes: [
                { id: ids.input, type: 'input', data: { type: 'input', label: 'start' } },
                { id: ids.node1, data: { type: 'endpoint', id: ids.ep1, label: 'step 1' } },
            ],
            edges: [{ id: uuid(), source: ids.input, target: ids.node1 }],
        },
    };
};

const buildConditionalDiagram = () => {
    const ids = {
        input: '0',
        condNode: uuid(),
        condData: uuid(),
        yesNode: uuid(),
        yesEp: uuid(),
        noNode: uuid(),
        noEp: uuid(),
    };
    return {
        ids,
        diagram: {
            nodes: [
                { id: ids.input, type: 'input', data: { type: 'input', label: 'start' } },
                {
                    id: ids.condNode,
                    data: {
                        type: 'conditional',
                        id: ids.condData,
                        label: 'check',
                        filter: 'context.x',
                        value: '1',
                        conditionType: 'eq',
                    },
                },
                { id: ids.yesNode, data: { type: 'endpoint', id: ids.yesEp, label: 'yes-ep' } },
                { id: ids.noNode, data: { type: 'endpoint', id: ids.noEp, label: 'no-ep' } },
            ],
            edges: [
                { id: uuid(), source: ids.input, target: ids.condNode },
                { id: uuid(), source: ids.condNode, target: ids.yesNode, sourceHandle: 'yes' },
                { id: uuid(), source: ids.condNode, target: ids.noNode, sourceHandle: 'no' },
            ],
        },
    };
};

describe('WSRestFlowCreator - real user payloads regression', () => {
    const repository = new KnexWSRestFlowRepository(knexConfig);
    const stepRepository = new KnexWSRestWorkflowStepRepository(repository.connection);

    /**
     * Todo alta de flujo pasa por aqui para respaldar antes los endpoints y
     * funciones que nombra el diagrama: son ids inventados en este archivo con
     * `uuid()` y postgres los exige existentes al guardar los pasos.
     *
     * @param {WSRestFlowCreator} creator
     * @param {Object} flowDto
     * @returns {Promise<*>}
     */
    const createFlow = async (creator, flowDto) => {
        await WSRestFlowMother.ensureDiagramRelations(repository.connection, flowDto.json_diagram_properties);

        return creator.execute(flowDto);
    };

    beforeEach(async () => {
        repository.connection.client.setMaxListeners(200);
        await repository.connection('ws_rest_workflow_steps').del();
        await repository.connection('ws_rest_conditionals').del();
        await repository.connection('ws_rest_flows').del();
        jest.spyOn(EventLogger.prototype, 'log').mockResolvedValue(undefined);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    it('working payload: create with minimal seed (no diagram)', async () => {
        const dto = WSRestFlowMother.dto();
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await createFlow(creator, dto);

        const rows = await repository.connection('ws_rest_flows').select('*').where('id', dto.id);
        expect(rows.length).toBe(1);
        expect(rows[0].description).toBe(dto.description);
    });

    it('working payload: create with main diagram only (no conditionals)', async () => {
        const flowDto = buildBaseFlowDto(buildLinearDiagram().diagram);
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await createFlow(creator, flowDto);

        const conditionals = await repository.connection('ws_rest_conditionals').select('*');
        const subflows = await repository.connection('ws_rest_flows').select('*').where('is_primary', false);
        expect(conditionals.length).toBe(0);
        expect(subflows.length).toBe(0);
    });

    it('working payload: create with single conditional and satisfied/unsatisfied subflows', async () => {
        const flowDto = buildBaseFlowDto(buildConditionalDiagram().diagram);
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await createFlow(creator, flowDto);

        const conditionals = await repository.connection('ws_rest_conditionals').select('*');
        const subflows = await repository.connection('ws_rest_flows').select('*').where('is_primary', false);
        expect(conditionals.length).toBe(1);
        expect(subflows.length).toBeGreaterThanOrEqual(2);
    });

    it('working payload: create with shared satisfied branches converging to same endpoint', async () => {
        // Helper inline because this diagram is specific to this test
        const inputId = '0';
        const condANode = uuid();
        const condBNode = uuid();
        const sharedEp = uuid();
        const flowDto = buildBaseFlowDto({
            nodes: [
                { id: inputId, type: 'input', data: { type: 'input', label: 'start' } },
                {
                    id: condANode,
                    data: {
                        type: 'conditional',
                        id: uuid(),
                        label: 'A',
                        filter: 'ctx.a',
                        value: '1',
                        conditionType: 'eq',
                    },
                },
                {
                    id: condBNode,
                    data: {
                        type: 'conditional',
                        id: uuid(),
                        label: 'B',
                        filter: 'ctx.b',
                        value: '1',
                        conditionType: 'eq',
                    },
                },
                { id: sharedEp, data: { type: 'endpoint', id: uuid(), label: 'shared' } },
            ],
            edges: [
                { id: uuid(), source: inputId, target: condANode },
                { id: uuid(), source: condANode, target: sharedEp, sourceHandle: 'yes' },
                { id: uuid(), source: condANode, target: condBNode, sourceHandle: 'no' },
                { id: uuid(), source: condBNode, target: sharedEp, sourceHandle: 'yes' },
            ],
        });
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await expect(createFlow(creator, flowDto)).resolves.not.toThrow();

        const conditionals = await repository.connection('ws_rest_conditionals').select('*');
        expect(conditionals.length).toBe(2);
    });

    it('working payload: create with deeply nested conditionals (3 levels)', async () => {
        const inputId = '0';
        const cond1 = uuid();
        const cond2 = uuid();
        const cond3 = uuid();
        const ep = uuid();
        const flowDto = buildBaseFlowDto({
            nodes: [
                { id: inputId, type: 'input', data: { type: 'input', label: 'start' } },
                {
                    id: cond1,
                    data: {
                        type: 'conditional',
                        id: uuid(),
                        label: 'lvl1',
                        filter: 'c.a',
                        value: '1',
                        conditionType: 'eq',
                    },
                },
                {
                    id: cond2,
                    data: {
                        type: 'conditional',
                        id: uuid(),
                        label: 'lvl2',
                        filter: 'c.b',
                        value: '1',
                        conditionType: 'eq',
                    },
                },
                {
                    id: cond3,
                    data: {
                        type: 'conditional',
                        id: uuid(),
                        label: 'lvl3',
                        filter: 'c.c',
                        value: '1',
                        conditionType: 'eq',
                    },
                },
                { id: ep, data: { type: 'endpoint', id: uuid(), label: 'end' } },
            ],
            edges: [
                { id: uuid(), source: inputId, target: cond1 },
                { id: uuid(), source: cond1, target: cond2, sourceHandle: 'yes' },
                { id: uuid(), source: cond2, target: cond3, sourceHandle: 'yes' },
                { id: uuid(), source: cond3, target: ep, sourceHandle: 'yes' },
            ],
        });
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await createFlow(creator, flowDto);

        const conditionals = await repository.connection('ws_rest_conditionals').select('*');
        expect(conditionals.length).toBe(3);
    });

    it('failing payload: rejects diagram missing nodes', async () => {
        // The VO (ValueObjectJsonDiagramProperties) requires at least 1 node.
        // WSRestFlowDiagramHelper.parseDiagram normalizes missing nodes to [], but
        // WSRestFlow.create() is called with { nodes: [], edges: [] }, which the VO rejects.
        const flowDto = buildBaseFlowDto({ edges: [] });
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await expect(createFlow(creator, flowDto)).rejects.toThrow();
    });

    it('failing payload: rejects diagram with edges that is not an array', async () => {
        // The Creator does not pre-validate edges; downstream graph traversal (Creator partitioning
        // logic) calls edges.find(), which throws TypeError when edges is a string. Net effect: rejection.
        const flowDto = buildBaseFlowDto({ nodes: [{ id: '0', data: {} }], edges: 'not-an-array' });
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await expect(createFlow(creator, flowDto)).rejects.toThrow();
    });

    it('failing payload: rejects duplicate primary flow when one already exists with same external_code', async () => {
        const externalCode = `dup_${uuid()}`;
        const creator = new WSRestFlowCreator(repository, stepRepository);
        const firstDto = buildBaseFlowDto(buildLinearDiagram().diagram, { external_code: externalCode });
        await createFlow(creator, firstDto);

        const secondDto = buildBaseFlowDto(buildLinearDiagram().diagram, { external_code: externalCode });

        await expect(createFlow(creator, secondDto)).rejects.toThrow();
    });

    it('failing payload: rejects conditional node without outgoing branches', async () => {
        // Originally intended to test "rejects payload with subflow references pointing to non-existent conditional id".
        // In practice, the Creator does not validate pre-set subflow references in cond.data.subflows —
        // it overwrites them during partitioning. The closest enforcement is structural: every conditional
        // node must have at least one outgoing edge. This test captures that real validation point.
        const inputId = '0';
        const orphanNode = uuid();
        const flowDto = buildBaseFlowDto({
            nodes: [
                { id: inputId, type: 'input', data: { type: 'input', label: 'start' } },
                {
                    id: orphanNode,
                    data: {
                        type: 'conditional',
                        id: uuid(),
                        label: 'orphan',
                        filter: 'c.x',
                        value: '1',
                        conditionType: 'eq',
                        subflows: { satisfied: uuid() },
                    },
                },
            ],
            edges: [{ id: uuid(), source: inputId, target: orphanNode }], // only incoming, no outgoing
        });
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await expect(createFlow(creator, flowDto)).rejects.toThrow(/at least one outgoing branch/);
    });

    it('regression: does not blow up node count via shared downstream nodes at creation', async () => {
        const inputId = '0';
        const cA = uuid();
        const cB = uuid();
        const sharedDownstream = uuid();
        const flowDto = buildBaseFlowDto({
            nodes: [
                { id: inputId, type: 'input', data: { type: 'input', label: 'start' } },
                {
                    id: cA,
                    data: {
                        type: 'conditional',
                        id: uuid(),
                        label: 'A',
                        filter: 'c.a',
                        value: '1',
                        conditionType: 'eq',
                    },
                },
                {
                    id: cB,
                    data: {
                        type: 'conditional',
                        id: uuid(),
                        label: 'B',
                        filter: 'c.b',
                        value: '1',
                        conditionType: 'eq',
                    },
                },
                { id: sharedDownstream, data: { type: 'endpoint', id: uuid(), label: 'shared' } },
            ],
            edges: [
                { id: uuid(), source: inputId, target: cA },
                { id: uuid(), source: cA, target: sharedDownstream, sourceHandle: 'yes' },
                { id: uuid(), source: cA, target: cB, sourceHandle: 'no' },
                { id: uuid(), source: cB, target: sharedDownstream, sourceHandle: 'yes' },
            ],
        });
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await createFlow(creator, flowDto);

        const mainRow = await repository
            .connection('ws_rest_flows')
            .select('json_diagram_properties')
            .where('id', flowDto.id)
            .first();
        const persistedDiagram =
            typeof mainRow.json_diagram_properties === 'string'
                ? JSON.parse(mainRow.json_diagram_properties)
                : mainRow.json_diagram_properties;
        const nodeIds = persistedDiagram.nodes.map((n) => n.id);
        const uniqueIds = new Set(nodeIds);
        expect(nodeIds.length).toBe(uniqueIds.size);
    });

    it('regression: deduplicates identical nodes in json_diagram_properties at insert', async () => {
        const inputId = '0';
        const duplicateId = uuid();
        const flowDto = buildBaseFlowDto({
            nodes: [
                { id: inputId, type: 'input', data: { type: 'input', label: 'start' } },
                { id: duplicateId, data: { type: 'endpoint', id: uuid(), label: 'dup' } },
                { id: duplicateId, data: { type: 'endpoint', id: uuid(), label: 'dup-again' } },
            ],
            edges: [{ id: uuid(), source: inputId, target: duplicateId }],
        });
        const creator = new WSRestFlowCreator(repository, stepRepository);

        await createFlow(creator, flowDto);

        const mainRow = await repository
            .connection('ws_rest_flows')
            .select('json_diagram_properties')
            .where('id', flowDto.id)
            .first();
        const persistedDiagram =
            typeof mainRow.json_diagram_properties === 'string'
                ? JSON.parse(mainRow.json_diagram_properties)
                : mainRow.json_diagram_properties;
        const ids = persistedDiagram.nodes.map((n) => n.id);
        expect(ids.filter((id) => id === duplicateId).length).toBe(1);
    });
});
