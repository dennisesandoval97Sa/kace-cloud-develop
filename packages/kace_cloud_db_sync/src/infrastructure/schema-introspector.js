import { assertValidIdentifier } from '../shared/identifier.js';

/**
 * Reads table metadata (columns and primary key) from the PostgreSQL catalog.
 */
export class SchemaIntrospector {
    #knex;

    /**
     * @param {import('knex').Knex} knex - Knex instance connected to the database to introspect.
     */
    constructor(knex) {
        this.#knex = knex;
    }

    /**
     * Lists a table's columns in declaration order.
     *
     * @param {string} schema - Schema name.
     * @param {string} table - Table name.
     * @returns {Promise<string[]>} Column names.
     * @throws {Error} When the identifiers are invalid or the relation does not exist.
     */
    async getColumns(schema, table) {
        assertValidIdentifier(schema, 'schema');
        assertValidIdentifier(table, 'table');

        const { rows } = await this.#knex.raw(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = ? AND table_name = ?
             ORDER BY ordinal_position`,
            [schema, table]
        );

        if (rows.length === 0) {
            throw new Error(`Relation "${schema}"."${table}" does not exist`);
        }

        return rows.map((row) => row.column_name);
    }

    /**
     * Lists a table's primary key columns in key order.
     *
     * @param {string} schema - Schema name.
     * @param {string} table - Table name.
     * @returns {Promise<string[]>} Primary key column names, empty when there is no primary key.
     * @throws {Error} When the identifiers are invalid.
     */
    async getPrimaryKey(schema, table) {
        assertValidIdentifier(schema, 'schema');
        assertValidIdentifier(table, 'table');

        const { rows } = await this.#knex.raw(
            `SELECT a.attname AS column_name
             FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey[0:i.indnkeyatts - 1])
             WHERE i.indrelid = (quote_ident(?) || '.' || quote_ident(?))::regclass
               AND i.indisprimary
             ORDER BY array_position(i.indkey, a.attnum)`,
            [schema, table]
        );

        return rows.map((row) => row.column_name);
    }
}
