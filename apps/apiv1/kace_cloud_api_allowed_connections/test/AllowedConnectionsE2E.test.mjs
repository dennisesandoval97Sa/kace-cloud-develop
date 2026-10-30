import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import AllowedConnectionsMother from '@kace/core/tests/allowed-connections/domain/AllowedConnectionsMother.js';

describe('AllowedConnectionsController test', () => {
    const repository = new KnexAllowedConnectionsRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/allowed-connections`
            : 'http://127.0.0.1:60002';

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create an Allowed Connection', async () => {
        const payload = AllowedConnectionsMother.dto();

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
    });

    it('should return statusCode 400 when validation fails to create an Allowed Connection', async () => {
        const payload = {};
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch an Allowed Connection', async () => {
        const allowedConnection = await AllowedConnectionsMother.createAllowedConnection(repository);
        const dataExpected = {
            id: allowedConnection.id.value,
            description: allowedConnection.description.value,
            connection: allowedConnection.connection.value,
            certificate: allowedConnection.certificate.value,
            is_active: allowedConnection.is_active.value,
            has_ssl: allowedConnection.has_ssl.value,
            created_at: allowedConnection.created_at.value,
            created_by: allowedConnection.created_by.value,
            updated_at: null,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${allowedConnection.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all Allowed Connections', async () => {
        const allowedConnection1 = await AllowedConnectionsMother.createAllowedConnection(repository);
        const allowedConnection2 = await AllowedConnectionsMother.createAllowedConnection(repository);

        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(allowedConnection2.id.value);
        expect(response.data.data.items[1].id).toEqual(allowedConnection1.id.value);
    });

    it('should delete an Allowed Connection', async () => {
        const allowedConnection = await AllowedConnectionsMother.createAllowedConnection(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${allowedConnection.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update an Allowed Connection', async () => {
        const allowedConnection = await AllowedConnectionsMother.createAllowedConnection(repository);
        const payload = {
            description: 'Updated description',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${allowedConnection.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
