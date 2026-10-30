import { KnexAutomationSettingsRepository } from '@kace/core/src/automation-settings/infrastructure/persistence/KnexAutomationSettingsRepository.js';
import AutomationSettingsMother from '@kace/core/tests/automation-settings/domain/AutomationSettingsMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { Helper } from '@kace/core/src/shared/index.js';

describe('AutomationSettingsController test', () => {
    const repository = new KnexAutomationSettingsRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/automation-settings`
            : `http://127.0.0.1:60073`;

    beforeAll(async () => {
        try {
            await repository.connection('automation_settings').select('id').first();
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

    it('should create AutomationSettings', async () => {
        const payload = AutomationSettingsMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create an AutomationSettings', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should fetch AutomationSettings', async () => {
        const automationSettings = await AutomationSettingsMother.create(repository);
        const dataExpected = {
            id: automationSettings.id.value,
            description: automationSettings.description.value,
            frequency: automationSettings.frequency.value,
            start_date: automationSettings.start_date.value,
            end_date: automationSettings.end_date.value,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${automationSettings.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch AutomationSettingss using search', async () => {
        const stateCreated = await AutomationSettingsMother.create(repository);

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

    it('should delete AutomationSettings', async () => {
        const AutomationSettings = await AutomationSettingsMother.create(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${AutomationSettings.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update AutomationSettings', async () => {
        const AutomationSettings = await AutomationSettingsMother.create(repository);
        const date = new Date();
        const payload = {
            frequency: '* 1/3 * * *',
            description: `Updated description ${uuidv4()}`,
            start_date: date,
            end_date: date,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${AutomationSettings.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response.status).toBe(403);
    });
});
