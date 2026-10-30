import { quoteIdentifier, quoteQualified } from './sqlIdentifier.js';

/**
 * INVARIANTE: este modulo lo consume `globalSetup`, que jest carga con el
 * resolver ESM nativo de Node. No puede importar nada de `src/`, cuyos imports
 * sin extension ese resolver no tolera.
 */

export const SNAPSHOT_SCHEMA = 'seed_snapshot';

/**
 * Version del FORMATO del espejo, no de su contenido.
 *
 * `globalSetup` reutiliza la plantilla si ya existe una base con el nombre que
 * sale del fingerprint, y ese fingerprint solo mezcla migraciones y permisos:
 * un cambio en la forma del manifiesto no lo mueve. Sin esta constante metida
 * en la mezcla (ver `templateDatabase.js`), una plantilla construida con el
 * formato anterior sobreviviria al cambio y el reset leeria un manifiesto que
 * no conoce las vistas ni las secuencias: las tomaria por objetos creados por
 * el test y las borraria en el primer reset. Subir este numero al cambiar la
 * forma del espejo fuerza la reconstruccion.
 *
 * @type {string}
 */
export const SNAPSHOT_FORMAT = 'snapshot-v2-relations';

const MANIFEST_TABLE = '__table_manifest';

const PROTECTED_PREFIX = 'knex_';

/**
 * `relkind` de `pg_class` para las clases de relacion que el espejo registra.
 * 'r' tabla ordinaria, 'p' tabla particionada (las particiones son 'r' aparte),
 * 'v' vista, 'm' vista materializada, 'S' secuencia.
 *
 * Se consulta `pg_class` y no `pg_tables`/`pg_views`/`pg_matviews`/
 * `pg_sequences` porque las cuatro clases salen de una sola consulta, y porque
 * el reset necesita ademas el `oid` de cada relacion -para pedir su
 * `pg_relation_size`-, que esas vistas del catalogo no exponen.
 */
const TABLE_KINDS = ['r', 'p'];

const RELATION_KINDS = [...TABLE_KINDS, 'v', 'm', 'S'];

/**
 * Papel en el manifiesto de cada clase de relacion que no es tabla.
 */
const ROLE_BY_KIND = { v: 'view', m: 'matview', S: 'sequence' };

/**
 * Construye el esquema espejo dentro de la base indicada: un manifiesto con
 * todas las tablas de `public` y su papel, mas una copia de las filas de las
 * tablas sembradas.
 *
 * Se ejecuta una sola vez, sobre la plantilla, en `globalSetup`. Cada clon lo
 * hereda sin coste porque `CREATE DATABASE ... TEMPLATE` copia el fichero
 * entero.
 *
 * Es idempotente: elimina el esquema antes de reconstruirlo.
 *
 * Deliberadamente no lleva try/catch propio. Si una query intermedia falla,
 * el esquema queda a medio construir, pero eso es inofensivo: el DROP SCHEMA
 * IF EXISTS del inicio hace que la proxima llamada lo reconstruya entero, sin
 * rastro del intento fallido. Deshacer una plantilla que fallo a medio
 * construir es responsabilidad de quien llama, no de esta funcion: hoy es
 * `globalSetup` (ver templateDatabase.js), que ya envuelve esta llamada en el
 * try/catch que borra la plantilla completa si algo falla. Si en algun
 * momento se llama a `buildSeedSnapshot` desde un sitio sin una guarda
 * equivalente, esa guarda debe vivir ahi, no aqui.
 *
 * Registra ADEMAS de las tablas las vistas, vistas materializadas y secuencias
 * de `public`. No se copian sus datos -una vista no tiene, y una secuencia se
 * recrea con la tabla que la posee-, pero el reset necesita saber que existen:
 * sin ellas en el manifiesto tomaria por "creado por el test" a
 * `view_case_details`, `view_casos` y las cuatro `mv_dashboard_*`, y las
 * borraria en el primer reset. De las vistas se guarda tambien la definicion,
 * porque hay tests que las borran y el reset las repone.
 *
 * @param {import('knex').Knex} connection
 * @param {string} [schema] nombre del esquema espejo, parametrizable para los tests
 * @returns {Promise<{total: number, seeded: number, relations: number}>}
 */
export const buildSeedSnapshot = async (connection, schema = SNAPSHOT_SCHEMA) => {
    const quotedSchema = quoteIdentifier(schema);

    await connection.raw(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
    await connection.raw(`CREATE SCHEMA ${quotedSchema}`);
    await connection.raw(
        `CREATE TABLE ${quotedSchema}.${quoteIdentifier(MANIFEST_TABLE)} (
            tablename text PRIMARY KEY,
            role text NOT NULL,
            definition text
        )`
    );

    // `pg_get_viewdef` solo se pide para las vistas: para una tabla devolveria
    // un error, y para una vista materializada la definicion sola no basta
    // para reponerla (haria falta ademas recrear sus indices unicos y
    // refrescarla), asi que no se guarda lo que no se va a usar.
    const { rows: relations } = await connection.raw(
        `select c.relname, c.relkind::text as relkind,
                case when c.relkind = 'v' then pg_get_viewdef(c.oid) end as definition
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = any(?)
         order by c.relname`,
        [RELATION_KINDS]
    );

    let tableCount = 0;
    let seededCount = 0;

    for (const { relname, relkind, definition } of relations) {
        if (TABLE_KINDS.includes(relkind) === false) {
            await connection(`${schema}.${MANIFEST_TABLE}`).insert({
                tablename: relname,
                role: ROLE_BY_KIND[relkind],
                definition,
            });
            continue;
        }

        tableCount += 1;
        const role = await classifyTable(connection, relname);

        if (role === 'seeded') {
            await connection.raw(
                `CREATE TABLE ${quotedSchema}.${quoteIdentifier(relname)} AS
                 SELECT * FROM ${quoteQualified('public', relname)}`
            );
            seededCount += 1;
        }

        await connection(`${schema}.${MANIFEST_TABLE}`).insert({ tablename: relname, role, definition: null });
    }

    return { total: tableCount, seeded: seededCount, relations: relations.length - tableCount };
};

/**
 * @param {import('knex').Knex} connection
 * @param {string} tablename
 * @returns {Promise<'protected'|'seeded'|'plain'>}
 */
const classifyTable = async (connection, tablename) => {
    if (tablename.startsWith(PROTECTED_PREFIX)) {
        return 'protected';
    }

    const { rows } = await connection.raw(`select count(*)::int as count from ${quoteQualified('public', tablename)}`);

    return rows[0].count > 0 ? 'seeded' : 'plain';
};

/**
 * Lee el manifiesto. El resultado se cachea en el llamador, no aqui: este
 * modulo no guarda estado para que los tests puedan reconstruir el espejo.
 *
 * `all` sigue siendo SOLO tablas: es el conjunto contra el que el reset decide
 * que tabla sobra, y las vistas y secuencias se comparan por separado porque
 * se eliminan con sentencias distintas. Los nombres no pueden colisionar entre
 * conjuntos -tablas, vistas, matvistas y secuencias comparten el espacio de
 * nombres de `pg_class`-, asi que la particion es limpia.
 *
 * Seleccionar `definition` de forma explicita tiene un efecto buscado: contra
 * una plantilla construida con el formato anterior la columna no existe y esta
 * consulta revienta nombrandola, en vez de devolver un manifiesto sin vistas
 * con el que el reset borraria `view_case_details` y las `mv_dashboard_*`.
 * Es una red por si algun dia se cambia la forma del espejo sin subir
 * `SNAPSHOT_FORMAT`.
 *
 * @param {import('knex').Knex} connection
 * @param {string} [schema]
 * @returns {Promise<{all: Set<string>, seeded: string[], protectedTables: string[], views: Map<string, string>, matviews: Set<string>, sequences: Set<string>}>}
 */
export const readTableManifest = async (connection, schema = SNAPSHOT_SCHEMA) => {
    const rows = await connection(`${schema}.${MANIFEST_TABLE}`)
        .select('tablename', 'role', 'definition')
        .orderBy('tablename');

    const withRole = (role) => rows.filter((row) => row.role === role).map((row) => row.tablename);

    return {
        all: new Set([...withRole('protected'), ...withRole('seeded'), ...withRole('plain')]),
        seeded: withRole('seeded'),
        protectedTables: withRole('protected'),
        views: new Map(rows.filter((row) => row.role === 'view').map((row) => [row.tablename, row.definition])),
        matviews: new Set(withRole('matview')),
        sequences: new Set(withRole('sequence')),
    };
};
