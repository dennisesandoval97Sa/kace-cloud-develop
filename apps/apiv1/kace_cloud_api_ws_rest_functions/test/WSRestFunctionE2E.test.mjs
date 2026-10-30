import { KnexWSRestFunctionRepository } from '@kace/core/src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import WSRestFunctionMother from '@kace/core/tests/ws_rest_functions/domain/WSRestFunctionMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { Helper } from '@kace/core/src/shared/index.js';

describe('WSRestFunctionController test', () => {
    const repository = new KnexWSRestFunctionRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/ws-rest-function`
            : `http://127.0.0.1:60333`;

    beforeAll(async () => {
        try {
            await repository.connection('ws_rest_functions').select('id').first();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    describe('Create WSRestFunction', () => {
        it('should create a wsRestFunction', async () => {
            const payload = WSRestFunctionMother.dto();
            const response = await TestHelper.postRequest(baseUrl, payload);

            expect(response.status).toBe(201);
        });

        it('return statusCode 400 when validation fails to create a wsRestFunction', async () => {
            const payload = {};
            const response = await TestHelper.postRequest(baseUrl, payload);

            expect(response.status).toBe(400);
        });

        it('should create a wsRestFunction with value_static null', async () => {
            const data = WSRestFunctionMother.dto();
            const payload = { ...data, value_static: null };
            const response = await TestHelper.postRequest(baseUrl, payload);

            expect(response.status).toBe(201);
        });

        it('should not create a wsRestFunction with value_dynamic in true and value_static null', async () => {
            const payload = WSRestFunctionMother.dto();
            const data = { ...payload, value_static: null, value_dynamic: true };
            const response = await TestHelper.postRequest(baseUrl, data);
            expect(response.status).toBe(400);
        });

        it('should not create with number for text-type function', async () => {
            const payload = WSRestFunctionMother.dto({
                type: 'concatenate',
                value_static: 123, // debería ser string
                value_dynamic: true,
            });

            const response = await TestHelper.postRequest(baseUrl, payload);
            expect(response.status).toBe(400);
        });

        it('should not create with text for number-type function', async () => {
            const payload = WSRestFunctionMother.dto({
                type: 'increment',
                value_static: 'not-a-number',
                value_dynamic: true,
            });

            const response = await TestHelper.postRequest(baseUrl, payload);
            expect(response.status).toBe(400);
        });
    });

    describe('Read WSRestFunction', () => {
        it('should fetch a wsRestFunction', async () => {
            const wsRestFunction = await WSRestFunctionMother.create(repository);

            const dataExpected = {
                id: wsRestFunction.id.value,
                description: wsRestFunction.description.value,
                type: wsRestFunction.type.value,
                filter_input: wsRestFunction.filter_input.value,
                context_position: wsRestFunction.context_position.value,
                value_static: wsRestFunction.value_static.value,
                value_dynamic: wsRestFunction.value_dynamic.value,
                is_active: wsRestFunction.is_active.value,
                created_by: wsRestFunction.created_by.value,
                created_at: wsRestFunction.created_at.value,
                updated_at: wsRestFunction.updated_at.value,
                updated_by: wsRestFunction.updated_by.value,
            };

            const response = await TestHelper.getRequest(`${baseUrl}/${wsRestFunction.id.value}`);

            expect(response.status).toBe(200);
            expect(response.data.data).toEqual(dataExpected);
        });

        it('should return notFound when the resource does not exist', async () => {
            const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);
            expect(response.status).toBe(404);
        });

        it('should return Forbidden when the endpoint does not exist', async () => {
            const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
            expect(response).toHaveProperty('status', 403);
        });
    });

    describe('Update WSRestFunction', () => {
        it('should update a wsRestFunction', async () => {
            const wsRestFunction = await WSRestFunctionMother.create(repository);

            const payload = {
                id: wsRestFunction.id.value,
                description: `Default function description ${uuidv4()}`,
                type: 'formatDate',
                filter_input: { filter_input: ['hola'] },
                context_position: 'items[1].price',
                value_static: 'Test value_static',
                value_dynamic: false,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${wsRestFunction.id.value}`, payload);

            expect(response.status).toBe(200);
        });
    });

    describe('Delete WSRestFunction', () => {
        it('should delete a wsRestFunction', async () => {
            const wsRestFunction = await WSRestFunctionMother.create(repository);

            const response = await TestHelper.getRequest(`${baseUrl}/${wsRestFunction.id.value}/delete`);

            expect(response.status).toBe(200);
        });
    });

    describe('Index WSRestFunction', () => {
        it('should return all wsRestFunctions', async () => {
            await WSRestFunctionMother.create(repository);
            await WSRestFunctionMother.create(repository);

            const response = await TestHelper.getRequest(`${baseUrl}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.data.data.items)).toBe(true);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Search WSRestFunction', () => {
        it('should return filtered wsRestFunctions', async () => {
            const wsRestFunction = await WSRestFunctionMother.create(repository);

            const payload = {
                filter: [
                    {
                        field: 'ws_rest_functions.id',
                        operator: 'eq',
                        value: wsRestFunction.id.value,
                        type: 'AND',
                    },
                ],
                limit: 10,
                offset: 0,
                order: {
                    field: 'created_at',
                    direction: 'asc',
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/search`, payload);
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toEqual(1);
        });

        it('should return 400 if validation fails', async () => {
            const payload = { filters: 'undefine-input' };

            const response = await TestHelper.postRequest(`${baseUrl}/search`, payload);
            expect(response.status).toBe(400);
        });
    });
});
