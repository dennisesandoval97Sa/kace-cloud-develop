import Knex from 'knex';
import { testReaderCredentials, testServerCredentials } from './support/adminConnection.js';

/**
 * Nombre de la base de datos aislada de este archivo de test, publicado por
 * tests/support/perFileDatabase.js durante setupFilesAfterEnv.
 *
 * @returns {string}
 */
const currentDatabase = () => {
    const database = globalThis.__KACE_TEST_DB__;

    if (!database) {
        throw new Error(
            'No hay base de datos de test asignada. Falta tests/support/perFileDatabase.js en setupFilesAfterEnv.'
        );
    }

    return database;
};

/**
 * Configuracion de escritura contra la base de datos aislada del archivo actual.
 *
 * @returns {import('knex').Knex.Config}
 */
export const buildWriterConfig = () => ({
    client: 'pg',
    connection: { ...testServerCredentials(), database: currentDatabase() },
    pool: { min: 0, max: 5 },
    schema: 'public',
});

/**
 * Configuracion de lectura: mismo servidor y misma base, alcanzado por otro
 * host, para que KnexRepository abra un segundo pool.
 *
 * @returns {import('knex').Knex.Config}
 */
export const buildReaderConfig = () => ({
    client: 'pg',
    connection: { ...testReaderCredentials(), database: currentDatabase() },
    pool: { min: 0, max: 5 },
    schema: 'public',
});

let instance = null;

/**
 * Instancia de knex compartida por el archivo de test actual. Knex no conecta
 * hasta la primera query, por lo que construirla en tiempo de import es seguro.
 *
 * Tiene dos consumidores ademas del Proxy de mas abajo: el `beforeEach` de
 * `perFileDatabase.js` necesita esta instancia exacta para poder resetear la
 * base -abrir una segunda dejaria una conexion que `closeTestConnection`
 * nunca cierra, porque solo conoce a `instance`-, y el propio
 * `closeTestConnection` la destruye antes del DROP DATABASE del afterAll. Los
 * tres -Proxy, reset y cierre- tienen que compartir la misma instancia.
 *
 * @returns {import('knex').Knex}
 */
export const getConnection = () => {
    if (!instance) {
        instance = Knex(buildWriterConfig());
        instance.config = buildWriterConfig();
    }

    return instance;
};

let destroying = null;

/**
 * Cierra la instancia compartida. La invoca el afterAll de perFileDatabase.js
 * antes de eliminar la base de datos.
 *
 * Memoiza la promesa porque ese afterAll la espera CON LIMITE y, si vence, la
 * abandona, termina los backends desde la conexion de administracion y vuelve a
 * esperarla: `tarn.destroy()` aguarda sin limite a que se liberen los recursos
 * en uso -una consulta en vuelo, una transaccion sin cerrar-, asi que una sola
 * conexion retenida lo cuelga para siempre, y terminar el backend desde el
 * servidor es lo que lo desatasca. Sin memoizar, esa segunda espera lanzaria
 * una destruccion nueva sobre el mismo pool.
 *
 * @returns {Promise<void>}
 */
export const closeTestConnection = async () => {
    if (!instance) {
        return;
    }

    if (!destroying) {
        destroying = instance.destroy().finally(() => {
            instance = null;
            destroying = null;
        });

        // El afterAll puede abandonar esta promesa al vencer su plazo. Sin este
        // catch, un rechazo posterior seria un unhandledRejection que tumba al
        // worker; quien la espere sigue viendo el rechazo por su propia rama.
        destroying.catch(() => {});
    }

    return destroying;
};

/**
 * Instancia de knex para los tests. Se mantiene el nombre `knexConfig` porque es
 * el que importan ~206 archivos, aunque sea una instancia y no una configuracion.
 *
 * @type {import('knex').Knex}
 */
export const knexConfig = new Proxy(function () {}, {
    apply: (_target, _thisArg, args) => getConnection()(...args),
    get: (_target, property) => {
        const value = getConnection()[property];

        return typeof value === 'function' ? value.bind(getConnection()) : value;
    },
    set: (_target, property, value) => {
        getConnection()[property] = value;

        return true;
    },
});
