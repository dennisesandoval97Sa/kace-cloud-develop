import { KnexActionRepository } from '@kace/core/src/actions';
import ActionMother from '@kace/core/tests/actions/domain/ActionMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('ActionController test', () => {
    const repository = new KnexActionRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/actions`
            : 'http://127.0.0.1:60000';

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create an Action', async () => {
        const payload = ActionMother.dto();

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Template', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch an Action', async () => {
        const action = await ActionMother.create(repository);
        const dataExpected = {
            id: action.id.value,
            description: action.description.value,
            action_type: action.action_type.value,
            advisor_list_id: action.advisor_list_id.value,
            triggers: action.triggers.value,
            conditions: action.conditions.value,
            permissions: action.permissions.value,
            external_group_code: action.external_group_code.value,
            external_user_code: action.external_user_code.value,
            group_id: action.group_id.value,
            group_list_id: action.group_list_id.value,
            mail_account_id: action.mail_account_id.value,
            model_update_id: action.model_update_id.value,
            priority: action.priority.value,
            responsible_id: action.responsible_id.value,
            state_id: action.state_id.value,
            template_id: action.template_id.value,
            ws_rest_flow_id: action.ws_rest_flow_id.value,
            is_active: action.is_active.value,
            automation_id: action.automation_id.value,
            created_at: action.created_at.value,
            created_by: action.created_by.value,
            updated_at: action.updated_at.value,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${action.id.value}`);
        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch actions using search', async () => {
        const actionCreated = await ActionMother.create(repository);
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

    it('should update an Action', async () => {
        const action = await ActionMother.create(repository);
        const payload = {
            description: `Updated description with id ${action.id.value}`,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${action.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should delete an Action', async () => {
        const action = await ActionMother.create(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${action.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
