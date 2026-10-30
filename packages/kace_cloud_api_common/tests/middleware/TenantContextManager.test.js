import { jest } from '@jest/globals';

let mockFind;

jest.unstable_mockModule('@kace/core/src/tenant/infrastructure/aws/DynamoTenantRepository.js', () => {
    const findMock = jest.fn();
    mockFind = findMock;

    return {
        default: jest.fn().mockImplementation(() => ({
            find: findMock,
        })),
    };
});

const { TenantContextManager } = await import('../../src/middleware/TenantContextManager.js');

describe('TenantContextManager', () => {
    let mockTenant;

    beforeEach(() => {
        // Limpiar cache antes de cada test
        TenantContextManager.clearCache();

        // Mock tenant data
        mockTenant = {
            id: { value: 'tenant-123' },
            subdomain: { value: 'acme' },
            db_host: { value: 'db.acme.com' },
            db_database: { value: 'acme_db' },
            db_user: { value: 'acme_user' },
            db_password: { value: 'secret123' },
            db_port: { value: 5432 },
            db_schema: { value: 'public' },
            aws_s3_bucket: { value: 'acme-bucket' },
            aws_s3_region: { value: 'us-east-1' },
            aws_s3_access_key_id: { value: 'AKIAIOSFODNN7EXAMPLE' },
            aws_s3_secret_access_key: { value: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
            secret_key: { value: 'encryption-key' },
            secret_iv: { value: 'encryption-iv' },
            encryption_method: { value: 'aes-256-cbc' },
            apps_environment: { value: 'production' },
            apps_domain: { value: 'acme.com' },
            timezone: { value: 'America/New_York' },
            buildKnexConfig({ poolMax = 3 } = {}) {
                return {
                    client: 'pg',
                    connection: {
                        host: this.db_host.value,
                        port: this.db_port.value,
                        database: this.db_database.value,
                        user: this.db_user.value,
                        password: this.db_password.value,
                        keepAlive: true,
                        keepAliveInitialDelayMillis: 10000,
                    },
                    pool: {
                        min: 0,
                        max: poolMax,
                        idleTimeoutMillis: 1000,
                        acquireTimeoutMillis: 10000,
                        propagateCreateError: true,
                    },
                    acquireConnectionTimeout: 10000,
                    searchPath: [this.db_schema.value],
                    schema: this.db_schema.value,
                };
            },
        };

        // Reset and configure mock
        mockFind.mockReset();
        mockFind.mockResolvedValue(mockTenant);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('extractSubdomain', () => {
        it('should extract subdomain from custom header (lowercase)', () => {
            const event = {
                headers: { 'x-tenant-subdomain': 'acme' },
            };
            expect(TenantContextManager.extractTenantId(event)).toBe('acme');
        });

        it('should extract subdomain from custom header (uppercase)', () => {
            const event = {
                headers: { 'X-Tenant-Subdomain': 'acme' },
            };
            expect(TenantContextManager.extractTenantId(event)).toBe('acme');
        });

        it('should extract tenant id from X-Tenant-ID header as sent by OneScript', () => {
            const event = {
                headers: { 'X-Tenant-ID': 'acme' },
            };
            expect(TenantContextManager.extractTenantId(event)).toBe('acme');
        });

        it('should throw error if subdomain not found', () => {
            const event = {
                headers: {},
            };
            expect(() => TenantContextManager.extractTenantId(event)).toThrow();
        });
    });

    describe('getTenant', () => {
        it('should get tenant from repository on cache miss', async () => {
            const tenant = await TenantContextManager.getTenant('acme');

            expect(mockFind).toHaveBeenCalledWith('acme');
            expect(tenant).toBe(mockTenant);
        });

        it('should return cached tenant on cache hit', async () => {
            // First call - cache miss
            await TenantContextManager.getTenant('acme');

            // Second call - cache hit
            const tenant = await TenantContextManager.getTenant('acme');

            expect(mockFind).toHaveBeenCalledTimes(1);
            expect(tenant).toBe(mockTenant);
        });

        it('should throw error if tenant not found in repository', async () => {
            mockFind.mockResolvedValue(null);

            await expect(TenantContextManager.getTenant('nonexistent')).rejects.toThrow(
                'Tenant not found: nonexistent'
            );
        });

        it('should cache tenant after fetching from repository', async () => {
            await TenantContextManager.getTenant('acme');

            const stats = TenantContextManager.getCacheStats();
            expect(stats.size).toBe(1);
        });
    });

    describe('invalidateTenant', () => {
        it('should remove tenant from cache', async () => {
            // Add to cache
            await TenantContextManager.getTenant('acme');
            expect(TenantContextManager.getCacheStats().size).toBe(1);

            // Invalidate
            TenantContextManager.invalidateTenant('acme');
            expect(TenantContextManager.getCacheStats().size).toBe(0);
        });

        it('should force refetch from repository after invalidation', async () => {
            // First call
            await TenantContextManager.getTenant('acme');
            expect(mockFind).toHaveBeenCalledTimes(1);

            // Invalidate
            TenantContextManager.invalidateTenant('acme');

            // Second call should hit repository again
            await TenantContextManager.getTenant('acme');
            expect(mockFind).toHaveBeenCalledTimes(2);
        });
    });

    describe('buildKnexConfig', () => {
        it('should build knex config with correct structure', () => {
            const knexConfig = TenantContextManager.buildKnexConfig(mockTenant);

            expect(knexConfig).toMatchObject({
                client: 'pg',
                connection: {
                    host: 'db.acme.com',
                    port: 5432,
                    database: 'acme_db',
                    user: 'acme_user',
                    password: 'secret123',
                },
                pool: {
                    min: 0,
                    max: 3,
                    idleTimeoutMillis: 1000,
                    acquireTimeoutMillis: 10000,
                    propagateCreateError: true,
                },
                acquireConnectionTimeout: 10000,
                searchPath: ['public'],
            });
        });

        it('should set correct search path from tenant schema', () => {
            mockTenant.db_schema.value = 'custom_schema';
            const knexConfig = TenantContextManager.buildKnexConfig(mockTenant);

            expect(knexConfig.searchPath).toEqual(['custom_schema']);
        });

        it('uses default poolMax of 3 when no options are provided', () => {
            const knexConfig = TenantContextManager.buildKnexConfig(mockTenant);
            expect(knexConfig.pool.max).toBe(3);
        });

        it('uses default poolMax of 3 when called with empty options', () => {
            const knexConfig = TenantContextManager.buildKnexConfig(mockTenant, {});
            expect(knexConfig.pool.max).toBe(3);
        });

        it('honors poolMax override when provided', () => {
            const knexConfig = TenantContextManager.buildKnexConfig(mockTenant, { poolMax: 10 });
            expect(knexConfig.pool.max).toBe(10);
        });

        it('keeps pool.min at 0 regardless of poolMax', () => {
            const knexConfig = TenantContextManager.buildKnexConfig(mockTenant, { poolMax: 25 });
            expect(knexConfig.pool.min).toBe(0);
            expect(knexConfig.pool.max).toBe(25);
        });
    });

    describe('clearCache', () => {
        it('should clear all cached tenants', async () => {
            // Add multiple tenants to cache
            await TenantContextManager.getTenant('acme');

            mockTenant.subdomain.value = 'tenant2';
            await TenantContextManager.getTenant('tenant2');

            expect(TenantContextManager.getCacheStats().size).toBe(2);

            // Clear cache
            TenantContextManager.clearCache();
            expect(TenantContextManager.getCacheStats().size).toBe(0);
        });
    });

    describe('getCacheStats', () => {
        it('should return cache statistics', () => {
            const stats = TenantContextManager.getCacheStats();

            expect(stats).toHaveProperty('size');
            expect(stats).toHaveProperty('max');
            expect(stats).toHaveProperty('ttl');
            expect(stats.max).toBe(500);
            expect(stats.ttl).toBe(5 * 60 * 1000);
        });
    });
});
