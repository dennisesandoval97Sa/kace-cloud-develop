import { jest } from '@jest/globals';
import {
    WSRestFlow,
    WSRestFlowCreator,
    WSRestFlowUpdater,
    WSRestFlowFinder,
    WSRestFlowDeleter,
    WSRestFlowSearcher,
    KnexWSRestFlowRepository,
    WSRestFlowResponse,
    WSRestFlowCollectionResponse,
    WSRestFlowCounter,
} from '../../src/ws-rest-flows/index.js';
import WSRestFlowMother from './domain/WSRestFlowMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { QueryDBError } from '../../src/shared/errors/QueryDBError.js';
import { User } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';

describe('WSRestFlow Integration Tests', () => {
    const repository = new KnexWSRestFlowRepository(knexConfig);
    const stepRepository = new KnexWSRestWorkflowStepRepository(repository.connection);
    const currentUser = new User(UsersMother.dto());

    it('should create a WSRestFlow', async () => {
        const dto = WSRestFlowMother.dto();
        const wsRestFlowCreator = new WSRestFlowCreator(repository, stepRepository);

        await wsRestFlowCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing WSRestFlow', async () => {
        const wsRestFlow = await WSRestFlowMother.create(repository);
        const wsRestFlowFinder = new WSRestFlowFinder(repository, currentUser);

        const wsRestFlowResult = await wsRestFlowFinder.execute(wsRestFlow.id.value);

        expect(wsRestFlowResult).not.toBeNull();
        expect(wsRestFlowResult).toBeInstanceOf(WSRestFlowResponse);
    });

    it('can update an existing WSRestFlow', async () => {
        const wsRestFlow = await WSRestFlowMother.create(repository);
        const wsRestFlowUpdater = new WSRestFlowUpdater(repository, stepRepository);

        const newValues = { description: 'Updated flow description' };
        await wsRestFlowUpdater.execute(wsRestFlow.id.value, newValues);

        const result = await repository.find(wsRestFlow.id);
        expect(result).toBeInstanceOf(WSRestFlow);
        expect(result.description.value).toBe(newValues.description);
    });

    it('can delete an existing WSRestFlow', async () => {
        const wsRestFlow = await WSRestFlowMother.create(repository);
        const wsRestFlowDeleter = new WSRestFlowDeleter(repository, stepRepository);

        await wsRestFlowDeleter.execute(wsRestFlow.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(wsRestFlow.id);
        expect(result).toBeInstanceOf(WSRestFlow);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('identifies only active primary Channel Hub connection flows as registration flows', async () => {
        const validCurrent = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-connection',
            description: 'Channel Hub connection',
        });
        const validVariant = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-connection-gmail',
            description: 'Channel Hub Gmail connection',
        });
        const validUnderscoreVariant = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-connection_gmail',
            description: 'Channel Hub Gmail connection',
        });
        const internalBranch = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-connection_satisfied',
            description: 'Internal branch',
        });
        const sendFlow = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-send-email',
            description: 'Channel Hub send email',
        });
        const inactive = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-connection-disabled',
            description: 'Inactive Channel Hub connection',
        });
        await repository.connection(repository.tableName).where({ id: internalBranch.id.value }).update({
            is_primary: false,
        });
        await repository.connection(repository.tableName).where({ id: inactive.id.value }).update({ is_active: false });

        expect(await repository.isValidChannelHubRegistrationFlow(validCurrent.id)).toBe(true);
        expect(await repository.isValidChannelHubRegistrationFlow(validVariant.id)).toBe(true);
        expect(await repository.isValidChannelHubRegistrationFlow(validUnderscoreVariant.id)).toBe(true);
        expect(await repository.isValidChannelHubRegistrationFlow(internalBranch.id)).toBe(false);
        expect(await repository.isValidChannelHubRegistrationFlow(sendFlow.id)).toBe(false);
        expect(await repository.isValidChannelHubRegistrationFlow(inactive.id)).toBe(false);
    });

    it('validates an exact active primary retained Channel Hub RestFlow purpose', async () => {
        const validList = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-mail-rules-list',
            description: 'Channel Hub mail-rule list',
        });
        const misleadingVariant = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-mail-rules-list-internal',
            description: 'Misleading list variant',
        });
        const wrongPurpose = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-mail-rule-priority-update',
            description: 'Channel Hub priority update',
        });
        const inactiveList = await WSRestFlowMother.create(repository, {
            external_code: 'channelhub-mail-rules-list',
            description: 'Inactive Channel Hub mail-rule list',
        });
        await repository.connection(repository.tableName).where({ id: inactiveList.id.value }).update({
            is_active: false,
        });

        expect(await repository.isValidChannelHubFlow(validList.id, 'channelhub-mail-rules-list')).toBe(true);
        expect(await repository.isValidChannelHubFlow(misleadingVariant.id, 'channelhub-mail-rules-list')).toBe(false);
        expect(await repository.isValidChannelHubFlow(wrongPurpose.id, 'channelhub-mail-rules-list')).toBe(false);
        expect(await repository.isValidChannelHubFlow(inactiveList.id, 'channelhub-mail-rules-list')).toBe(false);
    });

    it('searches for WSRestFlows with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await WSRestFlowMother.create(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const wsRestFlowSearcher = new WSRestFlowSearcher(repository);

        const searchResult = await wsRestFlowSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(WSRestFlowCollectionResponse);
    });

    it('should throw an error when creating an existing WSRestFlow', async () => {
        const wsRestFlow = await WSRestFlowMother.create(repository);
        const wsRestFlowCreator = new WSRestFlowCreator(repository, stepRepository);

        const dto = { ...WSRestFlowMother.dto(), id: wsRestFlow.id.value };
        await expect(wsRestFlowCreator.execute(dto)).rejects.toThrow(
            new CustomError(`WSRestFlow with id ${dto.id} already exists`)
        );
    });

    it('Should throw an error when finding a non-existent WSRestFlow instance', async () => {
        const wsRestFlowFinder = new WSRestFlowFinder(repository);

        await expect(wsRestFlowFinder.execute(uuid())).rejects.toThrow('Ws rest flow not found');
    });

    it('should throw an error when creating a WSRestFlow with invalid data', async () => {
        const dto = WSRestFlowMother.dto();
        delete dto.id;
        const wsRestFlowCreator = new WSRestFlowCreator(repository, stepRepository);

        await expect(wsRestFlowCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent WSRestFlow', async () => {
        const wsRestFlowUpdater = new WSRestFlowUpdater(repository, stepRepository);
        const newValues = { description: 'Updated description' };
        const nonExistentId = uuid();

        await expect(wsRestFlowUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `WSRestFlow with id ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent WSRestFlow', async () => {
        const wsRestFlowDeleter = new WSRestFlowDeleter(repository, stepRepository);
        const nonExistentId = uuid();
        await expect(
            wsRestFlowDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuid() })
        ).rejects.toThrow(`WSRestFlow with id ${nonExistentId} does not exist.`);
    });

    it('should count WSRestFlow instances correctly', async () => {
        // Los pasos del flujo referencian ws_rest_flows; postgres no deja borrar
        // el padre mientras el hijo exista.
        await repository.connection('ws_rest_workflow_steps').del();
        await repository.connection(repository.tableName).del();
        const counter = new WSRestFlowCounter(repository);
        const initialCount = Number((await counter.execute({ filters: [], relationship: null })).count);

        for (let i = 0; i < 10; i++) {
            await WSRestFlowMother.create(repository);
        }

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(initialCount + 10);
    });

    it('should throw QueryDBError when repository.save fails internally', async () => {
        const dto = WSRestFlowMother.dto();
        const repository = new KnexWSRestFlowRepository(knexConfig);

        await expect(
            repository.save({
                ...new WSRestFlow(dto),
                description: {
                    value: null,
                },
            })
        ).rejects.toThrow(QueryDBError);
    });

    it('should throw QueryDBError when repository.find fails internally', async () => {
        const repository = new KnexWSRestFlowRepository(knexConfig);

        await expect(repository.find({})).rejects.toThrow(QueryDBError);
    });

    it('should throw QueryDBError when repository.search fails internally', async () => {
        const repository = new KnexWSRestFlowRepository(knexConfig);

        await expect(repository.search({})).rejects.toThrow(QueryDBError);
    });

    it('should deduplicate identical nodes in json_diagram_properties preventing payload blowup', async () => {
        const dto = WSRestFlowMother.dto();
        const taskId = uuid();

        dto.json_diagram_properties = {
            nodes: [
                { id: taskId, data: { type: 'task' } },
                { id: taskId, data: { type: 'task' } },
                { id: taskId, data: { type: 'task' } },
            ],
            edges: [],
        };

        const creator = new WSRestFlowCreator(repository, stepRepository);
        await creator.execute(dto);

        const finder = new WSRestFlowFinder(repository, currentUser);
        const savedFlow = await finder.execute(dto.id);

        let jsonProps = savedFlow.toJson().data.json_diagram_properties;
        if (typeof jsonProps === 'string') jsonProps = JSON.parse(jsonProps);
        if (jsonProps?.value && typeof jsonProps.value === 'string') jsonProps.value = JSON.parse(jsonProps.value);

        const nodes = jsonProps?.value?.nodes || jsonProps?.nodes || [];

        expect(nodes.length).toBe(1);
        expect(nodes[0].id).toBe(taskId);
    });

    it('should deduplicate shared downstream nodes across conditional branches', async () => {
        const dto = WSRestFlowMother.dto();
        const condId = uuid();
        const sharedTaskId = uuid();

        dto.json_diagram_properties = {
            nodes: [
                { id: condId, data: { type: 'standard', id: condId } },
                { id: sharedTaskId, data: { type: 'task' } },
            ],
            edges: [
                { id: uuid(), source: condId, target: sharedTaskId, sourceHandle: 'yes' },
                { id: uuid(), source: condId, target: sharedTaskId, sourceHandle: 'no' },
            ],
        };

        const creator = new WSRestFlowCreator(repository, stepRepository);
        await creator.execute(dto);

        const finder = new WSRestFlowFinder(repository, currentUser);
        const savedFlow = await finder.execute(dto.id);

        let jsonProps = savedFlow.toJson().data.json_diagram_properties;
        if (typeof jsonProps === 'string') jsonProps = JSON.parse(jsonProps);
        if (jsonProps?.value && typeof jsonProps.value === 'string') jsonProps.value = JSON.parse(jsonProps.value);

        const nodes = jsonProps?.value?.nodes || jsonProps?.nodes || [];

        expect(nodes.length).toBe(2);
        const nodeIds = nodes.map((n) => n.id);
        expect(nodeIds).toContain(sharedTaskId);
        expect(nodeIds).toContain(condId);
    });

    it('should not grow node count across multiple save → read cycles (regression)', async () => {
        const nodeA = uuid();
        const nodeB = uuid();
        const nodeC = uuid();
        const edgeAB = uuid();
        const edgeBC = uuid();

        const dto = WSRestFlowMother.dto({
            json_diagram_properties: {
                nodes: [
                    { id: nodeA, data: { type: 'endpoint', label: 'A' } },
                    { id: nodeB, data: { type: 'endpoint', label: 'B' } },
                    { id: nodeC, data: { type: 'endpoint', label: 'C' } },
                    { id: nodeA, data: { type: 'endpoint', label: 'A' } },
                    { id: nodeB, data: { type: 'endpoint', label: 'B' } },
                    { id: nodeC, data: { type: 'endpoint', label: 'C' } },
                    { id: nodeA, data: { type: 'endpoint', label: 'A' } },
                    { id: nodeB, data: { type: 'endpoint', label: 'B' } },
                    { id: nodeC, data: { type: 'endpoint', label: 'C' } },
                ],
                edges: [
                    { id: edgeAB, source: nodeA, target: nodeB },
                    { id: edgeBC, source: nodeB, target: nodeC },
                    { id: edgeAB, source: nodeA, target: nodeB },
                    { id: edgeBC, source: nodeB, target: nodeC },
                ],
            },
        });

        const creator = new WSRestFlowCreator(repository, stepRepository);
        await creator.execute(dto);

        const saved = await repository.find({ value: dto.id });
        const diagram = saved.json_diagram_properties.value;

        expect(diagram.nodes.length).toBe(3);
        expect(diagram.edges.length).toBe(2);
    });

    describe('WSRestFlowDeleter — edge cases', () => {
        const buildDiagramWithConditional = () => {
            const inputId = '0';
            const condNode = uuid();
            const condData = uuid();
            const yesEp = uuid();
            const noEp = uuid();
            return {
                ids: { inputId, condNode, condData, yesEp, noEp },
                diagram: {
                    nodes: [
                        { id: inputId, type: 'input', data: { type: 'input', label: 'start' } },
                        {
                            id: condNode,
                            data: {
                                type: 'conditional',
                                id: condData,
                                label: 'cond',
                                filter: 'c.x',
                                value: '1',
                                conditionType: 'eq',
                                subflows: {},
                            },
                        },
                        { id: yesEp, data: { type: 'endpoint', id: uuid(), label: 'yes' } },
                        { id: noEp, data: { type: 'endpoint', id: uuid(), label: 'no' } },
                    ],
                    edges: [
                        { id: uuid(), source: inputId, target: condNode },
                        { id: uuid(), source: condNode, target: yesEp, sourceHandle: 'yes' },
                        { id: uuid(), source: condNode, target: noEp, sourceHandle: 'no' },
                    ],
                },
            };
        };

        it('deletes referenced subflows when the parent has conditional nodes', async () => {
            const creator = new WSRestFlowCreator(repository, stepRepository);
            const deleter = new WSRestFlowDeleter(repository, stepRepository);
            const flowDto = {
                id: uuid(),
                description: `parent-${uuid()}`,
                external_code: `parent_${uuid()}`,
                json_diagram_properties: buildDiagramWithConditional().diagram,
                is_active: true,
                is_primary: true,
                created_at: new Date().toISOString(),
                created_by: uuid(),
            };
            // Los endpoints del diagrama son ids inventados aqui y acaban en
            // `ws_rest_workflow_steps.endpoint_id`, que es clave foranea real.
            await WSRestFlowMother.ensureDiagramRelations(repository.connection, flowDto.json_diagram_properties);
            await creator.execute(flowDto);

            await deleter.execute(flowDto.id, { deleted_at: new Date().toISOString(), deleted_by: uuid() });

            const remaining = await repository
                .connection('ws_rest_flows')
                .where('external_code', 'like', `${flowDto.external_code}%`)
                .whereNull('deleted_at')
                .select('*');
            expect(remaining.length).toBe(0);
        });

        it('does NOT delete primary subflows (is_primary=true is skipped)', async () => {
            const primarySubflow = await WSRestFlowMother.create(repository, { is_primary: true });
            const deleter = new WSRestFlowDeleter(repository, stepRepository);

            const parentDiagram = {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: uuid(),
                        data: {
                            type: 'conditional',
                            id: uuid(),
                            label: 'cond',
                            filter: 'c.x',
                            value: '1',
                            conditionType: 'eq',
                            subflows: { satisfied: primarySubflow.id.value },
                        },
                    },
                ],
                edges: [],
            };
            const parent = await WSRestFlowMother.create(repository, { json_diagram_properties: parentDiagram });

            await deleter.execute(parent.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuid() });

            const primaryRow = await repository
                .connection('ws_rest_flows')
                .where('id', primarySubflow.id.value)
                .first();
            expect(primaryRow.deleted_at).toBeNull();
        });

        it('skips already-soft-deleted subflows', async () => {
            const sfDto = WSRestFlowMother.dto();
            sfDto.is_primary = false;
            await repository.save(WSRestFlow.create(sfDto));
            await repository
                .connection('ws_rest_flows')
                .where('id', sfDto.id)
                .update({ deleted_at: new Date().toISOString() });

            const parentDiagram = {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: uuid(),
                        data: {
                            type: 'conditional',
                            id: uuid(),
                            label: 'cond',
                            filter: 'c.x',
                            value: '1',
                            conditionType: 'eq',
                            subflows: { satisfied: sfDto.id },
                        },
                    },
                ],
                edges: [],
            };
            const parent = await WSRestFlowMother.create(repository, { json_diagram_properties: parentDiagram });
            const deleter = new WSRestFlowDeleter(repository, stepRepository);

            await expect(
                deleter.execute(parent.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuid() })
            ).resolves.toBeUndefined();
        });

        it('creates ws_rest_conditionals rows via Creator (setup verification)', async () => {
            const creator = new WSRestFlowCreator(repository, stepRepository);
            const { diagram } = buildDiagramWithConditional();
            const flowDto = {
                id: uuid(),
                description: `cond-parent-${uuid()}`,
                external_code: `cond_parent_${uuid()}`,
                json_diagram_properties: diagram,
                is_active: true,
                is_primary: true,
                created_at: new Date().toISOString(),
                created_by: uuid(),
            };
            await WSRestFlowMother.ensureDiagramRelations(repository.connection, flowDto.json_diagram_properties);
            await creator.execute(flowDto);
            const conditionals = await repository.connection('ws_rest_conditionals').select('*');
            // Creator persists one conditional record per conditional node
            expect(conditionals.length).toBeGreaterThan(0);
        });

        it('deletes steps for parent and all subflows via stepManager', async () => {
            const creator = new WSRestFlowCreator(repository, stepRepository);
            const deleter = new WSRestFlowDeleter(repository, stepRepository);
            const flowDto = {
                id: uuid(),
                description: `steps-${uuid()}`,
                external_code: `steps_${uuid()}`,
                json_diagram_properties: buildDiagramWithConditional().diagram,
                is_active: true,
                is_primary: true,
                created_at: new Date().toISOString(),
                created_by: uuid(),
            };
            await WSRestFlowMother.ensureDiagramRelations(repository.connection, flowDto.json_diagram_properties);
            await creator.execute(flowDto);

            await deleter.execute(flowDto.id, { deleted_at: new Date().toISOString(), deleted_by: uuid() });

            // After deleting, the main flow's steps should be removed
            const stepsForFlow = await repository
                .connection('ws_rest_workflow_steps')
                .where({ flow_id: flowDto.id })
                .select('*');
            expect(stepsForFlow.length).toBe(0);
        });

        it('tolerates missing subflow ids in the diagram (logs but does not throw)', async () => {
            const parentDiagram = {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: uuid(),
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
                edges: [],
            };
            const parent = await WSRestFlowMother.create(repository, { json_diagram_properties: parentDiagram });
            const deleter = new WSRestFlowDeleter(repository, stepRepository);

            await expect(
                deleter.execute(parent.id.value, { deleted_at: new Date().toISOString(), deleted_by: uuid() })
            ).resolves.toBeUndefined();
        });
    });

    describe('WSRestFlowFinder — reconstruction edge cases', () => {
        it('reconstructs main flow merging subflow nodes when conditional present', async () => {
            const subflowDto = WSRestFlowMother.dto({
                json_diagram_properties: {
                    nodes: [{ id: 'sf_node1', data: { type: 'endpoint', id: uuid(), label: 'sf-end' } }],
                    edges: [],
                },
            });
            subflowDto.is_primary = false;
            await repository.save(WSRestFlow.create(subflowDto));

            const parentDiagram = {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: 'cond',
                        data: {
                            type: 'conditional',
                            id: uuid(),
                            label: 'c',
                            filter: 'c.x',
                            value: '1',
                            conditionType: 'eq',
                            subflows: { satisfied: subflowDto.id },
                        },
                    },
                ],
                edges: [],
            };
            const parent = await WSRestFlowMother.create(repository, { json_diagram_properties: parentDiagram });
            const finder = new WSRestFlowFinder(repository, currentUser);

            const response = await finder.execute(parent.id.value);

            expect(response).toBeInstanceOf(WSRestFlowResponse);
            const json = response.toJson().data;
            const persistedNodeIds = json.json_diagram_properties?.nodes?.map((n) => n.id) || [];
            expect(persistedNodeIds).toContain('sf_node1');
        });

        it('returns flow unchanged when no conditional nodes exist', async () => {
            const flow = await WSRestFlowMother.create(repository, {
                json_diagram_properties: {
                    nodes: [{ id: 'n1', data: { label: 'only' } }],
                    edges: [],
                },
            });
            const finder = new WSRestFlowFinder(repository, currentUser);

            const response = await finder.execute(flow.id.value);

            const json = response.toJson().data;
            expect(json.json_diagram_properties.nodes.length).toBe(1);
        });

        it('ignores soft-deleted subflows during reconstruction', async () => {
            const sfDto = WSRestFlowMother.dto();
            sfDto.is_primary = false;
            await repository.save(WSRestFlow.create(sfDto));
            await repository
                .connection('ws_rest_flows')
                .where('id', sfDto.id)
                .update({ deleted_at: new Date().toISOString() });

            const parentDiagram = {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: 'cond',
                        data: {
                            type: 'conditional',
                            id: uuid(),
                            label: 'c',
                            filter: 'c.x',
                            value: '1',
                            conditionType: 'eq',
                            subflows: { satisfied: sfDto.id },
                        },
                    },
                ],
                edges: [],
            };
            const parent = await WSRestFlowMother.create(repository, { json_diagram_properties: parentDiagram });
            const finder = new WSRestFlowFinder(repository, currentUser);

            await expect(finder.execute(parent.id.value)).resolves.toBeInstanceOf(WSRestFlowResponse);
        });

        it('tolerates a missing subflow id (logs, returns partial diagram)', async () => {
            const parentDiagram = {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: 'cond',
                        data: {
                            type: 'conditional',
                            id: uuid(),
                            label: 'c',
                            filter: 'c.x',
                            value: '1',
                            conditionType: 'eq',
                            subflows: { satisfied: uuid() },
                        },
                    },
                ],
                edges: [],
            };
            const parent = await WSRestFlowMother.create(repository, { json_diagram_properties: parentDiagram });
            const finder = new WSRestFlowFinder(repository, currentUser);

            await expect(finder.execute(parent.id.value)).resolves.toBeInstanceOf(WSRestFlowResponse);
        });

        it('reconstructs and includes subflow edges (no duplicates)', async () => {
            const sfDto = WSRestFlowMother.dto({
                json_diagram_properties: {
                    nodes: [
                        { id: 'sf_a', data: { label: 'a' } },
                        { id: 'sf_b', data: { label: 'b' } },
                    ],
                    edges: [{ id: 'sf_edge', source: 'sf_a', target: 'sf_b' }],
                },
            });
            sfDto.is_primary = false;
            await repository.save(WSRestFlow.create(sfDto));

            const parentDiagram = {
                nodes: [
                    { id: '0', type: 'input', data: { type: 'input', label: 'start' } },
                    {
                        id: 'cond',
                        data: {
                            type: 'conditional',
                            id: uuid(),
                            label: 'c',
                            filter: 'c.x',
                            value: '1',
                            conditionType: 'eq',
                            subflows: { satisfied: sfDto.id },
                        },
                    },
                ],
                edges: [],
            };
            const parent = await WSRestFlowMother.create(repository, { json_diagram_properties: parentDiagram });
            const finder = new WSRestFlowFinder(repository, currentUser);

            const response = await finder.execute(parent.id.value);
            const json = response.toJson().data;
            const edgeIds = json.json_diagram_properties.edges.map((e) => e.id);
            expect(edgeIds.filter((id) => id === 'sf_edge').length).toBe(1);
        });

        it('throws CustomError 404 when flow does not exist', async () => {
            const finder = new WSRestFlowFinder(repository, currentUser);

            await expect(finder.execute(uuid())).rejects.toBeInstanceOf(CustomError);
        });

        it('throws CustomError 404 when flow is soft-deleted (deleted_by set)', async () => {
            const flow = await WSRestFlowMother.create(repository);
            await repository
                .connection('ws_rest_flows')
                .where('id', flow.id.value)
                .update({ deleted_at: new Date().toISOString(), deleted_by: uuid() });
            const finder = new WSRestFlowFinder(repository, currentUser);

            await expect(finder.execute(flow.id.value)).rejects.toBeInstanceOf(CustomError);
        });
    });

    describe('WSRestFlowSearcher — criteria propagation', () => {
        it('propagates limit and order field to Criteria passed to repository.search', async () => {
            await WSRestFlowMother.create(repository);
            const searcher = new WSRestFlowSearcher(repository);
            const searchSpy = jest.spyOn(repository, 'search');

            await searcher.execute({
                filter: undefined,
                relationship: undefined,
                limit: 5,
                offset: 0,
                order: { field: 'created_at', direction: 'asc' },
            });

            expect(searchSpy).toHaveBeenCalledTimes(1);
            const criteria = searchSpy.mock.calls[0][0];
            expect(criteria.limit).toBe(5);
            // Verify the order field is propagated via the OrderByCriteria accessor
            expect(criteria.tablename).toBe(repository.tableName);

            searchSpy.mockRestore();
        });

        it('uses repository.tableName for Criteria construction', async () => {
            const searcher = new WSRestFlowSearcher(repository);
            const searchSpy = jest.spyOn(repository, 'search');

            await searcher.execute({
                filter: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'id', direction: 'asc' },
            });

            const criteria = searchSpy.mock.calls[0][0];
            expect(criteria.tablename).toBe(repository.tableName);

            searchSpy.mockRestore();
        });

        it('returns WSRestFlowCollectionResponse with count from Counter', async () => {
            await WSRestFlowMother.create(repository);
            await WSRestFlowMother.create(repository);
            const searcher = new WSRestFlowSearcher(repository);

            const result = await searcher.execute({
                filter: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            });

            expect(result).toBeInstanceOf(WSRestFlowCollectionResponse);
            expect(result.toJson().data.items.length).toBeGreaterThanOrEqual(2);
        });

        it('returns empty collection after all rows are removed', async () => {
            // Los pasos del flujo referencian ws_rest_flows; postgres no deja borrar
            // el padre mientras el hijo exista.
            await repository.connection('ws_rest_workflow_steps').del();
            await repository.connection(repository.tableName).del();
            const searcher = new WSRestFlowSearcher(repository);

            const result = await searcher.execute({
                filter: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            });

            expect(result.toJson().data.items.length).toBe(0);
        });
    });
});
