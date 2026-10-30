import { DATABASE_PREFIX } from './dbNaming.js';
import { assertValidDatabaseName } from './databaseIdentifier.js';
import { isOrphanTestDatabaseName } from './globalTeardown.js';
import { RUN_ID_LENGTH, runIdTimestamp } from './runIdentity.js';

/**
 * Edad a partir de la cual una base de test se considera abandonada.
 *
 * Dos horas es una holgura amplia sobre la corrida completa mas larga medida
 * (1854 s, algo mas de 31 minutos). El margen es deliberadamente generoso: el
 * coste de esperar de mas es una base huerfana ocupando disco un rato, y el de
 * esperar de menos es borrarle las bases a una corrida viva, que es exactamente
 * el fallo que esta fase existe para eliminar.
 *
 * @type {number}
 */
export const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * Predicado puro: decide si un nombre de base de datos corresponde a una corrida
 * lo bastante vieja como para darla por muerta.
 *
 * Existe porque `pg_database` no guarda fecha de creacion. La unica fuente de
 * edad es el instante que el propio nombre lleva codificado en su identidad de
 * corrida (ver runIdentity.js).
 *
 * Es conservador por diseño: ante cualquier nombre que no encaje EXACTAMENTE en
 * el esquema `kace_t_<runId>_<hash>` devuelve `false`. Un barrido que recorre
 * todo `pg_database` no puede permitirse interpretar nombres ajenos.
 *
 * @param {unknown} name nombre tal como viene de pg_database
 * @param {number} [now] instante de referencia en milisegundos
 * @returns {boolean}
 */
export const isStaleTestDatabase = (name, now = Date.now()) => {
    // Excluye la plantilla y cualquier nombre sin el prefijo de base de test.
    if (!isOrphanTestDatabaseName(name)) {
        return false;
    }

    const rest = name.slice(DATABASE_PREFIX.length);

    // El separador tiene que estar justo donde acaba la identidad de corrida: si
    // no esta, el nombre no lo genero `databaseNameForTestPath` y no es nuestro.
    if (rest[RUN_ID_LENGTH] !== '_') {
        return false;
    }

    const createdAt = runIdTimestamp(rest.slice(0, RUN_ID_LENGTH));

    if (createdAt === null) {
        return false;
    }

    return now - createdAt > STALE_AFTER_MS;
};

/**
 * Barrido: elimina las bases de test de corridas ya muertas.
 *
 * Con identidad de corrida, `globalTeardown` solo puede reclamar lo suyo, asi
 * que las bases de una corrida que muere de golpe (un kill, un cuelgue del CI)
 * no las reclamaria nadie. Este barrido es esa reclamacion.
 *
 * Dos salvaguardas antes de cada DROP, porque el coste de equivocarse es
 * romperle la corrida a otro proceso:
 *
 *  1. La edad, via `isStaleTestDatabase`. Las bases de una corrida viva son
 *     recientes por construccion.
 *  2. Las conexiones abiertas en `pg_stat_activity`. Una base con sesiones vivas
 *     esta en uso AHORA, diga lo que diga su nombre. Por eso el DROP va sin
 *     `WITH (FORCE)`: forzar seria justamente saltarse esta comprobacion.
 *
 * @param {import('knex').Knex} admin conexion a la base "postgres"
 * @param {number} [now] instante de referencia en milisegundos
 * @returns {Promise<string[]>} nombres de las bases efectivamente eliminadas
 */
export const dropStaleTestDatabases = async (admin, now = Date.now()) => {
    // REGRESION: `starts_with` y no `LIKE`. En `LIKE` el `_` es comodin de UN
    // caracter, asi que el patron 'kace_t_%' casa tambien con 'kace_tpl_...' y
    // seleccionaria la plantilla. Ese error la borro una vez y costo caro.
    const result = await admin.raw('select datname from pg_database where starts_with(datname, ?)', [DATABASE_PREFIX]);

    const dropped = [];

    for (const { datname } of result.rows) {
        if (!isStaleTestDatabase(datname, now)) {
            continue;
        }

        const activity = await admin.raw('select 1 from pg_stat_activity where datname = ? limit 1', [datname]);

        if (activity.rows.length > 0) {
            continue;
        }

        // El nombre viene del catalogo de postgres y se interpola en SQL crudo:
        // DROP DATABASE no admite el nombre como binding parametrizado.
        assertValidDatabaseName(datname);
        await admin.raw(`DROP DATABASE IF EXISTS ${datname}`);
        dropped.push(datname);
    }

    return dropped;
};
