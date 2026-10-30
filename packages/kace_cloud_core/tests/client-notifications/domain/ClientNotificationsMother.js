import { v4 as uuidv4 } from 'uuid';
import { ClientNotification } from '../../../src/client-notifications';
import { ensureParentRows } from '../../support/ensureParentRow.js';

export default class ClientNotificationsMother {
    /**
     * Postgres exige que existan las filas padre de estas claves foraneas, y
     * esta factoria inventaba los ids sin respaldarlos con ninguna fila.
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo el id:
     * `ensureParentRow` es idempotente. Las columnas salen de pg_constraint.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            { table: 'clients', id: dto.client_id },
            { table: 'usuarios', id: dto.read_by },
        ]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `ClientNotification` entity.
     *
     * @param {Object} params - Optional parameters to override default values.
     * @returns {Object} The DTO containing the properties for a `ClientNotification` entity.
     */
    static dto({ id, client_id, created_by, read_by = null } = {}) {
        return {
            id: id ?? uuidv4(),
            client_id: client_id ?? uuidv4(),
            subject: 'Sample Subject',
            message: 'Sample Message',
            start_date: new Date().toISOString(),
            end_date: new Date().toISOString(),
            is_read: false,
            read_by: read_by,
            is_active: true,
            created_at: new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
        };
    }

    /**
     * Creates a `ClientNotification` instance and saves it to the repository.
     *
     * @param {Object} repository - The repository to save the `ClientNotification` instance.
     * @param {Object} data - Optional data to override default values.
     * @returns {ClientNotification} The created `ClientNotification` instance.
     */
    static async createClientNotification(repository, data = {}) {
        const dto = ClientNotificationsMother.dto(data);
        await ClientNotificationsMother.ensureRelations(repository.connection, dto);
        const clientNotification = ClientNotification.create(dto);
        await repository.save(clientNotification);
        return clientNotification;
    }
}
