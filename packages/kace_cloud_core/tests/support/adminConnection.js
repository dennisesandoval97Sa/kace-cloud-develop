import Knex from 'knex';

/**
 * Credenciales del servidor postgres de test, leidas del entorno.
 *
 * @returns {{host: string, port: string, user: string, password: string}}
 */
export const testServerCredentials = () => ({
    host: process.env.DB_TEST_HOST,
    port: process.env.DB_TEST_PORT,
    user: process.env.DB_TEST_USER,
    password: process.env.DB_TEST_PASSWORD,
});

/**
 * Credenciales de la ruta alternativa al mismo servidor, usada por los tests de
 * enrutamiento lector/escritor.
 *
 * @returns {{host: string, port: string, user: string, password: string}}
 */
export const testReaderCredentials = () => ({
    host: process.env.DB_TEST_ROUTING_HOST ?? process.env.DB_TEST_HOST,
    port: process.env.DB_TEST_ROUTING_PORT ?? process.env.DB_TEST_PORT,
    user: process.env.DB_TEST_USER,
    password: process.env.DB_TEST_PASSWORD,
});

/**
 * Abre una conexion a la base "postgres" para operaciones CREATE/DROP DATABASE.
 * El llamador es responsable de destruirla.
 *
 * `pool` permite sobrescribir la configuracion por defecto. Hace falta para los
 * cerrojos consultivos (`pg_advisory_lock`), que son de SESION: con el `min: 0`
 * por defecto, tarn destruye la conexion ociosa a los 30 segundos, la sesion
 * termina y postgres SUELTA EL CERROJO sin avisar. Medido: a los 45 segundos
 * otra sesion podia tomarlo y el `pg_advisory_unlock` devolvia `false`. Quien
 * necesite retener un cerrojo mientras hace otro trabajo debe pedir `min: 1`
 * para que la conexion no se recicle.
 *
 * `limits` acota la sesion. Los dos son OPCIONALES y por defecto no se aplica
 * ninguno: solo el teardown por archivo, que si tiene un presupuesto que
 * respetar, los pide.
 *
 * NO hay `statement_timeout` a proposito, y la ausencia es deliberada: se probo
 * con 15 segundos y el que moria era el propio `DROP DATABASE ... WITH (FORCE)`
 * -"canceling statement due to statement timeout" en cinco archivos de una
 * corrida de 33 con seis workers-, porque bajo carga borrar una base de 19 MB
 * pasa de ese plazo sin que nada vaya mal. Matarlo no arregla nada: solo
 * convierte una limpieza lenta en una limpieza fallida. Quien acota el teardown
 * es su propio presupuesto de tiempo, que abandona la espera sin cancelar el
 * trabajo del servidor.
 *
 * `lock_timeout` si tiene sentido: acota la espera por un cerrojo ajeno, que es
 * el unico bloqueo que no depende de cuanto trabajo real quede por hacer. Va en
 * `afterCreate` y no en un `raw` suelto para que valga tambien en cualquier
 * conexion que el pool reponga tras un reciclado. No abre transaccion, asi que
 * no estorba al DROP DATABASE, que tampoco puede correr dentro de una.
 *
 * @param {import('knex').Knex.PoolConfig} [pool] sobrescrituras del pool
 * @param {{lockTimeoutMs?: number, acquireTimeoutMs?: number}} [limits]
 * @returns {import('knex').Knex}
 */
export const openAdminConnection = (pool = {}, limits = {}) => {
    const { lockTimeoutMs, acquireTimeoutMs } = limits;

    const afterCreate = lockTimeoutMs
        ? (connection, done) =>
              connection.query(`set lock_timeout = ${Number(lockTimeoutMs)}`, (error) => done(error, connection))
        : undefined;

    return Knex({
        client: 'pg',
        connection: { ...testServerCredentials(), database: 'postgres' },
        ...(acquireTimeoutMs ? { acquireConnectionTimeout: acquireTimeoutMs } : {}),
        pool: { min: 0, max: 1, ...(afterCreate ? { afterCreate } : {}), ...pool },
    });
};
