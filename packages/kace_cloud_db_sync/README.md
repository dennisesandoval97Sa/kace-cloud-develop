# @kace/db-sync

Sincroniza una lista configurable de tablas desde una base PostgreSQL fuente hacia
una destino. Cada fila se **inserta si no existe** o se **actualiza si ya existe**,
usando la primary key de la tabla como clave de conflicto.

Pensado para dos instancias PostgreSQL en cuentas AWS distintas, alcanzables hoy sólo
vía túneles SSH a bastiones. Tablas de miles de filas, sync diario.

## Qué NO hace

-   **No borra**. Las filas que existen en destino pero ya no en la fuente se quedan.
-   **No modifica esquemas**. Si una columna existe en la fuente y no en el destino,
    se ignora y se reporta.
-   **No pisa columnas que sólo existen en el destino**. El `UPDATE` sólo menciona las
    columnas sincronizadas, así que una columna propia del destino conserva su valor en
    vez de quedar en NULL. Verificado.
-   **No ordena tablas**. Si hay foreign keys, lista los padres antes que los hijos.

## El orden de las tablas: cómo calcularlo

El script sincroniza en el orden del array y no ordena solo, así que un hijo antes que su padre
falla con `violates foreign key constraint`. **No lo deduzcas a mano**: en el esquema de KACE,
sincronizar `cases` arrastra 21 tablas por dependencias transitivas — `usuarios` necesita `roles`,
`grupos` necesita `shift_management`, `clasificaciones` necesita `flujos`. Es fácil creer que la
lista está completa y descubrir lo contrario en la primera corrida.

Genera el orden desde el catálogo del **origen**, sustituyendo el schema y las tablas que quieras:

```sql
WITH RECURSIVE quiero(t) AS (
    VALUES ('cases'), ('comentarios'), ('usuarios')          -- <-- tus tablas
),
cierre AS (
    SELECT t::regclass AS oid FROM quiero
    UNION
    SELECT con.confrelid
    FROM cierre c
    JOIN pg_constraint con ON con.conrelid = c.oid AND con.contype = 'f'
)
SELECT DISTINCT oid::regclass::text AS tabla FROM cierre;
```

Eso te da el conjunto completo (padres incluidos). Para el orden, haz un topológico sobre las FKs
entre esas tablas.

`tables.config.example.json` trae **las 136 tablas sincronizables del esquema**, en orden topológico
y verificado contra el esquema real de KACE: **134 de 136 sincronizan**. Las 2 restantes no son un
problema de configuración — ver "UNIQUE secundarios" abajo. De las 204 relaciones del esquema quedan
fuera, a propósito:

-   **66 particiones hijas** de `event_logs`, `history_cases`, `history_aux_cases`, `history_usuarios`
    y `ws_rest_flow_executions`. Se sincroniza la **tabla padre**; Postgres enruta cada fila a su
    partición. Listar las hijas duplicaría el trabajo.
-   **`knex_migrations` y `knex_migrations_lock`**: el estado de migraciones de cada base es suyo.
    Copiarlo haría creer al destino que corrió migraciones que no corrió.

Ninguna tabla del esquema carece de primary key, así que todas las demás son sincronizables.

Recorta la lista a lo que necesites: sincronizar las 136 rara vez es lo que quieres.

## Trampas conocidas

**Filtrar un padre obliga a filtrar sus hijos.** Si recortas `cases` a 90 días pero no `comentarios`,
los comentarios de casos viejos violan la FK — y `cases` tiene **21 tablas hijas**. Por eso el ejemplo
sólo filtra las 7 hojas append-only pesadas (`event_logs`, `history_*`, `ws_rest_flow_executions`):
tienen **cero hijos**, así que recortarlas por fecha no rompe nada, y son justo donde el filtro rinde.

Si necesitas filtrar un padre, repite el predicado en cada hijo con una subconsulta:

```json
{
    "name": "comentarios",
    "where": "caso_id IN (SELECT id FROM asistencia.cases WHERE created_at >= NOW() - INTERVAL '90 days')"
}
```

Ojo: la subconsulta corre contra la **fuente**, así que califica el schema con el nombre del origen.

**UNIQUE secundarios pueden bloquear el sync.** El upsert resuelve conflictos por primary key. Si el
destino tiene una fila con **otra** PK pero el mismo valor en un `UNIQUE` distinto (p. ej.
`cases.reference`), el insert falla con `duplicate key value violates unique constraint`. No es un
bug: son datos divergentes que la herramienta no puede resolver sola, y falla ruidosamente en vez de
corromper. Reproducido con `casos_reference_unique`.

Es lo que explica las 2 tablas que fallan al validar el ejemplo: `cases` choca contra ese `UNIQUE`
entre dos schemas de prueba con UUIDs distintos, y `action_job_processing` cae **en cascada** porque
su FK apunta a un caso que nunca llegó a insertarse. Un fallo de tabla arrastra a sus hijos: el orden
era correcto, faltaban los datos.

**FK auto-referenciales.** `cases.caso_clonado_id` y `clients.padre_id` apuntan a su propia tabla y
**no son DEFERRABLE**. Las filas se insertan en orden de PK ascendente, así que una fila que apunte a
un padre con id _mayor_ falla. En la práctica un caso clonado apunta al original, que es anterior,
pero no está garantizado. Verificado.

## Locks en el destino

Cada tabla se sincroniza dentro de **una sola transacción**, que permanece abierta mientras se
lee la tabla completa de la fuente. Las filas ya escritas quedan bloqueadas hasta que la tabla
termina: un `SELECT ... FOR UPDATE` concurrente sobre una fila escrita al principio esperará
hasta el final del sync de esa tabla. Verificado.

Es el precio de que un fallo a mitad no deje la tabla a medio sincronizar. Con tablas de miles
de filas es cuestión de segundos, pero tenlo en cuenta antes de programar el sync contra una
tabla con escritores concurrentes activos.

## Uso local

Las bases están en cuentas AWS distintas y se alcanzan vía bastión. Abre un túnel
por lado antes de correr el script:

```bash
ssh -N -L 5433:<host-rds-sura>:5432 bastion-sura
ssh -N -L 5434:<host-rds-staging>:5432 bastion-staging
```

Configura las credenciales en el `.env` de la **raíz del monorepo** (donde ya viven las demás
variables de base de datos):

```bash
DB_SYNC_SOURCE_HOST=localhost
DB_SYNC_SOURCE_PORT=5433
DB_SYNC_SOURCE_USER=...
DB_SYNC_SOURCE_PASSWORD=...
DB_SYNC_TARGET_HOST=localhost
DB_SYNC_TARGET_PORT=5434
DB_SYNC_TARGET_USER=...
DB_SYNC_TARGET_PASSWORD=...
```

Copia el ejemplo, edita tu lista de tablas y corre:

```bash
cd packages/kace_cloud_db_sync
cp tables.config.example.json tables.config.json
pnpm run sync                              # usa tables.config.json
pnpm run sync -- --config otra-lista.json  # o el archivo que quieras
```

Exit code 0 si todas las tablas sincronizaron; 1 si alguna falló.

## Configuración

| Campo                               | Obligatorio | Descripción                                          |
| ----------------------------------- | ----------- | ---------------------------------------------------- |
| `source.database` / `source.schema` | Sí          | Origen de los datos.                                 |
| `target.database` / `target.schema` | Sí          | Destino.                                             |
| `batchSize`                         | No (500)    | Filas por página de lectura y por lote de escritura. |
| `tables[].name`                     | Sí          | Nombre de la tabla en la fuente.                     |
| `tables[].targetName`               | No          | Nombre en destino, si difiere.                       |
| `tables[].where`                    | No          | Recorte de filas.                                    |

### Advertencia sobre `where`

`where` se inyecta **tal cual** en el `SELECT` de la fuente. Es configuración
privilegiada del operador: no debe construirse nunca con datos que vengan de un
usuario final ni de una fuente externa. Los nombres de schema y tabla sí se validan
contra `/^[a-zA-Z_][a-zA-Z0-9_-]*$/` y todos los valores de las filas viajan como
bindings parametrizados.

El guion está permitido porque tablas reales lo usan (`one-script`) y no puede escapar de las
comillas dobles con que se citan los identificadores — sólo un `"` podría, y el patrón lo rechaza.

## Permisos requeridos

El usuario de la fuente necesita `SELECT` sobre cada tabla listada; el de destino, `SELECT` + `INSERT` + `UPDATE`.

**Si falta el `GRANT SELECT`, el error dice `Relation "x"."y" does not exist` aunque la tabla exista.**
No es un bug: `information_schema.columns` filtra por privilegios, así que una tabla sin permiso
de lectura es indistinguible de una inexistente desde ahí. Antes de perseguir un typo o una
migración faltante, verifica los grants:

```sql
SELECT has_table_privilege('<usuario>', '<schema>.<tabla>', 'SELECT');
```

## Tests

Requiere las variables `DB_TEST_*` del `.env` de la raíz (las mismas que usa `@kace/core`).
Los tests crean y destruyen sus propios schemas en esa base.

```bash
cd packages/kace_cloud_db_sync
pnpm run tests
```

`bin/sync.js` y `src/shared/logger.js` **no aparecen en el reporte de cobertura**: el test del
CLI lanza el binario como subproceso real —única forma honesta de verificar el exit code— y Jest
sólo instrumenta lo que carga en su propio proceso. El 100% que ves es de `src/`, sin contar esos
dos archivos. Su verificación es de comportamiento: exit codes y contenido exacto de stdout/stderr.

## Fase 2: Lambda

El diseño contempla correr esto en una Lambda con EventBridge Scheduler cuando
exista camino de red entre cuentas. `TableSyncService` no cambia: se agrega un
`SecretsConfigProvider` junto a `env-config-provider.js` y un handler que lo invoca.
