import { v4 as uuidv4 } from 'uuid';
import { production as knexConfig } from '@kace/database/knexfile';
import { KnexAuxClientsRepository } from '@kace/core/src/aux_clientes/infrastructure/persitance/KnexAuxClientsRepository';
import { KnexClientRepository } from '@kace/core/src/clients';

import { AuxClientsMother } from '@kace/core/tests/aux-clients/domain/AuxClientsMother';
import { TestHelper } from '@kace/api-common';

import ClientMother from '@kace/core/tests/clients/domain/ClientMother';

describe('Aux clients controller test', () => {
    const repository = new KnexAuxClientsRepository(knexConfig);
    const clientRepository = new KnexClientRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/aux-clients`
            : `http://127.0.0.1:60006`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a aux-clients record', async () => {
        const parentClient = await ClientMother.createClient(clientRepository);
        const testClient = await ClientMother.createClient(clientRepository, parentClient.id.value);

        const payload = AuxClientsMother.dto({
            cliente_id: testClient.id.value,
        });

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('should return statusCode 400 when validation fails to create a aux-clients record', async () => {
        const payload = {};

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should fetch a aux-client record', async () => {
        const parentClient = await ClientMother.createClient(clientRepository);
        const testClient = await ClientMother.createClient(clientRepository, parentClient.id.value);

        const payload = AuxClientsMother.dto({
            cliente_id: testClient.id.value,
        });

        await AuxClientsMother.createAuxClient(repository, payload);

        const response = await TestHelper.getRequest(`${baseUrl}/${testClient.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data.cliente_id).toBe(testClient.id.value);
    });

    it('should update a aux-client record', async () => {
        const parentClient = await ClientMother.createClient(clientRepository);
        const testClient = await ClientMother.createClient(clientRepository, parentClient.id.value);

        const payload = AuxClientsMother.dto({
            cliente_id: testClient.id.value,
        });

        const testAuxCase = await AuxClientsMother.createAuxClient(repository, payload);

        const updatePayload = {
            data: {
                barrio: 'update test value',
            },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${testAuxCase.id.value}`, updatePayload);

        expect(response.status).toBe(200);
    });

    it('should return an empty object when fetching a non-existent aux-client record', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return notFound when the resource doesnt exist', async () => {
        let response;
        try {
            response = await TestHelper.getRequest(`${baseUrl}/invalid`);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('actionHistory: debe devolver error con id inválido', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const response = await TestHelper.postRequest(`${baseUrl}/invalid-id/history`, dtoCriteria);
        expect(response.status).toBeGreaterThanOrEqual(400);
    });
    it('actionHistory: debe devolver objeto vacío para uuid aleatorio', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const randomId = uuidv4();
        const response = await TestHelper.postRequest(`${baseUrl}/${randomId}/history`, dtoCriteria);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(typeof response.data.data).toBe('object');
    });
});
