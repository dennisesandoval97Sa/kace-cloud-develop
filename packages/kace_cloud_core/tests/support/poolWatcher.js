/**
 * Observador de que pool ejecuto cada consulta.
 *
 * Por que existe
 * --------------
 * El enrutamiento lector/escritor de `KnexRepository` se probaba sembrando
 * datos distintos en dos bases fisicas separadas y mirando cual volvia. Desde
 * que writer y reader apuntan a la MISMA base (ver `tests/knexfile.js`), esa
 * tecnica ya no distingue nada: la fila escrita por el writer se ve tambien
 * por el reader.
 *
 * La sustitucion que se uso entonces -`expect(repo.reader).not.toBe(repo.writer)`-
 * solo ejercita el getter en aislamiento: no comprueba que `search()`,
 * `count()` o `find()` lo llamen. Con ella, apagar el enrutamiento en el origen
 * (que `get read()` devuelva `this.writer`) no rompe ningun test.
 *
 * Este helper devuelve la mordida: knex emite un evento `query` por instancia,
 * asi que enganchando writer y reader se sabe QUE INSTANCIA ejecuto de verdad
 * cada SELECT. La asercion pasa a ser «esta lectura la ejecuto el reader» en
 * lugar de «el getter reader existe», y muere si el enrutamiento se apaga.
 *
 * Por que el evento y no un espia sobre el getter `read`/`reader`
 * ---------------------------------------------------------------
 * Un espia sobre el getter solo prueba que ALGUIEN lo leyo, no que la consulta
 * saliera por ahi: un metodo puede tocar `this.read` y acabar ejecutando por
 * `this.table()` (el writer), y el espia seguiria verde. El evento `query` se
 * emite en el punto de ejecucion real, de modo que observa el efecto y no la
 * intencion. Ademas no necesita reescribir propiedades del repositorio, con lo
 * que no deja al objeto en un estado raro si un test falla a mitad.
 *
 * Este archivo NO importa nada de `src/` a proposito: solo usa los getters
 * publicos del repositorio.
 */

/**
 * Engancha los pools de un repositorio y registra que instancia ejecuto cada
 * consulta.
 *
 * Llamalo justo despues de construir el repositorio y SIEMPRE fuera de un
 * `DbRequestContext.run()` que ya haya hecho `markWrite()`: dentro de uno, el
 * getter `reader` resuelve al writer y el reader real quedaria sin enganchar.
 *
 * @param {{ writer: import('knex').Knex, reader: import('knex').Knex }} repository
 * @returns {{
 *   lastPool: () => 'reader'|'writer'|null,
 *   pools: () => Array<'reader'|'writer'>,
 *   queries: () => Array<{ pool: 'reader'|'writer', sql: string }>,
 *   sharedPool: boolean,
 *   reset: () => void,
 *   stop: () => void,
 * }}
 */
export const watchPools = (repository) => {
    const writer = repository.writer;
    const reader = repository.reader;
    // Sin readerConfig, `reader` y `writer` son la MISMA instancia. Enganchar
    // dos veces duplicaria cada evento, asi que se engancha una sola y se
    // etiqueta como writer, que es lo que de verdad esta ejecutando.
    const sharedPool = reader === writer;

    const observed = [];
    const listeners = [];

    const attach = (knex, pool) => {
        const listener = (query) => observed.push({ pool, sql: query?.sql ?? '' });

        knex.on('query', listener);
        listeners.push([knex, listener]);
    };

    attach(writer, 'writer');

    if (!sharedPool) {
        attach(reader, 'reader');
    }

    return {
        /**
         * Pool que ejecuto la ultima consulta observada, o `null` si no hubo
         * ninguna. El `null` es deliberado: hace fallar la asercion cuando el
         * metodo bajo prueba no llego a consultar nada.
         *
         * @returns {'reader'|'writer'|null}
         */
        lastPool: () => (observed.length === 0 ? null : observed[observed.length - 1].pool),

        /**
         * Pools de todas las consultas observadas, en orden.
         *
         * @returns {Array<'reader'|'writer'>}
         */
        pools: () => observed.map((entry) => entry.pool),

        /**
         * Consultas observadas con su SQL, para diagnosticar un fallo.
         *
         * @returns {Array<{ pool: 'reader'|'writer', sql: string }>}
         */
        queries: () => observed.map((entry) => ({ ...entry })),

        /**
         * `true` cuando el repositorio se construyo sin readerConfig y ambos
         * getters devuelven la misma instancia.
         */
        sharedPool,

        /**
         * Vacia lo observado. Conviene llamarlo justo antes de la operacion que
         * se quiere medir, para que el sembrado previo -que va por el writer- no
         * contamine la asercion.
         *
         * @returns {void}
         */
        reset: () => {
            observed.length = 0;
        },

        /**
         * Desengancha los listeners. No lanza ninguna consulta, asi que es
         * seguro llamarlo desde un `afterEach` (los `afterAll` de estos archivos
         * corren DESPUES del DROP DATABASE de `perFileDatabase.js`).
         *
         * @returns {void}
         */
        stop: () => {
            for (const [knex, listener] of listeners) {
                knex.removeListener('query', listener);
            }

            listeners.length = 0;
        },
    };
};
