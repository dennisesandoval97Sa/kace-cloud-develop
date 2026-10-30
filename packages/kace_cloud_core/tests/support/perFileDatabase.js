import { databaseNameForTestPath } from './dbNaming.js';
import { openAdminConnection } from './adminConnection.js';
import { assertValidDatabaseName } from './databaseIdentifier.js';
import { closeTestConnection, getConnection } from '../knexfile.js';
import { resetTestDatabase } from './testDatabaseReset.js';

/**
 * INVARIANTE: este archivo corre en `setupFilesAfterEnv`, o sea ANTES de que se
 * evalue el archivo de test. Todo lo que importe aqui (transitivamente) queda
 * enlazado en el registro de modulos ESM antes de que el test pueda registrar
 * sus mocks, y por tanto vuelve inerte cualquier `jest.unstable_mockModule`
 * sobre esos modulos. NO IMPORTAR NADA DE `src/`, ni directa ni transitivamente.
 * `tests/support/setupModuleGraph.test.js` lo verifica.
 */

const testPath = expect.getState().testPath;

// La publica globalSetup y la heredan los workers, que jest bifurca despues.
// Sin ella el nombre seria el mismo en dos corridas concurrentes.
const runId = process.env.KACE_TEST_RUN_ID;

if (!runId) {
    throw new Error('KACE_TEST_RUN_ID no esta definida. globalSetup no se ejecuto: revisa jest.config.js');
}

// La publica jest en cada worker ('1' cuando corre en banda). Entra en el nombre
// para que dos ejecuciones concurrentes del MISMO archivo -que los IDE provocan
// al repetir la ruta en `--runTestsByPath`- no compartan base de datos.
const workerId = process.env.JEST_WORKER_ID;

/**
 * Nombre de la base de datos de esta ejecucion del archivo de test. Se expone en
 * globalThis para que tests/knexfile.js pueda construir su configuracion sin
 * volver a calcularlo.
 *
 * @type {string}
 */
export const currentTestDatabase = databaseNameForTestPath(testPath, runId, workerId);

assertValidDatabaseName(currentTestDatabase);

globalThis.__KACE_TEST_DB__ = currentTestDatabase;
process.env.DB_TEST_DATABASE = currentTestDatabase;

/**
 * Codigos de postgres que en este punto son una colision esperable y no un
 * error:
 *
 *  - `55006` (objeto en uso): alguien esta conectado a la PLANTILLA, y el
 *    clonado de otra corrida se conecta un instante.
 *  - `42P04` (base duplicada) y `23505` (violacion del indice unico
 *    `pg_database_datname_index`): el nombre ya existe. Con el workerId dentro
 *    del nombre ese choque solo puede venir de una ejecucion ANTERIOR del mismo
 *    archivo en el mismo worker que murio sin limpiar -tipicamente el reintento
 *    que `jest-runner` hace (`maxRetries: 3`) cuando un worker se cae-, y cuyo
 *    backend puede seguir copiando la plantilla un rato despues. `42P04` sale
 *    cuando el nombre ya esta en el catalogo; `23505` solo aflora si los dos
 *    `CREATE DATABASE` se solapan en la ventana entre la comprobacion previa y
 *    la insercion.
 *
 * @type {Set<string>}
 */
const RETRYABLE_CLONE_ERRORS = new Set(['55006', '42P04', '23505']);

/**
 * Clona la plantilla reintentando ante las colisiones de arriba.
 *
 * La espera crece con el intento (200, 400, 600...) para no volver a chocar
 * contra la misma ventana de conexion una y otra vez, y antes de cada reintento
 * se reemite el DROP: si el choque fue por nombre duplicado, sin borrar lo que
 * hay el reintento vuelve a fallar igual. Forzar la desconexion aqui es seguro
 * -y no lo seria con la clave (corrida, archivo) de antes- porque el nombre
 * incluye el workerId, asi que solo puede pertenecer a esta ejecucion o a una
 * ejecucion muerta de este mismo worker.
 *
 * @param {import('knex').Knex} admin conexion de administracion
 * @param {string} database nombre del clon a crear (ya validado)
 * @param {string} template nombre de la plantilla (ya validado)
 * @param {number} [attempts] intentos maximos
 * @returns {Promise<void>}
 */
export const cloneWithRetry = async (admin, database, template, attempts = 5) => {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            await admin.raw(`CREATE DATABASE ${database} TEMPLATE ${template}`);

            return;
        } catch (error) {
            if (!RETRYABLE_CLONE_ERRORS.has(error.code) || attempt === attempts) {
                throw error;
            }

            await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
            // Si el DROP falla, el CREATE del siguiente intento fallara tambien y
            // sera ESE el error que se propague: es el informativo. Tragarselo
            // aqui evita enmascararlo con un fallo de limpieza.
            await admin.raw(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`).catch(() => {});
        }
    }
};

beforeAll(async () => {
    const template = process.env.KACE_TEST_TEMPLATE_DB;

    if (!template) {
        throw new Error('KACE_TEST_TEMPLATE_DB no esta definida. globalSetup no se ejecuto: revisa jest.config.js');
    }

    assertValidDatabaseName(template);

    const admin = openAdminConnection();

    try {
        await admin.raw(`DROP DATABASE IF EXISTS ${currentTestDatabase} WITH (FORCE)`);
        await cloneWithRetry(admin, currentTestDatabase, template);
    } finally {
        await admin.destroy();
    }

    // Los permisos del rol global ya vienen concedidos en la plantilla
    // (globalSetup, templateDatabase.js), asi que el clon los hereda sin que
    // este setup tenga que tocar `src/`.
});

// Deliberadamente beforeEach y no afterEach: si un test falla, la base queda
// exactamente como la dejo ese test, inspeccionable hasta que corra el
// siguiente. Un afterEach limpiaria la evidencia en el mismo instante en que
// mas hace falta. El primer test del archivo ya arranca limpio sin ayuda de
// este hook: la base es un clon fresco de la plantilla recien creado arriba.
beforeEach(async () => {
    await resetTestDatabase(getConnection());
});

const CLOSE_TIMEOUT_MS = 10_000;
// Segunda espera, ya con los backends terminados. Es corta a proposito: si la
// terminacion iba a desatascar el cierre, lo hace en milisegundos; si no -una
// conexion sacada del pool y retenida sin consulta en vuelo no se libera porque
// tarn no llega a enterarse de que el socket murio- esperar el plazo completo
// otra vez solo regala diez segundos por archivo.
const CLOSE_RETRY_TIMEOUT_MS = 2_000;
const ADMIN_LOCK_TIMEOUT_MS = 5_000;
const ADMIN_ACQUIRE_TIMEOUT_MS = 20_000;
const ADMIN_DESTROY_TIMEOUT_MS = 5_000;
// Plazo por intento de DROP. No es un `statement_timeout`: al vencer se
// abandona la espera, pero el servidor sigue borrando. Ver `dropCurrentTestDatabase`.
const DROP_TIMEOUT_MS = 30_000;
const DROP_ATTEMPTS = 2;

/**
 * Espera a `promise` como mucho `ms`. Devuelve `true` si termino a tiempo -haya
 * resuelto o rechazado, que el llamador ya decide que hacer con eso- y `false`
 * si vencio el plazo.
 *
 * El `clearTimeout` no es cosmetico: un temporizador vivo mantiene ocupado el
 * bucle de eventos y jest lo denuncia como handle abierto al terminar el
 * archivo.
 *
 * @param {Promise<unknown>} promise
 * @param {number} ms
 * @returns {Promise<boolean>}
 */
export const settleWithin = (promise, ms) => {
    let timer;

    return Promise.race([
        promise.then(
            () => true,
            () => true
        ),
        new Promise((resolve) => {
            timer = setTimeout(() => resolve(false), ms);
        }),
    ]).finally(() => clearTimeout(timer));
};

/**
 * Termina las sesiones abiertas contra `database`.
 *
 * Sirve para dos cosas. La primera es desatascar un `knex.destroy()` colgado
 * por una consulta en vuelo: al cerrar el servidor el socket, node-postgres la
 * rechaza, tarn da por liberado el recurso y la destruccion del pool -que si no
 * espera indefinidamente- puede terminar. La segunda es despejar el DROP.
 *
 * Lo que NO arregla es una conexion sacada del pool y retenida sin consulta
 * pendiente: ahi no hay nada que rechazar, tarn no se entera de que el socket
 * murio y sigue contandola como en uso. Por eso el cierre se abandona tras un
 * plazo corto en vez de insistir: el `DROP DATABASE ... WITH (FORCE)` de abajo
 * se basta.
 *
 * @param {import('knex').Knex} admin conexion de administracion
 * @param {string} database
 * @returns {Promise<void>}
 */
export const terminateBackends = async (admin, database) => {
    await admin.raw(
        `select pg_terminate_backend(pid) from pg_stat_activity
         where datname = ? and pid <> pg_backend_pid()`,
        [database]
    );
};

/**
 * Cierra el pool del archivo y elimina su base de datos.
 *
 * NO LANZA NUNCA. Un fallo aqui es un fallo de limpieza, no del archivo de
 * test: `tests/grupos/GroupsIntegration.test.js` se puso roja en la baseline
 * del 13-08-2026 con sus 41 tests en verde, solo porque este teardown agoto los
 * 120 segundos de `testTimeout`. Y no deja basura: `globalTeardown.js` elimina
 * todas las `kace_t_<runId>_*` al final de la corrida y `staleDatabases.js`
 * barre por antiguedad lo que ni eso alcance.
 *
 * De las dos esperas, la que agota el reloj en la practica es el DROP, no el
 * cierre del pool: medido con seis workers, ocho de cada 33 archivos tardan mas
 * de treinta segundos en borrar su base de 19 MB porque compiten por el disco.
 * Con diez workers y la instrumentacion de cobertura encima -la configuracion
 * con la que se produjo aquella baseline- pasar de 120 segundos deja de ser
 * raro. El cierre colgado existe y esta cubierto, pero es el caso menos comun.
 *
 * El presupuesto -10 s de cierre + terminate + 2 s de segundo cierre + dos DROP
 * de 30 s con su espera- suma unos 73 segundos en el peor caso, por debajo del
 * `testTimeout`. Esa holgura es deliberada: se quiere que venza ANTES el plazo
 * propio, que sabe decir que fallo, y no el de jest, cuyo stack apunta a la
 * linea del hook sin distinguir cual de las esperas se colgo.
 *
 * El plazo del DROP se aplica ABANDONANDO la espera, no cancelando la
 * sentencia. La diferencia importa y costo una corrida entenderla: con un
 * `statement_timeout` de 15 segundos en la sesion, cinco archivos de 33
 * terminaron con "canceling statement due to statement timeout", o sea que el
 * plazo mataba el unico trabajo que queria que ocurriese. Abandonando, el
 * servidor sigue borrando la base y lo normal es que termine solo; y si no,
 * globalTeardown la reclama. Por eso tampoco se reintenta tras un vencimiento:
 * un segundo DROP mientras el primero corre solo consigue un `55006`.
 *
 * Los parametros existen para poder probar la funcion sin base de datos; en
 * produccion se llama sin argumentos.
 *
 * @param {{close?: () => Promise<void>, openAdmin?: typeof openAdminConnection,
 *          database?: string, warn?: (message: string) => void,
 *          closeTimeoutMs?: number, dropTimeoutMs?: number}} [overrides]
 * @returns {Promise<void>}
 */
export const dropCurrentTestDatabase = async ({
    close = closeTestConnection,
    openAdmin = openAdminConnection,
    database = currentTestDatabase,
    warn = console.warn,
    closeTimeoutMs = CLOSE_TIMEOUT_MS,
    dropTimeoutMs = DROP_TIMEOUT_MS,
} = {}) => {
    // La administracion se abre ANTES de cerrar el pool, no despues: si el
    // cierre se cuelga, es esta conexion la que tiene que ir a desatascarlo.
    const admin = openAdmin(
        {},
        {
            lockTimeoutMs: ADMIN_LOCK_TIMEOUT_MS,
            acquireTimeoutMs: ADMIN_ACQUIRE_TIMEOUT_MS,
        }
    );

    try {
        if ((await settleWithin(close(), closeTimeoutMs)) === false) {
            warn(
                `[perFileDatabase] ${database}: el cierre del pool no termino en ${closeTimeoutMs} ms; ` +
                    'se terminan sus backends desde el servidor.'
            );
            await terminateBackends(admin, database);
            await settleWithin(close(), CLOSE_RETRY_TIMEOUT_MS);
        }

        for (let attempt = 1; attempt <= DROP_ATTEMPTS; attempt++) {
            let failure = null;
            const drop = admin.raw(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`).catch((error) => {
                failure = error;
            });

            // Sin aviso a proposito: medido, con seis workers unos ocho DROP de
            // cada 33 pasan de treinta segundos y TODOS terminan solos -la
            // corrida acabo con cero bases sin reclamar-. Avisar aqui serian
            // ocho lineas por lote que no piden ninguna accion, y que de tanto
            // repetirse acabarian tapando al aviso de globalTeardown, que es el
            // que si delata una fuga real.
            if ((await settleWithin(drop, dropTimeoutMs)) === false) {
                return;
            }

            if (failure === null) {
                return;
            }

            if (attempt === DROP_ATTEMPTS) {
                throw failure;
            }

            // Bajo carga el DROP compite con backends que aun se estan muriendo
            // (`55006`) y con el lock_timeout de la sesion (`55P03`). Los dos
            // ceden con reintentar tras insistir en la terminacion.
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
            await terminateBackends(admin, database).catch(() => {});
        }
    } catch (error) {
        warn(
            `[perFileDatabase] no se pudo eliminar ${database}: ${error.message}. ` +
                'globalTeardown la reclamara al final de la corrida.'
        );
    } finally {
        await settleWithin(admin.destroy(), ADMIN_DESTROY_TIMEOUT_MS);
    }
};

afterAll(async () => {
    await dropCurrentTestDatabase();
});
