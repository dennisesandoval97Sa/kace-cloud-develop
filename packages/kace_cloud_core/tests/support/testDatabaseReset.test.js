import { afterAll, beforeAll, beforeEach, describe, expect, test } from '@jest/globals';
import Knex from 'knex';
import { resetTestDatabase } from './testDatabaseReset.js';
import { buildWriterConfig } from '../knexfile.js';
import { quoteQualified } from './sqlIdentifier.js';

let connection;

const countRows = async (table) => {
    const { rows } = await connection.raw(`select count(*)::int as count from ${quoteQualified('public', table)}`);
    return rows[0].count;
};

const tableExists = async (table) => {
    const { rows } = await connection.raw(`select 1 from pg_tables where schemaname = 'public' and tablename = ?`, [
        table,
    ]);
    return rows.length > 0;
};

/**
 * Existencia de una relacion de `public` por su `relkind` de `pg_class`: 'v'
 * vista, 'm' vista materializada, 'S' secuencia. Se consulta `pg_class` y no
 * `pg_views`/`pg_matviews`/`pg_sequences` para preguntar por las tres clases
 * con una sola forma, y para que el test mire exactamente el mismo catalogo
 * que usa el reset.
 *
 * @param {'v'|'m'|'S'} relkind
 * @param {string} name
 * @returns {Promise<boolean>}
 */
const relationExists = async (relkind, name) => {
    const { rows } = await connection.raw(
        `select 1 from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = ? and c.relname = ?`,
        [relkind, name]
    );
    return rows.length > 0;
};

/**
 * `xmin` es el id de la transaccion que escribio la version actual de la
 * fila: postgres se lo asigna en cada INSERT/UPDATE y crece con cada
 * transaccion que escribe. Si un TRUNCATE + INSERT redundante volviera a
 * correr sobre `usuarios`, la fila reaparece con un `xmin` mas nuevo aunque
 * el contenido sea identico. `ctid` no sirve para esto: en una tabla chica
 * el TRUNCATE + INSERT vuelve a dejar la fila en el mismo lugar fisico, asi
 * que un `ctid` igual no distingue "no se toco" de "se volvio a escribir
 * igual" -se verifico a mano contra la plantilla antes de usar `xmin`.
 *
 * @param {string} id
 * @returns {Promise<string>}
 */
const usuarioWriteWitness = async (id) => {
    const { rows } = await connection.raw('select xmin::text as xmin from "public"."usuarios" where id = ?', [id]);
    return rows[0].xmin;
};

let baseline;

beforeAll(() => {
    connection = Knex(buildWriterConfig());
});

beforeAll(async () => {
    // Se captura ANTES de que corra el beforeEach de este archivo -el primero
    // de los cuales ya llama a resetTestDatabase-, asi que esto es el clon
    // fresco de la plantilla que perFileDatabase.js acaba de crear: la
    // referencia real contra la que el reset debe volver. Capturarla dentro
    // del propio test, como hacia antes, corre despues de que el beforeEach
    // ya reseteo, asi que un estado corrupto se compara contra si mismo y la
    // prueba queda ciega. Se comprobo: se hizo que el bucle de reposicion se
    // saltara `literales` en silencio y las 8 pruebas anteriores pasaron
    // igual con el `antes` capturado dentro del test.
    baseline = await snapshotRowCounts();
});

afterAll(async () => {
    await connection.destroy();
});

beforeEach(async () => {
    await resetTestDatabase(connection);
});

describe('resetTestDatabase', () => {
    test('vacia una tabla que el test ensucio', async () => {
        await connection('banners').insert({ id: '11111111-1111-1111-1111-111111111111', descripcion: 'uno' });
        expect(await countRows('banners')).toBe(1);

        await resetTestDatabase(connection);

        expect(await countRows('banners')).toBe(0);
    });

    test('repone las filas sembradas que el test destruyo', async () => {
        const original = await countRows('usuarios');
        expect(original).toBeGreaterThan(0);

        // rel_usuarios_grupos referencia a usuarios sin ON DELETE CASCADE, asi
        // que hay que vaciar la tabla dependiente antes: un DELETE liso contra
        // usuarios revienta con una violacion de clave foranea.
        await connection.raw('DELETE FROM "public"."rel_usuarios_grupos"');
        await connection.raw('DELETE FROM "public"."usuarios"');
        expect(await countRows('usuarios')).toBe(0);

        await resetTestDatabase(connection);

        expect(await countRows('usuarios')).toBe(original);
    });

    test('repone las tablas arrastradas por el CASCADE aunque no figuren como sucias', async () => {
        const relaciones = await countRows('rel_usuarios_grupos');
        expect(relaciones).toBeGreaterThan(0);

        // Solo se toca `usuarios`. El TRUNCATE ... CASCADE vaciara tambien
        // `rel_usuarios_grupos`, que nunca se detecto como sucia.
        await connection.raw(`UPDATE "public"."usuarios" SET updated_at = now()`);

        await resetTestDatabase(connection);

        expect(await countRows('rel_usuarios_grupos')).toBe(relaciones);
    });

    test('elimina una tabla creada por el test', async () => {
        await connection.raw('CREATE TABLE "public"."aux_probeta" (id varchar(36) primary key)');
        expect(await tableExists('aux_probeta')).toBe(true);

        await resetTestDatabase(connection);

        expect(await tableExists('aux_probeta')).toBe(false);
    });

    test('elimina una tabla creada por el test aunque este vacia', async () => {
        // Una tabla creada y nunca escrita ocupa cero bytes, igual que una
        // tabla limpia: la deteccion de extras no puede depender de la senal
        // de suciedad, sino de que el nombre no este en el manifiesto.
        await connection.raw('CREATE TABLE "public"."aux_vacia" (id varchar(36) primary key)');

        await resetTestDatabase(connection);

        expect(await tableExists('aux_vacia')).toBe(false);
    });

    test('no destruye las tablas de knex', async () => {
        await resetTestDatabase(connection);

        const { rows } = await connection.raw('select count(*)::int as count from "public"."knex_migrations"');
        expect(rows[0].count).toBeGreaterThan(0);
    });

    test('no trunca knex_migrations aunque el test la escriba', async () => {
        // El test de arriba nunca la toca, asi que solo confirma que el conteo
        // sigue positivo cuando nadie la ensucio -algo que nunca estuvo en
        // duda. Esta la ensucia de verdad: un UPDATE ... SET name = name deja
        // una version nueva de la fila igual que cualquier otro UPDATE, y eso
        // basta para meterla en `dirty` si no estuviera excluida
        // explicitamente por ser protegida.
        const original = await countRows('knex_migrations');
        expect(original).toBeGreaterThan(0);

        await connection.raw(
            `UPDATE "public"."knex_migrations" SET name = name WHERE id = (select min(id) from "public"."knex_migrations")`
        );

        await resetTestDatabase(connection);

        expect(await countRows('knex_migrations')).toBe(original);
    });

    test('deja la base identica a la plantilla tras un ciclo completo', async () => {
        await connection('banners').insert({ id: '22222222-2222-2222-2222-222222222222', descripcion: 'dos' });
        await connection.raw(`UPDATE "public"."usuarios" SET updated_at = now()`);
        await connection.raw('CREATE TABLE "public"."aux_temporal" (id varchar(36) primary key)');

        await resetTestDatabase(connection);

        expect(await snapshotRowCounts()).toEqual(baseline);
    });

    test('el camino rapido sobrevive a un test sucio anterior en el mismo archivo', async () => {
        // Ensuciar primero, para que la llamada de abajo tome el camino lento
        // y el escenario pruebe que el rapido de despues no arrastra nada.
        await connection('banners').insert({ id: '33333333-3333-3333-3333-333333333333', descripcion: 'sucia' });
        await resetTestDatabase(connection);

        const { rows } = await connection.raw('select id from "public"."usuarios" order by id limit 1');
        const id = rows[0].id;
        const antes = await usuarioWriteWitness(id);

        // Un test que no escribe en ninguna tabla conocida, pero si crea una
        // tabla nueva: esa limpieza debe seguir ocurriendo pase lo que pase,
        // sea cual sea el camino que tome el resto del reset.
        await connection.raw('CREATE TABLE "public"."aux_camino_rapido" (id varchar(36) primary key)');

        await resetTestDatabase(connection);

        // La tabla extra se elimina siempre, tome el camino que tome el reset.
        expect(await tableExists('aux_camino_rapido')).toBe(false);

        // Pero usuarios no se debio tocar: mismo xmin que antes. Si el reset
        // viera las 22 sembradas como sucias en cada llamada, este TRUNCATE +
        // INSERT redundante habria dejado un xmin nuevo.
        expect(await usuarioWriteWitness(id)).toBe(antes);
    });

    test('repone una tabla sembrada que el test vacio con TRUNCATE', async () => {
        // TRUNCATE era el punto ciego de la senal basada en
        // `n_tup_ins + n_tup_upd + n_tup_del`: comprobado contra el servidor,
        // tras vaciar una tabla de 54 filas los tres contadores seguian
        // valiendo lo mismo, y hacia falta mirar ademas `pg_class.relfilenode`
        // para verlo. La huella de contenido que usa ahora el reset lo detecta
        // sin ayuda: vaciar la tabla la cambia como cualquier otra escritura.
        //
        // El caso esta vivo en la suite: 15 archivos truncan tablas sembradas,
        // y `tests/global-config/KnexGlobalConfigurationRepositoryFindByIdsIntegration.test.js`
        // lo hace en un `beforeEach` cuyo `it` no escribe nada.
        const original = await countRows('literales');
        expect(original).toBeGreaterThan(0);

        await connection.raw('TRUNCATE TABLE "public"."literales"');
        expect(await countRows('literales')).toBe(0);

        await resetTestDatabase(connection);

        expect(await countRows('literales')).toBe(original);
    });

    test('elimina la vista, la vista materializada y la secuencia que creo el test', async () => {
        await connection.raw('CREATE VIEW "public"."aux_vista" AS SELECT 1 AS id');
        await connection.raw('CREATE MATERIALIZED VIEW "public"."aux_matvista" AS SELECT 1 AS id');
        await connection.raw('CREATE SEQUENCE "public"."aux_secuencia"');

        await resetTestDatabase(connection);

        expect(await relationExists('v', 'aux_vista')).toBe(false);
        expect(await relationExists('m', 'aux_matvista')).toBe(false);
        expect(await relationExists('S', 'aux_secuencia')).toBe(false);
    });

    test('no destruye las vistas, vistas materializadas ni secuencias de la plantilla', async () => {
        // Esta es la regresion peligrosa: el manifiesto se construia leyendo
        // solo `pg_tables`, asi que no conocia ninguna de estas relaciones. Un
        // cierre ingenuo del hueco de arriba -"borra todo lo que no este en el
        // manifiesto"- se las llevaria por delante en el PRIMER reset, y con
        // ellas los tests del dashboard y los de `view_case_details`.
        await resetTestDatabase(connection);

        expect(await relationExists('v', 'view_case_details')).toBe(true);
        expect(await relationExists('v', 'view_casos')).toBe(true);
        expect(await relationExists('m', 'mv_dashboard_ans_counts')).toBe(true);
        expect(await relationExists('m', 'mv_dashboard_state_counts')).toBe(true);
        expect(await relationExists('m', 'mv_dashboard_group_counts')).toBe(true);
        expect(await relationExists('m', 'mv_dashboard_responsible_counts')).toBe(true);
        expect(await relationExists('S', 'casos_reference_seq')).toBe(true);
    });

    test('repone una vista de la plantilla que el test borro', async () => {
        // `tests/cases/application/CaseViewNameResolver.integration.test.js`,
        // `ViewCasesCounter.integration.test.js` y
        // `ViewCasesEntityCounter.integration.test.js` hacen DROP VIEW sobre
        // `view_case_details`, que es una vista REAL del esquema migrado. Sin
        // reposicion, el primero de esos tests deja rota la vista para todos
        // los que vienen detras en el mismo archivo.
        await connection.raw('DROP VIEW "public"."view_case_details"');
        expect(await relationExists('v', 'view_case_details')).toBe(false);

        await resetTestDatabase(connection);

        expect(await relationExists('v', 'view_case_details')).toBe(true);
        const { rows } = await connection.raw('select count(*)::int as count from "public"."view_case_details"');
        expect(rows[0].count).toBe(0);
    });

    test('detecta una escritura de otro backend aunque sus estadisticas no se hayan publicado', async () => {
        // REGRESION, baseline del 13-08-2026. Este es el escenario exacto que
        // se le escapaba a la senal anterior, y aqui se provoca a mano en vez
        // de esperar a que salga por azar bajo carga.
        //
        // Se retiene una conexion -B- para dos cosas: forzar que el reset use
        // otra, y poder dirigir escrituras a B a voluntad. Con la senal vieja
        // el reset leia `n_tup_ins + n_tup_upd + n_tup_del`, que cada backend
        // publica cuando queda inactivo Y ha pasado alrededor de un segundo
        // desde su ultimo volcado. Al escribir por B dentro de esa ventana, la
        // fila quedaba invisible para quien leyera desde otra conexion: `dirty`
        // salia vacio, el reset se saltaba el truncado y la fila sobrevivia al
        // test siguiente.
        const b = await connection.client.acquireConnection();

        try {
            // Una lectura basta para dejar estadisticas pendientes en B; al
            // quedar inactivo las publica y fija ahi su marca de ultimo
            // volcado.
            await connection.raw('select count(*) from "public"."banners"').connection(b);
            await new Promise((resolve) => setTimeout(resolve, 50));

            // La escritura llega dentro del segundo siguiente, asi que postgres
            // no la publica: se queda pendiente en B.
            await connection
                .raw(`insert into "public"."banners" (id, descripcion) values (?, 'fuga')`, [
                    '66666666-6666-6666-6666-666666666666',
                ])
                .connection(b);

            await resetTestDatabase(connection);

            expect(await countRows('banners')).toBe(0);
        } finally {
            connection.client.releaseConnection(b);
        }
    });

    test('detecta escrituras concurrentes repartidas en el pool compartido', async () => {
        // Las 5 escrituras van en paralelo, asi que pueden caer en cualquiera
        // de los hasta 5 backends del pool de buildWriterConfig -no hay forma
        // de forzar cual desde aca-. Con la senal anterior esto pasaba por
        // suerte; con la de ahora pasa por construccion, porque lo que se lee
        // es el estado de la base y no las estadisticas de un backend.
        await Promise.all(
            [0, 1, 2, 3, 4].map((i) =>
                connection('banners').insert({
                    id: `55555555-5555-5555-5555-55555555555${i}`,
                    descripcion: `concurrente-${i}`,
                })
            )
        );
        expect(await countRows('banners')).toBe(5);

        await resetTestDatabase(connection);

        expect(await countRows('banners')).toBe(0);
    });
});

/**
 * Conteo de filas de todas las tablas de `public`, para comparar el estado
 * completo antes y despues del ciclo.
 *
 * @returns {Promise<Record<string, number>>}
 */
const snapshotRowCounts = async () => {
    const { rows: tables } = await connection.raw(
        `select tablename from pg_tables where schemaname = 'public' order by tablename`
    );

    const counts = {};

    for (const { tablename } of tables) {
        const { rows } = await connection.raw(
            `select count(*)::int as count from ${quoteQualified('public', tablename)}`
        );
        counts[tablename] = rows[0].count;
    }

    return counts;
};
