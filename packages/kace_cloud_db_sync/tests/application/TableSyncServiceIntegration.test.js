import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { TableSyncService } from '../../src/application/table-sync-service.js';
import { enableJsonPassthrough } from '../../src/infrastructure/json-passthrough.js';
import { createTestKnex, testSchemaName, resetSchema, dropSchema } from '../support/test-database.js';

const sourceSchema = testSchemaName('sync_svc_src');
const targetSchema = testSchemaName('sync_svc_dst');
let knex;
let service;

const configFor = (tables) => ({
    source: { database: 'ignored', schema: sourceSchema },
    target: { database: 'ignored', schema: targetSchema },
    batchSize: 2,
    tables,
});

beforeAll(async () => {
    enableJsonPassthrough();
    knex = createTestKnex();
    await resetSchema(knex, sourceSchema);
    await resetSchema(knex, targetSchema);

    await knex.raw(`CREATE TABLE ??.clientes (id integer PRIMARY KEY, nombre text, foto_url text)`, [sourceSchema]);
    await knex.raw(`CREATE TABLE ??.clientes (id integer PRIMARY KEY, nombre text)`, [targetSchema]);
    await knex.raw(`CREATE TABLE ??.usuarios (id integer PRIMARY KEY, alias text)`, [sourceSchema]);
    await knex.raw(`CREATE TABLE ??.usuarios (id integer PRIMARY KEY, alias text)`, [targetSchema]);
    await knex.raw(`CREATE TABLE ??.sin_pk (valor text)`, [sourceSchema]);
    await knex.raw(`CREATE TABLE ??.sin_pk (valor text)`, [targetSchema]);
    // El destino declara NOT NULL donde la fuente permite null: fuerza un fallo real de escritura.
    await knex.raw(`CREATE TABLE ??.estricta (id integer PRIMARY KEY, dato text)`, [sourceSchema]);
    await knex.raw(`CREATE TABLE ??.estricta (id integer PRIMARY KEY, dato text NOT NULL)`, [targetSchema]);
    await knex.raw(`CREATE TABLE ??.con_json (id integer PRIMARY KEY, lista jsonb, objeto jsonb, plano json)`, [
        sourceSchema,
    ]);
    await knex.raw(`CREATE TABLE ??.con_json (id integer PRIMARY KEY, lista jsonb, objeto jsonb, plano json)`, [
        targetSchema,
    ]);

    service = new TableSyncService({ sourceKnex: knex, targetKnex: knex });
});

beforeEach(async () => {
    for (const table of ['clientes', 'usuarios', 'sin_pk', 'estricta', 'con_json']) {
        await knex.withSchema(sourceSchema).from(table).del();
        await knex.withSchema(targetSchema).from(table).del();
    }
});

afterAll(async () => {
    await dropSchema(knex, sourceSchema);
    await dropSchema(knex, targetSchema);
    await knex.destroy();
});

describe('TableSyncService', () => {
    it('should insert rows that do not exist in the target', async () => {
        await knex
            .withSchema(sourceSchema)
            .insert([
                { id: 1, nombre: 'ana', foto_url: 'a.png' },
                { id: 2, nombre: 'beto', foto_url: 'b.png' },
            ])
            .into('clientes');

        const report = await service.sync(configFor([{ name: 'clientes' }]));

        expect(report.hasFailures).toBe(false);
        const rows = await knex.withSchema(targetSchema).select('*').from('clientes').orderBy('id');
        expect(rows).toEqual([
            { id: 1, nombre: 'ana' },
            { id: 2, nombre: 'beto' },
        ]);
    });

    it('should update rows that already exist in the target', async () => {
        await knex.withSchema(sourceSchema).insert({ id: 1, nombre: 'nuevo', foto_url: null }).into('clientes');
        await knex.withSchema(targetSchema).insert({ id: 1, nombre: 'viejo' }).into('clientes');

        const report = await service.sync(configFor([{ name: 'clientes' }]));

        expect(report.hasFailures).toBe(false);
        const rows = await knex.withSchema(targetSchema).select('nombre').from('clientes');
        expect(rows[0].nombre).toBe('nuevo');
    });

    it('should report the ignored column caused by schema drift', async () => {
        await knex.withSchema(sourceSchema).insert({ id: 1, nombre: 'ana', foto_url: 'a.png' }).into('clientes');

        const report = await service.sync(configFor([{ name: 'clientes' }]));

        expect(report.toLines()[0]).toContain('(ignoró: foto_url)');
    });

    it('should sync across multiple pages when rows exceed the batch size', async () => {
        const rows = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, alias: `u${index + 1}` }));
        await knex.withSchema(sourceSchema).insert(rows).into('usuarios');

        const report = await service.sync(configFor([{ name: 'usuarios' }]));

        expect(report.hasFailures).toBe(false);
        const [{ count }] = await knex.withSchema(targetSchema).from('usuarios').count();
        expect(Number(count)).toBe(7);
    });

    it('should apply the configured where clause', async () => {
        await knex
            .withSchema(sourceSchema)
            .insert([
                { id: 1, alias: 'in' },
                { id: 2, alias: 'in' },
                { id: 9, alias: 'out' },
            ])
            .into('usuarios');

        await service.sync(configFor([{ name: 'usuarios', where: 'id < 5' }]));

        const rows = await knex.withSchema(targetSchema).select('id').from('usuarios').orderBy('id');
        expect(rows.map((row) => row.id)).toEqual([1, 2]);
    });

    it('should fail a table without a primary key without aborting the run', async () => {
        await knex.withSchema(sourceSchema).insert({ valor: 'x' }).into('sin_pk');
        await knex.withSchema(sourceSchema).insert({ id: 1, alias: 'ok' }).into('usuarios');

        const report = await service.sync(configFor([{ name: 'sin_pk' }, { name: 'usuarios' }]));

        expect(report.hasFailures).toBe(true);
        expect(report.successCount).toBe(1);
        expect(report.toLines()[0]).toContain('has no primary key');
        const rows = await knex.withSchema(targetSchema).select('id').from('usuarios');
        expect(rows).toHaveLength(1);
    });

    it('should fail a missing table without aborting the run', async () => {
        await knex.withSchema(sourceSchema).insert({ id: 1, alias: 'ok' }).into('usuarios');

        const report = await service.sync(configFor([{ name: 'inexistente' }, { name: 'usuarios' }]));

        expect(report.hasFailures).toBe(true);
        expect(report.successCount).toBe(1);
        expect(report.toLines()[0]).toContain('does not exist');
    });

    it('should roll back a failed table without leaving partial rows', async () => {
        await knex
            .withSchema(sourceSchema)
            .insert([
                { id: 1, dato: 'ok' },
                { id: 2, dato: null },
            ])
            .into('estricta');

        const report = await service.sync(configFor([{ name: 'estricta' }]));

        expect(report.hasFailures).toBe(true);
        const rows = await knex.withSchema(targetSchema).select('*').from('estricta');
        expect(rows).toEqual([]);
    });

    it('should report accurate insert and update counts, not swapped', async () => {
        // Conteos asimétricos (2 insertadas vs. 1 actualizada) a propósito: con conteos iguales, invertir
        // inserted/updated en el retorno da el mismo resultado y el bug queda invisible.
        await knex.withSchema(targetSchema).insert({ id: 1, nombre: 'viejo' }).into('clientes');
        await knex
            .withSchema(sourceSchema)
            .insert([
                { id: 1, nombre: 'nuevo', foto_url: null },
                { id: 2, nombre: 'beto', foto_url: null },
                { id: 3, nombre: 'caro', foto_url: null },
            ])
            .into('clientes');

        const report = await service.sync(configFor([{ name: 'clientes' }]));

        expect(report.hasFailures).toBe(false);
        expect(report.toLines()[0]).toContain('3 filas leídas, 2 insertadas, 1 actualizadas');
    });

    // Con batchSize: 2 y solo 2 filas, ambas caben en un único lote/INSERT: Postgres ya garantiza esa
    // atomicidad por sí solo, sin necesitar el wrapper de transacción. Este test usa batchSize: 1 para que
    // cada fila sea un INSERT separado, de modo que la primera fila (válida) se escriba en un lote y la
    // segunda (inválida) falle en un lote posterior — solo el wrapper de transacción por tabla evita que la
    // primera fila quede escrita cuando la tabla entera se reporta como fallida.
    it('should roll back an earlier, already-written batch when a later batch in the same table fails', async () => {
        await knex
            .withSchema(sourceSchema)
            .insert([
                { id: 1, dato: 'ok' },
                { id: 2, dato: null },
            ])
            .into('estricta');

        const report = await service.sync({
            source: { database: 'ignored', schema: sourceSchema },
            target: { database: 'ignored', schema: targetSchema },
            batchSize: 1,
            tables: [{ name: 'estricta' }],
        });

        expect(report.hasFailures).toBe(true);
        const rows = await knex.withSchema(targetSchema).select('*').from('estricta');
        expect(rows).toEqual([]);
    });

    it('should sync jsonb columns whose top-level value is an array', async () => {
        await knex.raw(`INSERT INTO ??.con_json VALUES (1, '["all"]'::jsonb, '{"a":1}'::jsonb, '[1,2]'::json)`, [
            sourceSchema,
        ]);

        const report = await service.sync(configFor([{ name: 'con_json' }]));

        expect(report.hasFailures).toBe(false);
        const [row] = await knex
            .raw(
                `SELECT lista::text AS lista, objeto::text AS objeto, plano::text AS plano FROM ??.con_json WHERE id = 1`,
                [targetSchema]
            )
            .then((result) => result.rows);
        expect(JSON.parse(row.lista)).toEqual(['all']);
        expect(JSON.parse(row.objeto)).toEqual({ a: 1 });
        expect(JSON.parse(row.plano)).toEqual([1, 2]);
    });
});
