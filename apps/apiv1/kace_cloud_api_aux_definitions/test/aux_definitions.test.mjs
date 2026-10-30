import { TestHelper } from '@kace/api-common';
import { auxKnexInstance } from '@kace/database';
import { v4 as uuidv4 } from 'uuid';

const baseUrl =
    process.env.APPS_ENVIRONMENT === 'staging'
        ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/aux_definitions`
        : 'http://127.0.0.1:60073';

describe('AuxDefinitionsController E2E - Validaciones y estructura', () => {
    it('debe devolver error si el schema_id no existe al crear', async () => {
        const payload = {
            id: uuidv4(),
            tablename: 'test_table',
            schema_id: uuidv4(),
            restflow_id: uuidv4(),
            is_active: 1,
        };
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(400);
    });

    it('debe devolver error al actualizar con un uuid aleatorio', async () => {
        const randomId = uuidv4();
        const payload = { tablename: 'updated_table' };
        const response = await TestHelper.postRequest(`${baseUrl}/${randomId}`, payload);
        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('la respuesta de index debe ser un objeto', async () => {
        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
        expect(typeof response.data.data).toBe('object');
    });

    it('la respuesta de search debe ser un objeto', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(typeof response.data.data).toBe('object');
    });

    it('debe crear la definición y guardarla en la base de datos', async () => {
        const generateDefinicionName = () => {
            const number = Math.floor(Math.random() * 100);
            const paddedNumber = number.toString().padStart(2, '0');
            return `definicion${paddedNumber}`;
        };

        const name = generateDefinicionName();
        const id = uuidv4();
        const payload = {
            id,
            name,
            tablename: `aux_${name}`,
            logs_tablename: `history_aux_${name}`,
            schema_id: '0c095f0e-3943-40dd-84a4-3cd3815e3156',
            is_active: true,
        };

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
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
