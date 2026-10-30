import { quoteQualified } from './sqlIdentifier.js';
import { readTableManifest, SNAPSHOT_SCHEMA } from './seedSnapshot.js';

/**
 * INVARIANTE: lo consume `perFileDatabase.js` desde `setupFilesAfterEnv`. No
 * puede importar nada de `src/`, ni directa ni transitivamente, o cualquier
 * `jest.unstable_mockModule` del archivo de test quedaria inerte.
 * `setupModuleGraph.test.js` lo verifica.
 */

/**
 * El manifiesto no cambia durante la corrida y leerlo cuesta una consulta.
 * Se cachea por proceso; cada worker de jest tiene el suyo, y cada archivo de
 * test corre en un worker con una sola base, asi que no hay riesgo de servir
 * el manifiesto de una base a otra. `restoreOrder` viaja pegado al mismo
 * cache: ver `dependencyOrder` para el porque.
 *
 * Esta garantia depende por completo de que un worker nunca tenga dos bases
 * vivas a la vez. Si eso dejara de ser cierto -un worker reutilizado entre
 * archivos de test sin reiniciar el cache, por ejemplo- este modulo seguiria
 * usando el manifiesto y el `restoreOrder` de la primera base contra la
 * segunda: el DROP y el TRUNCATE correrian con nombres de tabla que pueden no
 * existir, existir con otra forma, o faltarles una FK que la otra base si
 * tiene.
 *
 * @type {{all: Set<string>, seeded: string[], restoreOrder: string[], protectedTables: Set<string>, views: Map<string, string>, matviews: Set<string>, sequences: Set<string>}|null}
 */
let manifestCache = null;

/**
 * Estado de la base tal como la deja la plantilla. Es la referencia contra la
 * que se decide que tablas estan sucias. `null` hasta la primera llamada.
 *
 * A diferencia de la foto movil que habia antes, esta referencia NO envejece:
 * se captura una vez -sobre el clon recien creado, o sea sobre la plantilla
 * misma- y no se vuelve a tomar, porque el reset devuelve la base exactamente a
 * ese estado. Eso ahorra la segunda pasada de lecturas que antes hacia falta
 * despues de cada TRUNCATE + INSERT.
 *
 * El estado de una tabla son dos senales, elegidas por una razon comun: las dos
 * son SINCRONAS y agnosticas de quien escribio.
 *
 * 1. `pg_relation_size` para las tablas que la plantilla deja vacias, que son
 *    casi todas. Valen cero bytes, y el primer INSERT las lleva a 8192 aunque
 *    el test borre luego la fila: la pagina ya esta asignada. Es un `stat` del
 *    fichero, no una estimacion, y cabe en la consulta al catalogo que
 *    `readRelations` ya hacia, asi que no cuesta un viaje mas.
 *
 * 2. Huella `md5` del contenido para las 22 sembradas, donde el tamano no
 *    distingue "tiene sus filas" de "las cambio". Serializa la fila entera, asi
 *    que detecta INSERT, UPDATE, DELETE y TRUNCATE por igual -que es lo que
 *    antes obligaba a combinar dos senales, una de ellas ciega a TRUNCATE-.
 *
 * ## Por que ya no se usa `pg_stat_user_tables`
 *
 * REGRESION, baseline del 13-08-2026: la senal anterior sumaba
 * `n_tup_ins + n_tup_upd + n_tup_del`, y esos contadores no los publica el
 * servidor al escribir, sino cada backend cuando queda inactivo Y ha pasado
 * `PGSTAT_MIN_INTERVAL` -alrededor de un segundo- desde su ultimo volcado.
 * `pg_stat_force_next_flush()` no lo arregla: solo afecta al backend que
 * ejecuta esa consulta, y knex lo toma del pool, no necesariamente el que
 * escribio. Con hasta cinco backends calientes por archivo, las escrituras del
 * test anterior podian ser invisibles aqui: `dirty` salia vacio, el reset se
 * saltaba el truncado y las filas sobrevivian al siguiente test. Costo un rojo
 * en `ChannelHubInboundEmailProcessor.test.js` que parecia un fallo de
 * idempotencia y no lo era. No reintroducir esa lectura como optimizacion.
 *
 * ## Limites conocidos
 *
 * - Una tabla vacia-en-plantilla en la que un test inserte, borre y ademas un
 *   autovacuum recorte sus paginas dentro del mismo test volveria a cero bytes.
 *   Quedaria su secuencia desplazada y nada mas; es estrictamente menos
 *   probable que la ventana de volcado que esto sustituye.
 * - Leer las huellas toma `AccessShareLock` sobre las sembradas. Si un test
 *   dejo una transaccion abierta con `AccessExclusiveLock` -el escenario de
 *   `tests/README.md` §3.2- el reset se bloqueara ahi en vez de en el TRUNCATE
 *   posterior: el mismo fallo, un paso antes.
 * - `t::text` depende del `DateStyle` y el `TimeZone` de la sesion. Un `SET`
 *   colgado en una conexion del pool solo puede producir un FALSO SUCIO, que
 *   fuerza el camino lento y es correcto; nunca un falso limpio.
 *
 * Vive con el mismo alcance que `manifestCache`: por proceso, y cada worker de
 * jest maneja una sola base a la vez. La dependencia de esa premisa es aqui mas
 * debil que antes, porque tanto el manifiesto como esta referencia son
 * funciones de la PLANTILLA y no del clon.
 *
 * @type {{sizes: Map<string, string>, checksums: Map<string, string>, checksummed: string[]}|null}
 */
let baseline = null;

/**
 * `relkind` de `pg_class` que el reset vigila. Ver `seedSnapshot.js`, que
 * registra exactamente los mismos en el manifiesto.
 */
const TABLE_KINDS = new Set(['r', 'p']);

const WATCHED_KINDS = ['r', 'p', 'v', 'm', 'S'];

/**
 * Ordena las tablas sembradas para que el bucle de reposicion inserte cada
 * tabla despues de las que referencia por clave foranea.
 *
 * TRUNCATE ... CASCADE no necesita este orden -postgres resuelve las
 * dependencias el mismo dentro de una sola sentencia-, pero el bucle de
 * INSERT si: cada `INSERT INTO x SELECT * FROM espejo.x` es una sentencia
 * propia, y ninguna de las FK de este esquema es DEFERRABLE, asi que postgres
 * la valida antes de que la sentencia siguiente reponga la tabla referenciada.
 * `aux_definitions` referencia a `schemas`; como el manifiesto ordena por
 * nombre, `aux_definitions` (a-) se reponia antes que `schemas` (s-) y el
 * INSERT reventaba con `aux_definitions_schema_id_foreign`. De ahi este
 * ordenamiento topologico, calculado una vez y cacheado junto al manifiesto.
 *
 * Ignora los autoreferenciados (`ws_rest_endpoints` se referencia a si misma):
 * todas sus filas se insertan en una unica sentencia, y postgres valida las FK
 * de una sentencia al final de esta, no fila a fila, asi que una tabla nunca
 * necesita ordenarse respecto de si misma.
 *
 * No hay ciclos entre tablas distintas en el esquema actual. Si en el futuro
 * apareciera uno, esta funcion no lo detecta, pero tampoco lo esconde: el
 * bucle externo visita cada tabla de `seeded` sin importar lo que haya hecho
 * el DFS de las demas, y el push post-orden no tiene condicion, asi que el
 * resultado siempre es una permutacion completa de `seeded` -nunca un orden
 * incompleto. Lo que produce un ciclo real es un orden que viola al menos una
 * FK, y el `INSERT INTO x SELECT * FROM espejo.x` correspondiente revienta
 * nombrando la restriccion exacta: ruidoso, no silencioso, y en ese sentido
 * mas seguro de lo que este comentario decia antes. Preferible a bloquear el
 * reset con un chequeo de ciclos que hoy no hace falta.
 *
 * @param {import('knex').Knex} connection
 * @param {string[]} seeded
 * @returns {Promise<string[]>}
 */
const dependencyOrder = async (connection, seeded) => {
    const seededSet = new Set(seeded);

    const { rows } = await connection.raw(
        `select c1.relname as tabla, c2.relname as referencia
         from pg_constraint con
         join pg_class c1 on c1.oid = con.conrelid
         join pg_class c2 on c2.oid = con.confrelid
         join pg_namespace n on n.oid = c1.relnamespace
         where con.contype = 'f' and n.nspname = 'public'`
    );

    const dependsOn = new Map(seeded.map((name) => [name, []]));

    for (const { tabla, referencia } of rows) {
        if (tabla !== referencia && seededSet.has(tabla) && seededSet.has(referencia)) {
            dependsOn.get(tabla).push(referencia);
        }
    }

    const ordered = [];
    const visited = new Set();

    const visit = (name) => {
        if (visited.has(name)) {
            return;
        }

        visited.add(name);

        for (const dependency of dependsOn.get(name)) {
            visit(dependency);
        }

        ordered.push(name);
    };

    for (const name of seeded) {
        visit(name);
    }

    return ordered;
};

/**
 * Huella del contenido de cada tabla indicada.
 *
 * `t::text` serializa la fila entera, asi que la huella cambia con cualquier
 * INSERT, UPDATE, DELETE o TRUNCATE. El `order by` la hace independiente del
 * orden fisico, que un TRUNCATE seguido de INSERT no conserva. Se lee dentro de
 * la instantanea MVCC de la propia consulta: no hay ninguna publicacion
 * asincrona de por medio, a diferencia de los contadores de
 * `pg_stat_user_tables` que esto sustituye.
 *
 * Va todo en una sentencia porque son 22 tablas de 135 filas en total: el coste
 * esta en los viajes, no en el `md5`.
 *
 * @param {import('knex').Knex} connection
 * @param {string[]} tables
 * @returns {Promise<Map<string, string>>}
 */
const readContentChecksums = async (connection, tables) => {
    if (tables.length === 0) {
        return new Map();
    }

    const sql = tables
        .map(
            (name) =>
                `select ?::text as tabla,
                        md5(coalesce(string_agg(t::text, chr(10) order by t::text), '')) as suma
                 from ${quoteQualified('public', name)} t`
        )
        .join(' union all ');

    const { rows } = await connection.raw(sql, tables);

    return new Map(rows.map((row) => [row.tabla, row.suma]));
};

/**
 * Lee de `pg_class` las relaciones de `public` que el reset vigila, con su
 * clase y su tamano en disco.
 *
 * Sustituye a la consulta contra `pg_tables` que habia antes: `pg_tables` es
 * una vista sobre este mismo `pg_class` filtrada por `relkind in ('r','p')`,
 * asi que preguntar por las cinco clases de golpe no anade ningun viaje al
 * servidor -unas nueve filas mas en el mismo resultado- y de paso trae el
 * tamano que la deteccion de suciedad necesita.
 *
 * `pg_relation_size` solo para `relkind = 'r'`: una tabla particionada no tiene
 * almacenamiento propio, y quien lleva la senal es cada particion, que es una
 * tabla ordinaria y esta en el manifiesto por derecho propio. Se devuelve como
 * texto porque `pg_relation_size` es `bigint` y el driver lo entrega asi;
 * comparar cadenas basta para lo que aqui se pregunta.
 *
 * @param {import('knex').Knex} connection
 * @returns {Promise<Array<{relname: string, relkind: string, bytes: string}>>}
 */
const readRelations = async (connection) => {
    const { rows } = await connection.raw(
        `select c.relname, c.relkind::text as relkind,
                (case when c.relkind = 'r' then pg_relation_size(c.oid) else 0 end)::text as bytes
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = any(?)`,
        [WATCHED_KINDS]
    );

    return rows;
};

/**
 * Tamano en disco por tabla. Solo entran las tablas del manifiesto que no estan
 * protegidas: las extras se eliminan enteras y las protegidas nunca se truncan,
 * asi que su estado no decide nada.
 *
 * @param {Array<{relname: string, relkind: string, bytes: string}>} relations
 * @param {{all: Set<string>, protectedTables: Set<string>}} manifest
 * @returns {Map<string, string>}
 */
const buildTableSizes = (relations, { all, protectedTables }) => {
    const sizes = new Map();

    for (const { relname, relkind, bytes } of relations) {
        if (TABLE_KINDS.has(relkind) && all.has(relname) && protectedTables.has(relname) === false) {
            sizes.set(relname, bytes);
        }
    }

    return sizes;
};

/**
 * Captura el estado de referencia sobre el clon recien creado, o sea sobre la
 * plantilla.
 *
 * `checksummed` son las tablas cuya suciedad se decide por contenido: las
 * sembradas, mas cualquiera que la plantilla deje con paginas ya asignadas
 * aunque este vacia, donde el tamano no distinguiria "tiene filas" de "las
 * tuvo". Del resto basta el tamano.
 *
 * @param {import('knex').Knex} connection
 * @param {{all: Set<string>, seeded: string[], protectedTables: Set<string>}} manifest
 * @returns {Promise<{sizes: Map<string, string>, checksums: Map<string, string>, checksummed: string[]}>}
 */
const captureBaseline = async (connection, manifest) => {
    const sizes = buildTableSizes(await readRelations(connection), manifest);

    const checksummed = [
        ...new Set([
            ...manifest.seeded,
            ...[...sizes.entries()].filter(([, bytes]) => bytes !== '0').map(([name]) => name),
        ]),
    ];

    return { sizes, checksummed, checksums: await readContentChecksums(connection, checksummed) };
};

/**
 * Elimina de `public` toda relacion que no figure en el manifiesto: la creo el
 * test.
 *
 * El orden importa. Las tablas van PRIMERO y con CASCADE, porque arrastran a
 * lo que dependa de ellas: la secuencia implicita de una columna `serial`, o
 * una vista construida sobre la tabla. Intentarlo al reves fallaria -postgres
 * rechaza un DROP SEQUENCE mientras una columna la use como valor por
 * defecto-, y hacerlo en este orden convierte a las tres sentencias
 * siguientes en `IF EXISTS` que a menudo no encuentran nada que borrar.
 *
 * El CASCADE de cualquiera de las cuatro sentencias no puede llevarse por
 * delante un objeto de la plantilla: para que lo hiciera, el objeto de la
 * plantilla tendria que depender de uno creado por el test, y el de la
 * plantilla ya existia antes de que el test arrancara.
 *
 * @param {import('knex').Knex} connection
 * @param {Array<{relname: string, relkind: string}>} relations
 * @param {{all: Set<string>, views: Map<string, string>, matviews: Set<string>, sequences: Set<string>}} manifest
 * @returns {Promise<void>}
 */
const dropExtraRelations = async (connection, relations, { all, views, matviews, sequences }) => {
    const known = { r: all, p: all, v: views, m: matviews, S: sequences };
    const extra = { r: [], p: [], v: [], m: [], S: [] };

    for (const { relname, relkind } of relations) {
        if (known[relkind].has(relname) === false) {
            extra[relkind].push(relname);
        }
    }

    const drop = async (statement, names) => {
        if (names.length > 0) {
            const quoted = names.map((name) => quoteQualified('public', name)).join(', ');
            await connection.raw(`${statement} ${quoted} CASCADE`);
        }
    };

    // Una tabla particionada y sus particiones se eliminan en la misma
    // sentencia: DROP TABLE ... CASCADE resuelve la dependencia entre ellas
    // sea cual sea el orden en que aparezcan en la lista.
    await drop('DROP TABLE IF EXISTS', [...extra.r, ...extra.p]);
    await drop('DROP VIEW IF EXISTS', extra.v);
    await drop('DROP MATERIALIZED VIEW IF EXISTS', extra.m);
    await drop('DROP SEQUENCE IF EXISTS', extra.S);
};

/**
 * Vuelve a crear las vistas de la plantilla que ya no estan.
 *
 * Hay tests que hacen `DROP VIEW IF EXISTS view_case_details` sobre la vista
 * REAL del esquema migrado -`CaseViewNameResolver.integration.test.js`,
 * `ViewCasesCounter.integration.test.js`, `ViewCasesEntityCounter.integration.test.js`-
 * y sin esto la vista se quedaba borrada para todos los tests que vinieran
 * detras en el mismo archivo.
 *
 * La definicion sale del manifiesto, o sea de un `pg_get_viewdef` hecho sobre
 * la plantilla en `globalSetup`: es texto del catalogo de postgres, no entrada
 * del test, y por eso se interpola. El nombre, que si podria venir de
 * cualquier sitio, se cita con `quoteQualified`.
 *
 * Si alguna vez una vista de la plantilla dependiera de otra, este bucle
 * tendria que reponerlas en orden topologico; hoy ninguna de las dos depende
 * de la otra -se comprobo contra `pg_depend`-, y si eso cambiara el CREATE
 * VIEW fallaria nombrando la relacion que falta, que es un fallo ruidoso y no
 * uno silencioso.
 *
 * @param {import('knex').Knex} connection
 * @param {Array<{relname: string, relkind: string}>} relations
 * @param {Map<string, string>} views
 * @returns {Promise<void>}
 */
const restoreMissingViews = async (connection, relations, views) => {
    const present = new Set(relations.filter(({ relkind }) => relkind === 'v').map(({ relname }) => relname));

    for (const [name, definition] of views) {
        if (present.has(name) === false) {
            await connection.raw(`CREATE VIEW ${quoteQualified('public', name)} AS ${definition}`);
        }
    }
};

/**
 * Devuelve la base al estado exacto de la plantilla.
 *
 * 1. Lee en paralelo el catalogo de relaciones de `public` -con el tamano de
 *    cada tabla- y las huellas de contenido de las tablas sembradas.
 * 2. Elimina lo que no viene en el manifiesto -tablas, vistas, vistas
 *    materializadas y secuencias-: lo creo el test.
 * 3. Repone las vistas de la plantilla que el test borro.
 * 4. Compara el estado de cada tabla (tamano, o huella si es sembrada) contra
 *    el de la plantilla: lo que difiera esta sucio. Las protegidas (`knex_*`)
 *    nunca entran.
 * 5. Si nada difiere, termina. Es el camino rapido de los tests unitarios.
 * 6. Trunca las sucias mas TODAS las sembradas, con CASCADE.
 * 7. Repone las sembradas desde el espejo.
 *
 * No hay octavo paso. La referencia es el estado de la plantilla, y el paso 7
 * acaba de devolver la base justo a el, asi que sigue siendo valida sin
 * refotografiar nada -que es lo que antes costaba una segunda ronda de lecturas
 * al final de cada pasada sucia-.
 *
 * ## Que NO deshace este reset
 *
 * Lo que se limpia son relaciones enteras. Lo que queda fuera, y por que:
 *
 * - Indices, tipos (`CREATE TYPE`), funciones y esquemas creados por un test.
 *   Los indices no salen gratis pese a vivir en el mismo `pg_class`: son 338
 *   en la plantilla -mas que todas las demas relaciones juntas- y los que
 *   respaldan una restriccion no se pueden eliminar con DROP INDEX, hay que ir
 *   por `ALTER TABLE ... DROP CONSTRAINT`, asi que el algoritmo dejaria de ser
 *   "sobra, fuera". Tipos, funciones y esquemas viven en catalogos distintos
 *   (`pg_type`, `pg_proc`, `pg_namespace`) y costarian una consulta cada uno
 *   en CADA reset. Hoy ningun test de la suite crea nada de eso; si alguno
 *   empieza a hacerlo, este es el sitio donde anadirlo.
 * - Columnas anadidas a una tabla real y restricciones eliminadas de una tabla
 *   real. Detectarlas exige comparar el esquema COMPLETO contra el de la
 *   plantilla, columna a columna y restriccion a restriccion; eso es otro
 *   diseno, no una ampliacion de este.
 * - Una vista materializada o una secuencia de la plantilla que el test borre.
 *   Se protegen de que las borre el reset, pero no se reponen: reponer una
 *   matvista pide ademas recrear sus indices unicos y refrescarla, y una
 *   secuencia pide restaurar su valor actual y su pertenencia a la columna que
 *   la usa. Ningun test de la suite las borra; las vistas si, y por eso son
 *   las unicas que se reponen.
 * - Una vista de la plantilla que el test REEMPLACE por otra con el mismo
 *   nombre. La reposicion mira si la vista falta, no si su definicion cambio:
 *   comparar definiciones costaria un `pg_get_viewdef` por vista en cada
 *   reset. Los tres archivos que hoy sustituyen `view_case_details` por una
 *   version propia lo hacen en su `beforeEach` -que corre despues de este-,
 *   asi que ninguno depende de esa comparacion.
 *
 * El paso 6 incluye siempre las sembradas porque `TRUNCATE ... CASCADE` vacia
 * tambien las tablas que referencian a la truncada, y esas pueden no figurar
 * entre las sucias. Reponer las 135 filas completas cuesta menos que calcular
 * el cierre transitivo de las claves foraneas, y no admite error. Acotar el
 * TRUNCATE a esa clausura -ya con `pg_constraint` parseado para el orden de
 * insercion, calcularla no seria mucho mas trabajo- es una optimizacion real
 * pero pendiente: cambia "no puede salir mal" por "mas rapido", y esa apuesta
 * hay que hacerla con el costo medido de la tarea 7 en la mano, no antes.
 *
 * La deteccion no depende de por que conexion se hizo la escritura, ni de
 * cuando el servidor la publique: las dos senales -tamano en disco y huella de
 * contenido- se leen del estado real de la base. Eso cubre tambien las
 * escrituras hechas por pools ajenos a la instancia compartida, que son la
 * norma en los archivos `*ReadRouting.test.js`. Ver `baseline` para la
 * regresion que costo llegar hasta aqui.
 *
 * @param {import('knex').Knex} connection
 * @returns {Promise<void>}
 */
export const resetTestDatabase = async (connection) => {
    if (manifestCache === null) {
        const manifest = await readTableManifest(connection);
        manifestCache = {
            all: manifest.all,
            seeded: manifest.seeded,
            protectedTables: new Set(manifest.protectedTables),
            views: manifest.views,
            matviews: manifest.matviews,
            sequences: manifest.sequences,
            restoreOrder: await dependencyOrder(connection, manifest.seeded),
        };
    }

    const { seeded, restoreOrder, views } = manifestCache;

    if (baseline === null) {
        // Primera llamada de este worker. Corre siempre sobre el clon que
        // `perFileDatabase.js` acaba de crear, asi que la base esta en el
        // estado de la plantilla y ese estado ES la referencia.
        baseline = await captureBaseline(connection, manifestCache);
    }

    const [relations, checksums] = await Promise.all([
        readRelations(connection),
        readContentChecksums(connection, baseline.checksummed),
    ]);

    await dropExtraRelations(connection, relations, manifestCache);
    await restoreMissingViews(connection, relations, views);

    // Las extras ya se eliminaron arriba, y `buildTableSizes` deja fuera tanto
    // a esas como a las protegidas: truncar una tabla que acaba de desaparecer
    // reventaria, y una protegida no se trunca nunca. Sin ese descarte, un
    // UPDATE contra knex_migrations la metia en `dirty`, el TRUNCATE la
    // vaciaba, y como el bucle de reposicion solo itera `seeded` -las
    // protegidas nunca lo son- se quedaba vacia para siempre: la proteccion
    // dependia de que nadie las tocara, no de una regla.
    const sizes = buildTableSizes(relations, manifestCache);
    const byContent = new Set(baseline.checksummed);

    const dirty = [
        ...[...sizes.entries()]
            .filter(([name, bytes]) => byContent.has(name) === false && bytes !== baseline.sizes.get(name))
            .map(([name]) => name),
        ...[...checksums.entries()]
            .filter(([name, suma]) => suma !== baseline.checksums.get(name))
            .map(([name]) => name),
    ];

    if (dirty.length === 0) {
        return;
    }

    const toTruncate = [...new Set([...dirty, ...seeded])];

    await connection.raw(
        `TRUNCATE TABLE ${toTruncate.map((name) => quoteQualified('public', name)).join(', ')}
         RESTART IDENTITY CASCADE`
    );

    for (const table of restoreOrder) {
        await connection.raw(
            `INSERT INTO ${quoteQualified('public', table)}
             SELECT * FROM ${quoteQualified(SNAPSHOT_SCHEMA, table)}`
        );
    }
};
