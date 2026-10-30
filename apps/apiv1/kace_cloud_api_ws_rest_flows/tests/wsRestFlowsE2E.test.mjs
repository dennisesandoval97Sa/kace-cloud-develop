import { KnexWSRestFlowRepository } from '@kace/core/src/ws-rest-flows';
import WSRestFlowMother from '@kace/core/tests/ws-rest-flows/domain/WSRestFlowMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('WSRestFlowsController test', () => {
    const repository = new KnexWSRestFlowRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/ws-rest-flows`
            : `http://127.0.0.1:60053`;

    afterAll(async () => {
        await repository.connection.destroy();
    });

    it('should create a WSRestFlow', async () => {
        const payload = WSRestFlowMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('should return statusCode 400 when validation fails to create a WSRestFlow', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a WSRestFlow', async () => {
        const wsRestFlow = await WSRestFlowMother.create(repository);

        const dataExpected = {
            id: wsRestFlow.id.value,
            is_active: true,
            is_primary: true,
            description: wsRestFlow.description.value,
            external_code: wsRestFlow.external_code.value,
            json_diagram_properties: wsRestFlow.json_diagram_properties.value,
            created_at: wsRestFlow.created_at.value,
            created_by: wsRestFlow.created_by.value,
            updated_at: wsRestFlow.updated_at.value,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${wsRestFlow.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all WSRestFlows', async () => {
        const flow1 = await WSRestFlowMother.create(repository);
        const flow2 = await WSRestFlowMother.create(repository);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(flow2.id.value);
        expect(response.data.data.items[1].id).toEqual(flow1.id.value);
    });

    it('should delete a WSRestFlow', async () => {
        const wsRestFlow = await WSRestFlowMother.create(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${wsRestFlow.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a WSRestFlow', async () => {
        const wsRestFlow = await WSRestFlowMother.create(repository);
        const payload = {
            description: ` Updated ${wsRestFlow.description.value}`,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${wsRestFlow.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });

    it('should disable a WSRestFlow -> update is_active to false', async () => {
        const wsRestFlow = await WSRestFlowMother.create(repository);
        const payload = {
            is_active: false,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${wsRestFlow.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should fetch Restflows as select options (value/label) from /list', async () => {
        const state1 = await WSRestFlowMother.create(repository);
        const state2 = await WSRestFlowMother.create(repository);
        const response = await TestHelper.getRequest(`${baseUrl}/list`);
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data.data).toBeDefined();
        expect(Array.isArray(response.data.data.items)).toBe(true);
        const items = response.data.data.items;
        expect(items.length).toBeGreaterThanOrEqual(2);
        expect(items[0]).toMatchObject({
            value: state2.id.value,
            label: state2.description.value,
        });
        expect(items[1]).toMatchObject({
            value: state1.id.value,
            label: state1.description.value,
        });
        const allowedKeys = ['value', 'label'];
        const hasOnlyAllowedKeys = Object.keys(items[0]).every((k) => allowedKeys.includes(k));
        expect(hasOnlyAllowedKeys).toBe(true);
    });
});
