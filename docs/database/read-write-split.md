# Read/Write Split por servicio — Guía para el equipo

> La **cobertura de clasificación es completa** (100 serviceKeys con BD tenant, ver §4.1).
> Este documento es la referencia viva para **migrar nuevos servicios** al replica.

---

## 1. Por qué existe esto

El writer de Aurora estaba al ~96 % CPU. Ya pagábamos un **reader endpoint** (RDS Proxy `READ_ONLY`
Aurora reader) prácticamente ocioso. El read/write split descarga las **lecturas de servicios
no críticos** al replica sin tocar la lógica de queries: solo se cambia de qué pool sale el `SELECT`.

## 2. El modelo (semántica)

| Concepto | Regla |
|---|---|
| Servicio **prioritario** | lectura **y** escritura van a la **primaria** (writer). |
| Servicio **NO prioritario** | lectura → **replica**; escritura → **primaria**. |
| **Read-after-write** | tras una escritura en la misma petición/job, las lecturas siguientes vuelven al writer (lectura monotónica). |
| **Fail-safe = primary** | servicio sin clasificar, tenant sin `db_host_reader`, o config pasada como instancia ⇒ writer. |
| **Reuso de pool** | si `reader host == writer host` ⇒ un solo pool (no se abre un segundo). |

El endpoint RO **rechaza escrituras** (falla temprano y ruidoso): una escritura mal enrutada
revienta en vez de corromper datos silenciosamente.

## 3. La cadena de enrutamiento (end-to-end)

```
serviceDbRouting.js (runtime)  ──┐  fuente de verdad: { reports: { priority:false }, ... }
dbRoutingEnv.ts   (CDK mirror) ──┘  espejo CommonJS (drift-guard test los mantiene en sync)
        │
        ▼  en deploy / synth
KApiStack.setDefaultOptions('<serviceKey>')
        └─ lambdaFunction.addEnvironment('DB_TARGET', getDbTarget(id))   // 'primary' | 'replica'
        │
        ▼  en cada invocación
withTenantContext (api-common)
        ├─ preferReplica = process.env.DB_TARGET === 'replica'
        ├─ knexConfig   = Tenant.buildKnexConfig({ preferReplica })            // writer config
        ├─ readerConfig = Tenant.buildReaderConfig({ preferReplica })          // reader (role:'reader')
        ├─ event.tenantContext = { tenant, knexConfig, readerConfig, preferReplica, tenant_id }
        └─ DbRequestContext.run(() => handler(event))   // alcance del write-flag por petición
        │
        ▼  en el Controller
new MiRepositorio(knexConfig, readerConfig)   // ⚠️ CONFIG objects, NO this.database_connection
        │
        ▼  en el Repositorio (extiende KnexRepository)
this.read.table('mi_view').select(...)   // lectura auditada → replica (con read-after-write)
this.writer(...) / this.connection(...)  // escrituras y transacciones → primaria SIEMPRE
```

## 4. Componentes y contratos (con referencias de código)

### 4.1 Registro central — `serviceDbRouting.js`
`packages/kace_cloud_api_common/src/db-routing/serviceDbRouting.js`

```js
export const SERVICE_DB_ROUTING = {
    // priority:false  → lecturas a réplica, escrituras a primaria
    'cases-count': { priority: false },   // Oleada 3 (piloto)
    reports:       { priority: false },   // Oleada 4
    // ...ver el archivo completo: es la FUENTE DE VERDAD, no lo dupliques aquí
    // priority:true   → lectura y escritura a la primaria
    cases:         { priority: true  },
};
export const getDbTarget = (serviceKey) => /* 'replica' si priority:false, si no 'primary' */;
export const resolveDbTargetEnv = (serviceKey) => ({ DB_TARGET: getDbTarget(serviceKey) });
```
- `serviceKey` **DEBE** coincidir con el id pasado a `KApiStack.setDefaultOptions(id)`.
- Servicio ausente ⇒ `'primary'` (fail-safe).
- **No repliques la lista completa en este doc** (se desincroniza): el archivo es la fuente de verdad.
  Al 2026-07-07 el registro clasifica **100 serviceKeys** con BD tenant — **68 `priority:false`**
  (réplica) y **32 `priority:true`** (writer) — resultado de las Oleadas 3→16. El desglose por oleada
  está en §12. **`cases` ya es `priority:false`** (Fase 0: list/count a réplica); solo las acciones
  write-only del agregado (`case-clone`/`case-close`/`case-re-open`/`case-reclassification`,
  `cases-bulk`) quedan `priority:true`.

### 4.2 Espejo de infra — `dbRoutingEnv.ts` ⚠️
`packages/kace_cloud_aws_infra/src/dbRoutingEnv.ts`

El CDK **NO** importa el módulo ESM de api-common (fricción ESM/CJS en la toolchain del CDK).
En su lugar mantiene una **copia CommonJS** del mismo mapa. `KApiStack.ts:25` importa `getDbTarget`
de aquí, no de api-common.

> **Regla de oro:** cada vez que toques `serviceDbRouting.js`, replica el cambio en `dbRoutingEnv.ts`.
> El test `dbRoutingEnv.test.ts` (drift-guard) ahora compara el **mapa completo `{key→priority}`** de
> ambos registros (`expect(infraRouting).toEqual(apiRouting)`), así que detecta tanto claves faltantes
> o de más **como** valores `priority` divergentes (endurecido; antes solo comparaba claves — deuda
> §8.2/§11 ya resuelta). Si olvidas el espejo o divergen los `priority`, el guard falla en CI; sin él,
> el servicio desplegaría con `DB_TARGET: primary` y la réplica quedaría silenciosamente inactiva.

### 4.3 Inyección de env — `KApiStack`
`packages/kace_cloud_aws_infra/src/KApiStack.ts:224-227`

`setDefaultOptions(id)` hace `addEnvironment('DB_TARGET', getDbTarget(id))`. El default base es
`DB_TARGET: 'primary'`. **No se inyecta `DB_HOST_READER` global**: el host de réplica es **por-tenant**
(`db_host_reader` en DynamoDB), no un valor global.

### 4.4 Middleware — `withTenantContext`
`packages/kace_cloud_api_common/src/middleware/withTenantContext.js`

- Lee `DB_TARGET` **por-invocación** (no hoisted), construye `knexConfig` + `readerConfig` y los
  expone en `event.tenantContext`.
- Envuelve el handler en `DbRequestContext.run(...)` (línea ~84) → el write-flag tiene **alcance
  de petición** en Lambda.
- `event.tenantContext.knexConfig`/`readerConfig` son **objetos de config** (`{client, connection,
  pool, schema}`), **no** instancias Knex.

### 4.5 Selección de host — `Tenant`
`packages/kace_cloud_core/src/tenant/domain/Tenant.js`

```js
buildKnexConfig({ preferReplica = false, role = 'writer', poolMax = 3 } = {})
// useReplica = role==='reader' && preferReplica===true && Boolean(db_host_reader?.value)
```
`TenantContextManager.buildReaderConfig(tenant, opts)` = `buildKnexConfig({ ...opts, role:'reader' })`.
Sin `db_host_reader` en el tenant ⇒ cae a `db_host` (writer). El campo `db_host_reader` se persiste
como atributo **DynamoDB** (no hay tabla SQL de tenants) y se back-fillea con el endpoint RO del proxy.

### 4.6 El repositorio base — `KnexRepository` ⭐
`packages/kace_cloud_core/src/shared/infrastructure/persistence/KnexRepository.js`

Constructor: `constructor(config, table = '', readerConfig = null)`.

`#resolveReaderConnection(writerConfig, readerConfig)` reutiliza el pool del writer cuando:
1. no se pasa `readerConfig`, **o**
2. el writer se pasó como **instancia pre-construida** (`typeof config === 'function'`), **o**
3. `reader host == writer host`.

En cualquier otro caso abre un segundo pool `Knex(readerConfig)`.

Getters de conexión:

| Getter | Devuelve | Uso |
|---|---|---|
| `this.connection` / `this.writer` | pool **writer** (primaria) | escrituras, transacciones, metadata. Back-compat: `connection` es el writer de siempre. |
| `this.reader` | pool **replica**, salvo que ya hubo escritura en el contexto ⇒ writer | lecturas crudas con el query builder (`this.reader(tabla)...`). |
| `this.read` | fachada `{ table(name), raw(sql, bindings) }` enlazada a `this.reader` | **forma recomendada** para SELECTs auditados (ver §5). |

`markWrite()` se llama automáticamente en los métodos base de escritura: **`update()`,
`saveHistory()`, `saveHistoryWithRelationships()`, `startTransaction()`** (líneas 393/418/447/656).

### 4.7 El write-flag — `DbRequestContext`
`packages/kace_cloud_core/src/shared/infrastructure/context/DbRequestContext.js`
(re-exportado desde `@kace/api-common/src/db-routing/DbRequestContext.js` para no invertir la
dependencia core→api-common).

`AsyncLocalStorage` propio con `{ written }`. API: `run(fn)`, `runForJob(fn)`, `markWrite()`,
`hasWritten()`. **Fuera de cualquier `run()`, `hasWritten()` devuelve `false`.**

## 5. `this.reader` vs `this.read` — cuál usar

- **`this.read`** (Oleada 4, **preferida**): fachada `{ table, raw }` que **preserva la cualificación
  de schema** (igual que `this.table()`) y resuelve `this.reader` de forma **lazy en cada acceso**
  (respeta read-after-write). Úsala así:
  ```js
  this.read.table('mi_view').select('*').where(...);
  this.read.raw('LOWER(??) LIKE LOWER(?)', [campo, `%${v}%`]);
  ```
- **`this.reader`** (Oleada 3, crudo): el pool directo. No cualifica schema por ti. Útil cuando
  necesitas el builder crudo, pero en repos con schema por-tenant **prefiere `this.read.table()`**
  para no perder la cualificación.

**Nunca** uses `this.read`/`this.reader` para `INSERT/UPDATE/DELETE`, transacciones, ni metadata
(`columnInfo`, `PRAGMA`, `SchemaMetadataCache`): eso va **siempre** por `this.connection`/`this.writer`.

## 6. Playbook: migrar un nuevo servicio al replica

Sigue el patrón de la Oleada 4 (`reports`), con TDD (RED → GREEN → REFACTOR) en cada paso:

1. **Auditar las lecturas.** Identifica los call-sites de SELECT de datos del servicio. Distingue:
   lecturas de datos (→ `this.read`) vs metadata/`columnInfo`/detección de dialecto (→ `this.connection`).
   Confirma que el servicio **no** escribe por rutas que se sirvan del replica.
2. **Constructor del repo.** Acepta `readerConfig`: `constructor(config, readerConfig=null){ super(config, '', readerConfig); }`.
   Test doble-SQLite: pool separado con host distinto, reuso sin `readerConfig`.
3. **Migrar los SELECT** a `this.read.table()/raw()`. Solo cambia el origen de conexión; la lógica de
   filtros/fechas/paginación NO cambia. Test doble-SQLite con datos distinguibles
   (`from-writer`/`from-reader`) que prueba el enrutamiento real + read-after-write.
4. **Cablear el Controller.** Construye el repo desde **configs**, no instancias:
   ```js
   const { readerConfig } = this.event.tenantContext;
   this.repo = new MiRepositorio(knexConfig, readerConfig);   // NO this.database_connection
   ```
   En `destroyDbConnection()` cierra el pool del repo (`await this.repo.destroyConnection()`) antes de `super`.
5. **Clasificar el servicio** en `serviceDbRouting.js` (`miServicio: { priority: false }`) **y** en el
   espejo `dbRoutingEnv.ts`. Añade asserts `getDbTarget('miServicio') === 'replica'` en ambos test files.
6. **Integración (Postgres real).** Test `*Integration.test.js` sin mocks: valida pool único cuando
   reader host == writer host + cualificación de schema. (En CI suele colapsar a pool único; el
   enrutamiento de dos hosts se cubre con el unit doble-SQLite.)
7. **Gate de infra.** `cd apps/apiv1/<servicio> && pnpm run cdk:synth 2>&1 | grep -i DB_TARGET`
   ⇒ debe decir **`DB_TARGET: replica`**. Si dice `primary`, casi siempre es el espejo `dbRoutingEnv.ts`
   sin sincronizar o un `serviceKey` que no coincide con `setDefaultOptions(id)`.
8. **Deploy + compuerta** (§9).

## 7. Reglas y convenciones

- **Escrituras y transacciones SIEMPRE por `this.connection`/`this.writer`.** El reader es aditivo.
- **Metadata por el writer** (`columnInfo`, `PRAGMA table_info`, `SchemaMetadataCache.getTableColumns`).
- **Cualifica el schema** en lecturas multi-tenant: `this.read.table()` lo hace; `this.reader(...)` no.
- **Pasa configs, no instancias.** Una instancia Knex pre-construida colapsa el reader al writer (§8).
- **`serviceKey` == `setDefaultOptions(id)`.** Si difieren, `DB_TARGET` no se inyecta.
- **No relajes los tests** de enrutamiento para forzar verde: si un test rojo revela un bug, es un bug.

## 8. Gotchas / footguns (leer antes de migrar)

1. **Instancia vs config (el más peligroso).** Si construyes el repo con `this.database_connection`
   (una instancia Knex), `#resolveReaderConnection` ve `typeof config === 'function'` y **colapsa el
   reader al writer** — la réplica queda inactiva en silencio. Pasa siempre el **objeto de config**
   (`knexConfig`) + `readerConfig` del `tenantContext`.
2. **Los dos registros deben estar en sync.** El drift-guard (`dbRoutingEnv.test.ts`) ya compara el
   **mapa completo `{key→priority}`** (no solo claves): un servicio con `priority:false` en uno y
   `priority:true` en el otro **ahora sí** rompe el guard. (Histórico: originalmente solo comparaba
   claves; endurecido, deuda §11 cerrada.) Aun así, **no olvides replicar el cambio en ambos archivos**
   o el test falla.
3. **Inserts directos en repos no-base NO llaman `markWrite()`.** Solo lo hacen los métodos base
   `update/saveHistory/saveHistoryWithRelationships/startTransaction`. Un `this.connection(tabla).insert(...)`
   directo en un repo concreto **no** marca el write-flag ⇒ read-after-write no se dispara. **Antes de
   clasificar un servicio con escrituras como no prioritario**, audita sus writes directos e inserta
   `DbRequestContext.markWrite()` (o centraliza). Los pilotos `case_count` y `reports` son read-only,
   por eso no les afecta.
4. **Workers ECS: read-after-write NO está activo.** `JobRunner.mjs:62` envuelve en
   `TenantContext.runForJob`, pero **no** en `DbRequestContext.runForJob`. Sin ese scope,
   `hasWritten()` es siempre `false` y, si hay pool de réplica distinto, las lecturas van al replica
   sin protección read-after-write. **Requisito** antes de migrar un servicio worker-backed: envolver
   el job también en `DbRequestContext.runForJob(...)`.
5. **`this` dentro de `andWhere(function(){...})`.** En `KnexReportsViewRepository.fetchViewDataWithConditions`
   (rama OR), el callback es un `function` regular ⇒ dentro `this` es el **query builder**, no el repo:
   `this.read`/`this.connection` son `undefined` ahí. (Existe un bug latente pre-existente en la rama
   OR-`ilike` SQLite por esto — ver §11.) Si necesitas el reader dentro de un callback de grupo, captura
   `const reader = this.read` **fuera** del callback.
6. **Allowlist SQLite en tests.** El listener `query-response` de `KnexRepository` lanza para SELECTs
   SQLite sobre tablas no registradas en `#fieldsToParse`. Los tests con tablas ficticias deben añadir
   una entrada `mi_tabla: []` (gated tras `isSQLite`, impacto cero en Postgres). Precedente: `test_view`,
   `widgets`, `mi_vista`.

## 9. Compuerta de la oleada (validación post-deploy)

Tras `cd apps/apiv1/<servicio> && pnpm run cdk:deploy` (+ back-fill de `db_host_reader` en DynamoDB
si aún no está), verificar en Performance Insights:
- El **reader endpoint** (`...cluster-ro...`) pasa de ocioso a recibir las queries del servicio.
- **Bajan** CPU y conexiones del **writer**.
- **Cero** errores de escritura-en-RO (sin `cannot execute ... in a read-only transaction`).
- Suite de integración verde (sin regresiones de consistencia).

Rollout **incremental**: un servicio a la vez, re-midiendo la compuerta cada vez.

## 10. Patrones de test

- **Unit (doble-SQLite, enrutamiento real):** dos pools con `connection.host` distinto y datos
  distinguibles (`from-writer`/`from-reader`); fuerza `pool:{min:1,max:1}` para que cada `:memory:`
  conserve su DB. Prueba: lectura va al reader, read-after-write vuelve al writer, fail-safe sin readerConfig.
  Ej.: `tests/shared/infrastructure/persistence/KnexRepositoryReadFacade.test.js`,
  `tests/reports/infrastructure/persistence/KnexReportsViewRepositoryReadRouting.test.js`.
- **Integración (Postgres real, sin mocks):** `TestHelper.resetSchemaAndMigrate(knexConfigPostgres)`
  (requiere `ALLOW_SCHEMA_RESET=true`). Como `knexConfigPostgres` es una instancia, colapsa a pool único
  (reader == writer) — exactamente lo que se afirma para un solo host. El enrutamiento de dos hosts
  reales se valida en **staging/SARA**, no en CI.
- **Drift-guard:** `packages/kace_cloud_aws_infra/test/dbRoutingEnv.test.ts` compara el **mapa
  completo `{key→priority}`** de `serviceDbRouting.js` y `dbRoutingEnv.ts` (`toEqual`), más asserts
  `getDbTarget(...)` por servicio de cada oleada. Falla ante claves faltantes/de más o `priority`
  divergente.

> Convención `@kace/core` (ESM): `npx jest` pelado **falla**. Corre un archivo con
> `node --experimental-vm-modules node_modules/jest/bin/jest.js <ruta>` desde el paquete.
> Estilo: 4 espacios, comillas simples, semicolons, sin `console`.

## 11. Deuda abierta / follow-ups

- ~~**Drift-guard solo compara claves**~~ **RESUELTO**: ya compara el mapa completo `{key→priority}`
  (§8.2, `dbRoutingEnv.test.ts`).
- **Pool lifecycle en controllers con repos per-acción** (broker, broker_mapper y otros servicios admin
  con un repo nuevo por acción que nunca se destruye): bajo `DB_TARGET=replica` ahora también fuga un
  pool reader por invocación cálida (pools Knex lazy → impacto bajo en servicios de bajo tráfico). Fix:
  reusar `this.repository` o `destroyConnection()` en `finally`. Refactor transversal del patrón de
  controllers.
- **flow (`flows`) fijado a writer por write-on-read** (§12, Oleada 15): `search()` dispara un auto-heal
  que hace `UPDATE` (backfill de `kace_transition`). Query de solo lectura para medir si el backfill ya
  terminó en todos los tenants: `docs/superpowers/plans/…` / `docs/superpowers/flow-backfill-audit.sql`
  (local). Si `flujos_pendientes_backfill = 0` en todos los tenants ⇒ se puede eliminar el `UPDATE` y
  migrar `flows` limpio. `secrets-vaults` es CRUD limpio migrable, fijado a writer por decisión
  (bajo tráfico + datos sensibles).
- **Workers sin `DbRequestContext.runForJob`** (§8.4): read-after-write inactivo en ECS. No bloquea hoy
  porque todos los servicios worker-backed migrados están clasificados `priority:true` (writer), pero es
  **requisito** antes de migrar cualquier worker a réplica.
- **Inserts directos sin `markWrite()`** (§8.3): auditar antes de clasificar servicios con escritura.
- **Bug pre-existente OR-`ilike` SQLite** en `KnexReportsViewRepository.js:276-280`: el sub-path lanza
  por el `this`-binding del callback `andWhere(function(){...})`; sin cobertura de test (no existe
  condición OR-tipo `ilike`). Arreglar con su test cuando se toque esa zona.
- **`poolMax` del reader** usa el default (3); cuando hay host de réplica distinto se abre un 2º pool.
  Vigilar el presupuesto de conexiones agregado en RDS Proxy antes de ampliar el rollout.

## 12. Qué shipeó cada oleada

- **Oleada 3** — mecanismo completo: `Tenant.buildKnexConfig({preferReplica, role})` + `db_host_reader`,
  registro `serviceDbRouting` + espejo CDK, `DbRequestContext`, `KnexRepository` writer/reader +
  read-after-write, `withTenantContext` cableado, piloto `case_count`.
- **Oleada 4** — fachada `this.read` en `KnexRepository`, migración de `reports` (7 call-sites de
  lectura al replica), Controller desde configs, `reports` clasificado no prioritario, integración PG.

> **Oleadas 5→16 (2026-06 … 2026-07)** — barrido por dominios hasta cobertura completa. La verdad por
> servicio está en `serviceDbRouting.js`; abajo, el resumen por oleada. **Ninguna desplegada aún** (§9).

- **Oleada 5** — clasificaciones, usuarios/grupos-pivote, ANS, `users`, y `cases` (Fase 0:
  list/count read-only a réplica) + `boards`.
- **Oleada 6a/6b** — lecturas puras: available-states, case-transitions, states-distinct,
  global-configuration-get, client doc-types/contacts, imports-dashboard.
- **Oleada 7** — Tier B CRUD (reads→réplica, writes `markWrite`/`saveHistory`): literals, group-lists,
  automation-settings, allowed-connections, banners, helps(+attachments), custom-lists, geolocation,
  schemas, aux-definitions (DDL se queda en writer).
- **Oleada 8** — states, transitions (`search`→réplica, `find` en writer por cache/write-path),
  transition-rules, templates(+attachments).
- **Oleada 9** — groups (worker/cleaner en writer), roles, assignment-users-list.
- **Oleada 10** — client-notifications, mail-accounts (worker/workflow en writer).
- **Oleada 11** — comments, interactions (Tier C), emails (webhook en writer), report-executions
  (worker de reports en writer).
- **Oleada 12** — agendas(+groups pivote), appointments(+time-slots) Tier C con guards en writer,
  shift-management.
- **Oleada 13** — satélites de case: case-attachments/descriptions/session-duration (`search`/`count`
  →réplica; `find` + lecturas de `cases` en writer). Acciones write-only del agregado registradas
  `priority:true`: case-clone/close/re-open/reclassification.
- **Oleada 14** — global-configuration (CRUD, reads→réplica), schema-fields (metadata
  information_schema/pg_catalog→réplica). `global-configuration-set` write-only `priority:true`.
- **Oleada 15** — I/O: exports + s3-files migrados, cases_2 ya reader-ready (solo registrado).
  `priority:true` defensivo: imports, imports-processor, cases-bulk, tempcases, tempclients,
  **flows** (write-on-read, §11), **secrets-vaults** (sensible/bajo tráfico).
- **Oleada 16** — barrido de cobertura restante: broker-adapters, broker-mappers, workspaces,
  one_script, event-logs, generate-csv migrados. `priority:true`: ans-calculate, case-calculate-ans,
  group_cases_assignment, auth-cognito, debug-toggle, dashboard-counts-refresh, partition-maintenance,
  event-processor. Cierra la cobertura: **100 serviceKeys con BD tenant clasificados** (68 réplica +
  32 writer); los dirs restantes de `apps/apiv1/` no tienen BD tenant enrutable (DynamoDB, enums en
  memoria, presigned-URL S3, o stubs sin implementar).
