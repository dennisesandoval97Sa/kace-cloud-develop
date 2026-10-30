import { UserNotification } from '../../index';
import { KnexRepository } from '../../../shared/index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexUserNotificationRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'user_notifications', readerConfig);
    }

    /**
     * Saves a new user notification in the database.
     * @param {UserNotification} notification
     * @returns {Promise<void>}
     */
    async save(notification) {
        DbRequestContext.markWrite();
        try {
            await this.table().insert({
                id: notification.id.value,
                asunto: notification.asunto.value,
                mensaje: notification.mensaje.value,
                fecha_inicio: notification.fecha_inicio.value,
                fecha_fin: notification.fecha_fin.value,
                leida: notification.leida.value,
                leida_por: notification.leida_por.value,
                user_id: notification.user_id.value,
                is_active: notification.is_active.value,
                created_at: notification.created_at.value,
                created_by: notification.created_by.value,
                deleted_at: notification.deleted_at.value,
                deleted_by: notification.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving user notification:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a user notification by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<UserNotification | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('user_notifications').where({ id: id.value }).first();

            return result ? new UserNotification(result) : null;
        } catch (error) {
            Helper.logError('Error finding user notification:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `UserNotification` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<UserNotification[]>} A promise that resolves to an array of `UserNotification` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('user_notifications').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new UserNotification(row));
        } catch (error) {
            Helper.logError('Error searching user notifications:', error);
            throw new QueryDBError('search');
        }
    }
}
