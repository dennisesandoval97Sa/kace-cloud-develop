import { KnexReportsViewRepository } from '@kace/core/src/reports/index.js';

/**
 * Builds a KnexReportsViewRepository wired to the tenant's read replica when one
 * exists. Passes CONFIG OBJECTS (not a prebuilt Knex instance) so the base
 * repository can open a distinct reader pool — passing a prebuilt instance would
 * silently collapse reader onto writer.
 *
 * The returned repository owns its pools; callers MUST call destroyConnection().
 *
 * @param {import('@kace/core/src/tenant/domain/Tenant.js').Tenant} tenant
 * @returns {KnexReportsViewRepository}
 */
export function buildReportViewRepository(tenant) {
    const writerConfig = tenant.buildKnexConfig();
    const readerConfig = tenant.db_host_reader?.value
        ? tenant.buildKnexConfig({ preferReplica: true, role: 'reader' })
        : null;

    return new KnexReportsViewRepository(writerConfig, readerConfig);
}
