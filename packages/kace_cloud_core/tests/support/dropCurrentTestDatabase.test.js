import { describe, expect, jest, test } from '@jest/globals';
import { dropCurrentTestDatabase, settleWithin } from './perFileDatabase.js';

/**
 * El teardown por archivo, probado sin base de datos: todos sus colaboradores
 * entran por parametro. Lo que se comprueba aqui es la propiedad que hace falta
 * para que `tests/grupos/GroupsIntegration.test.js` no se vuelva a poner roja
 * con sus 41 tests en verde -que este codigo TERMINE, pase lo que pase, y no se
 * quede colgado hasta que jest lo mate a los 120 segundos.
 */

const DATABASE = 'kace_t_prueba';

const nuncaTermina = () => new Promise(() => {});

/**
 * Doble de la conexion de administracion. Reparte las llamadas a `raw` entre las
 * de terminacion de backends y las de DROP mirando el SQL, que es lo unico que
 * las distingue.
 *
 * @param {{onDrop?: () => Promise<unknown>}} [behaviour]
 */
const fakeAdmin = ({ onDrop = async () => ({}), onDestroy = async () => {} } = {}) => {
    const terminates = [];
    const drops = [];

    return {
        terminates,
        drops,
        destroy: jest.fn(onDestroy),
        raw: jest.fn(async (sql, bindings) => {
            if (sql.includes('pg_terminate_backend')) {
                terminates.push(bindings);

                return { rows: [] };
            }

            drops.push(sql);

            return onDrop();
        }),
    };
};

describe('settleWithin', () => {
    test('devuelve true cuando la promesa termina dentro del plazo, resuelva o rechace', async () => {
        await expect(settleWithin(Promise.resolve('ok'), 1000)).resolves.toBe(true);
        await expect(settleWithin(Promise.reject(new Error('feo')), 1000)).resolves.toBe(true);
    });

    test('devuelve false cuando vence el plazo', async () => {
        await expect(settleWithin(nuncaTermina(), 20)).resolves.toBe(false);
    });
});

describe('dropCurrentTestDatabase', () => {
    test('elimina la base sin tocar los backends cuando el pool cierra a tiempo', async () => {
        const admin = fakeAdmin();
        const warn = jest.fn();
        const close = jest.fn(async () => {});

        await dropCurrentTestDatabase({ close, openAdmin: () => admin, database: DATABASE, warn });

        expect(close).toHaveBeenCalledTimes(1);
        expect(admin.terminates).toHaveLength(0);
        expect(admin.drops).toHaveLength(1);
        expect(admin.drops[0]).toContain(`DROP DATABASE IF EXISTS ${DATABASE}`);
        expect(warn).not.toHaveBeenCalled();
        expect(admin.destroy).toHaveBeenCalledTimes(1);
    });

    test('termina los backends y sigue adelante cuando el cierre del pool se cuelga', async () => {
        // Es el caso real: `tarn.destroy()` espera sin limite a que se liberen
        // las conexiones en uso, asi que una consulta en vuelo lo cuelga para
        // siempre. Terminar los backends desde el servidor es lo que lo
        // desatasca, y por eso la conexion de administracion se abre ANTES de
        // pedir el cierre.
        const admin = fakeAdmin();
        const warn = jest.fn();
        const close = jest.fn(nuncaTermina);

        await dropCurrentTestDatabase({
            close,
            openAdmin: () => admin,
            database: DATABASE,
            warn,
            closeTimeoutMs: 30,
        });

        expect(close).toHaveBeenCalledTimes(2);
        expect(admin.terminates).toEqual([[DATABASE]]);
        expect(admin.drops).toHaveLength(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain(DATABASE);
    });

    test('reintenta el DROP y avisa sin lanzar cuando la base sigue en uso', async () => {
        // `55006` es "objeto en uso": bajo carga el DROP compite con backends
        // que todavia se estan muriendo. Que agote los intentos no puede tumbar
        // una suite cuyos tests pasaron; globalTeardown reclama la base al final
        // de la corrida.
        const enUso = Object.assign(new Error('database is being accessed by other users'), { code: '55006' });
        const admin = fakeAdmin({ onDrop: async () => Promise.reject(enUso) });
        const warn = jest.fn();

        await expect(
            dropCurrentTestDatabase({
                close: async () => {},
                openAdmin: () => admin,
                database: DATABASE,
                warn,
            })
        ).resolves.toBeUndefined();

        expect(admin.drops).toHaveLength(2);
        expect(admin.terminates).toHaveLength(1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('globalTeardown la reclamara');
        expect(admin.destroy).toHaveBeenCalledTimes(1);
    });

    test('abandona la espera del DROP en silencio y sin reintentarlo cuando tarda mas de la cuenta', async () => {
        // Un DROP lento NO es un DROP fallido: borrar una base de 19 MB con seis
        // workers a la vez pasa de treinta segundos sin que nada vaya mal, y
        // termina solo. Se abandona la espera -el servidor sigue borrando-, no
        // se reintenta -un segundo DROP mientras el primero corre solo da un
        // `55006`- y no se avisa, porque quien delata una fuga de verdad es el
        // recuento de globalTeardown.
        const admin = fakeAdmin({ onDrop: nuncaTermina });
        const warn = jest.fn();

        await expect(
            dropCurrentTestDatabase({
                close: async () => {},
                openAdmin: () => admin,
                database: DATABASE,
                warn,
                dropTimeoutMs: 30,
            })
        ).resolves.toBeUndefined();

        expect(admin.drops).toHaveLength(1);
        expect(warn).not.toHaveBeenCalled();
        expect(admin.destroy).toHaveBeenCalledTimes(1);
    });

    test('termina aunque la destruccion de la conexion de administracion se cuelgue', async () => {
        const admin = fakeAdmin({ onDestroy: nuncaTermina });
        const warn = jest.fn();

        await expect(
            dropCurrentTestDatabase({
                close: async () => {},
                openAdmin: () => admin,
                database: DATABASE,
                warn,
            })
        ).resolves.toBeUndefined();

        expect(admin.drops).toHaveLength(1);
    });
});
