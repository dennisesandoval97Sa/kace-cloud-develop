import { AllowedConnection } from '../../index';
import { KnexRepository } from '../../../shared/index';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';
import { DbRequestContext } from '../../../shared/infrastructure/context/DbRequestContext.js';

export class KnexAllowedConnectionsRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'allowed_connections', readerConfig);
    }

    /**
     * Saves a new allowed conection in the database.
     * @param {AllowedConnection} allowedConnection
     * @returns {Promise<void>}
     */
    async save(allowedConnection) {
        try {
            DbRequestContext.markWrite();
            await this.table().insert({
                id: allowedConnection.id.value,
                description: allowedConnection.description.value,
                connection: allowedConnection.connection.value,
                certificate: allowedConnection.certificate.value,
                is_active: allowedConnection.is_active.value,
                has_ssl: allowedConnection.has_ssl.value,
                created_at: allowedConnection.created_at.value,
                created_by: allowedConnection.created_by.value,
                deleted_at: allowedConnection.deleted_at.value,
                deleted_by: allowedConnection.deleted_by.value,
            });
        } catch (error) {
            Helper.logError('Error saving allowed conection:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Find a allowed conection by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<AllowedConnection | null>}
     */
    async find(id) {
        try {
            const result = await this.read.table('allowed_connections').where({ id: id.value }).first();

            return result ? new AllowedConnection(result) : null;
        } catch (error) {
            Helper.logError('Error finding allowed conection:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds a allowed connection by its connection value.
     * @param {ValueObjectConnection} connection - The connection string to search for.
     * @returns {Promise<AllowedConnection | null>} A promise that resolves to the allowed connection if found, or null if not.
     */
    async findByConnection(connection) {
        try {
            const url = connection.value.replace(/^https?:\/\//, '');
            const domain = url.split('/')[0];

            const query = this.read.table('allowed_connections').where({ connection: domain, deleted_at: null });

            Helper.logDebug(query.toQuery());
            const result = await query.first();

            return result ? new AllowedConnection(result) : null;
        } catch (error) {
            Helper.logError('Error finding allowed connection by connection value:', error);
            throw new QueryDBError('findByConnection');
        }
    }

    /**
     * Searches for `AllowedConnection` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<AllowedConnection[]>} A promise that resolves to an array of `AllowedConnection` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.read.table('allowed_connections').select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;
            return rows.map((row) => new AllowedConnection(row));
        } catch (error) {
            Helper.logError('Error searching allowed conections:', error);
            throw new QueryDBError('search');
        }
    }
}
