/**
 * Identidad de corrida: un identificador corto que distingue un proceso de jest
 * de cualquier otro y que ademas LLEVA DENTRO su instante de creacion.
 *
 * Existe porque el nombre de la base de datos por archivo se derivaba solo del
 * testPath, y por tanto era identico entre dos corridas concurrentes: las dos
 * creaban y eliminaban las mismas bases y se destruian mutuamente. Metiendo esta
 * identidad en el nombre, cada corrida tiene su propio espacio de nombres.
 *
 * Modulo autonomo (sin imports de `src/`): lo consumen `globalSetup` y
 * `setupFilesAfterEnv`, que no toleran las dependencias de `src/`.
 */

// 8 caracteres en base 36 alcanzan hasta 36^8 = 2,82e12 ms desde la epoca, o
// sea el ano 2059: sobra para la vida util de esta suite y deja el nombre corto.
const TIMESTAMP_LENGTH = 8;

// 4 caracteres aleatorios: dos corridas lanzadas en el MISMO milisegundo (no es
// hipotetico, un script puede arrancarlas en paralelo) compartirian los 8
// primeros caracteres, asi que el instante por si solo no basta para desempatar.
const RANDOM_LENGTH = 4;

/**
 * Longitud total del identificador. Es fija a proposito: el parser de
 * `runIdTimestamp` la usa para rechazar cualquier cosa que no tenga la forma
 * esperada, y el presupuesto de 63 caracteres del nombre de base de datos se
 * calcula contando con ella ("kace_t_" 7 + runId 12 + "_" 1 + hash 12 = 32).
 *
 * @type {number}
 */
export const RUN_ID_LENGTH = TIMESTAMP_LENGTH + RANDOM_LENGTH;

/**
 * Construye la identidad de la corrida actual.
 *
 * Base 36 y no hexadecimal porque el resultado tiene que caber en un nombre de
 * base de datos de postgres: base 36 usa `[0-9a-z]`, que el validador de
 * identificadores acepta, y codifica el instante en menos caracteres que hex.
 *
 * El `padStart` cubre el pasado (instantes cortos, solo en tests con relojes
 * falsos) y el `slice(-TIMESTAMP_LENGTH)` cubre el futuro lejano: si algun dia
 * el instante necesita mas de 8 caracteres, el identificador sigue siendo valido
 * y de longitud fija, solo pierde precision en los digitos altos.
 *
 * @param {number} [now] instante en milisegundos; parametrizable para poder testear
 * @returns {string} identificador de RUN_ID_LENGTH caracteres en `[0-9a-z]`
 */
export const createRunId = (now = Date.now()) => {
    const stamp = now.toString(36).padStart(TIMESTAMP_LENGTH, '0').slice(-TIMESTAMP_LENGTH);
    const random = Math.random().toString(36).slice(2).padEnd(RANDOM_LENGTH, '0').slice(0, RANDOM_LENGTH);

    return `${stamp}${random}`;
};

/**
 * Recupera el instante de creacion codificado en un identificador.
 *
 * Es la pieza que hace posible el barrido por edad: `pg_database` no guarda
 * fecha de creacion de las bases, asi que la unica forma de saber si una base
 * huerfana es de una corrida muerta hace horas o de una corrida viva ahora mismo
 * es leer el instante del propio nombre.
 *
 * Devuelve `null` -y no lanza- ante cualquier cosa que no tenga la forma
 * esperada, porque el llamador es un barrido que recorre TODO `pg_database`: un
 * nombre ajeno al esquema no es un error, es simplemente algo que no hay que
 * tocar.
 *
 * @param {unknown} runId
 * @returns {number|null} milisegundos desde la epoca, o null si no tiene la forma esperada
 */
export const runIdTimestamp = (runId) => {
    if (typeof runId !== 'string' || runId.length !== RUN_ID_LENGTH || /^[0-9a-z]+$/.test(runId) === false) {
        return null;
    }

    const parsed = Number.parseInt(runId.slice(0, TIMESTAMP_LENGTH), 36);

    return Number.isNaN(parsed) ? null : parsed;
};
