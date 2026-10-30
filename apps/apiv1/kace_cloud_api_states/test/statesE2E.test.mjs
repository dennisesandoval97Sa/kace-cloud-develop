import { KnexStateRepository } from '@kace/core/src/state';
import { StateMother } from '@kace/core/tests/state/domain/StateMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('StatesController test', () => {
    const repository = new KnexStateRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/states`
            : `http://127.0.0.1:60043`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a State', async () => {
        const payload = StateMother.dto();

        await repository.connection(repository.tableName).delete().where({
            nombre: payload.nombre,
            icon_class: payload.icon_class,
            require_observation: payload.require_observation,
        });

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create an State', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch a State', async () => {
        const state = await StateMother.createState(repository);
        const dataExpected = {
            id: state.id.value,
            nombre: state.nombre.value,
            descripcion: state.descripcion.value,
            icon_class: state.icon_class.value,
            status: state.status.value,
            color: state.color.value,
            require_observation: state.require_observation.value,
            created_by: state.created_by.value,
            created_at: state.created_at.value,
            updated_by: null,
            updated_at: null,
            deleted_by: null,
            deleted_at: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${state.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch states using search', async () => {
        const stateCreated = await StateMother.createRandomState(repository);

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

    it('should delete a State', async () => {
        const state = await StateMother.createState(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${state.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a State', async () => {
        await repository.connection(repository.tableName).delete().where({
            nombre: StateMother.dto().nombre,
            icon_class: StateMother.dto().icon_class,
            require_observation: StateMother.dto().require_observation,
        });
        const state = await StateMother.createState(repository);

        await repository.connection(repository.tableName).delete().where({
            nombre: 'Name updated',
            icon_class: StateMother.dto().icon_class,
            require_observation: StateMother.dto().require_observation,
        });
        const payload = {
            nombre: 'Name updated',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${state.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return a empty object when fetch a state that is not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });

    it('should fetch States as select options (value/label) from /list', async () => {
        const state1 = await StateMother.createState(repository);
        const state2 = await StateMother.createState(repository);
        const response = await TestHelper.getRequest(`${baseUrl}/list`);
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(response.data.data).toBeDefined();
        expect(Array.isArray(response.data.data.items)).toBe(true);
        const items = response.data.data.items;
        expect(items.length).toBeGreaterThanOrEqual(2);
        expect(items[0]).toMatchObject({
            value: state2.id.value,
            label: state2.nombre.value,
        });
        expect(items[1]).toMatchObject({
            value: state1.id.value,
            label: state1.nombre.value,
        });
        const allowedKeys = ['value', 'label'];
        const hasOnlyAllowedKeys = Object.keys(items[0]).every((k) => allowedKeys.includes(k));
        expect(hasOnlyAllowedKeys).toBe(true);
    });
});
