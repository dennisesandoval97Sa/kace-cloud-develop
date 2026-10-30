import { KnexFakeClientRepository } from '@kace/core/src/fake-clients/infrastructure/persistence/KnexFakeClientRepository.js';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { Helper } from '@kace/core/src/shared/index.js';

describe('FakeclientController test', () => {
    const repository = new KnexFakeClientRepository(knexConfig);
    const clientId = uuidv4();

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/tempclients`
            : 'http://127.0.0.1:60008';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });
    const payload = {
        id: clientId,
        tipo_cliente: 'Natural',
        tipo_documento: 'CC',
        documento: '123456',
        nombres: 'NombreTest',
        apellido1: 'ApellidoTest',
        apellido2: 'ApellidoDosTest',
        status: 1,
        padre_id: null,
        habeas_data: 'SI',
        created_at: '1957-09-17T14:52:43.167Z',
        created_by: '2ea255b3-1553-930f-ca39-ae94d912a8f5',
    };

    it('should create a Fake client', async () => {
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('should update a fake client', async () => {
        const updatePayload = {
            id: clientId,
            tipo_cliente: 'Natural',
            tipo_documento: 'NIT',
            documento: '123456',
            nombre_empresa: 'NombreTest',
            status: 1,
            padre_id: null,
            habeas_data: 'SI',
            created_at: '1957-09-17T14:52:43.167Z',
            created_by: '2ea255b3-1553-930f-ca39-ae94d912a8f5',
        };

        const response = await TestHelper.postRequest(baseUrl, updatePayload);

        expect(response.status).toBe(200);
    });

    it('Should nullify name fields after update', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${clientId}`);
        expect(response.status).toBe(200);
        expect(response.data.data.nombres).toEqual(null);
        expect(response.data.data.apellido1).toEqual(null);
        expect(response.data.data.apellido2).toEqual(null);
    });
});
