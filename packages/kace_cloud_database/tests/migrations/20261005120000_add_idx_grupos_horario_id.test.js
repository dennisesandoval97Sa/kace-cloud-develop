import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import { up, down } from '../../migrations/20261005120000_add_idx_grupos_horario_id.js';

const INDEX_NAME = 'idx_grupos_horario_id';

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await db.schema.createTable('grupos', (table) => {
            table.string('id', 36).primary();
            table.string('horario_id', 36);
        });
        await fn(db);
    } finally {
        await db.destroy();
    }
}

async function indexColumns(db) {
    const indexes = await db.raw(`PRAGMA index_list('grupos')`);
    if (!indexes.some((index) => index.name === INDEX_NAME)) {
        return null;
    }
    const columns = await db.raw(`PRAGMA index_info('${INDEX_NAME}')`);
    return columns.map((column) => column.name);
}

test('up indexes grupos.horario_id', async () => {
    await withDatabase(async (db) => {
        await up(db);

        assert.deepEqual(await indexColumns(db), ['horario_id']);
    });
});

test('down removes the index', async () => {
    await withDatabase(async (db) => {
        await up(db);
        await down(db);

        assert.equal(await indexColumns(db), null);
    });
});
