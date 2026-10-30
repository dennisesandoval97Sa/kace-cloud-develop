import { readFileSync } from 'node:fs';

/**
 * Reduce el JSONL del reporter de diagnostico a familias de causa.
 *
 * No es un test: es una herramienta de analisis que se ejecuta a mano sobre el
 * artefacto que produce `pnpm run test:diagnose`. Vive en `tests/support/`
 * porque es donde vive el reporter que genera su entrada.
 *
 * Uso: node tests/support/classifyDiagnostics.mjs <ruta al jsonl> [--json]
 *
 * ## Por que mira dos sitios y no uno
 *
 * La causa real de un fallo esta repartida entre dos campos que nunca
 * coinciden en la misma entrada, porque `Helper.logError` copia el stack del
 * error que recibe y el de un error de postgres apunta a `pg-protocol`, no al
 * codigo de dominio:
 *
 * - `failures[].messages` trae el stack de aplicacion con el mensaje generico
 *   (`Transaction failed: error saving data.`).
 * - `console[].message`, parseado como JSON, trae en `error` la causa real
 *   (`insert into ... violates foreign key constraint "..."`).
 *
 * Clasificar solo por la salida de jest se pierde todo lo que `QueryDBError`
 * enmascara, que son 559 sitios de `src/`.
 */

const FAMILIES = [
    { key: 'fk', label: 'Clave foranea', pattern: /violates foreign key constraint|null value in column/ },
    { key: 'unique', label: 'Valor unico repetido', pattern: /duplicate key value|already exist/ },
    {
        key: 'ddl',
        label: 'DDL en runtime',
        pattern: /relation "[^"]+" already exists|cannot drop table|is not a table/,
    },
    { key: 'count', label: 'count(*) sqlite', pattern: /\['count\(\*\)'\]/ },
    { key: 'undef', label: 'Recibido undefined', pattern: /Received: undefined/ },
    { key: 'timeout', label: 'Timeout', pattern: /Exceeded timeout/ },
    { key: 'red', label: 'Servicio externo', pattern: /ENOTFOUND|ECONNREFUSED|getaddrinfo|googleapis|amazonaws/ },
    { key: 'colision', label: 'Base inexistente', pattern: /database "kace_t_[0-9a-f]+" does not exist/ },
];

/**
 * Extrae el objeto de log de Helper de una entrada de consola, si lo es. Con
 * `NODE_ENV=diagnostic` esas entradas son JSON; sin la variable son texto
 * plano y esta funcion devuelve null para todas.
 *
 * @param {{message: string}} entry
 * @returns {Object|null}
 */
const parseLogEntry = (entry) => {
    const text = entry.message.trim();

    if (text.startsWith('{') === false) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

/**
 * @param {string} path
 * @returns {Array<{suite: string, failing: number, families: string[], causes: string[]}>}
 */
const classify = (path) =>
    readFileSync(path, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        // El reporter anota TODAS las suites ejecutadas, no solo las rojas,
        // porque el trinquete necesita saber que se midio para acotar su
        // comparacion. Aqui esas entradas verdes sobran: no tienen causa que
        // clasificar y caerian enteras en el cubo de "sin firma mecanica",
        // que es justo la lista que se usa para decidir por donde seguir.
        .filter((suite) => suite.failing > 0 || suite.executionError)
        .map((suite) => {
            const logs = (suite.console ?? []).map(parseLogEntry).filter(Boolean);
            const causes = logs.map((log) => log.error).filter(Boolean);
            const haystack = [
                ...suite.failures.flatMap((failure) => failure.messages),
                ...causes,
                ...logs.map((log) => log.message),
            ].join('\n');

            return {
                suite: suite.suite,
                failing: suite.failing,
                families: FAMILIES.filter((family) => family.pattern.test(haystack)).map((family) => family.key),
                causes: [...new Set(causes)].map((cause) => String(cause).slice(0, 160)).slice(0, 3),
            };
        });

const rows = classify(process.argv[2]);

if (process.argv.includes('--json')) {
    process.stdout.write(JSON.stringify(rows, null, 2));
} else {
    const byFamily = new Map(FAMILIES.map((family) => [family.key, 0]));
    const sinClasificar = [];

    for (const row of rows) {
        if (row.families.length === 0) {
            sinClasificar.push(row);
        }

        for (const family of row.families) {
            byFamily.set(family, byFamily.get(family) + 1);
        }
    }

    const totalTests = rows.reduce((sum, row) => sum + row.failing, 0);

    process.stdout.write(`suites con fallos: ${rows.length}   tests fallidos: ${totalTests}\n\n`);
    process.stdout.write(`${'FAMILIA'.padEnd(24)}SUITES\n`);

    for (const family of FAMILIES) {
        process.stdout.write(`${family.label.padEnd(24)}${byFamily.get(family.key)}\n`);
    }

    process.stdout.write(`${'Sin clasificar'.padEnd(24)}${sinClasificar.length}\n\n`);
    process.stdout.write('SUITES SIN FIRMA MECANICA, por numero de tests fallidos:\n');

    for (const row of sinClasificar.sort((a, b) => b.failing - a.failing).slice(0, 25)) {
        process.stdout.write(`  ${String(row.failing).padStart(4)}  ${row.suite}\n`);
    }
}
