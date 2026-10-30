import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { v4 as uuid } from 'uuid';

/**
 * Repository for managing endpoint token cache entries in the
 * `ws_rest_endpoint_token_cache` table.
 *
 * Each auth endpoint keeps at most **one** cache row (UNIQUE on endpoint_id).
 */
export class KnexEndpointTokenCacheRepository extends KnexRepository {
    constructor(config) {
        super(config, 'ws_rest_endpoint_token_cache');
    }

    /**
     * Retrieves the cached token entry for a given endpoint.
     *
     * @param {string} endpointId - The authorization endpoint's UUID.
     * @returns {Promise<{response_data: Object, cached_at: Date, expires_at: Date}|null>}
     */
    async findByEndpointId(endpointId) {
        try {
            const row = await this.table().where({ endpoint_id: endpointId }).first();

            if (!row) return null;

            return {
                response_data: row.response_data,
                cached_at: new Date(row.cached_at),
                expires_at: new Date(row.expires_at),
            };
        } catch (error) {
            Helper.logError('[EndpointTokenCache] Error reading cache:', error);
            return null;
        }
    }

    /**
     * Inserts a new cache entry for a given endpoint.
     *
     * @param {string} endpointId - The authorization endpoint's UUID.
     * @param {Object} responseData - The full HTTP response body to cache.
     * @param {string} expiresAt - ISO 8601 timestamp indicating when this cache entry should be considered expired.
     * @returns {Promise<void>}
     */
    async save(endpointId, responseData, expiresAt) {
        try {
            const now = new Date().toISOString();
            await this.table().insert({
                id: uuid(),
                endpoint_id: endpointId,
                response_data: JSON.stringify(responseData),
                cached_at: now,
                expires_at: expiresAt,
                created_at: now,
                updated_at: now,
            });

            Helper.logDebug(`[EndpointTokenCache] Cache saved for endpoint ${endpointId}`);
        } catch (error) {
            Helper.logError('[EndpointTokenCache] Error saving cache (non-critical):', error);
        }
    }

    /**
     * Updates an existing cache entry for a given endpoint.
     *
     * @param {string} endpointId - The authorization endpoint's UUID.
     * @param {Object} responseData - The full HTTP response body to cache.
     * @param {string} expiresAt - ISO 8601 timestamp indicating when this cache entry should be considered expired.
     * @returns {Promise<void>}
     */
    async update(endpointId, responseData, expiresAt) {
        try {
            const now = new Date().toISOString();
            await this.table()
                .where({ endpoint_id: endpointId })
                .update({
                    response_data: JSON.stringify(responseData),
                    cached_at: now,
                    expires_at: expiresAt,
                    updated_at: now,
                });

            Helper.logDebug(`[EndpointTokenCache] Cache updated for endpoint ${endpointId}`);
        } catch (error) {
            Helper.logError('[EndpointTokenCache] Error updating cache (non-critical):', error);
        }
    }
}
