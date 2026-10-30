import { KnexClientNotificationRepository } from '@kace/core/src/client-notifications';
import { KnexClientRepository } from '@kace/core/src/clients';
import ClientNotificationsMother from '@kace/core/tests/client-notifications/domain/ClientNotificationsMother';
import ClientMother from '@kace/core/tests/clients/domain/ClientMother';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

describe('ClientNotificationsController test', () => {
    const repository = new KnexClientNotificationRepository(knexConfig);
    const clientRepository = new KnexClientRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/client-notifications`
            : `http://127.0.0.1:60018`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a Client Notification', async () => {
        const { id: clientId } = await ClientMother.createClient(clientRepository);
        const payload = ClientNotificationsMother.dto({
            client_id: clientId.value,
        });
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('should return statusCode 400 when validation fails to create a Client Notification', async () => {
        const payload = {};

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should fetch a Client Notification', async () => {
        const { id: clientId } = await ClientMother.createClient(clientRepository);
        const clientNotification = await ClientNotificationsMother.createClientNotification(repository, {
            client_id: clientId.value,
        });
        const dataExpected = {
            id: clientNotification.id.value,
            client_id: clientNotification.client_id.value,
            subject: clientNotification.subject.value,
            message: clientNotification.message.value,
            start_date: clientNotification.start_date.value,
            end_date: clientNotification.end_date.value,
            is_read: clientNotification.is_read.value,
            read_by: clientNotification.read_by.value,
            is_active: clientNotification.is_active.value,
            created_at: clientNotification.created_at.value,
            created_by: clientNotification.created_by.value,
            updated_at: null,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${clientNotification.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all Client Notifications', async () => {
        const { id: clientId } = await ClientMother.createClient(clientRepository);
        const clientNotification1 = await ClientNotificationsMother.createClientNotification(repository, {
            client_id: clientId.value,
        });
        const clientNotification2 = await ClientNotificationsMother.createClientNotification(repository, {
            client_id: clientId.value,
        });

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].data.id).toEqual(clientNotification2.id.value);
        expect(response.data.data.items[1].data.id).toEqual(clientNotification1.id.value);
    });

    it('should delete a Client Notification', async () => {
        const { id: clientId } = await ClientMother.createClient(clientRepository);
        const clientNotification = await ClientNotificationsMother.createClientNotification(repository, {
            client_id: clientId.value,
        });

        const response = await TestHelper.getRequest(`${baseUrl}/${clientNotification.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a Client Notification', async () => {
        const { id: clientId } = await ClientMother.createClient(clientRepository);
        const clientNotification = await ClientNotificationsMother.createClientNotification(repository, {
            client_id: clientId.value,
        });
        const payload = {
            subject: 'Updated Subject',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${clientNotification.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        let response;
        try {
            response = await TestHelper.getRequest(`${baseUrl}/invalid`);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });
});
