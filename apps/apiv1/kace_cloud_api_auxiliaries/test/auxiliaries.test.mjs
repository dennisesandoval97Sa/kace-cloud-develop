import { TestHelper } from '@kace/api-common';
import { v4 as uuidv4 } from 'uuid';

const baseUrl =
    process.env.APPS_ENVIRONMENT === 'staging'
        ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/auxiliaries`
        : 'http://127.0.0.1:60098';

const testEntity = 'aux_cases';

describe('AuxiliariesController E2E - Casos de error', () => {
    it('debe devolver error si el data no es un objeto', async () => {
        const payload = {
            id: uuidv4(),
            data: 'test data structure',
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);
        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('debe devolver error al actualizar con un uuid aleatorio', async () => {
        const randomId = uuidv4();
        const payload = {
            data: { nombre: 'updated name' },
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}/${randomId}`, payload);
        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('la respuesta de index debe ser un objeto (aunque no haya datos)', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${testEntity}`);
        expect(response.status).toBe(200);
        expect(typeof response.data.data).toBe('object');
        expect(response.status).toBeGreaterThanOrEqual(200);
    });

    it('la respuesta de search debe ser un objeto (aunque no haya datos)', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(typeof response.data.data).toBe('object');
        expect(response.status).toBeGreaterThanOrEqual(200);
    });

    it('debe devolver error si no se proporciona entity en la ruta', async () => {
        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('debe devolver error si el id no es un UUID válido', async () => {
        const invalidId = 'invalid-uuid';
        const response = await TestHelper.getRequest(`${baseUrl}/${testEntity}/${invalidId}`);
        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('actionHistory: debe devolver error con id inválido', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}/invalid-id/history`, dtoCriteria);
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
        const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}/${randomId}/history`, dtoCriteria);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(typeof response.data.data).toBe('object');
    });
});
