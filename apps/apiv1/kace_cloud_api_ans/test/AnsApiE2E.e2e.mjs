import { randomUUID } from 'node:crypto';
import { TestHelper } from '@kace/api-common/tests/helpers/TestHelper.js';
import { KnexAnsRepository } from '@kace/core/src/ans/infrastructure/persistence/KnexAnsRepository.js';
import AnsMother from '@kace/core/tests/ans/domain/AnsMother.js';

/**
 * E2E del API REST de ANS según docs/guides/E2E_API_REST_SERVICE_TEST_SPECIFICATION.md.
 *
 * ENTORNO: el test y el Lambda deben usar SOLO el bloque `DB_TEST_*` del `.env`:
 *  - El test siembra y verifica con `TestHelper.getTenant()` → `LocalTenantRepository` → `DB_TEST_*`.
 *  - El Lambda solo lee `DB_TEST_*` si se sintetiza con `APPS_ENVIRONMENT=local`; con `staging`
 *    resuelve el tenant en DynamoDB y escribe en la base de desarrollo. `pnpm run api:e2e` lo
 *    arranca así y además vacía `DB_*` para que ningún código del Lambda pueda alcanzarla.
 *
 * Ejecución: `pnpm run api:e2e` en una terminal y `pnpm run test:e2e` en otra.
 */

const tenant = await TestHelper.getTenant();

const HTTP = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
};

// Campos que el servidor asigna al crear: los que mande el cliente se ignoran.
const SERVER_MANAGED_CREATE_FIELDS = ['id', 'created_at', 'created_by'];

// Fila que siembra 20260312120000_insert_default_estados.js en cada reset.
const SEEDED_ANS_COUNT = 1;

const createPayload = (overrides = {}) => {
    const payload = AnsMother.dto(overrides);
    for (const field of SERVER_MANAGED_CREATE_FIELDS) {
        if (!(field in overrides)) {
            delete payload[field];
        }
    }
    return payload;
};

// KnexRepository.count() devuelve la fila cruda de COUNT(*), así que el total llega como { count: '2' }.
const totalOf = (response) => Number(response.data.metadata.count.count);

const searchCriteria = (overrides = {}) => ({
    filter: null,
    relationship: null,
    limit: 10,
    offset: 0,
    order: { field: 'created_at', direction: 'desc' },
    ...overrides,
});

describe('AnsController E2E tests', () => {
    const repository = new KnexAnsRepository(tenant.buildKnexConfig());
    const baseUrl = 'http://127.0.0.1:60003';

    const findAnsBy = (where) => repository.table().where(where).first();
    const countAnsBy = async (where) => {
        const [{ count }] = await repository.table().where(where).count('* as count');
        return Number(count);
    };

    beforeAll(async () => {
        if (!process.env.DB_TEST_HOST || !process.env.DB_TEST_SCHEMA) {
            throw new Error('El E2E necesita DB_TEST_HOST y DB_TEST_SCHEMA en el .env.');
        }
        if (process.env.DB_TEST_HOST === process.env.DB_HOST && process.env.DB_TEST_SCHEMA === process.env.DB_SCHEMA) {
            throw new Error('DB_TEST_* apunta a la misma base y esquema que DB_*: el E2E la reiniciaría.');
        }
        if (
            tenant.db_host.value !== process.env.DB_TEST_HOST ||
            tenant.db_schema.value !== process.env.DB_TEST_SCHEMA
        ) {
            throw new Error('TestHelper.getTenant() no está resolviendo DB_TEST_*.');
        }

        // Si el Lambda lee otra base, la fila sembrada aquí no existe para él y todo falla con 404.
        await TestHelper.resetSchemaAndMigrate(tenant);
        const sentinel = await AnsMother.createAns(repository);
        const response = await TestHelper.getRequest(`${baseUrl}/${sentinel.id.value}`);
        if (response.status !== HTTP.OK) {
            throw new Error(
                `El Lambda de SAM Local no ve la base DB_TEST_* (GET sentinel → ${response.status ?? response.code}). ` +
                    'Arráncalo con `pnpm run api:e2e`.'
            );
        }
    });

    afterAll(async () => {
        await repository.destroyConnection();
    });

    // ============================================================
    // CREATE OPERATION
    // ============================================================
    describe('POST / - Create ANS', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should create an ANS and persist every field', async () => {
            // Arrange
            const payload = createPayload({ nombre: 'Ans Oro' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            const persisted = await findAnsBy({ nombre: 'Ans Oro' });
            expect(persisted).toMatchObject({
                intermedio: payload.intermedio,
                vencido: payload.vencido,
                color_ans_inicial: payload.color_ans_inicial,
                color_ans_intermedio: payload.color_ans_intermedio,
                color_ans_final: payload.color_ans_final,
                medicion_ans_id: payload.medicion_ans_id,
                status: payload.status,
                updated_at: null,
                updated_by: null,
                deleted_at: null,
                deleted_by: null,
            });
            expect(persisted.created_at).not.toBeNull();
            expect(persisted.created_by).not.toBeNull();
        });

        it('should replace a client-supplied id with a server-generated one', async () => {
            // Arrange
            const clientId = randomUUID();
            const payload = createPayload({ id: clientId, nombre: 'Ans Oro' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect(await findAnsBy({ id: clientId })).toBeUndefined();
            expect((await findAnsBy({ nombre: 'Ans Oro' })).id).not.toBe(clientId);
        });

        it('should ignore client-supplied audit fields', async () => {
            // Arrange
            const forgedCreator = randomUUID();
            const payload = createPayload({
                nombre: 'Ans Oro',
                created_by: forgedCreator,
                created_at: '2000-01-01T00:00:00.000Z',
            });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            const persisted = await findAnsBy({ nombre: 'Ans Oro' });
            expect(persisted.created_by).not.toBe(forgedCreator);
            expect(new Date(persisted.created_at).getUTCFullYear()).not.toBe(2000);
        });

        it('should return 400 when the payload is empty', async () => {
            // Act
            const response = await TestHelper.postRequest(baseUrl, {});

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it.each([
            'nombre',
            'intermedio',
            'vencido',
            'color_ans_inicial',
            'color_ans_intermedio',
            'color_ans_final',
            'medicion_ans_id',
        ])('should return 400 when required field %s is missing', async (field) => {
            // Arrange
            const payload = createPayload();
            delete payload[field];

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when intermedio is not a number', async () => {
            // Arrange
            const payload = createPayload({ intermedio: 'not-a-number' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when nombre exceeds 100 characters', async () => {
            // Arrange
            const payload = createPayload({ nombre: 'A'.repeat(101) });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when nombre contains digits', async () => {
            // Arrange
            const payload = createPayload({ nombre: 'Ans123' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when a color is not in the approved allowlist', async () => {
            // Arrange
            const payload = createPayload({ color_ans_final: '#123456' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 and persist nothing when medicion_ans_id is not a known type', async () => {
            // Arrange
            const payload = createPayload({ nombre: 'Ans Semanal', medicion_ans_id: 'Weeks' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findAnsBy({ nombre: 'Ans Semanal' })).toBeUndefined();
        });

        it('should accept accented letters and ñ in nombre', async () => {
            // Arrange
            const payload = createPayload({ nombre: 'Ans Ñandú Árbol' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect(await findAnsBy({ nombre: 'Ans Ñandú Árbol' })).toBeDefined();
        });

        it('should return 400 and persist nothing when intermedio is not lower than vencido', async () => {
            // Arrange
            const payload = createPayload({ nombre: 'Ans Invertido', intermedio: 20, vencido: 10 });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findAnsBy({ nombre: 'Ans Invertido' })).toBeUndefined();
        });

        it('should return 400 when nombre already exists', async () => {
            // Arrange
            await AnsMother.createAns(repository, { nombre: 'Ans Oro' });
            const payload = createPayload({ nombre: 'Ans Oro', intermedio: 1, vencido: 2 });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await countAnsBy({ nombre: 'Ans Oro' })).toBe(1);
        });

        it('should return 400 when the intermedio/vencido/medicion combination already exists', async () => {
            // Arrange
            const existing = await AnsMother.createAns(repository, { nombre: 'Ans Oro' });
            const payload = createPayload({
                nombre: 'Ans Plata',
                intermedio: existing.intermedio.value,
                vencido: existing.vencido.value,
                medicion_ans_id: existing.medicion_ans_id.value,
            });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findAnsBy({ nombre: 'Ans Plata' })).toBeUndefined();
        });

        it('should create two different ANS concurrently', async () => {
            // Arrange
            const payloadOro = createPayload({ nombre: 'Ans Oro', intermedio: 5, vencido: 10 });
            const payloadPlata = createPayload({ nombre: 'Ans Plata', intermedio: 1, vencido: 2 });

            // Act
            const [responseOro, responsePlata] = await Promise.all([
                TestHelper.postRequest(baseUrl, payloadOro),
                TestHelper.postRequest(baseUrl, payloadPlata),
            ]);

            // Assert
            expect(responseOro.status).toBe(HTTP.CREATED);
            expect(responsePlata.status).toBe(HTTP.CREATED);
            expect(await findAnsBy({ nombre: 'Ans Oro' })).toBeDefined();
            expect(await findAnsBy({ nombre: 'Ans Plata' })).toBeDefined();
        });
    });

    // ============================================================
    // READ OPERATION
    // ============================================================
    describe('GET /:id - Read ANS by ID', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should fetch an ANS with every field', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${ans.id.value}`);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            const { created_at: createdAt, ...data } = response.data.data;
            expect(data).toEqual({
                id: ans.id.value,
                nombre: ans.nombre.value,
                intermedio: ans.intermedio.value,
                vencido: ans.vencido.value,
                color_ans_inicial: ans.color_ans_inicial.value,
                color_ans_intermedio: ans.color_ans_intermedio.value,
                color_ans_final: ans.color_ans_final.value,
                status: ans.status.value,
                medicion_ans_id: ans.medicion_ans_id.value,
                created_by: ans.created_by.value,
                updated_at: null,
                updated_by: null,
            });
            expect(new Date(createdAt).toISOString()).toBe(new Date(ans.created_at.value).toISOString());
        });

        it('should return 404 when the ANS does not exist', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${randomUUID()}`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
        });

        it('should return 400 when the id is not a UUID', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/invalid-uuid-format`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // UPDATE OPERATION
    // ============================================================
    describe('POST /:id - Update ANS', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should update an ANS and persist the changes', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);
            const payload = { nombre: 'Ans Actualizado', intermedio: 6, vencido: 12 };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, payload);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(await findAnsBy({ id: ans.id.value })).toMatchObject(payload);
        });

        it('should update only the provided fields', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { vencido: 15 });

            // Assert
            expect(response.status).toBe(HTTP.OK);
            const fetched = await TestHelper.getRequest(`${baseUrl}/${ans.id.value}`);
            expect(fetched.data.data).toMatchObject({
                vencido: 15,
                nombre: ans.nombre.value,
                intermedio: ans.intermedio.value,
                medicion_ans_id: ans.medicion_ans_id.value,
            });
        });

        it('should keep the creation audit fields and set the update ones', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { nombre: 'Ans Auditado' });

            // Assert
            const fetched = await TestHelper.getRequest(`${baseUrl}/${ans.id.value}`);
            expect(fetched.data.data.created_by).toBe(ans.created_by.value);
            expect(new Date(fetched.data.data.created_at).toISOString()).toBe(
                new Date(ans.created_at.value).toISOString()
            );
            expect(fetched.data.data.updated_at).not.toBeNull();
            expect(fetched.data.data.updated_by).not.toBeNull();
        });

        it('should return 400 when a field has an invalid type', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, {
                intermedio: 'not-a-number',
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when nombre is empty', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { nombre: '' });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 and keep the original data when nombre contains digits', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { nombre: 'Ans123' });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findAnsBy({ id: ans.id.value })).nombre).toBe(ans.nombre.value);
        });

        it('should return 400 when intermedio is not lower than vencido', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, {
                intermedio: 20,
                vencido: 10,
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findAnsBy({ id: ans.id.value })).toMatchObject({
                intermedio: ans.intermedio.value,
                vencido: ans.vencido.value,
            });
        });

        it('should return 400 and keep the data when only intermedio is sent and it reaches vencido', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository, { intermedio: 5, vencido: 10 });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { intermedio: 20 });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findAnsBy({ id: ans.id.value })).intermedio).toBe(5);
        });

        it('should return 400 and keep the data when only vencido is sent and it drops to intermedio', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository, { intermedio: 5, vencido: 10 });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { vencido: 3 });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findAnsBy({ id: ans.id.value })).vencido).toBe(10);
        });

        it('should return 400 and keep the data when medicion_ans_id is not a known type', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, {
                medicion_ans_id: 'Weeks',
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findAnsBy({ id: ans.id.value })).medicion_ans_id).toBe(ans.medicion_ans_id.value);
        });

        it('should return 400 when the payload carries server-managed fields', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, {
                nombre: 'Ans Forjado',
                created_by: randomUUID(),
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findAnsBy({ id: ans.id.value })).nombre).toBe(ans.nombre.value);
        });

        it('should return 400 when the id is not a UUID', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/invalid-uuid`, { nombre: 'Ans Oro' });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when the ANS does not exist', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${randomUUID()}`, { nombre: 'Ans Oro' });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // DELETE OPERATION
    // ============================================================
    describe('GET /:id/delete - Delete ANS (Soft Delete)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should soft delete an ANS keeping the row with deleted_at and deleted_by', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${ans.id.value}/delete`);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            const row = await findAnsBy({ id: ans.id.value });
            expect(row.deleted_at).not.toBeNull();
            expect(row.deleted_by).not.toBeNull();
        });

        it('should return 404 when reading a deleted ANS', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);
            await TestHelper.getRequest(`${baseUrl}/${ans.id.value}/delete`);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${ans.id.value}`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
        });

        it('should return 400 when the id is not a UUID', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/invalid-uuid/delete`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when the ANS does not exist', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${randomUUID()}/delete`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // INDEX OPERATION
    // ============================================================
    describe('GET / - Index ANS (List with default criteria)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should list the ANS with their total count', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(totalOf(response)).toBe(SEEDED_ANS_COUNT + 1);
            expect(response.data.data.items.map((item) => item.id)).toContain(ans.id.value);
        });

        it('should return at most 10 items while counting all of them', async () => {
            // Arrange
            for (let i = 0; i < 12; i++) {
                await AnsMother.createRandomAns(repository);
            }

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toHaveLength(10);
            expect(totalOf(response)).toBe(SEEDED_ANS_COUNT + 12);
        });

        it('should order items by created_at desc', async () => {
            // Arrange
            const older = await AnsMother.createAns(repository, {
                nombre: 'Ans Antiguo',
                created_at: '2030-01-01T00:00:00.000Z',
            });
            const newer = await AnsMother.createAns(repository, {
                nombre: 'Ans Reciente',
                intermedio: 1,
                vencido: 2,
                created_at: '2030-01-02T00:00:00.000Z',
            });

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.slice(0, 2).map((item) => item.id)).toEqual([
                newer.id.value,
                older.id.value,
            ]);
        });

        it('should not return soft-deleted ANS', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);
            await TestHelper.getRequest(`${baseUrl}/${ans.id.value}/delete`);

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).not.toContain(ans.id.value);
            expect(totalOf(response)).toBe(SEEDED_ANS_COUNT);
        });
    });

    // ============================================================
    // SEARCH OPERATION
    // ============================================================
    describe('POST /search - Search ANS with custom criteria', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should find an ANS by ans.id', async () => {
            // Arrange
            const ans = await AnsMother.createRandomAns(repository);
            const criteria = searchCriteria({
                filter: [{ field: 'ans.id', operator: 'eq', value: ans.id.value, type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).toEqual([ans.id.value]);
            expect(totalOf(response)).toBe(1);
        });

        it('should find ANS by a case-insensitive partial nombre', async () => {
            // Arrange
            const oro = await AnsMother.createAns(repository, { nombre: 'Ans Oro' });
            await AnsMother.createAns(repository, { nombre: 'Ans Plata', intermedio: 1, vencido: 2 });
            const criteria = searchCriteria({
                filter: [{ field: 'ans.nombre', operator: 'ilike', value: '%oro%', type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).toEqual([oro.id.value]);
        });

        it('should combine several filters with AND', async () => {
            // Arrange
            const target = await AnsMother.createAns(repository, {
                nombre: 'Ans Objetivo',
                intermedio: 7,
                vencido: 14,
            });
            await AnsMother.createAns(repository, { nombre: 'Ans Distinto', intermedio: 7, vencido: 21 });
            const criteria = searchCriteria({
                filter: [
                    { field: 'ans.intermedio', operator: 'eq', value: 7, type: 'AND' },
                    { field: 'ans.vencido', operator: 'eq', value: 14, type: 'AND' },
                ],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).toEqual([target.id.value]);
        });

        it('should return an empty list when nothing matches', async () => {
            // Arrange
            const criteria = searchCriteria({
                filter: [{ field: 'ans.id', operator: 'eq', value: randomUUID(), type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toEqual([]);
            expect(totalOf(response)).toBe(0);
        });

        it('should paginate with limit and offset over a custom order', async () => {
            // Arrange
            const names = ['Ans Alfa', 'Ans Bravo', 'Ans Charlie', 'Ans Delta'];
            for (const [index, nombre] of names.entries()) {
                await AnsMother.createAns(repository, { nombre, intermedio: index + 1, vencido: index + 10 });
            }
            const criteria = searchCriteria({
                filter: [{ field: 'ans.nombre', operator: 'ilike', value: 'Ans %', type: 'AND' }],
                limit: 2,
                offset: 1,
                order: { field: 'nombre', direction: 'asc' },
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.nombre)).toEqual(['Ans Bravo', 'Ans Charlie']);
            expect(totalOf(response)).toBe(names.length);
        });

        it('should not return soft-deleted ANS', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);
            await TestHelper.getRequest(`${baseUrl}/${ans.id.value}/delete`);
            const criteria = searchCriteria({
                filter: [{ field: 'ans.id', operator: 'eq', value: ans.id.value, type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toEqual([]);
            expect(totalOf(response)).toBe(0);
        });

        it('should return 400 when limit is not a number', async () => {
            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/search`,
                searchCriteria({ limit: 'not-a-number' })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when the operator is not supported', async () => {
            // Arrange
            const criteria = searchCriteria({
                filter: [{ field: 'ans.nombre', operator: 'contains', value: 'Oro', type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 403 when a filter is outside the allowlist and the user lacks advanced search', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);
            const criteria = searchCriteria({
                filter: [{ field: 'id', operator: 'eq', value: ans.id.value, type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response).toHaveProperty('status', HTTP.FORBIDDEN);
        });

        it('should accept a filter outside the allowlist when the user has AnsSearchAdvanced', async () => {
            // Arrange
            await TestHelper.resetSchemaAndMigrate(tenant, { searchPermissionNames: ['AnsSearchAdvanced'] });
            const ans = await AnsMother.createAns(repository);
            const criteria = searchCriteria({
                filter: [{ field: 'id', operator: 'eq', value: ans.id.value, type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).toEqual([ans.id.value]);
        });
    });

    // ============================================================
    // ERROR HANDLING AND EDGE CASES
    // ============================================================
    describe('Error handling and edge cases', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should return 403 when the route does not exist', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${randomUUID()}/invalid`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.FORBIDDEN);
        });

        it('should return 400 when a path segment is not a UUID', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/123-456-789`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when nombre is a very long string', async () => {
            // Arrange
            const payload = createPayload({ nombre: 'A'.repeat(10000) });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should create the ANS when the optional status is omitted', async () => {
            // Arrange
            const payload = createPayload({ nombre: 'Ans Sin Estado' });
            delete payload.status;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect(await findAnsBy({ nombre: 'Ans Sin Estado' })).toBeDefined();
        });

        it('should return 400 when the optional status is null', async () => {
            // Arrange
            const payload = createPayload({ status: null });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should reject SQL injection in nombre and keep the table intact', async () => {
            // Arrange
            const payload = createPayload({ nombre: "'; DROP TABLE ans; --" });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await countAnsBy({})).toBe(SEEDED_ANS_COUNT);
        });

        it('should treat SQL injection in a search value as a literal', async () => {
            // Arrange
            await AnsMother.createAns(repository);
            const criteria = searchCriteria({
                filter: [{ field: 'ans.nombre', operator: 'ilike', value: "%'; DROP TABLE ans; --", type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toEqual([]);
            expect(await countAnsBy({})).toBe(SEEDED_ANS_COUNT + 1);
        });

        it('should return 400 when nombre carries an XSS payload', async () => {
            // Arrange
            const payload = createPayload({ nombre: "<script>alert('XSS')</script>" });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // DATA INTEGRITY AND CONSISTENCY
    // ============================================================
    describe('Data integrity and consistency', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should apply exactly one of two concurrent updates', async () => {
            // Arrange
            const ans = await AnsMother.createAns(repository);

            // Act
            const responses = await Promise.all([
                TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { nombre: 'Ans Primero' }),
                TestHelper.postRequest(`${baseUrl}/${ans.id.value}`, { nombre: 'Ans Segundo' }),
            ]);

            // Assert
            expect(responses.map((response) => response.status)).toEqual([HTTP.OK, HTTP.OK]);
            expect(['Ans Primero', 'Ans Segundo']).toContain((await findAnsBy({ id: ans.id.value })).nombre);
        });
    });
});
