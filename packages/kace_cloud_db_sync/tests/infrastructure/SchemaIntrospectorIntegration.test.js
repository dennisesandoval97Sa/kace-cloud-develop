import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SchemaIntrospector } from '../../src/infrastructure/schema-introspector.js';
import { createTestKnex, testSchemaName, resetSchema, dropSchema } from '../support/test-database.js';

const schema = testSchemaName('sync_introspect');
let knex;
let introspector;

beforeAll(async () => {
    knex = createTestKnex();
    await resetSchema(knex, schema);
    await knex.raw(
        `
        CREATE TABLE ??.clientes (
            id integer PRIMARY KEY,
            nombre text NOT NULL,
            email text
        )
    `,
        [schema]
    );
    await knex.raw(
        `
        CREATE TABLE ??.caso_usuarios (
            caso_id integer,
            usuario_id integer,
            rol text,
            PRIMARY KEY (caso_id, usuario_id)
        )
    `,
        [schema]
    );
    await knex.raw(`CREATE TABLE ??.sin_pk (valor text)`, [schema]);
    // Primary key declared in the reverse order of column declaration, so that a query
    // relying on attnum/declaration order (instead of the key's own order) would misreport it.
    await knex.raw(
        `
        CREATE TABLE ??.orden_invertido (
            x integer,
            y integer,
            PRIMARY KEY (y, x)
        )
    `,
        [schema]
    );
    // A UNIQUE index without a primary key: getPrimaryKey must not mistake it for one.
    await knex.raw(`CREATE TABLE ??.con_unique (id integer, codigo text UNIQUE)`, [schema]);
    // PRIMARY KEY ... INCLUDE stores payload columns in pg_index.indkey alongside the key columns;
    // only the first indnkeyatts entries are the actual key.
    await knex.raw(`CREATE TABLE ??.con_include (id integer, extra text, otro text)`, [schema]);
    await knex.raw(`ALTER TABLE ??.con_include ADD PRIMARY KEY (id) INCLUDE (extra)`, [schema]);
    introspector = new SchemaIntrospector(knex);
});

afterAll(async () => {
    await dropSchema(knex, schema);
    await knex.destroy();
});

describe('SchemaIntrospector', () => {
    it('should return columns in ordinal position order', async () => {
        const columns = await introspector.getColumns(schema, 'clientes');

        expect(columns).toEqual(['id', 'nombre', 'email']);
    });

    it('should return the single-column primary key', async () => {
        const primaryKey = await introspector.getPrimaryKey(schema, 'clientes');

        expect(primaryKey).toEqual(['id']);
    });

    it('should return composite primary keys in key order', async () => {
        const primaryKey = await introspector.getPrimaryKey(schema, 'caso_usuarios');

        expect(primaryKey).toEqual(['caso_id', 'usuario_id']);
    });

    it('should return an empty primary key for a table without one', async () => {
        const primaryKey = await introspector.getPrimaryKey(schema, 'sin_pk');

        expect(primaryKey).toEqual([]);
    });

    it('should order composite primary key columns by key position, not declaration order', async () => {
        const primaryKey = await introspector.getPrimaryKey(schema, 'orden_invertido');

        expect(primaryKey).toEqual(['y', 'x']);
    });

    it('should not mistake a UNIQUE index for a primary key', async () => {
        const primaryKey = await introspector.getPrimaryKey(schema, 'con_unique');

        expect(primaryKey).toEqual([]);
    });

    it('should exclude INCLUDE payload columns from the primary key', async () => {
        const primaryKey = await introspector.getPrimaryKey(schema, 'con_include');

        expect(primaryKey).toEqual(['id']);
    });

    it('should throw when the relation does not exist', async () => {
        await expect(introspector.getColumns(schema, 'inexistente')).rejects.toThrow(
            `Relation "${schema}"."inexistente" does not exist`
        );
    });

    it('should reject an invalid schema name before querying', async () => {
        await expect(introspector.getColumns('drop;', 'clientes')).rejects.toThrow('Invalid schema name');
    });
});
