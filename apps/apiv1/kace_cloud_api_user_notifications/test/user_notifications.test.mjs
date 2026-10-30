import { KnexUserNotificationRepository } from '@kace/core/src/user-notifications/index.js';
import { knexConfig } from '@kace/database/knexfile.js';
import UserNotificationsMother from '@kace/core/tests/user-notifications/domain/UserNotificationsMother';
import axios from 'axios';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

describe('UserNotificationsController test', () => {
    const userNotificationsRepository = new KnexUserNotificationRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/user-notifications`
            : 'http://127.0.0.1:60050';

    afterAll(async () => {
        try {
            userNotificationsRepository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a UserNotification', async () => {
        const payload = UserNotificationsMother.dto();
        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a UserNotification', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);

        await expect(response.status).toBe(400);
    });

    it('should fetch a UserNotification', async () => {
        const userNotification = await UserNotificationsMother.createUserNotification(userNotificationsRepository);
        const dataExpected = {
            id: userNotification.id.value,
            asunto: userNotification.asunto.value,
            mensaje: userNotification.mensaje.value,
            fecha_inicio: userNotification.fecha_inicio.value,
            fecha_fin: userNotification.fecha_fin.value,
            leida: userNotification.leida.value,
            leida_por: userNotification.leida_por.value,
            user_id: userNotification.user_id.value,
            is_active: userNotification.is_active.value,
            created_at: userNotification.created_at.value,
            updated_at: null,
            created_by: userNotification.created_by.value,
            updated_by: null,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${userNotification.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toEqual(dataExpected);
    });

    it('should fetch all UserNotifications', async () => {
        const userNotification1 = await UserNotificationsMother.createUserNotification(userNotificationsRepository);
        const userNotification2 = await UserNotificationsMother.createUserNotification(userNotificationsRepository);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(userNotification2.id.value);
        expect(response.data.data.items[1].id).toEqual(userNotification1.id.value);
    });

    it('should delete a UserNotification', async () => {
        const userNotification = await UserNotificationsMother.createUserNotification(userNotificationsRepository);

        const response = await TestHelper.getRequest(`${baseUrl}/${userNotification.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a UserNotification', async () => {
        const userNotification = await UserNotificationsMother.createUserNotification(userNotificationsRepository);
        const payload = {
            asunto: 'Updated Subject',
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${userNotification.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        await expect(axios.get(`${baseUrl}/${uuidv4()}/invalid`)).rejects.toHaveProperty('response.status', 403);
    });
});
