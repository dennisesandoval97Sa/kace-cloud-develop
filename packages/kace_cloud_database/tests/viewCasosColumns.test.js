import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import knex from 'knex';
import { viewCasesDetailsV8 } from '../views/view_cases_details_v8.js';
import { viewCasesDetailsV9 } from '../views/view_cases_details_v9.js';
import { viewCasosV6 } from '../views/view_casosV6.js';

const TEST_DB_FILE = './test-view-columns.sqlite';

const config = {
    client: 'sqlite3',
    connection: { filename: TEST_DB_FILE },
    useNullAsDefault: true,
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations',
    },
};

const columnNames = async (db, viewName) => {
    const rows = await db.raw(`PRAGMA table_info(${viewName})`);
    return rows.map((row) => row.name);
};

describe('view_casos / view_case_details columns after migrate:latest', () => {
    let db;

    before(async () => {
        if (existsSync(TEST_DB_FILE)) unlinkSync(TEST_DB_FILE);
        db = knex(config);
        await db.migrate.latest();
    });

    after(async () => {
        await db.destroy();
        if (existsSync(TEST_DB_FILE)) unlinkSync(TEST_DB_FILE);
    });

    it('view_casos includes transicion_id, edited_at, edited_by, parent_id, deleted_at', async () => {
        const columns = await columnNames(db, 'view_casos');
        assert.ok(columns.includes('transicion_id'), `view_casos columns: ${columns.join(', ')}`);
        assert.ok(columns.includes('edited_at'), `view_casos columns: ${columns.join(', ')}`);
        assert.ok(columns.includes('edited_by'), `view_casos columns: ${columns.join(', ')}`);
        assert.ok(columns.includes('parent_id'), `view_casos columns: ${columns.join(', ')}`);
        assert.ok(columns.includes('deleted_at'), `view_casos columns: ${columns.join(', ')}`);
    });

    it('view_case_details includes transicion_id, edited_at, edited_by, parent_id, deleted_at', async () => {
        const columns = await columnNames(db, 'view_case_details');
        assert.ok(columns.includes('transicion_id'), `view_case_details columns: ${columns.join(', ')}`);
        assert.ok(columns.includes('edited_at'), `view_case_details columns: ${columns.join(', ')}`);
        assert.ok(columns.includes('edited_by'), `view_case_details columns: ${columns.join(', ')}`);
        assert.ok(columns.includes('parent_id'), `view_case_details columns: ${columns.join(', ')}`);
        assert.ok(columns.includes('deleted_at'), `view_case_details columns: ${columns.join(', ')}`);
    });

    it('fake_cases includes edited_at and edited_by', async () => {
        const columns = await columnNames(db, 'fake_cases');
        assert.ok(columns.includes('edited_at'), `fake_cases columns: ${columns.join(', ')}`);
        assert.ok(columns.includes('edited_by'), `fake_cases columns: ${columns.join(', ')}`);
    });
});

describe('viewCasesDetailsV8 tenant variants SQL generation', () => {
    it('generates SQL containing edited_at, edited_by, and base columns for default tenant', () => {
        const sql = viewCasesDetailsV8('cases', 'clients', 'aux_cases');
        assert.ok(sql.includes('cases.edited_at'), 'should include cases.edited_at');
        assert.ok(sql.includes('cases.edited_by'), 'should include cases.edited_by');
        assert.ok(sql.includes('cases.transicion_id'), 'should include cases.transicion_id');
        assert.ok(sql.includes('cases.parent_id'), 'should include cases.parent_id');
        assert.ok(sql.includes('cases.deleted_at'), 'should include cases.deleted_at');
    });

    it('generates SQL containing edited_at, edited_by, and UT JSONB columns for ut tenant', () => {
        const sql = viewCasesDetailsV8('cases', 'clients', 'aux_cases', 'ut');
        assert.ok(sql.includes('cases.edited_at'), 'should include cases.edited_at');
        assert.ok(sql.includes('cases.edited_by'), 'should include cases.edited_by');
        assert.ok(sql.includes('cases.transicion_id'), 'should include cases.transicion_id');
        assert.ok(sql.includes('respuesta'), 'should include UT respuesta JSONB field');
        assert.ok(sql.includes('causal'), 'should include UT causal JSONB field');
    });

    it('generates SQL containing edited_at, edited_by, and SURAASISTENCIA columns and joins', () => {
        const sql = viewCasesDetailsV8('cases', 'clients', 'aux_cases', 'SURAASISTENCIA');
        assert.ok(sql.includes('cases.edited_at'), 'should include cases.edited_at');
        assert.ok(sql.includes('cases.edited_by'), 'should include cases.edited_by');
        assert.ok(sql.includes('cases.transicion_id'), 'should include cases.transicion_id');
        assert.ok(sql.includes('placa'), 'should include SURAASISTENCIA placa JSONB field');
        assert.ok(sql.includes('fecha_cita'), 'should include SURAASISTENCIA fecha_cita JSONB field');
        assert.ok(sql.includes('roles.descripcion AS rol_responsable'), 'should include rol_responsable');
        assert.ok(sql.includes('LEFT JOIN roles ON roles.id = responsable.rol_id'), 'should include roles JOIN');
    });
});

describe('viewCasesDetailsV9 keeps the V8 columns and resolves estado_id', () => {
    for (const tenant of [undefined, 'ut', 'SURAASISTENCIA']) {
        it(`preserves edited_at/edited_by and resolves estado_id for ${tenant ?? 'default'} tenant`, () => {
            const sql = viewCasesDetailsV9('cases', 'clients', 'aux_cases', tenant);
            assert.ok(sql.includes('cases.edited_at'), 'should include cases.edited_at');
            assert.ok(sql.includes('cases.edited_by'), 'should include cases.edited_by');
            assert.ok(
                sql.includes('COALESCE(transiciones.siguiente_estado_id, cases.estado_id) as estado_id'),
                'should resolve estado_id against the persisted column'
            );
        });
    }
});

describe('viewCasosV6 keeps the V5 columns and resolves estado_id', () => {
    it('preserves edited_at/edited_by/parent_id/deleted_at and resolves estado_id', () => {
        const sql = viewCasosV6('cases', 'clients');
        assert.ok(sql.includes('cases.edited_at'), 'should include cases.edited_at');
        assert.ok(sql.includes('cases.edited_by'), 'should include cases.edited_by');
        assert.ok(sql.includes('cases.parent_id'), 'should include cases.parent_id');
        assert.ok(sql.includes('cases.deleted_at'), 'should include cases.deleted_at');
        assert.ok(
            sql.includes('COALESCE(transiciones.siguiente_estado_id, cases.estado_id) AS estado_id'),
            'should resolve estado_id against the persisted column'
        );
    });
});

describe('view_casos / view_case_details resolve estado_id without going stale', () => {
    let db;
    const ESTADO_PERSISTIDO = 'estado-persistido';
    const ESTADO_DE_LA_TRANSICION = 'estado-de-la-transicion';
    const CASE_ID = 'caso-estado-id';

    before(async () => {
        if (existsSync(TEST_DB_FILE)) unlinkSync(TEST_DB_FILE);
        db = knex(config);
        await db.migrate.latest();

        await db('estados').insert([
            { id: ESTADO_PERSISTIDO, nombre: 'Persistido' },
            { id: ESTADO_DE_LA_TRANSICION, nombre: 'De la transición' },
        ]);
        await db('clients').insert({ id: 'cliente-1' });
        await db('grupos').insert({ id: 'grupo-1', nombre: 'Grupo' });
        await db('usuarios').insert({ id: 'usuario-1', nombres: 'Nombre', apellido1: 'Apellido' });
        await db('transiciones').insert([
            {
                id: 'transicion-1',
                estado_actual_id: ESTADO_PERSISTIDO,
                siguiente_estado_id: ESTADO_DE_LA_TRANSICION,
            },
            {
                id: 'transicion-sin-siguiente',
                estado_actual_id: ESTADO_PERSISTIDO,
                siguiente_estado_id: null,
            },
        ]);
        await db('clasificaciones').insert({ id: 'clasificacion-1' });
        await db('cases').insert({
            id: CASE_ID,
            cliente_id: 'cliente-1',
            grupo_id: 'grupo-1',
            responsable_id: 'usuario-1',
            transicion_id: 'transicion-1',
            clasificacion_id: 'clasificacion-1',
            estado_id: ESTADO_PERSISTIDO,
        });
    });

    after(async () => {
        await db.destroy();
        if (existsSync(TEST_DB_FILE)) unlinkSync(TEST_DB_FILE);
    });

    const estadoFromView = async (viewName) => db(viewName).where({ id: CASE_ID }).first('estado_id', 'estado_actual');

    for (const viewName of ['view_casos', 'view_case_details']) {
        it(`${viewName} does not return a stale estado_id when only transicion_id was updated`, async () => {
            await db('cases')
                .where({ id: CASE_ID })
                .update({ transicion_id: 'transicion-1', estado_id: ESTADO_PERSISTIDO });

            const row = await estadoFromView(viewName);

            assert.equal(row.estado_id, ESTADO_DE_LA_TRANSICION);
            assert.equal(row.estado_actual, 'De la transición');
        });

        it(`${viewName} falls back to cases.estado_id when the transition has no next state`, async () => {
            await db('cases')
                .where({ id: CASE_ID })
                .update({ transicion_id: 'transicion-sin-siguiente', estado_id: ESTADO_PERSISTIDO });

            const row = await estadoFromView(viewName);

            assert.equal(row.estado_id, ESTADO_PERSISTIDO);
            assert.equal(row.estado_actual, 'Persistido');
        });
    }
});
