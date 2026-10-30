import { WSRestEndpoint } from '../../domain/WSRestEndpoint.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class KnexWSRestEndpointRepository extends KnexRepository {
    constructor(config) {
        super(config, 'ws_rest_endpoints');
    }

    /**
     * Saves a new WS REST endpoint in the database.
     * @param {WSRestEndpoint} endpoint
     * @returns {Promise<void>}
     */
    async save(endpoint) {
        try {
            await this.table().insert({
                id: endpoint.id.value,
                description: endpoint.description.value,
                type: endpoint.type.value,
                url: endpoint.url.value,
                method: endpoint.method.value,
                headers: endpoint.headers.value,
                body: endpoint.body.value,
                body_type: endpoint.body_type.value,
                is_dynamic_body: endpoint.is_dynamic_body.value,
                is_active: endpoint.is_active.value,
                created_at: endpoint.created_at.value,
                created_by: endpoint.created_by.value,
                deleted_at: endpoint.deleted_at.value,
                deleted_by: endpoint.deleted_by.value,
                authorization_id: endpoint.authorization_id.value,
                is_dynamic_header: endpoint.is_dynamic_header.value,
                filter_input: endpoint.filter_input.value,
                context_position: endpoint.context_position.value,
                on_success: endpoint.on_success.value,
                on_error: endpoint.on_error.value,
                attempts: endpoint.attempts.value,
                initial_context: endpoint.initial_context.value,
                cache_expires_in_path: endpoint.cache_expires_in_path?.value ?? null,
                cache_default_ttl_seconds: endpoint.cache_default_ttl_seconds?.value ?? null,
            });
        } catch (error) {
            Helper.logError('Error saving WS REST endpoint:', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Finds a WS REST endpoint by ID.
     * @param {ValueObjectUuid} id
     * @returns {Promise<WSRestEndpoint | null>}
     */
    async find(id) {
        try {
            const result = await this.table().where({ id: id.value }).first();

            return result ? new WSRestEndpoint(result) : null;
        } catch (error) {
            Helper.logError('Error finding WS REST endpoint:', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Searches for `WSRestEndpoint` instances based on the given criteria.
     *
     * @param {Object} criteria - The criteria for the search operation.
     * @returns {Promise<WSRestEndpoint[]>} A promise that resolves to an array of `WSRestEndpoint` instances matching the criteria.
     */
    async search(criteria) {
        try {
            const queryBuilder = this.table().select('*');

            criteria.convertToKnex(queryBuilder);

            queryBuilder.whereNull('deleted_by');

            const rows = await queryBuilder;

            return rows.map((row) => new WSRestEndpoint(row));
        } catch (error) {
            Helper.logError('Error searching WS REST endpoints:', error);
            throw new QueryDBError('search');
        }
    }
}
