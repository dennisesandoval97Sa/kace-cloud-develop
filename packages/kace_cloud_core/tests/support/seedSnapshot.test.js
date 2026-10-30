import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import Knex from 'knex';
import { buildSeedSnapshot, readTableManifest } from './seedSnapshot.js';
import { buildWriterConfig } from '../knexfile.js';

const SCHEMA = 'seed_snapshot_probe';

let connection;

beforeAll(() => {
    connection = Knex(buildWriterConfig());
});

afterAll(async () => {
    // No se limpia el esquema espejo con una query aqui: el afterAll de
    // perFileDatabase.js (registrado antes, desde setupFilesAfterEnv) ya hizo
    // DROP DATABASE ... WITH FORCE sobre esta misma base para cuando este hook
    // corre -jest-circus ejecuta los afterAll en orden de registro, no al
    // reves-, asi que cualquier query aqui pega contra una base que ya no
    // existe. destroy() no manda query, por eso es seguro.
    await connection.destroy();
});

describe('buildSeedSnapshot', () => {
    test('clasifica las tablas en protected, seeded y plain', async () => {
        await buildSeedSnapshot(connection, SCHEMA);
        const manifest = await readTableManifest(connection, SCHEMA);

        expect(manifest.protectedTables).toEqual(expect.arrayContaining(['knex_migrations', 'knex_migrations_lock']));
        expect(manifest.seeded).toEqual(expect.arrayContaining(['usuarios', 'literales', 'grupos', 'estados']));
        expect(manifest.seeded).not.toContain('knex_migrations');
        expect(manifest.all.has('banners')).toBe(true);
        expect(manifest.seeded).not.toContain('banners');
        expect(manifest.protectedTables).not.toContain('banners');
    });

    test('copia las filas sembradas al esquema espejo', async () => {
        await buildSeedSnapshot(connection, SCHEMA);

        const [{ count }] = (await connection.raw(`select count(*)::int as count from "${SCHEMA}"."usuarios"`)).rows;
        const [{ count: origen }] = (await connection.raw('select count(*)::int as count from "public"."usuarios"'))
            .rows;

        expect(count).toBe(origen);
        expect(count).toBeGreaterThan(0);
    });

    test('no copia las tablas vacias', async () => {
        await buildSeedSnapshot(connection, SCHEMA);

        const { rows } = await connection.raw(
            `select tablename from pg_tables where schemaname = ? and tablename = 'banners'`,
            [SCHEMA]
        );

        expect(rows).toHaveLength(0);
    });

    test('es idempotente: reconstruirlo no duplica filas', async () => {
        await buildSeedSnapshot(connection, SCHEMA);
        await buildSeedSnapshot(connection, SCHEMA);

        const [{ count }] = (await connection.raw(`select count(*)::int as count from "${SCHEMA}"."usuarios"`)).rows;
        const [{ count: origen }] = (await connection.raw('select count(*)::int as count from "public"."usuarios"'))
            .rows;

        expect(count).toBe(origen);
    });

    test('registra las vistas, vistas materializadas y secuencias de la plantilla', async () => {
        // El manifiesto se construia leyendo solo `pg_tables`, asi que no
        // conocia ninguna de estas relaciones. El reset decide con el que
        // sobra y que no: si estas dejan de estar aqui, las tomara por objetos
        // creados por el test y las borrara.
        await buildSeedSnapshot(connection, SCHEMA);
        const manifest = await readTableManifest(connection, SCHEMA);

        expect([...manifest.views.keys()]).toEqual(expect.arrayContaining(['view_case_details', 'view_casos']));
        expect([...manifest.matviews]).toEqual(
            expect.arrayContaining([
                'mv_dashboard_ans_counts',
                'mv_dashboard_state_counts',
                'mv_dashboard_group_counts',
                'mv_dashboard_responsible_counts',
            ])
        );
        expect([...manifest.sequences]).toContain('casos_reference_seq');

        // Ninguna de ellas puede colarse entre las tablas: `all` es el conjunto
        // contra el que el reset decide que TABLA sobra, y una vista ahi dentro
        // haria que un DROP TABLE fuera a por ella.
        expect(manifest.all.has('view_case_details')).toBe(false);
        expect(manifest.all.has('mv_dashboard_ans_counts')).toBe(false);
        expect(manifest.all.has('casos_reference_seq')).toBe(false);
    });

    test('guarda la definicion de cada vista para poder reponerla', async () => {
        await buildSeedSnapshot(connection, SCHEMA);
        const manifest = await readTableManifest(connection, SCHEMA);

        // Sin definicion el reset no puede recrear la vista que un test borro,
        // y la ausencia seria silenciosa: `CREATE VIEW x AS undefined`.
        expect(manifest.views.get('view_case_details')).toMatch(/SELECT/i);
        expect(manifest.matviews.size).toBeGreaterThan(0);
    });

    test('cubre la tabla con guion sin romper el SQL', async () => {
        await buildSeedSnapshot(connection, SCHEMA);
        const manifest = await readTableManifest(connection, SCHEMA);

        expect(manifest.all.has('one-script')).toBe(true);
    });
});
