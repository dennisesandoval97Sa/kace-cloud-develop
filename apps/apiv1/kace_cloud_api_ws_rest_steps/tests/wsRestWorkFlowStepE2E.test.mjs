import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository';
import { production as knexConfig } from '@kace/database/knexfile';
import { WSRestWorkflowStepMother } from '@kace/core/tests/ws-rest-workflow-step/domain/WSRestWorkflowStepMother';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

import { KnexWSRestFlowRepository } from '@kace/core/src/ws-rest-flows/infrastructure/persistence/KnexWSRestFlowRepository.js';
import { KnexWSRestFunctionRepository } from '@kace/core/src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';

import WSRestFlowMother from '@kace/core/tests/ws-rest-flows/domain/WSRestFlowMother.js';
import WSRestFunctionMother from '@kace/core/tests/ws_rest_functions/domain/WSRestFunctionMother.js';
import { WSRestWorkflowStep } from '@kace/core/src/ws-rest-workflow-step/domain/WSRestWorkflowStep';

describe('WSRestWorkFlowStepController test', () => {
    const repository = new KnexWSRestWorkflowStepRepository(knexConfig);
    const flowRepository = new KnexWSRestFlowRepository(knexConfig);
    const functionRepository = new KnexWSRestFunctionRepository(knexConfig);
    let flowId = null;
    let functionId = null;

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/ws-rest-workflow-step`
            : `http://127.0.0.1:60054`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    beforeAll(async () => {
        const flow = await WSRestFlowMother.create(flowRepository);
        flowId = flow.id.value;
    });

    beforeEach(async () => {
        const wsFunction = await WSRestFunctionMother.create(functionRepository);
        functionId = wsFunction.id.value;
    });

    it('should create a WSRestWorkFlowStep', async () => {
        const payload = WSRestWorkflowStepMother.dtoWithRelationshipOverride(null, functionId);
        payload.flow_id = flowId;

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create an WSRestWorkFlowStep', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a WSRestWorkFlowStep', async () => {
        const payload = WSRestWorkflowStepMother.dtoWithRelationshipOverride(null, functionId);
        payload.flow_id = flowId;

        await repository.save(
            new WSRestWorkflowStep(payload)
        );

        const dataExpected = {
            id: payload.id,
            flow_id: flowId,
            order: payload.order,
            endpoint_id: payload.endpoint_id,
            function_id: functionId,
            created_at: payload.created_at,
            created_by: payload.created_by,
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${payload.id}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch WSRestWorkFlowStep using search', async () => {
        const payload = WSRestWorkflowStepMother.dtoWithRelationshipOverride(null, functionId);
        payload.flow_id = flowId;

        await repository.save(
            new WSRestWorkflowStep(payload)
        );

        const dtoCriteria = {
            filter: [
                {
                    field: 'ws_rest_workflow_steps.id',
                    operator: 'eq',
                    value: payload.id,
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 1,
            offset: 0,
            order: { field: 'ws_rest_workflow_steps.created_at', direction: 'desc' },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
        expect(response.data.data.items[0].id).toEqual(payload.id);
    });

    it('should delete a WSRestWorkFlowStep', async () => {
        const payload = WSRestWorkflowStepMother.dtoWithRelationshipOverride(null, functionId);
        payload.flow_id = flowId;

        await repository.save(
            new WSRestWorkflowStep(payload)
        );

        const response = await TestHelper.getRequest(`${baseUrl}/${payload.id}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a WSRestWorkFlowStep', async () => {
        const payload = WSRestWorkflowStepMother.dtoWithRelationshipOverride(null, functionId);
        payload.flow_id = flowId;

        await repository.save(
            new WSRestWorkflowStep(payload)
        );

        const updatePayload = {
            order: 7,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${payload.id}`, updatePayload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
