import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { TargetUpserter } from '../../src/infrastructure/target-upserter.js';
import { TableSyncPlan } from '../../src/domain/table-sync-plan.js';
import { createTestKnex, testSchemaName, resetSchema, dropSchema } from '../support/test-database.js';

const schema = testSchemaName('sync_upsert');
let knex;
let upserter;

const clientesPlan = () =>
    TableSyncPlan.build({
        table: { name: 'clientes' },
        sourceSchema: schema,
        targetSchema: schema,
        sourceColumns: ['id', 'nombre'],
        targetColumns: ['id', 'nombre'],
        primaryKey: ['id'],
    });

beforeAll(async () => {
    knex = createTestKnex();
    await resetSchema(knex, schema);
    await knex.raw(`CREATE TABLE ??.clientes (id integer PRIMARY KEY, nombre text)`, [schema]);
    await knex.raw(`CREATE TABLE ??.solo_pk (id integer PRIMARY KEY)`, [schema]);
    const anchaColumns = Array.from({ length: 10 }, (_, index) => `c${index}`);
    await knex.raw(
        `CREATE TABLE ??.ancha (id integer PRIMARY KEY, ${anchaColumns.map((c) => `${c} text`).join(', ')})`,
        [schema]
    );
    upserter = new TargetUpserter();
});

beforeEach(async () => {
    await knex.withSchema(schema).from('clientes').del();
    await knex.withSchema(schema).from('solo_pk').del();
    await knex.withSchema(schema).from('ancha').del();
});

afterAll(async () => {
    await dropSchema(knex, schema);
    await knex.destroy();
});

describe('TargetUpserter', () => {
    it('should count every row as inserted when the target is empty', async () => {
        const result = await knex.transaction((trx) =>
            upserter.upsertBatch(trx, clientesPlan(), [
                { id: 1, nombre: 'ana' },
                { id: 2, nombre: 'beto' },
            ])
        );

        expect(result).toEqual({ inserted: 2, updated: 0 });
    });

    it('should update existing rows and count them as updated', async () => {
        await knex.withSchema(schema).insert({ id: 1, nombre: 'viejo' }).into('clientes');

        const result = await knex.transaction((trx) =>
            upserter.upsertBatch(trx, clientesPlan(), [{ id: 1, nombre: 'nuevo' }])
        );

        expect(result).toEqual({ inserted: 0, updated: 1 });
        const rows = await knex.withSchema(schema).select('nombre').from('clientes').where({ id: 1 });
        expect(rows[0].nombre).toBe('nuevo');
    });

    it('should mix inserts and updates in a single batch', async () => {
        await knex.withSchema(schema).insert({ id: 1, nombre: 'viejo' }).into('clientes');

        const result = await knex.transaction((trx) =>
            upserter.upsertBatch(trx, clientesPlan(), [
                { id: 1, nombre: 'nuevo' },
                { id: 2, nombre: 'beto' },
            ])
        );

        expect(result).toEqual({ inserted: 1, updated: 1 });
    });

    it('should handle a table whose columns are all primary key', async () => {
        const plan = TableSyncPlan.build({
            table: { name: 'solo_pk' },
            sourceSchema: schema,
            targetSchema: schema,
            sourceColumns: ['id'],
            targetColumns: ['id'],
            primaryKey: ['id'],
        });
        await knex.withSchema(schema).insert({ id: 1 }).into('solo_pk');

        const result = await knex.transaction((trx) => upserter.upsertBatch(trx, plan, [{ id: 1 }, { id: 2 }]));

        expect(result).toEqual({ inserted: 1, updated: 0 });
    });

    it('should return zero counts for an empty batch', async () => {
        const result = await knex.transaction((trx) => upserter.upsertBatch(trx, clientesPlan(), []));

        expect(result).toEqual({ inserted: 0, updated: 0 });
    });

    it('should upsert a batch whose row count times column count exceeds the bind parameter limit', async () => {
        const columns = Array.from({ length: 10 }, (_, index) => `c${index}`);
        const plan = TableSyncPlan.build({
            table: { name: 'ancha' },
            sourceSchema: schema,
            targetSchema: schema,
            sourceColumns: ['id', ...columns],
            targetColumns: ['id', ...columns],
            primaryKey: ['id'],
        });
        // 6000 filas x 11 columnas = 66.000 parámetros: por encima del tope de 65.535 del protocolo.
        const rows = Array.from({ length: 6000 }, (_, index) => ({
            id: index + 1,
            ...Object.fromEntries(columns.map((column) => [column, 'x'])),
        }));

        const result = await knex.transaction((trx) => upserter.upsertBatch(trx, plan, rows));

        expect(result).toEqual({ inserted: 6000, updated: 0 });
        const [{ count }] = await knex.withSchema(schema).from('ancha').count();
        expect(Number(count)).toBe(6000);
    });
});
