// packages/kace_cloud_core/tests/support/diagnosticReporter.cjs
const { appendFileSync, writeFileSync } = require('node:fs');
const { relative } = require('node:path');

const OUTPUT = process.env.KACE_DIAGNOSTIC_OUTPUT || 'diagnostics.jsonl';

/**
 * Vuelca una entrada por cada suite EJECUTADA, con sus mensajes de fallo y las
 * entradas de consola que jest capturo. Con NODE_ENV=diagnostic esas entradas
 * llevan el objeto de log completo de Helper, con `error` y `stack`.
 *
 * La correlacion es exacta por archivo y aproximada por test: jest agrupa la
 * consola por suite, no por `it`, asi que atribuir una entrada a un test
 * concreto se hace por orden de aparicion.
 *
 * ## Por que tambien se anotan las suites verdes
 *
 * `tests/support/redRatchet.mjs` deduce de este archivo que suites corrieron,
 * para acotar la comparacion contra la linea base a lo que esa corrida de
 * verdad midio. Si solo se anotaran las suites rojas, una suite que pasa a
 * estar entera en verde desapareceria del JSONL, quedaria fuera de ese ambito,
 * y sus tests se quedarian en la linea base para siempre: el trinquete dejaria
 * de bajar justo cuando el trabajo empieza a dar fruto.
 *
 * Las entradas verdes van sin consola a proposito. No hay fallo que explicar
 * con ella y volcarla multiplicaria el tamano del artefacto por las ~530
 * suites que hoy pasan.
 */
class DiagnosticReporter {
    constructor(globalConfig) {
        this.rootDir = globalConfig.rootDir;
        writeFileSync(OUTPUT, '');
    }

    onTestResult(_test, result) {
        const failed = result.numFailingTests > 0 || Boolean(result.testExecError);

        const entry = {
            suite: relative(this.rootDir, result.testFilePath),
            failing: result.numFailingTests,
            passing: result.numPassingTests,
            executionError: result.testExecError ? String(result.testExecError.message) : null,
            failures: result.testResults
                .filter((assertion) => assertion.status === 'failed')
                .map((assertion) => ({
                    title: assertion.fullName,
                    messages: assertion.failureMessages,
                })),
            // La forma del objeto es la misma para verdes y rojas para que
            // quien lo consume no tenga que distinguir entre campo vacio y
            // campo ausente.
            console: failed ? (result.console || []).map((line) => ({ type: line.type, message: line.message })) : [],
        };

        appendFileSync(OUTPUT, `${JSON.stringify(entry)}\n`);
    }

    onRunComplete() {
        // El fichero ya esta escrito de forma incremental: si la corrida muere
        // a mitad, lo diagnosticado hasta ese punto se conserva.
    }
}

module.exports = DiagnosticReporter;
