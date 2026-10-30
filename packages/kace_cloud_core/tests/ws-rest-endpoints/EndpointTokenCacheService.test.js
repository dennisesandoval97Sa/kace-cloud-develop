import { knexConfig } from '../knexfile.js';
import { KnexEndpointTokenCacheRepository } from '../../src/ws-rest-endpoints/infrastructure/persistence/KnexEndpointTokenCacheRepository.js';
import { KnexWSRestEndpointRepository } from '../../src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import { EndpointTokenCacheService } from '../../src/ws-rest-endpoints/domain/services/EndpointTokenCacheService.js';
import WSRestEndpointMother from './domain/WSRestEndpointMother.js';
import jwt from 'jsonwebtoken';

describe('EndpointTokenCacheService', () => {
    const endpointRepository = new KnexWSRestEndpointRepository(knexConfig);
    const cacheRepository = new KnexEndpointTokenCacheRepository(knexConfig);
    let service;

    beforeEach(async () => {
        service = new EndpointTokenCacheService(cacheRepository, 60);
    });

    /**
     * Helper: creates a real endpoint in the DB and returns its ID.
     */
    async function createEndpointId() {
        const endpoint = await WSRestEndpointMother.create(endpointRepository);
        return endpoint.id.value;
    }

    describe('getValidCachedResponse', () => {
        it('should return null when no cache entry exists', async () => {
            const endpointId = await createEndpointId();

            const result = await service.getValidCachedResponse(endpointId);

            expect(result).toBeNull();
        });

        it('should return cached data when token is still valid', async () => {
            const endpointId = await createEndpointId();
            const responseData = { access_token: 'abc123', token_type: 'bearer' };

            await service.cacheResponse(endpointId, responseData, {
                cacheExpiresInPath: null,
                cacheDefaultTtlSeconds: 3600,
            });

            const result = await service.getValidCachedResponse(endpointId);

            expect(result).toEqual(responseData);
        });

        it('should return null when token is expired', async () => {
            const endpointId = await createEndpointId();
            const responseData = { access_token: 'expired-token' };

            await cacheRepository.save(endpointId, responseData, new Date(Date.now() - 1000).toISOString());

            const result = await service.getValidCachedResponse(endpointId);

            expect(result).toBeNull();
        });

        it('should return null when token expires within safety margin', async () => {
            const endpointId = await createEndpointId();
            const responseData = { access_token: 'almost-expired' };

            await cacheRepository.save(endpointId, responseData, new Date(Date.now() + 30 * 1000).toISOString());

            const result = await service.getValidCachedResponse(endpointId);

            expect(result).toBeNull();
        });

        it('should return data when token has enough remaining time beyond safety margin', async () => {
            const endpointId = await createEndpointId();
            const responseData = { access_token: 'valid-token', scope: 'read' };

            await cacheRepository.save(endpointId, responseData, new Date(Date.now() + 120 * 1000).toISOString());

            const result = await service.getValidCachedResponse(endpointId);

            expect(result).toEqual(responseData);
        });
    });

    describe('cacheResponse – TTL cascade', () => {
        it('should resolve TTL from response path (Priority 1) and persist it', async () => {
            const endpointId = await createEndpointId();
            const responseData = { access_token: 'token-p1', expires_in: 7200 };

            await service.cacheResponse(endpointId, responseData, {
                cacheExpiresInPath: 'expires_in',
                cacheDefaultTtlSeconds: 300,
            });

            const cached = await cacheRepository.findByEndpointId(endpointId);

            expect(cached).not.toBeNull();
            expect(cached.response_data).toEqual(responseData);

            const remainingSeconds = Math.round((cached.expires_at.getTime() - Date.now()) / 1000);
            expect(remainingSeconds).toBeGreaterThanOrEqual(7197);
            expect(remainingSeconds).toBeLessThanOrEqual(7201);
        });

        it('should resolve TTL from JWT token in response path', async () => {
            const endpointId = await createEndpointId();
            const jwtToken = jwt.sign({ data: 'test' }, 'secret', { expiresIn: 7200 });
            const responseData = { access_token: jwtToken };

            await service.cacheResponse(endpointId, responseData, {
                cacheExpiresInPath: 'access_token',
                cacheDefaultTtlSeconds: 300,
            });

            const cached = await cacheRepository.findByEndpointId(endpointId);

            expect(cached).not.toBeNull();
            expect(cached.response_data).toEqual(responseData);

            const remainingSeconds = Math.round((cached.expires_at.getTime() - Date.now()) / 1000);
            // 7200 - 60 (safety margin default) = 7140
            expect(remainingSeconds).toBeGreaterThanOrEqual(7135);
            expect(remainingSeconds).toBeLessThanOrEqual(7145);
        });

        it('should use default TTL when response path does not exist (Priority 2)', async () => {
            const endpointId = await createEndpointId();
            const responseData = { access_token: 'token-p2' };

            await service.cacheResponse(endpointId, responseData, {
                cacheExpiresInPath: 'expires_in',
                cacheDefaultTtlSeconds: 1800,
            });

            const cached = await cacheRepository.findByEndpointId(endpointId);

            expect(cached).not.toBeNull();
            const remainingSeconds = Math.round((cached.expires_at.getTime() - Date.now()) / 1000);
            expect(remainingSeconds).toBeGreaterThanOrEqual(1798);
            expect(remainingSeconds).toBeLessThanOrEqual(1801);
        });

        it('should NOT cache when no TTL source is available', async () => {
            const endpointId = await createEndpointId();

            await service.cacheResponse(
                endpointId,
                { access_token: 'no-ttl' },
                {
                    cacheExpiresInPath: null,
                    cacheDefaultTtlSeconds: null,
                }
            );

            const cached = await cacheRepository.findByEndpointId(endpointId);
            expect(cached).toBeNull();
        });

        it('should support nested response paths for TTL', async () => {
            const endpointId = await createEndpointId();
            const responseData = { token: 'nested', metadata: { valid_for: 900 } };

            await service.cacheResponse(endpointId, responseData, {
                cacheExpiresInPath: 'metadata.valid_for',
                cacheDefaultTtlSeconds: null,
            });

            const cached = await cacheRepository.findByEndpointId(endpointId);

            expect(cached).not.toBeNull();
            const remainingSeconds = Math.round((cached.expires_at.getTime() - Date.now()) / 1000);
            expect(remainingSeconds).toBeGreaterThanOrEqual(898);
            expect(remainingSeconds).toBeLessThanOrEqual(901);
        });
    });

    describe('cacheResponse – save vs update', () => {
        it('should insert a new row when no cache exists for the endpoint', async () => {
            const endpointId = await createEndpointId();
            const responseData = { access_token: 'first-save' };

            await service.cacheResponse(endpointId, responseData, {
                cacheExpiresInPath: null,
                cacheDefaultTtlSeconds: 600,
            });

            const rows = await cacheRepository
                .connection('ws_rest_endpoint_token_cache')
                .where({ endpoint_id: endpointId });
            expect(rows).toHaveLength(1);
            expect(rows[0].response_data).toEqual(responseData);
        });

        it('should update the existing row when a cache already exists', async () => {
            const endpointId = await createEndpointId();
            const firstResponse = { access_token: 'original-token' };
            const secondResponse = { access_token: 'refreshed-token' };

            await service.cacheResponse(endpointId, firstResponse, {
                cacheExpiresInPath: null,
                cacheDefaultTtlSeconds: 600,
            });

            await service.cacheResponse(endpointId, secondResponse, {
                cacheExpiresInPath: null,
                cacheDefaultTtlSeconds: 1200,
            });

            const rows = await cacheRepository
                .connection('ws_rest_endpoint_token_cache')
                .where({ endpoint_id: endpointId });
            expect(rows).toHaveLength(1);
            expect(rows[0].response_data).toEqual(secondResponse);
        });

        it('should handle multiple endpoints independently', async () => {
            const endpointIdA = await createEndpointId();
            const endpointIdB = await createEndpointId();

            await service.cacheResponse(
                endpointIdA,
                { token: 'A' },
                {
                    cacheExpiresInPath: null,
                    cacheDefaultTtlSeconds: 600,
                }
            );

            await service.cacheResponse(
                endpointIdB,
                { token: 'B' },
                {
                    cacheExpiresInPath: null,
                    cacheDefaultTtlSeconds: 600,
                }
            );

            const cachedA = await service.getValidCachedResponse(endpointIdA);
            const cachedB = await service.getValidCachedResponse(endpointIdB);

            expect(cachedA).toEqual({ token: 'A' });
            expect(cachedB).toEqual({ token: 'B' });
        });
    });

    describe('full cycle: cache → read → expire → re-cache', () => {
        it('should allow re-caching after expiration', async () => {
            const endpointId = await createEndpointId();

            await cacheRepository.save(endpointId, { access_token: 'old' }, new Date(Date.now() - 1000).toISOString());

            const expired = await service.getValidCachedResponse(endpointId);
            expect(expired).toBeNull();

            await service.cacheResponse(
                endpointId,
                { access_token: 'new' },
                {
                    cacheExpiresInPath: null,
                    cacheDefaultTtlSeconds: 3600,
                }
            );

            const refreshed = await service.getValidCachedResponse(endpointId);
            expect(refreshed).toEqual({ access_token: 'new' });

            const rows = await cacheRepository
                .connection('ws_rest_endpoint_token_cache')
                .where({ endpoint_id: endpointId });
            expect(rows).toHaveLength(1);
        });
    });
});
