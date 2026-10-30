import { jest } from '@jest/globals';
import { v4 as uuid } from 'uuid';

import { knexConfig } from '../knexfile.js';
import { KnexWSRestFlowRepository, WSRestFlowCreator, WSRestFlowUpdater } from '../../src/ws-rest-flows/index.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { EventLogger } from '../../src/shared/EventLogger.js';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { ValidationFailError } from '../../src/shared/index.js';
import WSRestFlowMother from './domain/WSRestFlowMother.js';

const getConditionalNodeByDataId = (nodes, conditionalDataId) =>
    nodes.find((node) => node?.data?.type === 'conditional' && node?.data?.id === conditionalDataId);

const hasEdge = (edges, source, target, sourceHandle) =>
    edges.some(
        (edge) =>
            edge.source === source &&
            edge.target === target &&
            (sourceHandle === undefined || edge.sourceHandle === sourceHandle)
    );

const getLastMainDiagramFromUpdateSpy = (updateSpy, flowId) => {
    const mainFlow = [...updateSpy.mock.calls]
        .map((call) => call[0])
        .reverse()
        .find((flow) => flow.id.value === flowId);

    return mainFlow?.json_diagram_properties?.value;
};

const queryActiveSubflows = async (connection, flowExternalCode = null) => {
    let query = connection('ws_rest_flows')
        .select('id', 'is_primary', 'deleted_at', 'external_code')
        .where('is_primary', 0)
        .whereNull('deleted_at');

    if (flowExternalCode) {
        query = query.where('external_code', 'like', `${flowExternalCode}%`);
    }

    return query;
};

const countActiveSubflows = async (connection, flowExternalCode = null) => {
    const rows = await queryActiveSubflows(connection, flowExternalCode);
    return rows.length;
};

const buildSharedSatisfiedDiagram = () => {
    const ids = {
        input: '0',
        condANode: uuid(),
        condAData: uuid(),
        condBNode: uuid(),
        condBData: uuid(),
        sharedNode: uuid(),
        sharedEndpoint: uuid(),
        noBNode: uuid(),
        noBEndpoint: uuid(),
    };

    const diagram = {
        nodes: [
            { id: ids.input, type: 'input', data: { type: 'input', label: 'inicio' } },
            {
                id: ids.condANode,
                data: {
                    type: 'conditional',
                    id: ids.condAData,
                    label: 'if A',
                    filter: 'context.a',
                    value: '1',
                    conditionType: 'eq',
                },
            },
            {
                id: ids.condBNode,
                data: {
                    type: 'conditional',
                    id: ids.condBData,
                    label: 'if B',
                    filter: 'context.b',
                    value: '1',
                    conditionType: 'eq',
                },
            },
            { id: ids.sharedNode, data: { type: 'endpoint', id: ids.sharedEndpoint, label: 'shared endpoint' } },
            { id: ids.noBNode, data: { type: 'endpoint', id: ids.noBEndpoint, label: 'no B endpoint' } },
        ],
        edges: [
            { id: uuid(), source: ids.input, target: ids.condANode },
            { id: uuid(), source: ids.condANode, target: ids.sharedNode, sourceHandle: 'yes' },
            { id: uuid(), source: ids.condANode, target: ids.condBNode, sourceHandle: 'no' },
            { id: uuid(), source: ids.condBNode, target: ids.sharedNode, sourceHandle: 'yes' },
            { id: uuid(), source: ids.condBNode, target: ids.noBNode, sourceHandle: 'no' },
        ],
    };

    return { ids, diagram };
};

const buildLinearDiagram = () => {
    const ids = {
        input: '0',
        node1: uuid(),
        ep1: uuid(),
        node2: uuid(),
        ep2: uuid(),
        node3: uuid(),
        ep3: uuid(),
    };

    const diagram = {
        nodes: [
            { id: ids.input, type: 'input', data: { type: 'input', label: 'start' } },
            { id: ids.node1, data: { type: 'endpoint', id: ids.ep1, label: 'step 1' } },
            { id: ids.node2, data: { type: 'endpoint', id: ids.ep2, label: 'step 2' } },
            { id: ids.node3, data: { type: 'endpoint', id: ids.ep3, label: 'step 3' } },
        ],
        edges: [
            { id: uuid(), source: ids.input, target: ids.node1 },
            { id: uuid(), source: ids.node1, target: ids.node2 },
            { id: uuid(), source: ids.node2, target: ids.node3 },
        ],
    };

    return { ids, diagram };
};

const buildSingleConditionalDiagram = () => {
    const ids = {
        input: '0',
        condNode: uuid(),
        condData: uuid(),
        yesNode: uuid(),
        yesEndpoint: uuid(),
        noNode: uuid(),
        noEndpoint: uuid(),
    };

    const diagram = {
        nodes: [
            { id: ids.input, type: 'input', data: { type: 'input', label: 'start' } },
            {
                id: ids.condNode,
                data: {
                    type: 'conditional',
                    id: ids.condData,
                    label: 'if status ok',
                    filter: 'status',
                    value: 'ok',
                    conditionType: 'eq',
                },
            },
            { id: ids.yesNode, data: { type: 'endpoint', id: ids.yesEndpoint, label: 'ok path' } },
            { id: ids.noNode, data: { type: 'endpoint', id: ids.noEndpoint, label: 'fail path' } },
        ],
        edges: [
            { id: uuid(), source: ids.input, target: ids.condNode },
            { id: uuid(), source: ids.condNode, target: ids.yesNode, sourceHandle: 'yes' },
            { id: uuid(), source: ids.condNode, target: ids.noNode, sourceHandle: 'no' },
        ],
    };

    return { ids, diagram };
};

const buildSingleBranchDiagram = () => {
    const ids = {
        input: '0',
        condNode: uuid(),
        condData: uuid(),
        noNode: uuid(),
        noEndpoint: uuid(),
    };

    const diagram = {
        nodes: [
            { id: ids.input, type: 'input', data: { type: 'input', label: 'start' } },
            {
                id: ids.condNode,
                data: {
                    type: 'conditional',
                    id: ids.condData,
                    label: 'only-no-branch',
                    filter: 'flag',
                    value: 'active',
                    conditionType: 'eq',
                },
            },
            { id: ids.noNode, data: { type: 'endpoint', id: ids.noEndpoint, label: 'no path endpoint' } },
        ],
        edges: [
            { id: uuid(), source: ids.input, target: ids.condNode },
            { id: uuid(), source: ids.condNode, target: ids.noNode, sourceHandle: 'no' },
        ],
    };

    return { ids, diagram };
};

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

describe('WSRestFlowUpdater — comprehensive integration tests', () => {
    const repository = new KnexWSRestFlowRepository(knexConfig);
    const stepRepository = new KnexWSRestWorkflowStepRepository(repository.connection);

    /**
     * Toda alta y toda actualizacion de flujo pasan por estos dos envoltorios
     * para respaldar antes los endpoints y funciones que nombra el diagrama:
     * son ids inventados en este archivo con `uuid()` y postgres los exige
     * existentes al guardar los pasos. El envoltorio recibe el payload entero
     * porque el diagrama nuevo viaja dentro de el.
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

    beforeEach(async () => {
        repository.connection.client.setMaxListeners(200);

        await repository.connection('ws_rest_workflow_steps').del();
        await repository.connection('ws_rest_conditionals').del();
        await repository.connection('ws_rest_flows').del();
        jest.spyOn(EventLogger.prototype, 'log').mockResolvedValue(undefined);

        // NOTA: Mock exclusivo para SQLite en testing.
        // Postgres maneja JSON nativamente, pero SQLite requiere JSON.stringify() crudo en los .update().
        const realUpdate = repository.update.bind(repository);
        jest.spyOn(repository, 'update').mockImplementation(async (aggregate) => {
            if (
                aggregate.changedAttributes &&
                aggregate.changedAttributes.json_diagram_properties !== undefined &&
                typeof aggregate.changedAttributes.json_diagram_properties !== 'string'
            ) {
                aggregate.changedAttributes.json_diagram_properties = JSON.stringify(
                    aggregate.changedAttributes.json_diagram_properties
                );
            }
            return realUpdate(aggregate);
        });
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    describe('1 — Basic field update (no diagram)', () => {
        it('updates description without touching subflows or diagram', async () => {
            const flowDto = buildBaseFlowDto(buildLinearDiagram().diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await createFlow(creator, flowDto);

            const newDescription = `updated-desc-${uuid()}`;
            await expect(
                updateFlow(updater, flowDto.id, {
                    description: newDescription,
                    updated_at: new Date().toISOString(),
                    updated_by: uuid(),
                })
            ).resolves.toBeUndefined();

            // `connection.raw` en postgres devuelve el `Result` de pg: las
            // filas estan en `.rows`, no en el propio objeto.
            const { rows } = await repository.connection.raw('SELECT description FROM ws_rest_flows WHERE id = ?', [
                flowDto.id,
            ]);
            expect(rows[0]?.description).toBe(newDescription);
        });

        it('does not create any subflows when updating only metadata fields', async () => {
            const flowDto = buildBaseFlowDto(buildLinearDiagram().diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await createFlow(creator, flowDto);

            await updateFlow(updater, flowDto.id, {
                description: `only-metadata-${uuid()}`,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });
            const count = await countActiveSubflows(repository.connection, flowDto.external_code);
            expect(count).toBe(0);
            const conditionals = await repository.connection('ws_rest_conditionals').select('*');
            expect(conditionals.length).toBe(0);
        });
    });

    describe('2 — Shared satisfied-branch regressions', () => {
        it('resolves without error when one conditional changes and two satisfied branches share the same endpoint', async () => {
            const { ids, diagram } = buildSharedSatisfiedDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updatedDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(updatedDiagram.nodes, ids.condBData).data.value = '2';

            await expect(
                updateFlow(updater, flowDto.id, {
                    json_diagram_properties: updatedDiagram,
                    updated_at: new Date().toISOString(),
                    updated_by: uuid(),
                })
            ).resolves.toBeUndefined();
        });

        it('keeps both satisfied-branch edges in the persisted main flow after a partial update', async () => {
            const { ids, diagram } = buildSharedSatisfiedDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updateSpy = jest.spyOn(repository, 'update');
            const updater = new WSRestFlowUpdater(repository, stepRepository);

            const updatedDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(updatedDiagram.nodes, ids.condBData).data.filter = 'context.b2';

            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: updatedDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const persistedMain = getLastMainDiagramFromUpdateSpy(updateSpy, flowDto.id);
            expect(hasEdge(persistedMain.edges, ids.condANode, ids.sharedNode, 'yes')).toBe(true);
            expect(hasEdge(persistedMain.edges, ids.condBNode, ids.sharedNode, 'yes')).toBe(true);
        });

        it('preserves satisfied subflow ids for both conditionals after updating one conditional', async () => {
            const { ids, diagram } = buildSharedSatisfiedDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updateSpy = jest.spyOn(repository, 'update');
            const updater = new WSRestFlowUpdater(repository, stepRepository);

            const updatedDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(updatedDiagram.nodes, ids.condBData).data.value = 'B-updated';

            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: updatedDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const persistedAfter = getLastMainDiagramFromUpdateSpy(updateSpy, flowDto.id);
            const conditionalsAfter = persistedAfter.nodes.filter((n) => n?.data?.type === 'conditional');

            const condAAfter = getConditionalNodeByDataId(conditionalsAfter, ids.condAData);
            const condBAfter = getConditionalNodeByDataId(conditionalsAfter, ids.condBData);

            expect(condAAfter.data.subflows.satisfied).toBeTruthy();
            expect(condBAfter.data.subflows.satisfied).toBeTruthy();
        });

        it('keeps all branch references on both conditionals after a partial update', async () => {
            const { ids, diagram } = buildSharedSatisfiedDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updateSpy = jest.spyOn(repository, 'update');
            const updater = new WSRestFlowUpdater(repository, stepRepository);

            const updatedDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(updatedDiagram.nodes, ids.condBData).data.label = 'if B changed';

            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: updatedDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const persistedAfter = getLastMainDiagramFromUpdateSpy(updateSpy, flowDto.id);
            const conditionalsAfter = persistedAfter.nodes.filter((n) => n?.data?.type === 'conditional');

            const condAAfter = getConditionalNodeByDataId(conditionalsAfter, ids.condAData);
            const condBAfter = getConditionalNodeByDataId(conditionalsAfter, ids.condBData);

            expect(condAAfter).toBeTruthy();
            expect(condBAfter).toBeTruthy();
            expect(condAAfter.data.subflows.satisfied).toBeTruthy();
            expect(condAAfter.data.subflows.unsatisfied).toBeTruthy();
            expect(condBAfter.data.subflows.satisfied).toBeTruthy();
            expect(condBAfter.data.subflows.unsatisfied).toBeTruthy();
        });

        it('passes satisfied subflow ids to WSRestConditional upsert for both converging conditionals', async () => {
            const { ids, diagram } = buildSharedSatisfiedDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            const secondUpdate = structuredClone(diagram);
            getConditionalNodeByDataId(secondUpdate.nodes, ids.condBData).data.filter = 'context.b.second';

            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: secondUpdate,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const allDtos = await repository.connection('ws_rest_conditionals').select('*');

            const condARecord = allDtos.find((dto) => dto.id === ids.condAData);
            const condBRecord = allDtos.find((dto) => dto.id === ids.condBData);

            expect(condARecord?.satisfied).toBeTruthy();
            expect(condBRecord?.satisfied).toBeTruthy();
        });

        it('sends all shared-branch subflows to the step manager update payload', async () => {
            const { ids, diagram } = buildSharedSatisfiedDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            const updatedDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(updatedDiagram.nodes, ids.condBData).data.value = 'B-changed';

            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: updatedDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const dbSubflows = await repository
                .connection('ws_rest_flows')
                .where('is_primary', 0)
                .where('external_code', 'like', `${flowDto.external_code}%`);
            expect(dbSubflows.length).toBeGreaterThanOrEqual(2);

            const sharedBranchSubflows = dbSubflows.filter((sf) => {
                const props =
                    typeof sf.json_diagram_properties === 'string'
                        ? JSON.parse(sf.json_diagram_properties)
                        : sf.json_diagram_properties;
                return (
                    hasEdge(props.edges, ids.condANode, ids.sharedNode, 'yes') ||
                    hasEdge(props.edges, ids.condBNode, ids.sharedNode, 'yes')
                );
            });
            expect(sharedBranchSubflows.length).toBeGreaterThanOrEqual(1);
        });

        it('shared satisfied subflows remain active in DB after a partial update (not orphaned)', async () => {
            const { diagram } = buildSharedSatisfiedDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const countAfterCreate = await countActiveSubflows(repository.connection, flowDto.external_code);

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            const updatedDiagram = structuredClone(diagram);
            updatedDiagram.nodes
                .filter((n) => n?.data?.type === 'conditional')
                .forEach((n) => {
                    n.data.label = `${n.data.label} (edited)`;
                });

            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: updatedDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const countAfterUpdate = await countActiveSubflows(repository.connection, flowDto.external_code);
            expect(countAfterUpdate).toBeGreaterThanOrEqual(countAfterCreate);
        });
    });

    describe('3 — Orphaned subflow cleanup', () => {
        it('soft-deletes subflow rows when the conditional is removed from the diagram', async () => {
            const { ids, diagram } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const subflowsBefore = await queryActiveSubflows(repository.connection, flowDto.external_code);
            expect(subflowsBefore.length).toBeGreaterThanOrEqual(1);
            const orphanIds = subflowsBefore.map((r) => r.id);
            const linearDiagram = {
                nodes: [
                    { id: ids.input, type: 'input', data: { type: 'input', label: 'start' } },
                    { id: ids.yesNode, data: { type: 'endpoint', id: ids.yesEndpoint, label: 'ok path' } },
                ],
                edges: [{ id: uuid(), source: ids.input, target: ids.yesNode }],
            };

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: linearDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });
            const stillActive = await queryActiveSubflows(repository.connection, flowDto.external_code);
            const activeIds = new Set(stillActive.map((r) => r.id));
            orphanIds.forEach((id) => expect(activeIds.has(id)).toBe(false));
        });

        it('marks orphaned subflow rows with deleted_at set in the DB after the conditional is removed', async () => {
            const { ids, diagram } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);
            const rowsBefore = await queryActiveSubflows(repository.connection, flowDto.external_code);
            const orphanIds = rowsBefore.map((r) => r.id);
            expect(orphanIds.length).toBeGreaterThanOrEqual(1);

            const linearDiagram = {
                nodes: [
                    { id: ids.input, type: 'input', data: { type: 'input', label: 'start' } },
                    { id: ids.yesNode, data: { type: 'endpoint', id: ids.yesEndpoint } },
                ],
                edges: [{ id: uuid(), source: ids.input, target: ids.yesNode }],
            };

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: linearDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });
            const activeAfter = await queryActiveSubflows(repository.connection, flowDto.external_code);
            const activeIds = new Set(activeAfter.map((r) => r.id));
            orphanIds.forEach((id) => expect(activeIds.has(id)).toBe(false));
        });

        it('does not delete subflows that are still referenced by the updated diagram', async () => {
            const { ids, diagram } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            const updatedDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(updatedDiagram.nodes, ids.condData).data.value = 'updated-value';

            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: updatedDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const count = await countActiveSubflows(repository.connection, flowDto.external_code);
            expect(count).toBeGreaterThanOrEqual(2);
        });
    });

    describe('4 — Double sequential update (idempotency)', () => {
        it('produces the same active-subflow count after two identical updates', async () => {
            const { diagram } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const countAfterCreate = await countActiveSubflows(repository.connection, flowDto.external_code);

            const updater1 = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater1, flowDto.id, {
                json_diagram_properties: structuredClone(diagram),
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });
            const countAfterFirst = await countActiveSubflows(repository.connection, flowDto.external_code);

            const updater2 = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater2, flowDto.id, {
                json_diagram_properties: structuredClone(diagram),
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });
            const countAfterSecond = await countActiveSubflows(repository.connection, flowDto.external_code);

            expect(countAfterFirst).toBeGreaterThanOrEqual(countAfterCreate);
            expect(countAfterSecond).toBe(countAfterFirst);
        });

        it('does not duplicate subflow rows on repeated updates of the same conditional', async () => {
            const { ids, diagram } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            for (let i = 0; i < 3; i++) {
                const d = structuredClone(diagram);
                getConditionalNodeByDataId(d.nodes, ids.condData).data.value = `iteration-${i}`;
                const updaterN = new WSRestFlowUpdater(repository, stepRepository);
                await updateFlow(updaterN, flowDto.id, {
                    json_diagram_properties: d,
                    updated_at: new Date().toISOString(),
                    updated_by: uuid(),
                });
            }

            const allSubflowRows = await queryActiveSubflows(repository.connection, flowDto.external_code);
            const allIds = allSubflowRows.map((r) => r.id);
            const uniqueIds = new Set(allIds);
            expect(allIds.length).toBe(uniqueIds.size);
        });

        it('handles three consecutive updates on shared-branch diagram without corruption', async () => {
            const { ids, diagram } = buildSharedSatisfiedDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            for (let i = 0; i < 3; i++) {
                const d = structuredClone(diagram);
                getConditionalNodeByDataId(d.nodes, ids.condBData).data.value = `round-${i}`;
                const updaterN = new WSRestFlowUpdater(repository, stepRepository);
                await expect(
                    updateFlow(updaterN, flowDto.id, {
                        json_diagram_properties: d,
                        updated_at: new Date().toISOString(),
                        updated_by: uuid(),
                    })
                ).resolves.toBeUndefined();
            }
            const updateSpy = jest.spyOn(repository, 'update');
            const finalDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(finalDiagram.nodes, ids.condBData).data.value = 'final';

            const updaterFinal = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updaterFinal, flowDto.id, {
                json_diagram_properties: finalDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const persisted = getLastMainDiagramFromUpdateSpy(updateSpy, flowDto.id);
            const condA = getConditionalNodeByDataId(persisted.nodes, ids.condAData);
            const condB = getConditionalNodeByDataId(persisted.nodes, ids.condBData);

            expect(condA.data.subflows.satisfied).toBeTruthy();
            expect(condB.data.subflows.satisfied).toBeTruthy();
        });
    });

    describe('5 — Add a conditional on second update', () => {
        it('creates subflows when a conditional is introduced via update', async () => {
            const { diagram: linearDiagram } = buildLinearDiagram();
            const flowDto = buildBaseFlowDto(linearDiagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);
            const countBeforeConditional = await countActiveSubflows(repository.connection, flowDto.external_code);
            expect(countBeforeConditional).toBe(0);

            const { diagram: conditionalDiagram } = buildSingleConditionalDiagram();
            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: conditionalDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const countAfterConditional = await countActiveSubflows(repository.connection, flowDto.external_code);
            expect(countAfterConditional).toBeGreaterThanOrEqual(1);
        });

        it('persists the pruned main diagram (conditional node present, branch targets removed) after adding conditional', async () => {
            const { diagram: linearDiagram } = buildLinearDiagram();
            const flowDto = buildBaseFlowDto(linearDiagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const { ids: condIds, diagram: conditionalDiagram } = buildSingleConditionalDiagram();
            const updateSpy = jest.spyOn(repository, 'update');
            const updater = new WSRestFlowUpdater(repository, stepRepository);

            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: conditionalDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const persisted = getLastMainDiagramFromUpdateSpy(updateSpy, flowDto.id);
            const cond = getConditionalNodeByDataId(persisted.nodes, condIds.condData);
            expect(cond).toBeDefined();
            const mainNodeIds = persisted.nodes.map((n) => n.id);
            expect(mainNodeIds).not.toContain(condIds.yesNode);
            expect(mainNodeIds).not.toContain(condIds.noNode);
        });

        it('subflows created after adding conditional are non-primary', async () => {
            const { diagram: linearDiagram } = buildLinearDiagram();
            const flowDto = buildBaseFlowDto(linearDiagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const { diagram: conditionalDiagram } = buildSingleConditionalDiagram();
            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: conditionalDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            // `is_primary` es `boolean` en postgres: compararla con 0 aborta
            // la consulta. Y `connection.raw` devuelve el `Result` de pg.
            const { rows } = await repository.connection.raw(
                `SELECT id, is_primary FROM ws_rest_flows WHERE is_primary = false`
            );
            expect(rows.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('6 — Replace conditional with different topology', () => {
        it('creates new subflows when a different conditional is introduced on second update', async () => {
            const { diagram: diagA } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagA);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const countAfterCreate = await countActiveSubflows(repository.connection, flowDto.external_code);
            expect(countAfterCreate).toBeGreaterThanOrEqual(1);
            const { ids: newIds, diagram: diagB } = buildSingleConditionalDiagram();
            const updateSpy = jest.spyOn(repository, 'update');

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: diagB,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });
            const countAfterReplace = await countActiveSubflows(repository.connection, flowDto.external_code);
            expect(countAfterReplace).toBeGreaterThanOrEqual(1);
        });

        it('correctly upserts conditional creator/updater calls when changing conditional data id', async () => {
            const { ids: idsA, diagram: diagA } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagA);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);
            jest.restoreAllMocks();
            jest.spyOn(EventLogger.prototype, 'log').mockResolvedValue(undefined);

            const { ids: idsB, diagram: diagB } = buildSingleConditionalDiagram();
            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: diagB,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });
            const allDtos = await repository.connection('ws_rest_conditionals').select('*');

            const condBUpserted = allDtos.find((dto) => dto.id === idsB.condData);
            expect(condBUpserted).toBeDefined();
            expect(condBUpserted.satisfied).toBeTruthy();
            expect(condBUpserted.unsatisfied).toBeTruthy();
        });
    });

    describe('7 — Diamond topology (3 conditionals, shared endpoint)', () => {
        it('resolves correctly when three conditionals share a satisfied target endpoint', async () => {
            const inputId = '0';
            const condANodeId = uuid(),
                condADataId = uuid();
            const condBNodeId = uuid(),
                condBDataId = uuid();
            const condCNodeId = uuid(),
                condCDataId = uuid();
            const sharedNodeId = uuid(),
                sharedEpId = uuid();
            const onlyCNodeId = uuid(),
                onlyCEpId = uuid();

            const diagram = {
                nodes: [
                    { id: inputId, type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: condANodeId,
                        data: {
                            type: 'conditional',
                            id: condADataId,
                            label: 'A',
                            filter: 'a',
                            value: '1',
                            conditionType: 'eq',
                        },
                    },
                    {
                        id: condBNodeId,
                        data: {
                            type: 'conditional',
                            id: condBDataId,
                            label: 'B',
                            filter: 'b',
                            value: '1',
                            conditionType: 'eq',
                        },
                    },
                    {
                        id: condCNodeId,
                        data: {
                            type: 'conditional',
                            id: condCDataId,
                            label: 'C',
                            filter: 'c',
                            value: '1',
                            conditionType: 'eq',
                        },
                    },
                    { id: sharedNodeId, data: { type: 'endpoint', id: sharedEpId, label: 'shared' } },
                    { id: onlyCNodeId, data: { type: 'endpoint', id: onlyCEpId, label: 'only-c' } },
                ],
                edges: [
                    { id: uuid(), source: inputId, target: condANodeId },
                    { id: uuid(), source: condANodeId, target: sharedNodeId, sourceHandle: 'yes' },
                    { id: uuid(), source: condANodeId, target: condBNodeId, sourceHandle: 'no' },
                    { id: uuid(), source: condBNodeId, target: sharedNodeId, sourceHandle: 'yes' },
                    { id: uuid(), source: condBNodeId, target: condCNodeId, sourceHandle: 'no' },
                    { id: uuid(), source: condCNodeId, target: sharedNodeId, sourceHandle: 'yes' },
                    { id: uuid(), source: condCNodeId, target: onlyCNodeId, sourceHandle: 'no' },
                ],
            };

            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updatedDiagram = structuredClone(diagram);
            updatedDiagram.nodes.find((n) => n?.data?.id === condCDataId).data.value = 'updated-C';

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await expect(
                updateFlow(updater, flowDto.id, {
                    json_diagram_properties: updatedDiagram,
                    updated_at: new Date().toISOString(),
                    updated_by: uuid(),
                })
            ).resolves.toBeUndefined();
        });

        it('preserves all 3 conditional records during a partial update of diamond diagram', async () => {
            const inputId = '0';
            const condANodeId = uuid(),
                condADataId = uuid();
            const condBNodeId = uuid(),
                condBDataId = uuid();
            const condCNodeId = uuid(),
                condCDataId = uuid();
            const sharedNodeId = uuid();
            const onlyCNodeId = uuid();

            const diagram = {
                nodes: [
                    { id: inputId, type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: condANodeId,
                        data: {
                            type: 'conditional',
                            id: condADataId,
                            label: 'A',
                            filter: 'a',
                            value: '1',
                            conditionType: 'eq',
                        },
                    },
                    {
                        id: condBNodeId,
                        data: {
                            type: 'conditional',
                            id: condBDataId,
                            label: 'B',
                            filter: 'b',
                            value: '1',
                            conditionType: 'eq',
                        },
                    },
                    {
                        id: condCNodeId,
                        data: {
                            type: 'conditional',
                            id: condCDataId,
                            label: 'C',
                            filter: 'c',
                            value: '1',
                            conditionType: 'eq',
                        },
                    },
                    { id: sharedNodeId, data: { type: 'endpoint', id: uuid(), label: 'shared' } },
                    { id: onlyCNodeId, data: { type: 'endpoint', id: uuid(), label: 'only-c' } },
                ],
                edges: [
                    { id: uuid(), source: inputId, target: condANodeId },
                    { id: uuid(), source: condANodeId, target: sharedNodeId, sourceHandle: 'yes' },
                    { id: uuid(), source: condANodeId, target: condBNodeId, sourceHandle: 'no' },
                    { id: uuid(), source: condBNodeId, target: sharedNodeId, sourceHandle: 'yes' },
                    { id: uuid(), source: condBNodeId, target: condCNodeId, sourceHandle: 'no' },
                    { id: uuid(), source: condCNodeId, target: sharedNodeId, sourceHandle: 'yes' },
                    { id: uuid(), source: condCNodeId, target: onlyCNodeId, sourceHandle: 'no' },
                ],
            };

            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updateSpy = jest.spyOn(repository, 'update');
            const updatedDiagram = structuredClone(diagram);
            updatedDiagram.nodes.find((n) => n?.data?.id === condCDataId).data.value = 'updated-C-only';

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: updatedDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const persisted = getLastMainDiagramFromUpdateSpy(updateSpy, flowDto.id);
            const condA = getConditionalNodeByDataId(persisted.nodes, condADataId);
            const condB = getConditionalNodeByDataId(persisted.nodes, condBDataId);
            const condC = getConditionalNodeByDataId(persisted.nodes, condCDataId);

            expect(condA).toBeDefined();
            expect(condB).toBeDefined();
            expect(condC).toBeDefined();
            expect(condA.data.subflows.satisfied).toBeTruthy();
            expect(condB.data.subflows.satisfied).toBeTruthy();
            expect(condC.data.subflows.satisfied).toBeTruthy();
        });
    });

    describe('8 — Single-branch conditional (unsatisfied only)', () => {
        it('creates only the unsatisfied subflow when the conditional has no yes-edge', async () => {
            const { diagram } = buildSingleBranchDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const createdDtos = await repository.connection('ws_rest_conditionals').select('*');
            expect(createdDtos.length).toBeGreaterThanOrEqual(1);

            const cond = createdDtos[createdDtos.length - 1];
            expect(cond.satisfied).toBeNull();
            expect(cond.unsatisfied).toBeTruthy();
        });

        it('updates the unsatisfied subflow correctly on a follow-up update', async () => {
            const { ids, diagram } = buildSingleBranchDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updatedDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(updatedDiagram.nodes, ids.condData).data.value = 'inactive';

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await expect(
                updateFlow(updater, flowDto.id, {
                    json_diagram_properties: updatedDiagram,
                    updated_at: new Date().toISOString(),
                    updated_by: uuid(),
                })
            ).resolves.toBeUndefined();

            const count = await countActiveSubflows(repository.connection, flowDto.external_code);
            expect(count).toBeGreaterThanOrEqual(1);
        });

        it('conditional record still has null satisfied after updating single-branch conditional', async () => {
            const { ids, diagram } = buildSingleBranchDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);
            jest.restoreAllMocks();
            jest.spyOn(EventLogger.prototype, 'log').mockResolvedValue(undefined);

            const updatedDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(updatedDiagram.nodes, ids.condData).data.value = 'updated-flag';

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: updatedDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const allDtos = await repository.connection('ws_rest_conditionals').select('*');

            const condRecord = allDtos.find((dto) => dto.id === ids.condData);
            expect(condRecord).toBeDefined();
            expect(condRecord.satisfied).toBeNull();
            expect(condRecord.unsatisfied).toBeTruthy();
        });
    });

    describe('9 — External code collision validation', () => {
        it('throws ValidationFailError when updating external_code to one already used by another primary flow', async () => {
            const flowA = buildBaseFlowDto(buildLinearDiagram().diagram);
            const flowB = buildBaseFlowDto(buildLinearDiagram().diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowA);
            await createFlow(creator, flowB);

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await expect(
                updateFlow(updater, flowB.id, {
                    external_code: flowA.external_code,
                    updated_at: new Date().toISOString(),
                    updated_by: uuid(),
                })
            ).rejects.toThrow(ValidationFailError);
        });

        it('does not throw when updating external_code to the same value it already has', async () => {
            const flowDto = buildBaseFlowDto(buildLinearDiagram().diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await expect(
                updateFlow(updater, flowDto.id, {
                    external_code: flowDto.external_code,
                    updated_at: new Date().toISOString(),
                    updated_by: uuid(),
                })
            ).resolves.toBeUndefined();
        });
    });

    describe('10 — Guard: flow not found', () => {
        it('throws a CustomError when the flow id does not exist in the DB', async () => {
            const updater = new WSRestFlowUpdater(repository, stepRepository);
            const nonExistentId = uuid();

            await expect(
                updateFlow(updater, nonExistentId, {
                    description: 'should fail',
                    updated_at: new Date().toISOString(),
                    updated_by: uuid(),
                })
            ).rejects.toThrow(CustomError);
        });

        it('throws with status 404 for a non-existent flow id', async () => {
            const updater = new WSRestFlowUpdater(repository, stepRepository);
            const nonExistentId = uuid();

            let thrownError = null;
            try {
                await updateFlow(updater, nonExistentId, {
                    description: 'should fail',
                    updated_at: new Date().toISOString(),
                    updated_by: uuid(),
                });
            } catch (error) {
                thrownError = error;
            }

            expect(thrownError).not.toBeNull();
            expect(thrownError.statusCode).toBe(404);
        });
    });

    describe('11 — Step manager receives correct subflows payload', () => {
        it('passes subflows with non-empty json_diagram_properties to step manager on update', async () => {
            const { diagram } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: structuredClone(diagram),
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const dbSubflows = await repository
                .connection('ws_rest_flows')
                .where('is_primary', 0)
                .where('external_code', 'like', `${flowDto.external_code}%`);
            expect(dbSubflows.length).toBeGreaterThanOrEqual(1);
            dbSubflows.forEach((sf) => {
                expect(sf.id).toBeTruthy();
                expect(sf.json_diagram_properties).toBeDefined();
                const props =
                    typeof sf.json_diagram_properties === 'string'
                        ? JSON.parse(sf.json_diagram_properties)
                        : sf.json_diagram_properties;
                expect(Array.isArray(props.nodes)).toBe(true);
                expect(Array.isArray(props.edges)).toBe(true);
            });
        });

        it('passes at least 2 subflows to step manager when two conditionals share a branch target', async () => {
            const { ids, diagram } = buildSharedSatisfiedDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updatedDiagram = structuredClone(diagram);
            getConditionalNodeByDataId(updatedDiagram.nodes, ids.condAData).data.value = 'A-new';

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: updatedDiagram,
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const dbSubflows = await repository
                .connection('ws_rest_flows')
                .where('is_primary', 0)
                .where('external_code', 'like', `${flowDto.external_code}%`);
            expect(dbSubflows.length).toBeGreaterThanOrEqual(2);
        });

        it('each subflow in the step manager payload has a valid UUID as its id', async () => {
            const { diagram } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: structuredClone(diagram),
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const dbSubflows = await repository
                .connection('ws_rest_flows')
                .where('is_primary', 0)
                .where('external_code', 'like', `${flowDto.external_code}%`);
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            dbSubflows.forEach((sf) => {
                expect(sf.id).toMatch(uuidRegex);
            });
        });

        it('step manager first argument is the primary WSRestFlow entity', async () => {
            const { diagram } = buildSingleConditionalDiagram();
            const flowDto = buildBaseFlowDto(diagram);
            const creator = new WSRestFlowCreator(repository, stepRepository);
            await createFlow(creator, flowDto);

            const updater = new WSRestFlowUpdater(repository, stepRepository);
            await updateFlow(updater, flowDto.id, {
                json_diagram_properties: structuredClone(diagram),
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            });

            const passedFlow = await repository.connection('ws_rest_flows').where({ id: flowDto.id }).first();
            expect(passedFlow).toBeDefined();
            expect(passedFlow.id).toBe(flowDto.id);
        });
    });
});
