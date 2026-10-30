import { compareAgainstBaseline } from './redRatchet.mjs';

describe('redRatchet', () => {
    it('senala como regresion un test que estaba verde y ahora esta rojo', () => {
        const result = compareAgainstBaseline({
            baseline: ['suite a > test uno'],
            current: ['suite a > test uno', 'suite b > test dos'],
            flaky: [],
        });

        expect(result.regressions).toEqual(['suite b > test dos']);
        expect(result.fixed).toEqual([]);
        expect(result.ok).toBe(false);
    });

    it('senala como arreglado un test que estaba rojo y ahora esta verde', () => {
        const result = compareAgainstBaseline({
            baseline: ['suite a > test uno', 'suite b > test dos'],
            current: ['suite a > test uno'],
            flaky: [],
        });

        expect(result.regressions).toEqual([]);
        expect(result.fixed).toEqual(['suite b > test dos']);
        expect(result.ok).toBe(true);
    });

    // Los intermitentes se ignoran en AMBAS direcciones: si contaran como
    // arreglados, un `--accept` los sacaria de la linea base y su siguiente
    // oscilacion se leeria como regresion.
    it('ignora los intermitentes en ambas direcciones', () => {
        const result = compareAgainstBaseline({
            baseline: ['suite a > oscila'],
            current: ['suite b > oscila tambien'],
            flaky: ['suite a > oscila', 'suite b > oscila tambien'],
        });

        expect(result.regressions).toEqual([]);
        expect(result.fixed).toEqual([]);
        expect(result.ok).toBe(true);
    });

    it('la linea base vacia y ninguna suite roja es el estado terminal', () => {
        const result = compareAgainstBaseline({ baseline: [], current: [], flaky: [] });

        expect(result.ok).toBe(true);
        expect(result.done).toBe(true);
    });

    // CRITICO: casi todas las mediciones de este plan corren UN directorio, no la
    // suite entera. Sin acotar la comparacion a las suites presentes en esa
    // corrida, todo lo rojo de fuera se leeria como "arreglado" y un `--accept`
    // vaciaria la linea base de golpe, dejando el trinquete inservible.
    it('solo compara dentro de las suites presentes en la corrida', () => {
        const result = compareAgainstBaseline({
            baseline: ['tests/a.test.js > uno', 'tests/b.test.js > dos'],
            current: ['tests/a.test.js > uno'],
            flaky: [],
            scope: ['tests/a.test.js'],
        });

        expect(result.fixed).toEqual([]);
        expect(result.regressions).toEqual([]);
        expect(result.ok).toBe(true);
    });

    // El caso que da sentido a todo el trinquete: una suite que se ejecuta
    // entera en verde. Solo llega aqui porque el reporter anota TAMBIEN las
    // suites sin fallos; si solo anotara las rojas, esta suite no estaria en el
    // scope y sus tests se quedarian en la linea base para siempre.
    it('declara arreglados los tests de una suite que corrio sin ningun rojo', () => {
        const result = compareAgainstBaseline({
            baseline: ['tests/a.test.js > uno', 'tests/b.test.js > dos'],
            current: [],
            flaky: [],
            scope: ['tests/a.test.js'],
        });

        expect(result.fixed).toEqual(['tests/a.test.js > uno']);
        expect(result.regressions).toEqual([]);
        expect(result.ok).toBe(true);
    });

    it('sin scope compara contra la linea base entera', () => {
        const result = compareAgainstBaseline({
            baseline: ['tests/a.test.js > uno', 'tests/b.test.js > dos'],
            current: ['tests/a.test.js > uno'],
            flaky: [],
        });

        expect(result.fixed).toEqual(['tests/b.test.js > dos']);
    });
});
