import { KnexActionUpdateModelRepository } from '@kace/core/src/action-update-model';
import ActionUpdateModelMother from '@kace/core/tests/action-model-update/domain/ActionUpdateModelMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('ActionUpdateModelController test', () => {
    const repository = new KnexActionUpdateModelRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/action-update-model`
            : 'http://127.0.0.1:60001';

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create an ActionUpdateModel', async () => {
        const payload = ActionUpdateModelMother.dto();

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Template', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch an ActionUpdateModel', async () => {
        const actionUpdateModel = await ActionUpdateModelMother.create(repository);
        const dataExpected = {
            id: actionUpdateModel.id.value,
            type: actionUpdateModel.type.value,
            aggregate: actionUpdateModel.aggregate.value,
            description: actionUpdateModel.description.value,
            formula: actionUpdateModel.formula.value,
            value: actionUpdateModel.value.value,
            field: actionUpdateModel.field.value,
            created_at: actionUpdateModel.created_at.value,
            created_by: actionUpdateModel.created_by.value,
            updated_at: null,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${actionUpdateModel.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch actions using search', async () => {
        const actionCreated = await ActionUpdateModelMother.create(repository);
        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: actionCreated.id.value,
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
        expect(response.data.data.items[0].id).toEqual(actionCreated.id.value);
    });

    it('should update an ActionUpdateModel', async () => {
        const actionUpdateModel = await ActionUpdateModelMother.create(repository);
        const payload = {
            description: 'Updated description',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${actionUpdateModel.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should delete an ActionUpdateModel', async () => {
        const actionUpdateModel = await ActionUpdateModelMother.create(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${actionUpdateModel.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });

    it('should return 400 when type is "formula" but formula is missing', async () => {
        const payload = {
            type: 'formula',
            description: 'Some description',
            value: 'Some value',
        };
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should return 400 when value is required and not provided', async () => {
        const payload = {
            type: 'alfanumerico',
            description: 'Description without value',
        };
        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });
});
