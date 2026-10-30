import { DATABASE_PREFIX, TEMPLATE_DATABASE_PREFIX } from './dbNaming.js';
import { openAdminConnection } from './adminConnection.js';
import { assertValidDatabaseName } from './databaseIdentifier.js';

/**
 * Predicado puro que decide si un nombre de base de datos es una base de test
 * por-archivo huerfana (candidata a DROP).
 *
 * REGRESION: en SQL, `LIKE 'kace_t_%'` tambien casaba con `kace_tpl_...` (la
 * base plantilla), porque en `LIKE` el `_` es un comodin de UN caracter, no
 * un literal: el `_` que cierra `DATABASE_PREFIX` ("kace_t_") consumia la "p"
 * de "tpl", asi que el patron completo casaba con el nombre de la plantilla y
 * `globalTeardown` la borraba en cada corrida. `startsWith` (y su equivalente
 * SQL `starts_with`) comparan el prefijo como texto literal, sin semantica de
 * comodines, y por eso excluyen la plantilla por construccion:
 * "kace_tpl_...".startsWith("kace_t_") es `false` (la "p" en la posicion 6 no
 * coincide con el "_" literal del prefijo).
 *
 * @param {string} name
 * @returns {boolean}
 */
export const isOrphanTestDatabaseName = (name) =>
    typeof name === 'string' && name.startsWith(DATABASE_PREFIX) && !name.startsWith(TEMPLATE_DATABASE_PREFIX);

/**
 * jest globalTeardown. Elimina las bases por archivo DE ESTA CORRIDA.
 *
 * Antes barria todas las `kace_t_*`, y con corridas concurrentes eso significaba
 * borrarle las bases al proceso de al lado en pleno uso. Acotar por el prefijo
 * de la propia corrida es lo que hace que dos jest puedan convivir.
 *
 * Lo que esta corrida no llega a reclamar -porque muere de golpe- lo recoge
 * despues el barrido por edad de `staleDatabases.js`, que invoca globalSetup.
 *
 * El template NO se elimina: se reutiliza entre corridas.
 *
 * @returns {Promise<void>}
 */
export default async function dropOrphanDatabases() {
    const runId = process.env.KACE_TEST_RUN_ID;

    // Sin identidad no se puede acotar, y barrer sin acotar es exactamente el
    // fallo que se acaba de eliminar. Mejor no tocar nada.
    if (!runId) {
        return;
    }

    const prefix = `${DATABASE_PREFIX}${runId}_`;
    const admin = openAdminConnection();

    try {
        // REGRESION: `starts_with` y no `LIKE`. En `LIKE` el `_` es comodin de UN
        // caracter, asi que 'kace_t_%' casaba tambien con 'kace_tpl_...' y este
        // teardown borraba la plantilla en cada corrida.
        const result = await admin.raw('select datname from pg_database where starts_with(datname, ?)', [prefix]);

        // En una corrida sana esto no imprime nada: cada archivo elimina su
        // base en su propio afterAll. El aviso es la contrapartida de que ese
        // afterAll ya no lanza cuando no puede borrarla -tumbaba suites cuyos
        // tests estaban todos en verde-: sin esta linea, una fuga sistematica
        // de bases se limpiaria aqui en silencio y nadie se enteraria.
        if (result.rows.length > 0) {
            console.warn(
                `[globalTeardown] ${result.rows.length} base(s) por archivo sin reclamar: ` +
                    `${result.rows.map(({ datname }) => datname).join(', ')}.`
            );
        }

        for (const { datname } of result.rows) {
            // Defensa en profundidad: revalida en JS, aunque la query SQL ya
            // filtra por prefijo literal.
            if (!datname.startsWith(prefix)) {
                continue;
            }

            assertValidDatabaseName(datname);
            await admin.raw(`DROP DATABASE IF EXISTS ${datname} WITH (FORCE)`);
        }
    } finally {
        await admin.destroy();
    }
}
