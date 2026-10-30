import dotenv from 'dotenv';
import Knex from 'knex';
import { combineFingerprints, migrationsFingerprint, payloadFingerprint, templateDatabaseName } from './dbNaming.js';
import { openAdminConnection, testServerCredentials } from './adminConnection.js';
import { assertValidDatabaseName } from './databaseIdentifier.js';
import { registerSrcResolveShim } from './nodeResolveShim.js';
import { createRunId } from './runIdentity.js';
import { dropStaleTestDatabases } from './staleDatabases.js';
import { buildSeedSnapshot, SNAPSHOT_FORMAT } from './seedSnapshot.js';

dotenv.config({ path: '../../.env' });

const MIGRATIONS_DIRECTORY = './node_modules/@kace/database/migrations';
const SEEDS_DIRECTORY = './node_modules/@kace/database/seeds';

/**
 * jest globalSetup. Construye la base de datos plantilla (migraciones + seeds +
 * permisos del rol global + esquema espejo `seed_snapshot`) si no existe ya para
 * el fingerprint actual.
 *
 * El esquema espejo lo consume el reset por test: guarda el manifiesto de tablas
 * y una copia de las filas sembradas, y viaja dentro de la plantilla, asi que
 * cada clon lo hereda sin coste.
 *
 * ## Por que los permisos se conceden AQUI y no en setupFilesAfterEnv
 *
 * `testRolePermissions.js` importa clases de `src/`. Hacer esa importacion
 * desde `setupFilesAfterEnv` arrastraba 788 modulos de `src/` al registro de
 * modulos ESM de CADA archivo de test, y lo hacia ANTES de evaluar el test:
 * cualquier `jest.unstable_mockModule` posterior sobre esos modulos quedaba
 * registrado pero inerte, porque el consumidor ya estaba enlazado contra la
 * dependencia real. Cuatro suites llegaban a S3, Gmail y SQS de verdad.
 *
 * Concederlos sobre la plantilla los deja aplicados una sola vez por corrida y
 * mantiene `src/` completamente fuera del runtime de los archivos de test. El
 * invariante lo vigila `tests/support/setupModuleGraph.test.js`.
 *
 * `globalSetup` se carga con el resolver ESM nativo de Node, que no acepta los
 * imports sin extension de `src/`; `registerSrcResolveShim()` cubre ese hueco
 * (ver `nodeResolveShim.js`) y por eso `testRolePermissions.js` se importa de
 * forma dinamica, despues de registrar el hook.
 *
 * ## Invalidacion de la plantilla
 *
 * El nombre mezcla el fingerprint de las migraciones con el hash del payload de
 * permisos YA MATERIALIZADO. Un cambio en el catalogo de permisos -venga de
 * `ListPermissions` o de cualquiera de sus dependencias- produce un nombre
 * distinto y fuerza reconstruccion. Sin esto, la plantilla cacheada por
 * migraciones sobreviviria a cambios en los permisos y serviria datos obsoletos
 * a toda la suite.
 *
 * La tercera parte es `SNAPSHOT_FORMAT`: el manifiesto del espejo tiene una
 * forma, y el reset la da por supuesta. Una plantilla vieja no se distingue de
 * una nueva por las migraciones ni por los permisos, asi que sin este tercer
 * ingrediente un cambio de formato se serviria contra un espejo construido con
 * el formato anterior.
 *
 * @returns {Promise<void>}
 */
export default async function buildTemplateDatabase() {
    registerSrcResolveShim();

    // La identidad de corrida se publica ANTES de cualquier otra cosa: jest bifurca
    // los workers despues de globalSetup, asi que heredan process.env. Sin esto, dos
    // corridas concurrentes generan los mismos nombres de base y se destruyen.
    process.env.KACE_TEST_RUN_ID = createRunId();

    const { buildGlobalRolePermissions, grantGlobalRolePermissions } = await import('./testRolePermissions.js');
    const permissions = await buildGlobalRolePermissions();

    const fingerprint = combineFingerprints(
        migrationsFingerprint(MIGRATIONS_DIRECTORY),
        payloadFingerprint(permissions),
        SNAPSHOT_FORMAT
    );
    const templateName = templateDatabaseName(fingerprint);
    assertValidDatabaseName(templateName);
    process.env.KACE_TEST_TEMPLATE_DB = templateName;

    // `min: 1` NO es decorativo: el cerrojo consultivo es de sesion y se retiene
    // mientras corren las migraciones y los seeds, que tardan minutos. Con el
    // `min: 0` por defecto, tarn recicla la conexion ociosa a los 30 segundos y
    // postgres suelta el cerrojo en silencio (ver adminConnection.js).
    const admin = openAdminConnection({ min: 1 });

    try {
        // `pg_advisory_lock` serializa la construccion entre corridas concurrentes: la
        // comprobacion de existencia y el CREATE DATABASE tienen que ser atomicos.
        // Sin el, dos corridas que arrancan a la vez y no encuentran la plantilla
        // intentan crearla las dos y una se lleva un error de nombre duplicado.
        await admin.raw('select pg_advisory_lock(hashtext(?))', [templateName]);

        try {
            const existing = await admin.raw('select 1 from pg_database where datname = ?', [templateName]);

            // Deliberadamente un `if` y no un `return` temprano: el barrido por
            // edad de mas abajo tiene que correr TAMBIEN cuando la plantilla ya
            // existe, que es el caso comun. Un `return` aqui lo dejaba sin
            // ejecutar en casi todas las corridas y las bases huerfanas no las
            // habria reclamado nadie.
            if (existing.rows.length === 0) {
                await admin.raw(`CREATE DATABASE ${templateName}`);

                try {
                    const template = Knex({
                        client: 'pg',
                        connection: { ...testServerCredentials(), database: templateName },
                        pool: { min: 0, max: 2 },
                        schema: 'public',
                        migrations: { tableName: 'knex_migrations', directory: MIGRATIONS_DIRECTORY },
                        seeds: { directory: SEEDS_DIRECTORY },
                    });

                    try {
                        await template.migrate.latest();
                        await template.seed.run();
                        // El catalogo de permisos del dominio (ListPermissions) tiene mas entradas
                        // que el seed (agente 35 vs 15, administrador 304 vs 248): esta concesion
                        // es necesaria, no decorativa.
                        await grantGlobalRolePermissions(template, permissions);
                        // El espejo se construye AL FINAL: fotografia el estado que cada clon
                        // debe recuperar en cada `beforeEach`, permisos incluidos.
                        await buildSeedSnapshot(template);
                    } finally {
                        await template.destroy();
                    }
                } catch (error) {
                    // Un fallo aqui deja la plantilla a medio construir (creada pero sin
                    // migrar/sembrar). El siguiente run solo comprueba que el nombre
                    // existe, asi que la reutilizaria como si estuviera completa.
                    // Se elimina para forzar una reconstruccion limpia.
                    await admin.raw(`DROP DATABASE IF EXISTS ${templateName}`).catch(() => {});
                    throw error;
                }
            }
        } finally {
            // El cerrojo se suelta pase lo que pase, incluido el camino de error:
            // si no, la siguiente corrida se quedaria esperando indefinidamente.
            await admin.raw('select pg_advisory_unlock(hashtext(?))', [templateName]);
        }

        // Con identidad de corrida, las bases de una corrida que muere no las reclama
        // nadie. El barrido por edad es esa reclamacion; no toca las de corridas vivas
        // porque son recientes y tienen conexiones abiertas.
        await dropStaleTestDatabases(admin);
    } finally {
        await admin.destroy();
    }
}
