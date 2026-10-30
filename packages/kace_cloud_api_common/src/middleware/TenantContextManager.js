import DynamoTenantRepository from '@kace/core/src/tenant/infrastructure/aws/DynamoTenantRepository.js';
import { LRUCache } from 'lru-cache';
import LocalTenantRepository from '@kace/core/src/tenant/infrastructure/local/LocalTenantRepository.js';
import { ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { normalizeHeaders } from '../utils/normalizeHeaders.js';

/**
 * Gestor de contexto de tenant con caching LRU y validación robusta
 *
 * ⚠️ IMPORTANTE: NO modifica process.env para evitar race conditions
 * en Lambda con concurrencia > 1. Toda la configuración se pasa por context.
 *
 * @example
 * const subdomain = TenantContextManager.extractSubdomain(event);
 * const tenant = await TenantContextManager.getTenant(subdomain);
 * const config = TenantContextManager.buildTenantConfig(tenant);
 */
class TenantContextManager {
    static #cache = new LRUCache({
        max: 500, // Máximo 500 tenants en cache
        ttl: 5 * 60 * 1000, // 5 minutos TTL
        updateAgeOnGet: true, // Renovar TTL en cada acceso (hot tenants)
        updateAgeOnHas: false,
    });
    static #repository =
        process.env.NODE_ENV === 'local'
            ? new LocalTenantRepository(ValueObjectUuid.random())
            : new DynamoTenantRepository();

    /**
     * Extrae tenant identifier del event
     *
     * PRIORIDAD (para evitar límites de API Gateway):
     * 1. Header X-Tenant-ID (RECOMENDADO - producción)
     * 2. Path parameter {tenantId}
     * 3. Header X-Tenant-Subdomain (legacy/fallback)
     * 4. EventBridge event payload (event.detail.tenant_id)
     *
     * @param {Object} event - Lambda event de API Gateway o EventBridge
     * @returns {string} Tenant ID validado y normalizado
     * @throws {Error} Si no se encuentra tenant ID
     */
    static extractTenantId(event) {
        const headers = normalizeHeaders(event.headers);
        const pathParams = event.pathParameters || {};
        let tenantId;

        // 1. Header X-Tenant-ID (PRODUCCIÓN - sin límites de API Gateway)
        tenantId = headers['x-tenant-id'];

        // 2. Path parameter {tenantId} (alternativa RESTful)
        if (!tenantId && pathParams.tenantId) {
            tenantId = pathParams.tenantId;
        }

        // 3. Header X-Tenant-Subdomain (legacy/backward compatibility)
        if (!tenantId) {
            tenantId = headers['x-tenant-subdomain'];
        }

        // 4. EventBridge event payload (para eventos programados/asíncronos)
        if (!tenantId && event.source === 'aws.events' && event.detail?.tenant_id) {
            tenantId = event.detail.tenant_id;
        }

        if (!tenantId) {
            throw new Error(
                'Tenant ID not found in request. Send X-Tenant-ID header, tenantId path parameter, or tenant_id in event.detail.'
            );
        }

        return tenantId;
    }

    /**
     * Obtiene tenant con caching LRU
     *
     * @param {string} id - Subdomain del tenant
     * @returns {Promise<Tenant>} Tenant entity
     * @throws {Error} Si el tenant no existe
     */
    static async getTenant(id) {
        // Check cache (LRU automáticamente maneja TTL)
        const cached = this.#cache.get(id);
        if (cached) {
            return cached;
        }

        // Query DynamoDB
        const tenant = await this.#repository.find(id);

        if (!tenant) {
            throw new Error(`Tenant not found: ${id}`);
        }

        // Cache result (LRU evicta automáticamente el más antiguo si max=500)
        this.#cache.set(id, tenant);

        return tenant;
    }

    /**
     * Invalida el cache de un tenant específico
     * Útil cuando se actualiza configuración del tenant
     *
     * @param {string} id - Subdomain del tenant a invalidar
     */
    static invalidateTenant(id) {
        this.#cache.delete(id);
    }

    /**
     * Construye knexConfig dinámico basado en tenant
     *
     * @param {Tenant} tenant
     * @param {Object} [options]
     * @param {number} [options.poolMax=3]  Knex pool max override; default 3.
     * @returns {Object} Configuración de Knex
     */
    static buildKnexConfig(tenant, options = {}) {
        return tenant.buildKnexConfig(options);
    }

    /**
     * Builds the reader Knex config for a tenant.
     * @param {Tenant} tenant
     * @param {Object} [options]
     * @returns {Object}
     */
    static buildReaderConfig(tenant, options = {}) {
        return tenant.buildKnexConfig({ ...options, role: 'reader' });
    }

    /**
     * Limpia todo el cache (útil para testing)
     */
    static clearCache() {
        this.#cache.clear();
    }

    /**
     * Obtiene estadísticas del cache
     *
     * @returns {Object} Estadísticas del cache
     */
    static getCacheStats() {
        return {
            size: this.#cache.size,
            max: this.#cache.max,
            ttl: this.#cache.ttl,
        };
    }
}

export { TenantContextManager };
