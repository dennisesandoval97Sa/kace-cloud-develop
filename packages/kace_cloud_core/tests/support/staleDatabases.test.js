import { dropStaleTestDatabases, isStaleTestDatabase, STALE_AFTER_MS } from './staleDatabases.js';

const NOW = 1786000000000;
// La forma real que produce `databaseNameForTestPath`, sufijo de worker
// incluido: el barrido lee `pg_database`, asi que tiene que reconocer el nombre
// tal cual esta en el catalogo, no una version simplificada.
const nameForRun = (runId) => `kace_t_${runId}_0123456789ab_w1`;
const runIdAt = (instant) => `${instant.toString(36).padStart(8, '0').slice(-8)}zzzz`;

describe('staleDatabases', () => {
    it('considera caducada una base de una corrida vieja', () => {
        const name = nameForRun(runIdAt(NOW - STALE_AFTER_MS - 1));

        expect(isStaleTestDatabase(name, NOW)).toBe(true);
    });

    // Protege a las corridas concurrentes vivas: sus bases son recientes.
    it('no toca una base de una corrida reciente', () => {
        const name = nameForRun(runIdAt(NOW - 1000));

        expect(isStaleTestDatabase(name, NOW)).toBe(false);
    });

    // REGRESION: `LIKE 'kace_t_%'` casa con `kace_tpl_...` porque en LIKE el `_`
    // es comodin de un caracter. Ese error borro la plantilla una vez.
    it('nunca considera caducada la plantilla', () => {
        expect(isStaleTestDatabase('kace_tpl_8f4a8b3efcb2', NOW)).toBe(false);
    });

    it('no toca bases ajenas al esquema de nombres', () => {
        expect(isStaleTestDatabase('postgres', NOW)).toBe(false);
        expect(isStaleTestDatabase('kace_t_sinformato', NOW)).toBe(false);
    });
});

/**
 * Admin de mentira: devuelve las filas que se le den para el SELECT del catalogo,
 * declara que nadie esta conectado y APUNTA los DROP en vez de ejecutarlos.
 *
 * @param {string[]} datnames nombres que devuelve el catalogo
 * @returns {{raw: Function, dropped: string[], queries: string[]}}
 */
const fakeAdmin = (datnames) => {
    const dropped = [];
    const queries = [];

    return {
        dropped,
        queries,
        raw: async (sql, bindings) => {
            queries.push(sql);

            if (sql.includes('pg_database')) {
                return { rows: datnames.map((datname) => ({ datname })) };
            }

            if (sql.includes('pg_stat_activity')) {
                return { rows: [] };
            }

            dropped.push(sql);

            return { rows: [], bindings };
        },
    };
};

describe('dropStaleTestDatabases', () => {
    // ESTE es el test con dientes sobre la plantilla. El predicado por si solo no
    // se puede romper para que la plantilla caiga -la protegen tres capas
    // independientes-, pero el barrido SI: si deja de filtrar por el predicado y
    // elimina todo lo que devuelve el catalogo, la plantilla se va con el resto.
    // El SELECT usa `starts_with`, pero un `LIKE 'kace_t_%'` la devolveria, asi
    // que aqui se simula ese catalogo permisivo a proposito.
    it('no elimina la plantilla aunque el catalogo la devuelva entre las candidatas', async () => {
        const admin = fakeAdmin(['kace_tpl_8f4a8b3efcb2', nameForRun(runIdAt(NOW - STALE_AFTER_MS - 1))]);

        const dropped = await dropStaleTestDatabases(admin, NOW);

        expect(dropped).toEqual([nameForRun(runIdAt(NOW - STALE_AFTER_MS - 1))]);
        expect(admin.dropped.join('\n')).not.toContain('kace_tpl_');
    });

    it('deja en paz las bases de corridas vivas', async () => {
        const admin = fakeAdmin([nameForRun(runIdAt(NOW - 1000))]);

        expect(await dropStaleTestDatabases(admin, NOW)).toEqual([]);
    });

    // Segunda salvaguarda: una base con sesiones abiertas esta en uso ahora
    // mismo, por vieja que parezca su identidad de corrida.
    it('no elimina una base caducada que todavia tiene conexiones abiertas', async () => {
        const name = nameForRun(runIdAt(NOW - STALE_AFTER_MS - 1));
        const admin = fakeAdmin([name]);
        const withActivity = {
            ...admin,
            raw: async (sql, bindings) =>
                sql.includes('pg_stat_activity') ? { rows: [{ '?column?': 1 }] } : admin.raw(sql, bindings),
        };

        expect(await dropStaleTestDatabases(withActivity, NOW)).toEqual([]);
        expect(admin.dropped).toEqual([]);
    });

    // El DROP no lleva `WITH (FORCE)` a proposito: forzar desconectaria a quien
    // este usando la base, que es justo lo que la comprobacion anterior evita.
    it('no fuerza la desconexion al eliminar', async () => {
        const admin = fakeAdmin([nameForRun(runIdAt(NOW - STALE_AFTER_MS - 1))]);

        await dropStaleTestDatabases(admin, NOW);

        expect(admin.dropped.join('\n')).not.toContain('FORCE');
    });
});
