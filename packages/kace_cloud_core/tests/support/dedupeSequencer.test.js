// El sequencer es CommonJS a proposito (jest lo carga por `require` y el paquete
// es `"type": "module"`), asi que se importa con la misma forma que
// diagnosticReporter.test.js.
const { default: DedupeSequencer } = await import('./dedupeSequencer.cjs');

/**
 * Entrada de la cola de jest con la forma minima que consulta el sequencer.
 *
 * `config.cache: false` deja vacia la cache de tiempos de la clase base, y
 * `hasteFS.getSize` es el desempate que usa cuando no hay tiempos: sin el, el
 * `sort` heredado revienta.
 *
 * @param {string} path
 * @returns {Object}
 */
const testEntry = (path) => ({
    path,
    context: {
        config: { cache: false, cacheDirectory: '/tmp/kace-dedupe-sequencer', id: 'kace-core' },
        hasteFS: { getSize: () => 0 },
    },
});

describe('DedupeSequencer', () => {
    // REGRESION: WebStorm construye la lista de «Rerun Failed Tests» con una
    // entrada por test fallido, no por archivo, y jest no deduplica las rutas de
    // `--runTestsByPath`. El archivo acababa corriendo a la vez en dos workers y
    // los dos se peleaban por la misma base de datos por archivo.
    it('deja una sola entrada por ruta aunque llegue repetida', () => {
        const tests = [
            testEntry('/repo/tests/cases/A.test.js'),
            testEntry('/repo/tests/cases/A.test.js'),
            testEntry('/repo/tests/cases/A.test.js'),
        ];

        const sorted = new DedupeSequencer().sort(tests);

        expect(sorted.map((test) => test.path)).toEqual(['/repo/tests/cases/A.test.js']);
    });

    it('no pierde rutas distintas', () => {
        const tests = [
            testEntry('/repo/tests/cases/A.test.js'),
            testEntry('/repo/tests/cases/B.test.js'),
            testEntry('/repo/tests/cases/A.test.js'),
        ];

        const sorted = new DedupeSequencer().sort(tests);

        expect(sorted.map((test) => test.path).sort()).toEqual([
            '/repo/tests/cases/A.test.js',
            '/repo/tests/cases/B.test.js',
        ]);
    });

    it('conserva la entrada tal cual, no una copia', () => {
        const entry = testEntry('/repo/tests/cases/A.test.js');

        const sorted = new DedupeSequencer().sort([entry, testEntry('/repo/tests/cases/A.test.js')]);

        expect(sorted[0]).toBe(entry);
    });

    it('sigue heredando el reparto por shards del sequencer por defecto', () => {
        expect(typeof new DedupeSequencer().shard).toBe('function');
    });
});
