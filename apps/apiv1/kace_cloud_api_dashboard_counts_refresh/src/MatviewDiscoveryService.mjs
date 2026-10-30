/**
 * Infrastructure service that queries pg_matviews to discover materialized views
 * matching a given prefix within a tenant schema.
 *
 * Isolates the PostgreSQL catalog SQL from the application controller so the
 * controller stays free of raw infrastructure queries.
 */
export class MatviewDiscoveryService {
    #connection;
    #schema;

    /**
     * @param {import('knex').Knex} connection
     * @param {string|null} schema - tenant schema name, or null for the default search path
     */
    constructor(connection, schema) {
        this.#connection = connection;
        this.#schema = schema;
    }

    /**
     * Returns all matview names whose name starts with `prefix` in the tenant schema.
     * Returns null when pg_matviews is unavailable (e.g. SQLite) or the query fails,
     * so the caller can substitute a fallback list.
     *
     * @param {string} [prefix='mv_'] - matview name prefix to match
     * @returns {Promise<string[]|null>}
     */
    async discover(prefix = 'mv_') {
        try {
            const query = this.#schema
                ? `SELECT matviewname FROM pg_matviews WHERE schemaname = ? AND matviewname LIKE ? ORDER BY matviewname`
                : `SELECT matviewname FROM pg_matviews WHERE matviewname LIKE ? ORDER BY matviewname`;
            const params = this.#schema ? [this.#schema, `${prefix}%`] : [`${prefix}%`];
            const result = await this.#connection.raw(query, params);
            const found = (result.rows ?? []).map((r) => r.matviewname);
            return found.length > 0 ? found : null;
        } catch {
            return null;
        }
    }
}
