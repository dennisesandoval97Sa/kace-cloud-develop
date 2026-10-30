import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';
import { postgresConnection } from '../../utils/postgresTestConnection.js';

import { down, up } from '../../migrations/20261023120000_add_folio_lookup_indexes.js';

const INDEXES = {
    idx_clasificaciones_folio_config_id: /ON \S*clasificaciones .*\(folio_config_id\)/,
    idx_history_folio_configurations_entity_id: /ON \S*history_folio_configurations .*\(entity_id\)/,
};

async function withPostgresSchema(run) {
    const schema = `tmp_folio_idx_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const admin = knexLib({ client: 'pg', connection: postgresConnection() });
    await admin.raw('create schema ??', [schema]);
    const db = knexLib({ client: 'pg', connection: postgresConnection(), searchPath: [schema] });

    try {
        await db.schema.createTable('clasificaciones', (table) => {
            table.string('id', 36).primary();
            table.string('folio_config_id', 36).nullable();
        });
        await db.schema.createTable('history_folio_configurations', (table) => {
            table.string('id', 36).primary();
            table.string('entity_id', 36);
        });
        await run(db, schema);
    } finally {
        await db.destroy();
        await admin.raw('drop schema ?? cascade', [schema]);
        await admin.destroy();
    }
}

async function indexDefinitions(db, schema) {
    const { rows } = await db.raw(
        'select indexname, indexdef from pg_indexes where schemaname = ? and indexname in (?, ?)',
        [schema, ...Object.keys(INDEXES)]
    );
    return Object.fromEntries(rows.map((row) => [row.indexname, row.indexdef]));
}

test('up creates both lookup indexes in the tenant schema', async () => {
    await withPostgresSchema(async (db, schema) => {
        await up(db);

        const definitions = await indexDefinitions(db, schema);
        for (const [name, pattern] of Object.entries(INDEXES)) {
            assert.match(definitions[name] ?? '', pattern, name);
        }
    });
});

test('down removes both indexes', async () => {
    await withPostgresSchema(async (db, schema) => {
        await up(db);
        await down(db);

        assert.deepEqual(await indexDefinitions(db, schema), {});
    });
});
