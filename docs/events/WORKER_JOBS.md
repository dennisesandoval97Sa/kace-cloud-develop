# Jobs del Worker `actions-queue-executions` — Referencia por Job

> Complemento de [`WORKERS_AND_SCHEDULED_TASKS.md`](./WORKERS_AND_SCHEDULED_TASKS.md) (panorama del worker ECS y las tareas cron)
> y de [`EVENTS_FLOW_DIAGRAM.md`](./EVENTS_FLOW_DIAGRAM.md) (flujo de eventos de dominio).
> Este documento entra al detalle de **cada uno de los 5 jobs** que viven en
> `apps/workers/kace_cloud_worker_actions_queue_executions/src/jobs/`.

---

## 1. Contrato común de un Job

Todos los jobs son clases sencillas que exponen el mismo contrato mínimo que consume el `JobRunner`
(`JobRunner.mjs:15` valida `{ name: string, run: function }`):

```js
class XxxJob {
    name = 'XxxJob';            // identificador para logs / overlap protection
    async run(tenant) { /* ... */ }
}
```

### 1.1 Patrón compartido dentro de `run(tenant)`

Los 5 jobs siguen exactamente el mismo esqueleto de manejo de conexión y telemetría:

```js
const knexConfig = TenantContextManager.buildKnexConfig(tenant, { poolMax: 10 });
const db = knex(knexConfig);
const endPoolTelemetry = PoolTelemetry.attach(db, { job: '<JobName>', tenantId: tenant.id?.value });
try {
    // ... arma repos + servicio/executor del @kace/core y ejecuta
} catch (error) {
    originalError = error;
    throw error;                 // se relanza...
} finally {
    endPoolTelemetry();
    await db.destroy();          // ...pero la conexión SIEMPRE se libera
    Helper.logTimeEnd('<JobName>.run');
}
```

Puntos clave de este patrón:

- **`poolMax: 10` por job (override scoped):** cada job sube el pool de Knex a 10 **solo para sí mismo**;
  el resto de Lambdas/servicios mantienen el default `poolMax=3`. Es para cubrir el fan-out de
  `CaseContextBatchLoader` / paginación sin starvar el pool local detrás de RDS Proxy
  (ver [[project_case_context_batch_loader_pool_invariant]] y [[project_actions_worker_connection_ceiling]]).
- **`PoolTelemetry.attach`:** instrumenta el pool para diagnóstico de saturación.
- **`db.destroy()` en `finally`:** cada ejecución por tenant abre y cierra su propia conexión Knex.
- **Relanza el error**, pero quien lo captura es el `JobRunner` (ver §1.2): un fallo en un tenant
  **no aborta** el procesamiento de los demás.

### 1.2 Cómo se ejecutan (orquestación)

```
Scheduler (croner)            JobRunner (uno por job)            Job
─────────────────             ────────────────────────          ───────────
tick cron  ──▶ runTickNow()
                │  (#inFlight a nivel orquestación: ignora ticks solapados)
                ├─ debugOverride.fetchAndApply()
                ├─ TenantEnumerator.list()  ──▶ [tenant1, tenant2, ...]
                └─ para cada runner: runner.runIfIdle({ tenants })
                                              │  (skip si ya hay uno en vuelo)
                                              └─ pLimit(WORKER_CONCURRENCY=5)
                                                   por tenant:
                                                     TenantContext.runForJob(tenant)
                                                       └─ job.run(tenant)  ──▶ try/catch por tenant
```

- **`Scheduler`** (`Scheduler.mjs`): un `Cron` de croner dispara `runTickNow()`. Mantiene un
  `#inFlight` que cubre **solo la orquestación** (fetch de tenants + dispatch); los errores del tick
  se loguean y se tragan (`tick.error`) para no matar el scheduler.
- **`JobRunner`** (`JobRunner.mjs`): es **fire-and-forget y nunca lanza**. Si el job anterior sigue
  en vuelo, salta el tick (`runner.skip`). Procesa hasta `WORKER_CONCURRENCY` (=5) tenants en
  paralelo vía `pLimit`. Por cada tenant abre un `TenantContext.runForJob` y **captura el error de
  ese tenant** (`runner.tenant.error`), llevando contadores `{ processed, errors }` y emitiendo
  `runner.end` al terminar.
- **Qué job corre en qué servicio** lo decide `WORKER_MODE` (ver `WORKERS_AND_SCHEDULED_TASKS.md` §2):
  los 4 rápidos en el servicio `fast`, `AnsCalculateJob` en el servicio `ans`.

### 1.3 Resumen de los 5 jobs

| Job | Servicio | Frecuencia | Publica evento | Usa lock `background_executions` |
|---|---|---|---|---|
| [`ActionsQueueJob`](#2-actionsqueuejob) | `fast` | 1 min | **Sí** (`AutomatedActionsRequested`) | Sí (vía executor) |
| [`AutomatedAssignmentJob`](#3-automatedassignmentjob) | `fast` | 1 min | No | Sí (vía executor) |
| [`UsersActionsJob`](#4-usersactionsjob) | `fast` | 1 min | No | No |
| [`GroupsActionsJob`](#5-groupsactionsjob) | `fast` | 1 min | No | No |
| [`AnsCalculateJob`](#6-anscalculatejob) | `ans` | 5 min | No | Sí |

---

## 2. `ActionsQueueJob`

**Archivo:** `src/jobs/ActionsQueueJob.mjs` · **Servicio:** `fast` (1 min) · **Único job que publica eventos.**

### Propósito
Procesa la cola de acciones automatizadas pendientes del tenant y, por cada ejecución, **emite el
evento de dominio `AutomatedActionsRequested`** hacia `automated-actions-events-queue.fifo`, que luego
consume `event-processor-automated-actions` (ver `EVENTS_FLOW_DIAGRAM.md`).

### Flujo
1. Construye el `db` con `poolMax: 10` (comentado en el código: el path de SQL-prefilter carga
   contexto vía `CaseContextBatchLoader`, que abre varias queries concurrentes).
2. Obtiene un `EventPublisher`: el inyectado por constructor, o lo arma con
   `buildRoutingEventBusFromTenant(tenant)`. **Si la construcción falla** (p. ej. el tenant no tiene
   URLs de cola configuradas), loguea `ActionsQueueJob.eventPublisher.disabled` y sigue con
   `eventPublisher = null` (degradación elegante: procesa sin publicar).
3. Instancia `ActionQueueExecutionsExecutor` (de `@kace/core`) con 7 repos
   (`ActionsQueueExecutions`, `Action`, `Case`, `BackgroundExecution`, `AutomationSettings`,
   `Groups`, `UserLists`) + el `eventPublisher` + el `tenant`, y llama `executor.execute()`.
4. Serializa la respuesta (`response.toJson()`).

### Salida y observabilidad
- Devuelve `{ successful, failed, duplicate, ... }`.
- `hasWork = successful + failed + duplicate > 0`: si hubo trabajo loguea a nivel **info**
  (`ActionsQueueJob.end`); si no, a **debug** (para no inundar logs en ticks vacíos cada minuto).

### Notas
- Es el **acoplamiento del worker con el bus de eventos**: el resto de jobs escriben directo en BD.
- El lock distribuido `background_executions` lo gestiona el executor del core, no el job.

---

## 3. `AutomatedAssignmentJob`

**Archivo:** `src/jobs/AutomatedAssignmentJob.mjs` · **Servicio:** `fast` (1 min) · No publica eventos.

### Propósito
Ejecuta la **asignación automática de grupos** sobre los casos del tenant (acciones de tipo
asignación dinámica de grupo). Escribe el resultado directo en PostgreSQL.

### Flujo
1. Arma un set amplio de repos (`Action`, `AutomationSettings`, `Groups`, `UserLists`, `Case`,
   `BackgroundExecution`, `Users`, `GlobalConfiguration`, `Classification`, `AuxCases`).
2. Construye los servicios de dominio: `AssignationService`, `AssignGroupByExternalDynamicCode`
   (handler de asignación dinámica) y un `ActionsProcessor` (con `FinderByTrigger` +
   `AutomationValidationService`).
3. **Toggle de estrategia** vía `AUTOMATED_ASSIGNMENT_SQL_PREFILTER_ENABLED`:
   - **`true` (SQL prefilter):** usa `AutomatedGroupAssignmentService` con un `EntityCandidateFinder`
     (traduce condiciones a SQL con `ActionConditionsToSqlTranslator` + `createCasesFieldCatalog`;
     query base: casos con `fecha_resolucion` nula) y un `CaseContextBatchLoader`. Prefiltra en BD
     para no evaluar todos los casos en memoria.
   - **`false` (legacy):** usa `LegacyAutomatedGroupAssignmentService` (evaluación clásica).
4. Envuelve todo en `AutomatedGroupAssignmentExecutor` (con `BackgroundExecutionService` para el lock)
   y ejecuta.

### Notas
- El `EntityCandidateFinder` construye SQL **fuera** de `KnexRepository`, por lo que debe
  auto-cualificar el `FROM`/`JOIN` por tenant (ver [[project_sql_prefilter_schema_qualification]]).
- Usa lock `background_executions` (vía el executor) para evitar solape entre invocaciones.

---

## 4. `UsersActionsJob`

**Archivo:** `src/jobs/UsersActionsJob.mjs` · **Servicio:** `fast` (1 min) · No publica eventos.

### Propósito
Ejecuta acciones automatizadas con trigger `CRON_JOB` cuyo `entityFilter` es **`user`** — es decir,
acciones programadas que operan sobre **usuarios** del tenant.

### Flujo (con cortes tempranos)
1. `FinderByTrigger.execute(CRON_JOB, { entityFilter: 'user' })` → si no hay acciones, retorna `ZERO`.
2. Filtra a `dueActions` validando cada acción con `AutomationValidationService` (respeta la
   ventana/horario de automatización). Si ninguna está "due", retorna `ZERO`.
3. `usersRepository.countActive()` → si no hay usuarios activos, retorna `ZERO`.
4. Construye un `UsersProcessor` con:
   - `EntityActionValidator` (validación runtime de cada par entidad-acción),
   - `EntityCandidateFinder` (prefilter SQL; query base: `is_active = '1'` y `deleted_at` nulo),
   - `UserContextBatchLoader` (carga contexto de grupos + config global en lote).
5. `processor.processEntitiesWithActions(dueActions)` evalúa; luego
   `EntityActionExecutionServiceFactory.create(usersRepository).executeMatchedPairs(successPairs)`
   ejecuta los pares que matchearon.

### Salida
Devuelve contadores: `{ processed, evaluatedPairs, prefilteredOut, matched, executed, failed }`
donde `processed = dueActions.length * entitiesActive` y `prefilteredOut = processed - evaluatedPairs`
(cuánto ahorró el prefilter SQL). Loguea `UsersActionsJob.start/end` (info) y métricas del prefilter (debug).

### Notas
- **No** usa lock `background_executions`. La protección de solape la da `JobRunner.runIfIdle` (un solo
  vuelo por job a la vez **dentro de la misma task**).

---

## 5. `GroupsActionsJob`

**Archivo:** `src/jobs/GroupsActionsJob.mjs` · **Servicio:** `fast` (1 min) · No publica eventos.

### Propósito
Gemelo de `UsersActionsJob` pero para **grupos**: acciones con trigger `CRON_JOB` y
`entityFilter: 'group'`.

### Flujo
Idéntico en estructura a `UsersActionsJob` (§4), con dos diferencias:
- El `EntityCandidateFinder` usa `createGroupsFieldCatalog` y la query base prefiltra
  `status = 1` y `deleted_at` nulo.
- Usa `GroupsProcessor` (sin `UserContextBatchLoader`; los grupos no requieren ese contexto).

### Salida
Mismos contadores `{ processed, evaluatedPairs, prefilteredOut, matched, executed, failed }`.

### Notas
- Tampoco usa lock `background_executions`; depende de `JobRunner.runIfIdle`.

---

## 6. `AnsCalculateJob`

**Archivo:** `src/jobs/AnsCalculateJob.mjs` · **Servicio:** `ans` (5 min) · No publica eventos.

### Propósito
Recalcula los **ANS/SLA** de los casos del tenant. Es el job **pesado**: stream de ~30k casos por
tenant vía **keyset pagination + batch UPDATE**. Por eso vive aislado en el servicio `ans`
(`WORKER_MODE=ans`), con un health staleness mucho más laxo (1800 s), para que una recalc legítima de
varios minutos no dispare un reinicio de ECS (ver [[project_actions_worker_healthcheck_eventloop]]).

### Flujo
1. `db` con `poolMax: 10` (cubre el interleaving query+update sin starvar otros workers).
2. Arma `KnexCaseRepository` + `BackgroundExecutionService` (sobre `KnexBackgroundExecutionRepository`).
3. Construye `AnsBackgroundRunner({ caseRepository, backgroundExecutionService })` y llama `execute()`.

### Notas
- **Lock distribuido `background_executions`:** el `AnsBackgroundRunner` evita que dos corridas
  recalculen el mismo tenant a la vez.
- ⚠️ **Doble cálculo de ANS:** existe **también** la Lambda `kace_cloud_api_ans_calculate`
  (EventBridge, cada 5 min) que corre el mismo `AnsBackgroundRunner`. Ambos compiten por el mismo
  lock; conviene definir una sola fuente de verdad (ver `WORKERS_AND_SCHEDULED_TASKS.md` §5.1).

---

## 7. Referencias de código

| Componente | Ruta |
|---|---|
| Jobs | `apps/workers/kace_cloud_worker_actions_queue_executions/src/jobs/*.mjs` |
| Orquestación (runner) | `apps/workers/.../src/JobRunner.mjs` |
| Scheduler (croner) | `apps/workers/.../src/Scheduler.mjs` |
| Cableado / WORKER_MODE | `apps/workers/.../src/index.mjs`, `resolveActiveSchedulers.mjs` |
| Executor de acciones | `@kace/core` → `actions-queue-executions/application/executions/ActionQueueExecutionsExecutor.js` |
| Runner de ANS | `@kace/core` → `ans/application/calculator/AnsBackgroundRunner.js` |
