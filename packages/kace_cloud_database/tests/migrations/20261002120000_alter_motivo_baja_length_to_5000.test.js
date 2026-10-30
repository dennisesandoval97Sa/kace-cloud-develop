import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';
import { postgresConnection } from '../../utils/postgresTestConnection.js';

import { down, up } from '../../migrations/20261002120000_alter_motivo_baja_length_to_5000.js';

const LONG_MOTIVO = 'a'.repeat(256);

async function withPostgresSchema(run) {
    const schema = `tmp_motivo_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const admin = knexLib({ client: 'pg', connection: postgresConnection() });
    await admin.raw('create schema ??', [schema]);
    const db = knexLib({ client: 'pg', connection: postgresConnection(), searchPath: [schema] });

    try {
        await run(db, schema);
    } finally {
        await db.destroy();
        await admin.raw('drop schema ?? cascade', [schema]);
        await admin.destroy();
    }
}

async function createCaseTables(db) {
    await db.schema.createTable('clients', (table) => {
        table.string('id', 36).primary();
        table.string('nombres');
        table.string('apellido1');
        table.string('apellido2');
        table.string('documento');
        table.string('tipo_cliente');
        table.string('nombre_empresa');
    });
    await db.schema.createTable('grupos', (table) => {
        table.string('id', 36).primary();
        table.string('nombre');
    });
    await db.schema.createTable('usuarios', (table) => {
        table.string('id', 36).primary();
        table.string('nombres');
        table.string('apellido1');
        table.string('apellido2');
        table.string('login');
        table.boolean('is_active');
        table.string('external_id');
        table.string('rol_id');
    });
    await db.schema.createTable('transiciones', (table) => {
        table.string('id', 36).primary();
        table.string('siguiente_estado_id');
    });
    await db.schema.createTable('clasificaciones', (table) => {
        table.string('id', 36).primary();
        table.string('ans_id');
        for (let nivel = 1; nivel <= 10; nivel += 1) {
            table.string(`nivel${nivel}`);
        }
    });
    await db.schema.createTable('ans', (table) => {
        table.string('id', 36).primary();
        table.string('color_ans_inicial');
        table.string('color_ans_intermedio');
        table.string('color_ans_final');
    });
    await db.schema.createTable('descripciones_casos', (table) => {
        table.string('id', 36).primary();
    });
    await db.schema.createTable('estados', (table) => {
        table.string('id', 36).primary();
        table.string('nombre');
    });
    await db.schema.createTable('aux_cases', (table) => {
        table.string('id', 36).primary();
        table.string('caso_id');
        table.jsonb('data');
    });
    await db.schema.createTable('cases', (table) => {
        table.string('id', 36).primary();
        table.integer('ans_posicion');
        table.integer('antiguedad');
        table.integer('antiguedad_dias');
        table.integer('antiguedad_horas');
        table.integer('antiguedad_minutos');
        table.string('cambio_estado_comentario_id');
        table.string('caso_clonado_id');
        table.timestamp('created_at');
        table.timestamp('deleted_at');
        table.timestamp('edited_at');
        table.string('edited_by');
        table.timestamp('fecha_resolucion');
        table.string('motivo_baja', 255);
        table.string('parent_id');
        table.string('reference');
        table.string('responsable_id');
        table.string('grupo_id');
        table.timestamp('sla_due_date');
        table.timestamp('updated_at');
        table.string('transicion_id');
        table.string('estado_id');
        table.string('cliente_id');
        table.string('clasificacion_id');
        table.string('descripcion_caso_id');
        table.string('created_by');
    });
    await db.schema.createTable('fake_cases', (table) => {
        table.string('id', 36).primary();
        table.string('motivo_baja', 255);
    });
}

async function characterMaximumLength(db, schema, tableName) {
    const row = await db('information_schema.columns')
        .where({
            table_schema: schema,
            table_name: tableName,
            column_name: 'motivo_baja',
        })
        .first('character_maximum_length');
    return row?.character_maximum_length ?? null;
}

async function assertMotivoBajaLength(db, schema, expected) {
    for (const tableName of ['cases', 'fake_cases', 'view_casos', 'view_case_details']) {
        assert.equal(await characterMaximumLength(db, schema, tableName), expected, `${tableName}.motivo_baja`);
    }
}

test('up widens motivo_baja to 5000 on cases, fake_cases, view_casos and view_case_details', async () => {
    await withPostgresSchema(async (db, schema) => {
        await createCaseTables(db);
        await db.raw('CREATE VIEW view_casos AS SELECT motivo_baja FROM cases');
        await db.raw('CREATE VIEW view_case_details AS SELECT motivo_baja FROM cases');

        await up(db);

        await assertMotivoBajaLength(db, schema, 5000);
    });
});

test('down restores varchar(255) when every motivo_baja fits', async () => {
    await withPostgresSchema(async (db, schema) => {
        await createCaseTables(db);
        await up(db);
        await db('fake_cases').insert({ id: '11111111-1111-4111-8111-111111111111', motivo_baja: 'abc' });

        await down(db);

        await assertMotivoBajaLength(db, schema, 255);
    });
});

test('down throws and does not truncate when a motivo_baja exceeds 255 characters', async () => {
    await withPostgresSchema(async (db, schema) => {
        await createCaseTables(db);
        await up(db);
        await db('fake_cases').insert({
            id: '22222222-2222-4222-8222-222222222222',
            motivo_baja: LONG_MOTIVO,
        });

        await assert.rejects(
            () => down(db),
            /fake_cases: 1 motivo_baja rows exceed 255 chars; rollback would truncate them/
        );

        assert.equal(await characterMaximumLength(db, schema, 'fake_cases'), 5000);
        const row = await db('fake_cases').where({ id: '22222222-2222-4222-8222-222222222222' }).first();
        assert.equal(row.motivo_baja.length, 256);
    });
});

test('up names a tenant view that selects cases.motivo_baja', async () => {
    await withPostgresSchema(async (db, schema) => {
        await createCaseTables(db);
        await db.raw('CREATE VIEW boards_rev AS SELECT motivo_baja FROM cases');

        await assert.rejects(
            () => up(db),
            /Cannot alter motivo_baja: dependent views must be handled first: .*\.boards_rev/
        );

        assert.equal(await characterMaximumLength(db, schema, 'cases'), 255);
        const views = await db('information_schema.views')
            .where({ table_schema: schema, table_name: 'boards_rev' })
            .first('table_name');
        assert.equal(views?.table_name, 'boards_rev');
    });
});

test('up names a tenant view that depends on view_case_details', async () => {
    await withPostgresSchema(async (db, schema) => {
        await createCaseTables(db);
        await db.raw('CREATE VIEW view_case_details AS SELECT motivo_baja FROM cases');
        await db.raw('CREATE VIEW reports_rev AS SELECT motivo_baja FROM view_case_details');

        await assert.rejects(
            () => up(db),
            /Cannot alter motivo_baja: dependent views must be handled first: .*\.reports_rev/
        );

        assert.equal(await characterMaximumLength(db, schema, 'cases'), 255);
        const views = await db('information_schema.views')
            .where({ table_schema: schema })
            .whereIn('table_name', ['view_case_details', 'reports_rev'])
            .pluck('table_name');
        assert.deepEqual([...views].sort(), ['reports_rev', 'view_case_details']);
    });
});

test('up sets lock_timeout to 5s for the migration transaction', async () => {
    await withPostgresSchema(async (db) => {
        await createCaseTables(db);
        await db.transaction(async (trx) => {
            await up(trx);
            const { rows } = await trx.raw('SHOW lock_timeout');
            assert.equal(rows[0].lock_timeout, '5s');
        });
    });
});
