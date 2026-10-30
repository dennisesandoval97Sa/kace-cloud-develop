import { v4 as uuidv4 } from 'uuid';
import { UserNotification } from '../../../src/user-notifications';

export default class UserNotificationsMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `UserNotification` entity.
     *
     * @param {Object} params - Optional parameters to customize the DTO.
     * @param {string} params.id - The ID of the user notification.
     * @param {string} params.user_id - The ID of the client.
     * @param {string} params.leida_por - The ID of the user who read the user notification.
     * @param {string} params.created_by - The ID of the creator.
     * @returns {Object} The DTO containing the properties for a `UserNotification` entity.
     */
    static dto({ id, user_id, leida_por, created_by } = {}) {
        return {
            id: id ?? uuidv4(),
            asunto: 'Asunto de prueba',
            mensaje: 'Mensaje de prueba',
            fecha_inicio: new Date().toISOString(),
            fecha_fin: new Date(Date.now() + 86400000).toISOString(),
            leida: false,
            leida_por: leida_por ?? null,
            user_id: user_id ?? uuidv4(),
            is_active: true,
            created_at: new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
        };
    }

    /**
     * Creates a `UserNotification` instance and saves it to the repository.
     *
     * @param {KnexUserNotificationRepository} repository - The repository to save the `UserNotification` instance.
     * @param {Object} data - Optional data to customize the `UserNotification` instance.
     * @returns {Promise<UserNotification>} The created `UserNotification` instance.
     */
    static async createUserNotification(repository, data = {}) {
        const userNotification = UserNotification.create(UserNotificationsMother.dto(data));
        await repository.save(userNotification);
        return userNotification;
    }
}
