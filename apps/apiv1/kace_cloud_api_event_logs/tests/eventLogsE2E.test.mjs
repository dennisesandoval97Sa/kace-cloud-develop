import { KnexEventRepository } from '@kace/core/src/event-log';
import EventLogMother from '@kace/core/tests/event-log/domain/EventLogMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('EventLogsController test', () => {
    const repository = new KnexEventRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/event-log`
            : 'http://127.0.0.1:60093';

    beforeEach(async () => {
        await repository.connection.raw(`TRUNCATE TABLE ${repository.tableName} CASCADE`);
    });

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should fetch a Event logs', async () => {
        const eventLog = await EventLogMother.createEventLog(repository);
        const dataExpected = {
            id: eventLog.id.value,
            event_name: eventLog.event_name.value,
            occurred_at: eventLog.occurred_at.value,
            initiated_by_user: eventLog.initiated_by_user.value,
            aggregate_id: eventLog.aggregate_id.value,
            body: eventLog.body.value,
            case_id: eventLog.case_id.value,
            client_id: eventLog.client_id.value,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${eventLog.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all Event logs', async () => {
        const eventLog1 = await EventLogMother.createEventLog(repository);
        const eventLog2 = await EventLogMother.createEventLog(repository);

        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(eventLog2.id.value);
        expect(response.data.data.items[1].id).toEqual(eventLog1.id.value);
    });

    it('should fetch event logs using search', async () => {
        const customEventId = uuidv4();
        await EventLogMother.createEventLog(repository, { id: customEventId });

        const dtoCriteria = {
            filter: [
                {
                    field: 'id',
                    operator: 'eq',
                    value: customEventId,
                    type: 'AND',
                },
            ],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'occurred_at', direction: 'desc' },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(1);
    });

    it('should fetch event logs by case id', async () => {
        const customCaseId = uuidv4();
        await EventLogMother.createEventLog(repository, { case_id: customCaseId });
        await EventLogMother.createEventLog(repository, { case_id: customCaseId });

        const dtoCriteria = {
            filter: null,
            relationship: null,
            limit: 2,
            offset: 0,
            order: { field: 'occurred_at', direction: 'desc' },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/case/${customCaseId}`, dtoCriteria);
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toEqual(2);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
