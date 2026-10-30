const TestSequencer = require('@jest/test-sequencer').default;

/**
 * Sequencer que elimina las rutas repetidas antes de repartir el trabajo entre
 * los workers.
 *
 * ## Por que hace falta
 *
 * jest NO deduplica las rutas que recibe por `--runTestsByPath`:
 * `SearchSource.findTestsByPaths` hace `paths.map(...).filter(...)` y punto. Y
 * los IDE lanzan justamente asi los tests: WebStorm, al pulsar «Rerun Failed
 * Tests», construye la lista desde las UBICACIONES de los tests fallidos -una
 * entrada por test, no por archivo-, de modo que un archivo con varios rojos
 * llega repetido.
 *
 * El resultado era que el mismo archivo corria a la vez en dos workers y los dos
 * se peleaban por su base de datos por archivo (ver `perFileDatabase.js`), con
 * dos sintomas: `duplicate key ... pg_database_datname_index` si los dos
 * `CREATE DATABASE` se solapaban, y `database "..." does not exist` cuando el
 * `DROP ... WITH (FORCE)` de uno se llevaba por delante la base del otro.
 *
 * Deduplicar aqui es el sitio correcto porque `runJest` toma la salida de
 * `sort()` como lista definitiva. No se pierde ningun test: el IDE acompaña las
 * rutas con un `--testNamePattern` que es la union de los nombres fallidos, y
 * ese filtro se aplica dentro del archivo.
 *
 * Se extiende el sequencer por defecto en lugar de escribir uno desde cero para
 * conservar su heuristica de «los lentos primero», que en una suite de ~660
 * archivos y ~27 minutos no es cosmetica. `shard()` y `allFailedTests()` se
 * heredan intactos.
 */
class DedupeSequencer extends TestSequencer {
    /**
     * @param {Array<{path: string}>} tests
     * @returns {Array<{path: string}>}
     */
    sort(tests) {
        const seen = new Set();
        const unique = [];

        for (const test of tests) {
            if (seen.has(test.path)) {
                continue;
            }

            seen.add(test.path);
            unique.push(test);
        }

        return super.sort(unique);
    }
}

module.exports = DedupeSequencer;
