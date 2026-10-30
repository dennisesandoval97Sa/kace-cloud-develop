import { test } from 'node:test';
import assert from 'node:assert/strict';

import knex from 'knex';

import { backfillEstadoId } from '../../migrations/20260914125000_backfill_cases_estado_id.js';

const createTestDatabase = async () => {
    const db = knex({
        client: 'sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true,
    });

    await db.schema.createTable('transiciones', (table) => {
        table.string('id', 36).primary();
        table.string('estado_actual_id', 36);
        table.string('siguiente_estado_id', 36);
    });

    await db.schema.createTable('cases', (table) => {
        table.string('id', 36).primary();
        table.string('transicion_id', 36);
        table.string('estado_id', 36);
    });

    return db;
};

const estadoIdOf = async (db, caseId) => {
    const row = await db('cases').where({ id: caseId }).first('estado_id');
    return row.estado_id;
};

test('backfill toma el siguiente_estado_id de la transición del caso', async () => {
    const db = await createTestDatabase();

    try {
        await db('transiciones').insert({
            id: 'transicion-1',
            estado_actual_id: 'estado-origen',
            siguiente_estado_id: 'estado-destino',
        });
        await db('cases').insert({ id: 'caso-1', transicion_id: 'transicion-1' });

        await backfillEstadoId(db);

        assert.equal(await estadoIdOf(db, 'caso-1'), 'estado-destino');
    } finally {
        await db.destroy();
    }
});

// La definición de "estado actual" del sistema es `transiciones.siguiente_estado_id` a secas:
// es la que usan `view_casos` / `view_case_details` y las tres matviews del dashboard. El
// backfill no puede inventar un estado (`estado_actual_id`) donde esas vistas muestran NULL,
// o la lista de casos y los conteos del dashboard divergirían.
test('backfill deja en NULL los casos cuya transición no tiene siguiente estado', async () => {
    const db = await createTestDatabase();

    try {
        await db('transiciones').insert({
            id: 'transicion-sin-siguiente',
            estado_actual_id: 'estado-origen',
            siguiente_estado_id: null,
        });
        await db('cases').insert({ id: 'caso-1', transicion_id: 'transicion-sin-siguiente' });

        await backfillEstadoId(db);

        assert.equal(await estadoIdOf(db, 'caso-1'), null);
    } finally {
        await db.destroy();
    }
});

test('backfill deja en NULL los casos sin transición, sin fallar', async () => {
    const db = await createTestDatabase();

    try {
        await db('cases').insert({ id: 'caso-huerfano', transicion_id: null });

        await backfillEstadoId(db);

        assert.equal(await estadoIdOf(db, 'caso-huerfano'), null);
    } finally {
        await db.destroy();
    }
});

// El checklist post-deploy contempla reejecutar este backfill. Si sobreescribiera, esa
// reejecución revertiría al estado derivado de la transición cualquier `estado_id` que el
// dominio hubiera escrito por su cuenta — exactamente el dato que MSKT-1392 persiste.
test('backfill sólo rellena filas con estado_id NULL y nunca pisa un valor ya escrito', async () => {
    const db = await createTestDatabase();

    try {
        await db('transiciones').insert({
            id: 'transicion-1',
            estado_actual_id: 'estado-origen',
            siguiente_estado_id: 'estado-derivado',
        });
        await db('cases').insert({
            id: 'caso-reclasificado',
            transicion_id: 'transicion-1',
            estado_id: 'estado-escrito-por-el-dominio',
        });

        await backfillEstadoId(db);

        assert.equal(await estadoIdOf(db, 'caso-reclasificado'), 'estado-escrito-por-el-dominio');
    } finally {
        await db.destroy();
    }
});

// `cases` es una tabla grande: el relleno va por lotes para no escribirla entera en una sola
// sentencia. Con un lote de 1 fila, estos dos tests recorren el bucle de verdad.
test('backfill recorre todas las filas aunque el lote sea más pequeño que el total', async () => {
    const db = await createTestDatabase();

    try {
        await db('transiciones').insert({
            id: 'transicion-1',
            estado_actual_id: 'estado-origen',
            siguiente_estado_id: 'estado-destino',
        });
        await db('cases').insert([
            { id: 'caso-1', transicion_id: 'transicion-1' },
            { id: 'caso-2', transicion_id: 'transicion-1' },
            { id: 'caso-3', transicion_id: 'transicion-1' },
        ]);

        const processed = await backfillEstadoId(db, { batchSize: 1 });

        assert.equal(processed, 3);
        for (const id of ['caso-1', 'caso-2', 'caso-3']) {
            assert.equal(await estadoIdOf(db, id), 'estado-destino');
        }
    } finally {
        await db.destroy();
    }
});

/**
 * Un caso cuya transición no tiene siguiente estado sigue con `estado_id` NULL DESPUÉS de que
 * el UPDATE lo toque. Si el bucle seleccionara solo por `estado_id IS NULL`, esa fila volvería
 * en cada lote y el relleno no terminaría nunca. El cursor por `id` es lo que lo impide, y
 * este test se cuelga —no falla— si esa garantía se rompe.
 */
test('backfill termina aunque haya filas que se quedan en NULL', async () => {
    const db = await createTestDatabase();

    try {
        await db('transiciones').insert({
            id: 'transicion-sin-siguiente',
            estado_actual_id: 'estado-origen',
            siguiente_estado_id: null,
        });
        await db('cases').insert([
            { id: 'caso-1', transicion_id: 'transicion-sin-siguiente' },
            { id: 'caso-2', transicion_id: 'transicion-sin-siguiente' },
        ]);

        const processed = await backfillEstadoId(db, { batchSize: 1 });

        assert.equal(processed, 2);
        assert.equal(await estadoIdOf(db, 'caso-1'), null);
        assert.equal(await estadoIdOf(db, 'caso-2'), null);
    } finally {
        await db.destroy();
    }
});

test('backfill es idempotente: una segunda ejecución no cambia nada', async () => {
    const db = await createTestDatabase();

    try {
        await db('transiciones').insert({
            id: 'transicion-1',
            estado_actual_id: 'estado-origen',
            siguiente_estado_id: 'estado-destino',
        });
        await db('cases').insert({ id: 'caso-1', transicion_id: 'transicion-1' });

        await backfillEstadoId(db);
        await backfillEstadoId(db);

        assert.equal(await estadoIdOf(db, 'caso-1'), 'estado-destino');
    } finally {
        await db.destroy();
    }
});
