import { ClientNotification } from '../../index';
import { KnexRepository } from '../../../shared/index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexClientNotificationRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'client_notifications', readerConfig);
    }

    /**
     * Saves a new client notification in the database.
     * @param {ClientNotification} notification
     * @returns {Promise<void>}
     */
    async save(notification) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: notification.id.value,
                client_id: notification.client_id.value,
                subject: notification.subject.value,
                message: notification.message.value,
                start_date: notification.start_date.value,
                end_date: notification.end_date.value,
                is_read: notification.is_read.value,
                read_by: notification.read_by.value,
                is_active: notification.is_active.value,
                created_at: notification.created_at.value,
                created_by: notification.created_by.value,
                deleted_at: notification.deleted_at.value,
                deleted_by: notification.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving client notification:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Find a client notification by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<ClientNotification | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('client_notifications').where({ id: id.value }).first();

            return result ? new ClientNotification(result) : null;
        } catch (error) {
            Helper.logError('Error finding client notification:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Updates an existing client notification.
     * @param {ClientNotification} notification
     * @returns {Promise<void>}
     */
    async update(notification) {
        if (Object.keys(notification.changedAttributes).length === 0) {
            return;
        }

        try {
            DbRequestContext.markWrite();
            await this.table().update(notification.changedAttributes).where({ id: notification.id.value });
        } catch (error) {
            Helper.logError('Error updating client notification:', error);
            throw new QueryDBError('update');
        }
    }

    /**
     * Searches for `ClientNotification` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<ClientNotification[]>} A promise that resolves to an array of `ClientNotification` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('client_notifications').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new ClientNotification(row));
        } catch (error) {
            Helper.logError('Error searching client notifications:', error);
            throw new QueryDBError('search');
        }
    }

    /**
     * Counts the number of client notifications based on the given criteria.
     * @param {Object} criteria - The criteria for the count operation.
     * @returns {Promise<number>} A promise that resolves to the count of `ClientNotification` instances matching the criteria.
     */
    async count(criteria) {
        try {
            const query = criteria.convertToKnex(this.read.table('client_notifications').count());
            const [rows] = await query;

            // pg nombra la columna `count` y la entrega como string; `count(*)` era el alias
            // de mysql y aqui resolvia undefined siempre.
            return Number(rows.count);
        } catch (error) {
            Helper.logError('Error counting client notifications:', error);
            throw new QueryDBError('count');
        }
    }
}
