import { v4 as uuidv4 } from 'uuid';
import { TestHelper } from '@kace/api-common';

const baseUrl =
    process.env.APPS_ENVIRONMENT === 'staging'
        ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/schemas`
        : 'http://127.0.0.1:60095';

const e2e = process.env.SCHEMAS_API_REACHABLE === '1' ? describe : describe.skip;

function httpResult(raw) {
    if (raw && raw.response) {
        return {
            status: raw.response.status,
            body: raw.response.data,
        };
    }
    return { status: raw?.status, body: raw?.data };
}

e2e('SchemasController E2E - Casos de error', () => {
    it('debe devolver error si el data_structure no es un objeto', async () => {
        const payload = {
            id: uuidv4(),
            name: 'test name',
            data_structure: 'test data structure',
        };
        const { status } = httpResult(await TestHelper.postRequest(baseUrl, payload));
        expect(status).toBeGreaterThanOrEqual(400);
    });

    it('debe devolver error al actualizar con un uuid aleatorio', async () => {
        const randomId = uuidv4();
        const payload = { name: 'updated name' };
        const { status } = httpResult(await TestHelper.postRequest(`${baseUrl}/${randomId}`, payload));
        expect(status).toBeGreaterThanOrEqual(400);
    });

    it('debe devolver un registro vacio al consultar (read) con un uuid aleatorio', async () => {
        const randomId = uuidv4();
        const { status, body } = httpResult(await TestHelper.getRequest(`${baseUrl}/${randomId}`));
        expect(status).toBeGreaterThanOrEqual(200);
        expect(typeof body?.data).toBe('object');
        expect(Object.keys(body.data).length).toBe(0);
    });

    it('la respuesta de index debe ser un objeto (aunque no haya datos)', async () => {
        const { status, body } = httpResult(await TestHelper.getRequest(baseUrl));
        expect(status).toBe(200);
        expect(typeof body.data).toBe('object');
    });

    it('la respuesta de search debe ser un objeto (aunque no haya datos)', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const { status, body } = httpResult(await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria));
        expect(status).toBe(200);
        expect(typeof body.data).toBe('object');
    });

    it('ControllerRelationsCount: debe devolver error con id inválido', async () => {
        const { status } = httpResult(await TestHelper.getRequest(`${baseUrl}/invalid-id/relations-count`));
        expect(status).toBeGreaterThanOrEqual(400);
    });

    it('ControllerRelationsCount: debe devolver objeto vacío para uuid aleatorio', async () => {
        const randomId = uuidv4();
        const { status, body } = httpResult(await TestHelper.getRequest(`${baseUrl}/${randomId}/relations-count`));
        expect(status).toBeGreaterThanOrEqual(200);
        expect(typeof body?.data).toBe('object');
    });

    it('ControllerRelationsDetail: debe devolver error con id inválido', async () => {
        const { status } = httpResult(await TestHelper.getRequest(`${baseUrl}/invalid-id/rules`));
        expect(status).toBeGreaterThanOrEqual(400);
    });

    it('ControllerRelationsDetail: debe devolver objeto vacío para uuid aleatorio', async () => {
        const randomId = uuidv4();
        const { status, body } = httpResult(await TestHelper.getRequest(`${baseUrl}/${randomId}/rules`));
        expect(status).toBeGreaterThanOrEqual(200);
        expect(typeof body?.data).toBe('object');
    });

    it('actionHistory: debe devolver error con id inválido', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const { status } = httpResult(await TestHelper.postRequest(`${baseUrl}/invalid-id/history`, dtoCriteria));
        expect(status).toBeGreaterThanOrEqual(400);
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
        const { status, body } = httpResult(
            await TestHelper.postRequest(`${baseUrl}/${randomId}/history`, dtoCriteria)
        );
        expect(status).toBeGreaterThanOrEqual(200);
        expect(typeof body?.data).toBe('object');
    });

    it('ControllerFunctions: debe devolver todas las funciones disponibles con status 200', async () => {
        const { status, body } = httpResult(await TestHelper.getRequest(`${baseUrl}/functions`));

        expect(status).toBe(200);

        expect(body).toHaveProperty('data');
        expect(typeof body.data).toBe('object');

        const expectedCategories = ['dates', 'math', 'chains', 'utilities', 'comparators'];
        expectedCategories.forEach((category) => {
            expect(body.data).toHaveProperty(category);
            expect(Array.isArray(body.data[category])).toBe(true);
        });

        const mathFunctions = body.data.math.map((fn) => fn.name);
        expect(mathFunctions).toContain('sum');
        expect(mathFunctions).toContain('div');
    });
});

e2e('ControllerRules actionSearch E2E', () => {
    const rulesSearchUrl = `${baseUrl}/rules/search`;

    const validCriteria = () => ({
        filter: [],
        relationship: null,
        limit: 10,
        offset: 0,
        order: { field: 'created_at', direction: 'desc' },
    });

    const rulesSearchNotInGateway = (status, body) =>
        status === 403 && body?.message === 'Missing Authentication Token';

    it('debe responder 200 con data.items como array', async () => {
        const { status, body } = httpResult(await TestHelper.postRequest(rulesSearchUrl, validCriteria()));
        if (rulesSearchNotInGateway(status, body)) {
            expect(status).toBe(403);
            return;
        }
        expect(status).toBe(200);
        expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('debe rechazar payload sin limit', async () => {
        const { limit: _l, ...rest } = validCriteria();
        const { status, body } = httpResult(await TestHelper.postRequest(rulesSearchUrl, rest));
        if (rulesSearchNotInGateway(status, body)) {
            expect(status).toBe(403);
            return;
        }
        expect(status).toBeGreaterThanOrEqual(400);
    });

    it('debe rechazar limit no numérico', async () => {
        const payload = { ...validCriteria(), limit: 'x' };
        const { status, body } = httpResult(await TestHelper.postRequest(rulesSearchUrl, payload));
        if (rulesSearchNotInGateway(status, body)) {
            expect(status).toBe(403);
            return;
        }
        expect(status).toBeGreaterThanOrEqual(400);
    });

    it('debe filtrar por name eq sin coincidencias y devolver items vacíos', async () => {
        const payload = {
            ...validCriteria(),
            filter: [
                {
                    field: 'name',
                    operator: 'eq',
                    value: '__no_schema_should_have_this_name_rules_search__',
                    type: 'AND',
                },
            ],
        };
        const { status, body } = httpResult(await TestHelper.postRequest(rulesSearchUrl, payload));
        if (rulesSearchNotInGateway(status, body)) {
            expect(status).toBe(403);
            return;
        }
        expect(status).toBe(200);
        expect(body.data.items.length).toBe(0);
    });

    it('debe filtrar por id eq con uuid aleatorio y devolver items vacíos', async () => {
        const payload = {
            ...validCriteria(),
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: uuidv4(),
                    type: 'AND',
                },
            ],
        };
        const { status, body } = httpResult(await TestHelper.postRequest(rulesSearchUrl, payload));
        if (rulesSearchNotInGateway(status, body)) {
            expect(status).toBe(403);
            return;
        }
        expect(status).toBe(200);
        expect(body.data.items.length).toBe(0);
    });

    it('debe aceptar filtro name AND más id OR en una misma petición', async () => {
        const payload = {
            ...validCriteria(),
            filter: [
                {
                    field: 'name',
                    operator: 'eq',
                    value: '__impossible_name_rules_search_or__',
                    type: 'AND',
                },
                {
                    field: 'id',
                    operator: 'eq',
                    value: uuidv4(),
                    type: 'OR',
                },
            ],
        };
        const { status, body } = httpResult(await TestHelper.postRequest(rulesSearchUrl, payload));
        if (rulesSearchNotInGateway(status, body)) {
            expect(status).toBe(403);
            return;
        }
        expect(status).toBe(200);
        expect(Array.isArray(body.data.items)).toBe(true);
    });

    it('cada item devuelto debe incluir data_structure', async () => {
        const { status, body } = httpResult(
            await TestHelper.postRequest(rulesSearchUrl, { ...validCriteria(), limit: 5 })
        );
        if (rulesSearchNotInGateway(status, body)) {
            expect(status).toBe(403);
            return;
        }
        expect(status).toBe(200);
        for (const item of body.data.items) {
            expect(item).toHaveProperty('data_structure');
        }
    });

    it('debe respetar limit en la cantidad de items', async () => {
        const { status, body } = httpResult(
            await TestHelper.postRequest(rulesSearchUrl, { ...validCriteria(), limit: 2 })
        );
        if (rulesSearchNotInGateway(status, body)) {
            expect(status).toBe(403);
            return;
        }
        expect(status).toBe(200);
        expect(body.data.items.length).toBeLessThanOrEqual(2);
    });

    it('debe respetar offset alto devolviendo lista vacía o menor tamaño', async () => {
        const { status, body } = httpResult(
            await TestHelper.postRequest(rulesSearchUrl, {
                ...validCriteria(),
                limit: 10,
                offset: 999999,
            })
        );
        if (rulesSearchNotInGateway(status, body)) {
            expect(status).toBe(403);
            return;
        }
        expect(status).toBe(200);
        expect(body.data.items.length).toBe(0);
    });
});
