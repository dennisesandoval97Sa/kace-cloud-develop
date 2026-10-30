import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { NestedValueManager } from '../../../shared/domain/utilities/NestedValueManager.js';
import { JsonWebToken } from '../../../shared/domain/auth/JsonWebToken.js';

/**
 * Domain service responsible for caching auth endpoint responses in the
 * `ws_rest_endpoint_token_cache` table.
 *
 * Supports any type of auth response (OAuth2 bearer tokens, API keys, sessions, etc.)
 * by using a **TTL cascade strategy** to determine cache duration:
 *
 * 1. `cache_expires_in_path` — extracts the value from the response: if numeric, uses it
 *    directly as TTL; if it's a JWT string, decodes the `exp` claim to compute remaining TTL.
 * 2. `cache_default_ttl_seconds` — static fallback TTL.
 * 3. If none of the above resolve, the response is **not cached** (fail-safe).
 */
export class EndpointTokenCacheService {
    /** @type {import('../../infrastructure/persistence/KnexEndpointTokenCacheRepository.js').KnexEndpointTokenCacheRepository} */
    #repository;

    /**
     * Safety margin in seconds subtracted from the resolved TTL to avoid using
     * a token that is about to expire. Default: 60 seconds.
     * @type {number}
     */
    #safetyMarginSeconds;

    /**
     * @param {KnexEndpointTokenCacheRepository} repository
     * @param {number} [safetyMarginSeconds=60] Safety margin before considering a cached token expired.
     */
    constructor(repository, safetyMarginSeconds = 60) {
        this.#repository = repository;
        this.#safetyMarginSeconds = safetyMarginSeconds;
    }

    /**
     * Attempts to retrieve a valid cached response for the given auth endpoint.
     *
     * @param {string} endpointId - The authorization endpoint's UUID.
     * @returns {Promise<Object|null>} The cached response data if valid, or null if expired/missing.
     */
    async getValidCachedResponse(endpointId) {
        try {
            const cached = await this.#repository.findByEndpointId(endpointId);

            if (!cached) {
                Helper.logDebug(`[EndpointTokenCache] No cache entry for endpoint ${endpointId}`);
                return null;
            }

            const now = new Date();
            const expiresAtWithMargin = new Date(cached.expires_at.getTime() - this.#safetyMarginSeconds * 1000);

            if (now >= expiresAtWithMargin) {
                Helper.logDebug(`[EndpointTokenCache] Cache expired for endpoint ${endpointId}`, {
                    cached_at: cached.cached_at,
                    expires_at: cached.expires_at,
                });
                return null;
            }

            Helper.logDebug(`[EndpointTokenCache] Cache HIT for endpoint ${endpointId}`, {
                cached_at: cached.cached_at,
                expires_at: cached.expires_at,
                remaining_seconds: Math.round((expiresAtWithMargin.getTime() - now.getTime()) / 1000),
            });

            return cached.response_data;
        } catch (error) {
            Helper.logError('[EndpointTokenCache] Error reading cache, falling back to normal auth', error);
            return null;
        }
    }

    /**
     * Caches an auth endpoint's HTTP response using the TTL cascade strategy.
     *
     * @param {string} endpointId - The authorization endpoint's UUID.
     * @param {Object} responseData - The full HTTP response body.
     * @param {Object} cacheConfig - Cache configuration from the endpoint.
     * @param {string|null} cacheConfig.cacheExpiresInPath - JSON path to read TTL or JWT token from response.
     * @param {number|null} cacheConfig.cacheDefaultTtlSeconds - Fallback TTL.
     * @returns {Promise<void>}
     */
    async cacheResponse(endpointId, responseData, { cacheExpiresInPath, cacheDefaultTtlSeconds }) {
        try {
            const ttlSeconds = this.#resolveTtlSeconds(cacheExpiresInPath, cacheDefaultTtlSeconds, responseData);

            if (ttlSeconds == null || ttlSeconds <= 0) {
                Helper.logDebug(
                    `[EndpointTokenCache] Could not determine TTL for endpoint ${endpointId} – skipping cache`
                );
                return;
            }

            const now = new Date();
            const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

            const existing = await this.#repository.findByEndpointId(endpointId);

            if (existing) {
                await this.#repository.update(endpointId, responseData, expiresAt);
            } else {
                await this.#repository.save(endpointId, responseData, expiresAt);
            }

            Helper.logDebug(`[EndpointTokenCache] Response cached for endpoint ${endpointId}`, {
                ttl_seconds: ttlSeconds,
                expires_at: expiresAt,
                action: existing ? 'updated' : 'saved',
            });
        } catch (error) {
            Helper.logError('[EndpointTokenCache] Error caching response (non-critical)', error);
        }
    }

    /**
     * Resolves the effective TTL in seconds using the cascade strategy:
     *
     * Priority 1: `cacheExpiresInPath` — extracts the value from the response:
     *             if numeric, uses it directly as TTL; if it's a JWT string,
     *             decodes the `exp` claim to compute remaining TTL.
     * Priority 2: `cacheDefaultTtlSeconds` — static fallback.
     * Priority 3: null — do not cache.
     *
     * @param {string|null} cacheExpiresInPath - JSON path in the response body.
     * @param {number|null} cacheDefaultTtlSeconds - Fallback TTL.
     * @param {Object} responseData - The HTTP response body.
     * @returns {number|null} The resolved TTL in seconds, or null if unresolvable.
     * @private
     */
    #resolveTtlSeconds(cacheExpiresInPath, cacheDefaultTtlSeconds, responseData) {
        if (cacheExpiresInPath && responseData) {
            const extractedValue = NestedValueManager.getValue(responseData, cacheExpiresInPath);

            const parsed = Number(extractedValue);
            if (!isNaN(parsed) && parsed > 0) {
                Helper.logDebug('[EndpointTokenCache] TTL resolved from response path (numeric)', {
                    path: cacheExpiresInPath,
                    value: parsed,
                });
                return parsed;
            }

            if (typeof extractedValue === 'string' && extractedValue.length > 0) {
                const ttl = JsonWebToken.getRemainingTtlSeconds(extractedValue);
                if (ttl != null) {
                    Helper.logDebug('[EndpointTokenCache] TTL resolved from response path (JWT exp)', {
                        path: cacheExpiresInPath,
                        ttl_seconds: ttl,
                    });
                    return ttl;
                }
            }
        }

        if (cacheDefaultTtlSeconds != null && cacheDefaultTtlSeconds > 0) {
            Helper.logDebug('[EndpointTokenCache] TTL resolved from cache_default_ttl_seconds', {
                cacheDefaultTtlSeconds,
            });
            return cacheDefaultTtlSeconds;
        }

        return null;
    }
}
