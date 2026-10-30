import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// La ruta de salida se lee una sola vez, al cargar el modulo, asi que hay que
// fijar la variable antes de importarlo: de ahi el import dinamico en lugar del
// estatico, que se evaluaria antes que cualquier linea de este archivo.
const OUTPUT = join(mkdtempSync(join(tmpdir(), 'kace-diag-')), 'diagnostics.jsonl');

process.env.KACE_DIAGNOSTIC_OUTPUT = OUTPUT;

const { default: DiagnosticReporter } = await import('./diagnosticReporter.cjs');

/**
 * Resultado de suite con la forma minima que el reporter consulta.
 *
 * @param {Object} overrides
 * @returns {Object}
 */
const testResult = (overrides = {}) => ({
    testFilePath: '/raiz/tests/ejemplo.test.js',
    numFailingTests: 0,
    numPassingTests: 3,
    testExecError: undefined,
    testResults: [],
    console: null,
    ...overrides,
});

/**
 * @returns {Object[]}
 */
const readEntries = () =>
    readFileSync(OUTPUT, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));

describe('diagnosticReporter', () => {
    let reporter;

    // El constructor trunca el archivo de salida, asi que un reporter nuevo por
    // caso basta para aislarlos entre si.
    beforeEach(() => {
        reporter = new DiagnosticReporter({ rootDir: '/raiz' });
    });

    // El caso que sostiene al trinquete: `redRatchet.mjs` deduce de este
    // archivo que suites corrieron. Si las verdes no se anotasen, una suite que
    // pasa a estar entera en verde desapareceria del artefacto y sus tests se
    // quedarian en la linea base para siempre.
    it('anota tambien las suites que pasaron sin ningun fallo', () => {
        reporter.onTestResult(null, testResult());

        const entries = readEntries();

        expect(entries).toHaveLength(1);
        expect(entries[0].suite).toBe('tests/ejemplo.test.js');
        expect(entries[0].failing).toBe(0);
        expect(entries[0].failures).toEqual([]);
    });

    it('anota el nombre completo de cada test fallido', () => {
        reporter.onTestResult(
            null,
            testResult({
                numFailingTests: 1,
                testResults: [
                    { status: 'failed', fullName: 'grupo hace algo', failureMessages: ['Error: roto'] },
                    { status: 'passed', fullName: 'grupo hace otra cosa', failureMessages: [] },
                ],
            })
        );

        const [entry] = readEntries();

        expect(entry.failures).toEqual([{ title: 'grupo hace algo', messages: ['Error: roto'] }]);
    });

    // Volcar la consola de las ~530 suites que pasan multiplicaria el tamano
    // del artefacto sin aportar nada: no hay fallo que explicar con ella.
    it('guarda la consola de las suites rojas y la omite en las verdes', () => {
        const console = [{ type: 'log', message: 'ruido' }];

        reporter.onTestResult(null, testResult({ console }));
        reporter.onTestResult(
            null,
            testResult({
                numFailingTests: 1,
                testResults: [{ status: 'failed', fullName: 'grupo falla', failureMessages: ['Error: roto'] }],
                console,
            })
        );

        const [verde, roja] = readEntries();

        expect(verde.console).toEqual([]);
        expect(roja.console).toEqual(console);
    });

    it('anota una suite que ni siquiera llego a ejecutarse', () => {
        reporter.onTestResult(null, testResult({ testExecError: { message: 'Cannot find module' } }));

        const [entry] = readEntries();

        expect(entry.executionError).toBe('Cannot find module');
    });
});
