import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { SourceReader } from '../../src/infrastructure/source-reader.js';
import { TableSyncPlan } from '../../src/domain/table-sync-plan.js';
import { createTestKnex, testSchemaName, resetSchema, dropSchema } from '../support/test-database.js';

const schema = testSchemaName('sync_reader');
let knex;
let reader;

const planFor = (table, overrides = {}) =>
    TableSyncPlan.build({
        table,
        sourceSchema: schema,
        targetSchema: schema,
        sourceColumns: ['id', 'nombre'],
        targetColumns: ['id', 'nombre'],
        primaryKey: ['id'],
        ...overrides,
    });

const collect = async (iterator) => {
    const pages = [];
    for await (const page of iterator) {
        pages.push(page);
    }

    return pages;
};

beforeAll(async () => {
    knex = createTestKnex();
    await resetSchema(knex, schema);
    await knex.raw(`CREATE TABLE ??.clientes (id integer PRIMARY KEY, nombre text, activo boolean)`, [schema]);
    await knex.raw(`CREATE TABLE ??.pares (a integer, b integer, valor text, PRIMARY KEY (a, b))`, [schema]);
    await knex.raw(`CREATE TABLE ??.desordenado (id integer PRIMARY KEY, nombre text)`, [schema]);
    await knex.raw(`CREATE TABLE ??.con_or (id integer PRIMARY KEY, estado text)`, [schema]);

    const clientes = Array.from({ length: 25 }, (_, index) => ({
        id: index + 1,
        nombre: `cliente-${index + 1}`,
        activo: index % 2 === 0,
    }));
    await knex.withSchema(schema).insert(clientes).into('clientes');
    await knex
        .withSchema(schema)
        .insert([
            { a: 1, b: 1, valor: 'uno' },
            { a: 1, b: 2, valor: 'dos' },
            { a: 2, b: 1, valor: 'tres' },
        ])
        .into('pares');
    // Inserted in descending id order so the physical (heap) row order is the reverse of
    // primary-key order. A reader that omitted ORDER BY could still pass on `clientes`
    // (inserted ascending) purely by luck of matching heap order; this table would catch that.
    const desordenado = Array.from({ length: 20 }, (_, index) => ({
        id: 20 - index,
        nombre: `n-${20 - index}`,
    }));
    await knex.withSchema(schema).insert(desordenado).into('desordenado');

    const conOr = Array.from({ length: 30 }, (_, index) => ({
        id: index + 1,
        estado: index % 3 === 0 ? 'activo' : index === 1 ? 'pendiente' : 'otro',
    }));
    await knex.withSchema(schema).insert(conOr).into('con_or');

    reader = new SourceReader(knex);
});

afterAll(async () => {
    await dropSchema(knex, schema);
    await knex.destroy();
});

describe('SourceReader', () => {
    it('should read every row across pages', async () => {
        const pages = await collect(reader.readPages(planFor({ name: 'clientes' }), 10));
        const rows = pages.flat();

        expect(pages.length).toBe(3);
        expect(rows).toHaveLength(25);
        expect(rows[0]).toEqual({ id: 1, nombre: 'cliente-1' });
        expect(rows.at(-1)).toEqual({ id: 25, nombre: 'cliente-25' });
    });

    it('should only select the planned columns', async () => {
        const pages = await collect(reader.readPages(planFor({ name: 'clientes' }), 100));

        expect(Object.keys(pages[0][0])).toEqual(['id', 'nombre']);
    });

    it('should apply the configured where clause', async () => {
        const pages = await collect(reader.readPages(planFor({ name: 'clientes', where: 'activo = true' }), 100));

        expect(pages.flat()).toHaveLength(13);
    });

    it('should paginate composite primary keys without skipping rows', async () => {
        const plan = planFor(
            { name: 'pares' },
            { sourceColumns: ['a', 'b', 'valor'], targetColumns: ['a', 'b', 'valor'], primaryKey: ['a', 'b'] }
        );

        const rows = (await collect(reader.readPages(plan, 1))).flat();

        expect(rows).toEqual([
            { a: 1, b: 1, valor: 'uno' },
            { a: 1, b: 2, valor: 'dos' },
            { a: 2, b: 1, valor: 'tres' },
        ]);
    });

    it('should yield nothing for an empty result set', async () => {
        const pages = await collect(reader.readPages(planFor({ name: 'clientes', where: 'id < 0' }), 10));

        expect(pages).toEqual([]);
    });

    it('should return rows in ascending primary key order regardless of insertion/physical order', async () => {
        const rows = (await collect(reader.readPages(planFor({ name: 'desordenado' }), 7))).flat();

        expect(rows.map((row) => row.id)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
    });

    it('should keep pagination correct when the where clause contains a top-level OR', async () => {
        const plan = planFor(
            { name: 'con_or', where: "estado = 'activo' OR estado = 'pendiente'" },
            { sourceColumns: ['id', 'estado'], targetColumns: ['id', 'estado'] }
        );

        const rows = (await collect(reader.readPages(plan, 5))).flat();

        expect(rows.map((row) => row.id)).toEqual([1, 2, 4, 7, 10, 13, 16, 19, 22, 25, 28]);
    });
});
