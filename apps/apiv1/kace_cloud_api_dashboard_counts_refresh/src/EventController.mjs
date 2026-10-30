import { Helper } from '@kace/core/src/shared/index.js';
import { KnexRepository } from '@kace/core/src/shared/infrastructure/persistence/KnexRepository.js';
import { HttpResponse } from '@kace/api-common';
import { MatviewDiscoveryService } from './MatviewDiscoveryService.mjs';

// Used as fallback when pg_matviews is unavailable (SQLite in tests, unexpected DB error).
const MATVIEWS_DEFAULT = [
    'mv_dashboard_state_counts',
    'mv_dashboard_group_counts',
    'mv_dashboard_responsible_counts',
    'mv_dashboard_ans_counts',
];

/**
 * Turns a plain Knex CONFIG object into a real Knex connection.
 *
 * We delegate to @kace/core's KnexRepository (instead of importing `knex` here) so the knex
 * instantiation and the tenant-schema extraction stay where `knex` is declared and bundled —
 * the app package does not depend on `knex` directly, so a bare `import knex` would not resolve
 * in unit tests. KnexRepository.schema reads the tenant schema from config.schema.
 *
 * @param {import('knex').Knex.Config} config
 * @returns {{ connection: import('knex').Knex, schema: string|null }}
 */
const buildConnectionFromConfig = (config) => {
    const repository = new KnexRepository(config);
    return { connection: repository.connection, schema: repository.schema };
};

export class EventController {
    #event;
    #knexConfig;
    #buildConnection;

    constructor(event, knexConfig, { buildConnection = buildConnectionFromConfig } = {}) {
        // withTenantContext injects the output of Tenant.buildKnexConfig(): a PLAIN Knex config
        // object ({ client, connection, pool, schema }), NOT a live Knex instance. It therefore
        // has no .raw(); we must instantiate a connection from it before running raw SQL.
        this.#event = event;
        this.#knexConfig = knexConfig;
        this.#buildConnection = buildConnection;
    }

    async run() {
        Helper.logInfo('DashboardCountsRefresh: Begin run');
        const failed = [];

        const { connection, schema, ownsConnection } = this.#resolveConnection();

        try {
            const matviews = await this.#discoverMatviews(connection, schema);
            Helper.logInfo(`DashboardCountsRefresh: refreshing ${matviews.length} matview(s)`);

            for (const matview of matviews) {
                // The live PG search_path stays at 'public' in production: the tenant schema is a
                // custom Knex `schema` config field (used by KnexRepository.qualifiedName to PREFIX
                // table names), NOT search_path. So raw SQL must qualify the matview with the tenant
                // schema, or it resolves against 'public' and fails with "relation ... does not exist".
                const target = schema ? `"${schema}"."${matview}"` : matview;
                try {
                    await connection.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${target}`);
                } catch (error) {
                    Helper.logError(`Error refreshing matview ${matview}`, error);
                    failed.push(matview);
                }
            }
        } finally {
            // We own (and must close) only the connection we built from a config object. A caller
            // that injected a ready connection keeps ownership of its lifecycle.
            if (ownsConnection && typeof connection.destroy === 'function') {
                try {
                    await connection.destroy();
                } catch (error) {
                    Helper.logError('Error destroying dashboard refresh connection', error);
                }
            }
        }

        if (failed.length > 0) {
            return HttpResponse.internalServerError({
                errors: new Error('One or more dashboard count materialized views failed to refresh'),
                event: this.#event,
            });
        }

        Helper.logInfo('DashboardCountsRefresh: End run - success');
        return HttpResponse.ok({ message: 'Dashboard count matviews refreshed', event: this.#event });
    }

    async #discoverMatviews(connection, schema) {
        const found = await new MatviewDiscoveryService(connection, schema).discover('mv_');
        if (found === null) {
            Helper.logInfo('DashboardCountsRefresh: pg_matviews unavailable or empty, using default list');
            return MATVIEWS_DEFAULT;
        }
        return found;
    }

    #resolveConnection() {
        const config = this.#knexConfig;

        // A caller (or unit test) may inject an already-usable connection exposing .raw().
        // withTenantContext does NOT: it injects a plain config object, which we turn into a
        // real connection and then own.
        if (config && typeof config.raw === 'function') {
            return {
                connection: config,
                schema: config.client?.config?.schema,
                ownsConnection: false,
            };
        }

        const { connection, schema } = this.#buildConnection(config);
        return { connection, schema, ownsConnection: true };
    }
}
