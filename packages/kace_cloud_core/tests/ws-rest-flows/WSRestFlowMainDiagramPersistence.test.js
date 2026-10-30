import { jest } from '@jest/globals';
import { v4 as uuid } from 'uuid';

import { knexConfig } from '../knexfile.js';
import { KnexWSRestFlowRepository, WSRestFlowCreator, WSRestFlowFinder } from '../../src/ws-rest-flows/index.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { WSRestConditionalCreator } from '../../src/ws-rest-conditionals/application/create/WSRestConditionalCreator.js';
import { WSRestConditionalUpdater } from '../../src/ws-rest-conditionals/application/update/WSRestConditionalUpdater.js';
import { WSRestConditionalFinder } from '../../src/ws-rest-conditionals/domain/WSRestConditionalFinder.js';
import { WSRestFlowStepManager } from '../../src/ws-rest-flows/application/services/WSRestFlowStepManager.js';
import { EventLogger } from '../../src/shared/EventLogger.js';

describe('WSRestFlow pruned persistence + read reconstruction (real imports)', () => {
    const repository = new KnexWSRestFlowRepository(knexConfig);
    const stepRepository = new KnexWSRestWorkflowStepRepository(repository.connection);

    const buildConditionalDiagram = () => {
        const inputNodeId = '0';
        const endpointBeforeNodeId = uuid();
        const conditionalNodeId = uuid();
        const yesNodeId = uuid();
        const noNodeId = uuid();

        return {
            nodes: [
                { id: inputNodeId, type: 'input', data: { type: 'input', label: 'inicio' } },
                {
                    id: endpointBeforeNodeId,
                    data: { type: 'endpoint', id: uuid(), label: 'first endpoint' },
                },
                {
                    id: conditionalNodeId,
                    data: {
                        type: 'conditional',
                        id: uuid(),
                        label: 'if status = ok',
                        filter: 'status',
                        value: 'ok',
                        conditionType: 'eq',
                    },
                },
                { id: yesNodeId, data: { type: 'function', id: uuid(), label: 'yes branch' } },
                { id: noNodeId, data: { type: 'endpoint', id: uuid(), label: 'no branch' } },
            ],
            edges: [
                { id: uuid(), source: inputNodeId, target: endpointBeforeNodeId },
                { id: uuid(), source: endpointBeforeNodeId, target: conditionalNodeId },
                { id: uuid(), source: conditionalNodeId, target: yesNodeId, sourceHandle: 'yes' },
                { id: uuid(), source: conditionalNodeId, target: noNodeId, sourceHandle: 'no' },
            ],
        };
    };

    beforeEach(async () => {
        jest.spyOn(WSRestConditionalCreator.prototype, 'execute').mockResolvedValue(undefined);
        jest.spyOn(WSRestConditionalUpdater.prototype, 'execute').mockResolvedValue(undefined);
        jest.spyOn(WSRestConditionalFinder.prototype, 'execute').mockResolvedValue(null);
        jest.spyOn(WSRestFlowStepManager.prototype, 'createStepsForFlows').mockResolvedValue(undefined);
        jest.spyOn(WSRestFlowStepManager.prototype, 'updateStepsForFlows').mockResolvedValue(undefined);
        jest.spyOn(WSRestFlowStepManager.prototype, 'deleteStepsForFlow').mockResolvedValue(undefined);
        jest.spyOn(EventLogger.prototype, 'log').mockResolvedValue(undefined);
    });

    afterEach(async () => {
        jest.restoreAllMocks();
    });

    it('stores pruned main flow in DB and reconstructs full graph in get by id', async () => {
        const diagram = buildConditionalDiagram();
        const flowId = uuid();

        const creator = new WSRestFlowCreator(repository, stepRepository);
        await creator.execute({
            id: flowId,
            description: `main-flow-create-${uuid()}`,
            external_code: `main_flow_create_${uuid()}`,
            json_diagram_properties: diagram,
            is_active: true,
            is_primary: true,
            created_at: new Date().toISOString(),
            created_by: uuid(),
        });

        const saved = await repository.find({ value: flowId });
        const persistedPruned = saved.json_diagram_properties.value;

        expect(persistedPruned.nodes.length).toBeLessThan(diagram.nodes.length);
        expect(persistedPruned.edges.length).toBeLessThanOrEqual(diagram.edges.length);

        const finder = new WSRestFlowFinder(repository, { id: { value: uuid() } });
        const response = await finder.execute(flowId);
        const reconstructed = response.toJson().data.json_diagram_properties;

        expect(reconstructed.nodes).toHaveLength(diagram.nodes.length);
        expect(reconstructed.edges).toHaveLength(diagram.edges.length);
    });
});
