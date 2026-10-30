import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Trinquete de tests rojos: compara los fallos de una corrida contra una linea
 * base versionada y se niega a avanzar si algo que estaba verde se ha puesto
 * rojo.
 *
 * No ejecuta tests. Consume el JSONL que escribe
 * `tests/support/diagnosticReporter.cjs` (`pnpm run test:diagnose`), asi que
 * medir y comparar son dos pasos separados y el segundo es reproducible sobre
 * un artefacto guardado.
 *
 * Uso: node tests/support/redRatchet.mjs <ruta al jsonl> [--accept]
 *
 * No importa nada de `src/`, ni puede hacerlo: `tests/support/setupModuleGraph.test.js`
 * exige que el arranque de la suite no arrastre codigo de produccion.
 */

const SUPPORT_DIR = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(SUPPORT_DIR, 'red-baseline.txt');
const FLAKY_PATH = join(SUPPORT_DIR, 'flaky.txt');

// El nombre completo de un test rojo es `<ruta de la suite> > <fullName>`. El
// separador se elige asi porque ninguna ruta de archivo lo contiene, de modo
// que el primer ` > ` de la cadena siempre parte suite de titulo.
const SEPARATOR = ' > ';

// Una suite que ni siquiera llega a evaluarse no aporta ningun nombre de test,
// y sin esta entrada sintetica sus tests de la linea base se leerian como
// "arreglados": pasar de fallar a no cargar contaria como progreso.
const EXECUTION_ERROR_TITLE = '<la suite no llego a ejecutarse>';

/**
 * Ordena y deduplica. El orden en que jest escribe las suites en el JSONL
 * depende del reparto entre workers y no es estable entre corridas, asi que
 * comparar y volcar exigen una forma canonica.
 *
 * @param {string[]} names
 * @returns {string[]}
 */
const canonical = (names) => [...new Set(names)].sort();

/**
 * Forma canonica de un nombre completo. La linea base es un archivo de una
 * linea por test, asi que un salto de linea dentro de un titulo lo partiria, y
 * los blancos de los extremos no sobreviven a la ida y vuelta por el archivo:
 * hay `it` cuyo titulo acaba en espacio, y sin recortar aqui el mismo test
 * aparecia a la vez como regresion y como arreglado.
 *
 * @param {string} name
 * @returns {string}
 */
const normalizeName = (name) => name.replace(/\s*\n\s*/g, ' ').trim();

/**
 * @param {string} name nombre completo de un test
 * @returns {string} la suite a la que pertenece
 */
export const suiteOf = (name) => {
    const cut = name.indexOf(SEPARATOR);

    return cut === -1 ? name : name.slice(0, cut);
};

/**
 * Compara los rojos de una corrida contra la linea base.
 *
 * @param {Object} params
 * @param {string[]} params.baseline nombres completos aceptados como rojos
 * @param {string[]} params.current nombres completos rojos en esta corrida
 * @param {string[]} [params.flaky] nombres completos que oscilan entre corridas
 * @param {string[]} [params.scope] suites presentes en la corrida; sin el, se
 *     compara contra la linea base entera
 * @returns {{regressions: string[], fixed: string[], ok: boolean, done: boolean}}
 */
export const compareAgainstBaseline = ({ baseline = [], current = [], flaky = [], scope = null }) => {
    const flakySet = new Set(flaky);
    const scopeSet = scope === null ? null : new Set(scope);

    // Acotar al scope es lo que hace utilizable el trinquete en corridas
    // parciales: casi ninguna medicion recorre la suite entera, y sin este
    // filtro todo lo rojo que esa corrida no toco se leeria como arreglado.
    const inScope = (name) => scopeSet === null || scopeSet.has(suiteOf(name));
    const relevant = (name) => inScope(name) && flakySet.has(name) === false;

    const baselineInScope = canonical(baseline.filter(relevant));
    const currentInScope = canonical(current.filter(relevant));
    const baselineSet = new Set(baselineInScope);
    const currentSet = new Set(currentInScope);

    const regressions = currentInScope.filter((name) => baselineSet.has(name) === false);
    const fixed = baselineInScope.filter((name) => currentSet.has(name) === false);

    // `done` mira la linea base ENTERA, no la del scope: una corrida parcial en
    // verde no es el final de nada. Y exige `flaky` vacio porque cada
    // intermitente es un test que no sabe lo que prueba.
    const baselineTotal = baseline.filter((name) => flakySet.has(name) === false);
    const done =
        regressions.length === 0 && baselineTotal.length === 0 && currentInScope.length === 0 && flaky.length === 0;

    return { regressions, fixed, ok: regressions.length === 0, done };
};

/**
 * Linea base que dejaria un `--accept`: lo de fuera del scope se conserva tal
 * cual (esta corrida no lo midio) y lo de dentro se sustituye por lo medido.
 *
 * @param {Object} params
 * @param {string[]} params.baseline
 * @param {string[]} params.current
 * @param {string[]} [params.flaky]
 * @param {string[]} [params.scope]
 * @returns {string[]}
 */
export const nextBaseline = ({ baseline = [], current = [], flaky = [], scope = null }) => {
    const flakySet = new Set(flaky);
    const scopeSet = scope === null ? null : new Set(scope);
    const inScope = (name) => scopeSet === null || scopeSet.has(suiteOf(name));

    // Los intermitentes nunca entran en la linea base: se ignoran en ambas
    // direcciones, asi que anotarlos aqui solo duplicaria la deuda en dos
    // archivos que luego se desincronizan.
    const kept = baseline.filter((name) => inScope(name) === false && flakySet.has(name) === false);
    const measured = current.filter((name) => inScope(name) && flakySet.has(name) === false);

    return canonical([...kept, ...measured]);
};

/**
 * Lee un archivo de nombres, uno por linea. Ignora lineas vacias y comentarios
 * para que `flaky.txt` pueda documentar el motivo medido de cada entrada.
 *
 * @param {string} path
 * @returns {string[]}
 */
export const readNameList = (path) => {
    if (existsSync(path) === false) {
        return [];
    }

    return readFileSync(path, 'utf8')
        .split('\n')
        .map(normalizeName)
        .filter((line) => line.length > 0 && line.startsWith('#') === false);
};

/**
 * Extrae de un JSONL de diagnostico los nombres completos de los tests rojos y
 * las suites presentes en la corrida.
 *
 * El reporter escribe una entrada por suite EJECUTADA, verde o roja, y de ahi
 * sale el scope. Depende de eso: si solo anotara las rojas, una suite que pasa
 * a estar entera en verde desapareceria del JSONL, sus tests quedarian fuera
 * del ambito comparado y no se declararian nunca arreglados.
 *
 * @param {string} path
 * @returns {{red: string[], scope: string[]}}
 */
export const readDiagnostics = (path) => {
    const entries = readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));

    const red = [];
    const scope = [];

    for (const entry of entries) {
        scope.push(entry.suite);

        for (const failure of entry.failures ?? []) {
            red.push(`${entry.suite}${SEPARATOR}${failure.title}`);
        }

        if (entry.executionError) {
            red.push(`${entry.suite}${SEPARATOR}${EXECUTION_ERROR_TITLE}`);
        }
    }

    return { red: canonical(red.map(normalizeName)), scope: canonical(scope) };
};

/**
 * @param {string[]} names
 */
const writeBaseline = (names) => {
    writeFileSync(BASELINE_PATH, names.length === 0 ? '' : `${names.join('\n')}\n`);
};

/**
 * @param {string} title
 * @param {string[]} names
 */
const printList = (title, names) => {
    process.stdout.write(`\n${title} (${names.length}):\n`);

    for (const name of names) {
        process.stdout.write(`  ${name}\n`);
    }
};

const main = () => {
    const args = process.argv.slice(2);
    const accept = args.includes('--accept');
    const jsonlPath = args.find((arg) => arg.startsWith('--') === false);

    if (jsonlPath === undefined) {
        process.stdout.write('Uso: node tests/support/redRatchet.mjs <ruta al jsonl> [--accept]\n');
        process.exitCode = 1;

        return;
    }

    if (existsSync(jsonlPath) === false) {
        process.stdout.write(`No existe el JSONL: ${jsonlPath}\n`);
        process.exitCode = 1;

        return;
    }

    const baselineExists = existsSync(BASELINE_PATH);

    if (baselineExists === false) {
        process.stdout.write(`No hay linea base en ${BASELINE_PATH}: se compara contra una linea base vacia.\n`);
    }

    // Sembrar es el unico caso en que aceptar rojos que no estaban antes es lo
    // correcto: sin archivo no hay nada que proteger, y contra una linea base
    // vacia TODO lo rojo sale como regresion, asi que sin esta excepcion el
    // primer `--accept` se negaria a si mismo y el trinquete jamas arrancaria.
    const seeding = accept && baselineExists === false;

    const baseline = readNameList(BASELINE_PATH);
    const flaky = readNameList(FLAKY_PATH);
    const { red, scope } = readDiagnostics(jsonlPath);
    const result = compareAgainstBaseline({ baseline, current: red, flaky, scope });

    process.stdout.write(`suites ejecutadas: ${scope.length}   tests rojos: ${red.length}\n`);
    process.stdout.write(`linea base: ${baseline.length}   intermitentes ignorados: ${flaky.length}\n`);

    if (result.regressions.length > 0 && seeding === false) {
        printList('REGRESIONES', result.regressions);
    }

    if (result.fixed.length > 0) {
        printList('ARREGLADOS', result.fixed);
    }

    if (accept) {
        // Aceptar con regresiones subiria el liston en vez de bajarlo, que es
        // justo lo que el trinquete existe para impedir.
        if (result.ok === false && seeding === false) {
            process.stdout.write(
                '\n--accept rechazado: hay regresiones. Arreglalas o justificalas antes de aceptar.\n'
            );
            process.exitCode = 1;

            return;
        }

        const next = nextBaseline({ baseline, current: red, flaky, scope });

        writeBaseline(next);
        process.stdout.write(
            seeding
                ? `\nLinea base sembrada con ${next.length} tests rojos.\n`
                : `\nLinea base reescrita: ${baseline.length} -> ${next.length} tests rojos.\n`
        );

        return;
    }

    if (result.done) {
        process.stdout.write('\nESTADO TERMINAL: ni linea base, ni rojos, ni intermitentes.\n');
    }

    if (result.ok === false) {
        process.exitCode = 1;
    }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
