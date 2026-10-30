import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DB_PREFIX = 'kace_t_';
const TEMPLATE_PREFIX = 'kace_tpl_';
const HASH_LENGTH = 12;

// jest publica JEST_WORKER_ID siempre y siempre numerico: '1' en banda
// (jest-runner) y 1-indexado en los workers (jest-worker). Cualquier otra cosa
// significa que el valor no viene de jest y no se puede confiar en el.
const WORKER_ID_PATTERN = /^[0-9]+$/;

/**
 * Recorta la ruta al primer segmento "tests/" para que el nombre de la base de
 * datos no dependa de donde este clonado el repositorio.
 *
 * @param {string} testPath
 * @returns {string}
 */
const toStableKey = (testPath) => {
    const normalized = testPath.replaceAll('\\', '/');
    const index = normalized.lastIndexOf('/tests/');

    return index === -1 ? normalized : normalized.slice(index + 1);
};

/**
 * Nombre de la base de datos aislada de UNA EJECUCION de un archivo de test
 * dentro de una corrida concreta.
 *
 * La forma es `kace_t_<runId>_<hash>_w<workerId>`: 7 + 12 + 1 + 12 + 2 + <=2 =
 * 36 caracteres, muy por debajo del limite de 63 de postgres. El runId va
 * DELANTE del hash para que el teardown y el barrido puedan seleccionar por
 * prefijo literal (`starts_with(datname, 'kace_t_<runId>_')`) todas las bases de
 * una corrida; el workerId va al FINAL, donde no estorba a esa seleccion.
 *
 * ## Por que el workerId forma parte del nombre
 *
 * La clave era (corrida, archivo), lo que da por supuesto que un archivo se
 * ejecuta UNA sola vez por corrida. No es cierto: jest no deduplica las rutas de
 * `--runTestsByPath` (`SearchSource.findTestsByPaths`), que es como los IDE
 * lanzan los tests, y ademas `jest-runner` reintenta en otro worker un archivo
 * cuyo worker haya muerto. Dos ejecuciones del mismo archivo compartian nombre y
 * se destruian mutuamente: una hacia `DROP DATABASE ... WITH (FORCE)` sobre la
 * base que la otra estaba usando, y si los `CREATE DATABASE` se solapaban
 * postgres devolvia una violacion del indice unico `pg_database_datname_index`.
 *
 * Un worker ejecuta un archivo a la vez, asi que dos ejecuciones CONCURRENTES
 * del mismo archivo caen forzosamente en workers distintos y sus nombres
 * divergen por construccion.
 *
 * @param {string} testPath ruta absoluta del archivo de test
 * @param {string} runId identidad de la corrida (ver runIdentity.js)
 * @param {string} workerId identificador del worker de jest (JEST_WORKER_ID)
 * @returns {string} nombre de base de datos valido en postgres (<= 63 chars)
 */
export const databaseNameForTestPath = (testPath, runId, workerId) => {
    if (!testPath) {
        throw new Error('testPath es obligatorio para derivar el nombre de la base de datos');
    }

    // Sin la identidad de corrida el nombre es determinista, y dos procesos de
    // jest generan los mismos nombres y se eliminan las bases mutuamente. Es un
    // fallo silencioso y destructivo, asi que se exige el parametro.
    if (!runId) {
        throw new Error('runId es obligatorio: sin el, dos corridas concurrentes se destruyen entre si');
    }

    // Se exige explicitamente en lugar de leer el entorno aqui: este modulo es
    // puro a proposito (lo importan globalSetup y setupFilesAfterEnv, que no
    // toleran sorpresas), y un valor ausente que se degradara a un default
    // reintroduciria en silencio la colision que este parametro existe para
    // eliminar.
    if (!WORKER_ID_PATTERN.test(String(workerId))) {
        throw new Error(
            'workerId es obligatorio y tiene que ser numerico: sin el, dos ejecuciones del mismo archivo se destruyen entre si'
        );
    }

    const digest = createHash('sha1').update(toStableKey(testPath)).digest('hex').slice(0, HASH_LENGTH);

    return `${DB_PREFIX}${runId}_${digest}_w${workerId}`;
};

/**
 * @param {string} fingerprint
 * @returns {string}
 */
export const templateDatabaseName = (fingerprint) => `${TEMPLATE_PREFIX}${fingerprint}`;

/**
 * Hash del contenido de todos los archivos de un directorio, en orden estable.
 *
 * Asume un directorio PLANO (sin subcarpetas). `readFileSync` sobre una
 * subcarpeta lanza `EISDIR`, asi que si en el futuro las migraciones se
 * reorganizan en subdirectorios (por ejemplo, por año), esta funcion
 * fallara de forma ruidosa y habra que adaptarla para recorrer recursivamente.
 *
 * @param {string} directory ruta a un directorio plano
 * @returns {string} hash hexadecimal de 12 caracteres
 */
export const migrationsFingerprint = (directory) => {
    const hash = createHash('sha1');

    for (const file of readdirSync(directory).sort()) {
        hash.update(file);
        hash.update(readFileSync(join(directory, file)));
    }

    return hash.digest('hex').slice(0, HASH_LENGTH);
};

/**
 * Serializacion determinista: mismas claves en el mismo orden produce siempre
 * el mismo texto, independientemente del orden de insercion en el objeto. El
 * orden de los ARRAYS se preserva (es significativo).
 *
 * @param {unknown} value
 * @returns {string}
 */
export const stableSerialize = (value) => {
    if (Array.isArray(value)) {
        return `[${value.map(stableSerialize).join(',')}]`;
    }

    if (value && typeof value === 'object') {
        const entries = Object.keys(value)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);

        return `{${entries.join(',')}}`;
    }

    return JSON.stringify(value) ?? 'null';
};

/**
 * Hash de un payload ya materializado (no de los archivos que lo producen).
 *
 * Se usa para el catalogo de permisos que se concede sobre la base plantilla:
 * hashear el resultado y no `ListPermissions.js` significa que un cambio en
 * CUALQUIERA de sus dependencias invalida la plantilla por construccion, sin
 * depender de acertar que archivos hay que vigilar.
 *
 * @param {unknown} payload
 * @returns {string} hash hexadecimal de 12 caracteres
 */
export const payloadFingerprint = (payload) =>
    createHash('sha1').update(stableSerialize(payload)).digest('hex').slice(0, HASH_LENGTH);

/**
 * Combina varios fingerprints en uno solo. Cambiar cualquiera de las partes
 * cambia el resultado.
 *
 * @param {...string} parts
 * @returns {string} hash hexadecimal de 12 caracteres
 */
export const combineFingerprints = (...parts) =>
    createHash('sha1').update(parts.join(':')).digest('hex').slice(0, HASH_LENGTH);

export const DATABASE_PREFIX = DB_PREFIX;
export const TEMPLATE_DATABASE_PREFIX = TEMPLATE_PREFIX;
