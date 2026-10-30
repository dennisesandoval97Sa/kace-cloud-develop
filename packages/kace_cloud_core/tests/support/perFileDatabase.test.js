import { randomUUID } from 'node:crypto';
import Knex from 'knex';
import { knexConfig } from '../knexfile.js';
import { cloneWithRetry, currentTestDatabase } from './perFileDatabase.js';
import { DATABASE_PREFIX } from './dbNaming.js';
import { openAdminConnection, testServerCredentials } from './adminConnection.js';
import { assertValidDatabaseName } from './databaseIdentifier.js';

describe('base de datos por archivo de test', () => {
    it('esta conectada a la base derivada de este archivo', async () => {
        const result = await knexConfig.raw('select current_database() as db');

        expect(result.rows[0].db).toBe(currentTestDatabase);
    });

    it('tiene el esquema completo migrado', async () => {
        const result = await knexConfig.raw(
            "select count(*)::int as total from information_schema.tables where table_schema = 'public'"
        );

        expect(result.rows[0].total).toBeGreaterThan(200);
    });

    it('tiene los seeds aplicados', async () => {
        const roles = await knexConfig('roles').select('id');

        expect(roles.length).toBeGreaterThan(0);
    });

    it('parte de un estado limpio y deterministico: la tabla literales trae exactamente los seeds', async () => {
        // La migracion 20241121092900_literales.js siembra 54 literales fijos (tipos de
        // documento, protocolos de correo, etc.) cuando la tabla esta vacia. No es cero,
        // pero es deterministico: el objetivo es un estado inicial conocido, no vacio.
        const result = await knexConfig('literales').count({ total: '*' });

        expect(Number(result[0].total)).toBe(54);
    });

    it('una escritura es visible dentro del mismo archivo', async () => {
        await knexConfig('literales').insert({
            id: '11111111-1111-4111-8111-111111111111',
            nombre: 'aislamiento',
        });

        const result = await knexConfig('literales').count({ total: '*' });

        expect(Number(result[0].total)).toBe(55);
    });

    it('una escritura de este archivo no es visible desde otra base clonada de la misma plantilla', async () => {
        const template = process.env.KACE_TEST_TEMPLATE_DB;
        const isolationDatabase = `${DATABASE_PREFIX}isolation_${randomUUID().replaceAll('-', '')}`;
        assertValidDatabaseName(isolationDatabase);
        assertValidDatabaseName(template);

        const admin = openAdminConnection();
        let isolationConnection;

        try {
            await admin.raw(`CREATE DATABASE ${isolationDatabase} TEMPLATE ${template}`);

            isolationConnection = Knex({
                client: 'pg',
                connection: { ...testServerCredentials(), database: isolationDatabase },
                pool: { min: 0, max: 2 },
            });

            // La fila se inserta en ESTE test, no se hereda del anterior: el reset
            // por test (tests/support/testDatabaseReset.js) ya no deja pasar filas
            // de un test a otro dentro del mismo archivo, asi que la prueba tiene
            // que generar su propia evidencia en vez de depender de esa fuga.
            await knexConfig('literales').insert({
                id: '11111111-1111-4111-8111-111111111111',
                nombre: 'aislamiento',
            });

            const inThisFile = await knexConfig('literales').where({ id: '11111111-1111-4111-8111-111111111111' });
            expect(inThisFile).toHaveLength(1);

            // ...pero no en una base clonada de forma independiente desde la misma plantilla:
            // cada clon parte del estado de la plantilla, no del de otros clones.
            const inIsolationDatabase = await isolationConnection('literales').where({
                id: '11111111-1111-4111-8111-111111111111',
            });
            expect(inIsolationDatabase).toHaveLength(0);

            // La plantilla misma tampoco se contamino: sigue en el conteo original de seeds.
            const isolationCount = await isolationConnection('literales').count({ total: '*' });
            expect(Number(isolationCount[0].total)).toBe(54);
        } finally {
            if (isolationConnection) {
                await isolationConnection.destroy();
            }
            await admin.raw(`DROP DATABASE IF EXISTS ${isolationDatabase} WITH (FORCE)`);
            await admin.destroy();
        }
    });
});

/**
 * Admin de mentira: apunta las sentencias y falla en los `CREATE DATABASE` que
 * se le indiquen, con el codigo que se le indique.
 *
 * @param {Array<string|null>} createOutcomes codigo de error por intento; null = exito
 * @returns {{raw: Function, statements: string[]}}
 */
const fakeAdmin = (createOutcomes) => {
    const statements = [];
    let createCall = 0;

    return {
        statements,
        raw: async (sql) => {
            statements.push(sql);

            if (!sql.startsWith('CREATE DATABASE')) {
                return { rows: [] };
            }

            const code = createOutcomes[createCall++];

            if (code) {
                const error = new Error(`fallo simulado ${code}`);
                error.code = code;
                throw error;
            }

            return { rows: [] };
        },
    };
};

describe('cloneWithRetry', () => {
    // El caso feliz: una sola sentencia, sin limpieza de por medio.
    it('clona a la primera cuando no hay colision', async () => {
        const admin = fakeAdmin([null]);

        await cloneWithRetry(admin, 'kace_t_a_b_w1', 'kace_tpl_x', 3);

        expect(admin.statements).toEqual(['CREATE DATABASE kace_t_a_b_w1 TEMPLATE kace_tpl_x']);
    });

    // REGRESION: 23505 es el sintoma que dejo el fallo original -dos ejecuciones
    // del mismo archivo clonando a la vez-, y antes no estaba contemplado, asi
    // que reventaba el archivo entero en el primer intento.
    it.each([['55006'], ['42P04'], ['23505']])('reintenta ante %s y acaba clonando', async (code) => {
        const admin = fakeAdmin([code, null]);

        await cloneWithRetry(admin, 'kace_t_a_b_w1', 'kace_tpl_x', 3);

        expect(admin.statements.filter((sql) => sql.startsWith('CREATE DATABASE'))).toHaveLength(2);
    });

    // Sin borrar lo que hay, un choque por nombre duplicado se repetiria igual
    // en cada reintento hasta agotarlos.
    it('borra la base antes de reintentar', async () => {
        const admin = fakeAdmin(['23505', null]);

        await cloneWithRetry(admin, 'kace_t_a_b_w1', 'kace_tpl_x', 3);

        expect(admin.statements[1]).toBe('DROP DATABASE IF EXISTS kace_t_a_b_w1 WITH (FORCE)');
    });

    it('propaga un error que no sea una colision, sin reintentar', async () => {
        const admin = fakeAdmin(['42501', null]);

        await expect(cloneWithRetry(admin, 'kace_t_a_b_w1', 'kace_tpl_x', 3)).rejects.toThrow('fallo simulado 42501');
        expect(admin.statements).toHaveLength(1);
    });

    it('propaga el error del ultimo intento cuando se agotan', async () => {
        const admin = fakeAdmin(['23505', '23505']);

        await expect(cloneWithRetry(admin, 'kace_t_a_b_w1', 'kace_tpl_x', 2)).rejects.toThrow('fallo simulado 23505');
    });
});
