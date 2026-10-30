/**
 * Adds the endpoint token cache infrastructure:
 * 1. Two new columns on `ws_rest_endpoints` to configure caching behavior:
 *    - `cache_expires_in_path`: JSON path in the auth response that contains the TTL in seconds (e.g. "expires_in", "valid_for").
 *    - `cache_default_ttl_seconds`: Fallback TTL when no other source is available.
 * 2. A dedicated `ws_rest_endpoint_token_cache` table that stores the last cached auth response per endpoint with its expiration timestamp.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.alterTable('ws_rest_endpoints', (table) => {
        table.string('cache_expires_in_path', 255).nullable();
        table.integer('cache_default_ttl_seconds').nullable();
    });

    await knex.schema.createTable('ws_rest_endpoint_token_cache', (table) => {
        table.string('id', 36).primary();
        table.string('endpoint_id', 36).unique();
        table.jsonb('response_data');
        table.timestamp('cached_at');
        table.timestamp('expires_at');
        table.timestamp('created_at');
        table.timestamp('updated_at');

        table.foreign('endpoint_id').references('id').inTable('ws_rest_endpoints');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('ws_rest_endpoint_token_cache');

    await knex.schema.alterTable('ws_rest_endpoints', (table) => {
        table.dropColumn('cache_expires_in_path');
        table.dropColumn('cache_default_ttl_seconds');
    });
}
