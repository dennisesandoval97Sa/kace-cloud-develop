import knexLib from 'knex';

/**
 * Creates a Knex instance pointing at the shared test database, with a 5s statement/lock timeout on every connection.
 *
 * @returns {import('knex').Knex} A Knex instance.
 */
export const createTestKnex = () =>
    knexLib({
        client: 'pg',
        connection: {
            host: process.env.DB_TEST_HOST,
            database: process.env.DB_TEST_DATABASE,
            user: process.env.DB_TEST_USER,
            password: process.env.DB_TEST_PASSWORD,
            port: process.env.DB_TEST_PORT,
        },
        pool: {
            min: 0,
            max: 3,
            // Lock contention (e.g. a leaked transaction) must fail fast and legibly
            // instead of stalling until Jest's 60s testTimeout.
            afterCreate: (conn, done) => {
                conn.query("SET statement_timeout = '5s'; SET lock_timeout = '5s';", (err) => done(err, conn));
            },
        },
    });

/**
 * Builds a schema name unique to the current Jest worker.
 *
 * @param {string} prefix - Schema prefix (e.g. "sync_source").
 * @returns {string} The worker-scoped schema name.
 */
export const testSchemaName = (prefix) => `${prefix}_w${process.env.JEST_WORKER_ID ?? '1'}`;

/**
 * Drops and recreates a schema so each test starts from a known state.
 *
 * @param {import('knex').Knex} knex - Knex instance.
 * @param {string} schema - Schema name to reset.
 * @returns {Promise<void>}
 */
export const resetSchema = async (knex, schema) => {
    await knex.raw(`DROP SCHEMA IF EXISTS ?? CASCADE`, [schema]);
    await knex.raw(`CREATE SCHEMA ??`, [schema]);
};

/**
 * Drops a schema, used for teardown.
 *
 * @param {import('knex').Knex} knex - Knex instance.
 * @param {string} schema - Schema name to drop.
 * @returns {Promise<void>}
 */
export const dropSchema = async (knex, schema) => {
    await knex.raw(`DROP SCHEMA IF EXISTS ?? CASCADE`, [schema]);
};
