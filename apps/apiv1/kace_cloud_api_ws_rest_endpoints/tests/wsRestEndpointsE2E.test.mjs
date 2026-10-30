import { KnexWSRestEndpointRepository } from '@kace/core/src/ws-rest-endpoints';
import WSRestEndpointMother from '@kace/core/tests/ws-rest-endpoints/domain/WSRestEndpointMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { Helper } from '@kace/core/src/shared/index.js';

describe('WSRestEndpointController test', () => {
    const repository = new KnexWSRestEndpointRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/ws-rest-endpoints`
            : `http://127.0.0.1:60052`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a WSRestEndpoint', async () => {
        const payload = WSRestEndpointMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create an WSRestEndpoint', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a WSRestEndpoint', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository);
        const dataExpected = {
            id: wsRestEndpoint.id.value,
            type: wsRestEndpoint.type.value,
            description: wsRestEndpoint.description.value,
            url: wsRestEndpoint.url.value,
            method: wsRestEndpoint.method.value,
            headers: wsRestEndpoint.headers.value,
            body: wsRestEndpoint.body.value,
            body_type: wsRestEndpoint.body_type.value,
            is_dynamic_body: wsRestEndpoint.is_dynamic_body.value,
            is_active: wsRestEndpoint.is_active.value,
            created_at: wsRestEndpoint.created_at.value,
            created_by: wsRestEndpoint.created_by.value,
            updated_at: null,
            updated_by: null,
            authorization_id: wsRestEndpoint.authorization_id.value,
            is_dynamic_header: wsRestEndpoint.is_dynamic_header.value,
            filter_input: wsRestEndpoint.filter_input.value,
            context_position: wsRestEndpoint.context_position.value,
            on_success: wsRestEndpoint.on_success.value,
            on_error: wsRestEndpoint.on_error.value,
            attempts: wsRestEndpoint.attempts.value,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${wsRestEndpoint.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch WSRestEndpoints using search', async () => {
        const stateCreated = await WSRestEndpointMother.create(repository);

        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: stateCreated.id.value,
                    type: 'AND',
                },
            ],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
        expect(response.data.data.items[0].id).toEqual(stateCreated.id.value);
    });

    it('should delete a WSRestEndpoint', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${wsRestEndpoint.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a WSRestEndpoint', async () => {
        const wsRestEndpoint = await WSRestEndpointMother.create(repository);
        const payload = {
            description: `Updated description ${uuidv4()}`,
            method: 'GET',
            is_active: false,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${wsRestEndpoint.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
