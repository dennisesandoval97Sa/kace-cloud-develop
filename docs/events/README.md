# Documentación de Eventos — KACE Cloud

Índice y guía de la arquitectura **event-driven** de KACE Cloud: cómo se publican los domain events,
cómo se transportan (SQS FIFO + sidecar EventBridge) y cómo se consumen (`event-processor`), más los
productores periódicos (worker ECS y Lambdas cron).

> **TL;DR de la arquitectura actual (Fase 3):** cada *use case* graba domain events en su agregado y
> los publica con `EventPublisher.publishAll()`. El **`RoutingEventBus`** enruta cada evento por su
> `eventName` a la **cola SQS FIFO** del bounded context destino (hot path) y, en paralelo, hace un
> `PutEvents` *best-effort* a **EventBridge** como **archivo/replay** (90 días, sin reglas a
> consumidores). Del lado consumidor hay **6 Lambdas** (una por BC), todas sobre el mismo motor
> `createEventLambdaHandler` con deduplicación idempotente.

---

## ¿Qué documento leo?

| Si quieres…                                                                 | Lee                                                                 |
|------------------------------------------------------------------------------|--------------------------------------------------------------------|
| **Agregar / crear un domain event nuevo** (clase, use case, handler, routing) | [`DOMAIN_EVENTS_GUIDE.md`](./DOMAIN_EVENTS_GUIDE.md)                |
| Entender **convenciones, idempotencia, testing y troubleshooting** de eventos | [`DOMAIN_EVENTS_GUIDE.md`](./DOMAIN_EVENTS_GUIDE.md)                |
| Ver el **mapa completo** evento → cola → Lambda → handler (revisión de equipo) | [`EVENTS_FLOW_DIAGRAM.md`](./EVENTS_FLOW_DIAGRAM.md)               |
| Entender el **consumidor**: motor compartido, dedup, fallos parciales, infra  | [`EVENT_PROCESSOR.md`](./EVENT_PROCESSOR.md)                        |
| Trazar un **flujo end-to-end** (`CaseCreated` / `ActionsQueueJob` → WS REST)  | [`E2E_FLOWS.md`](./E2E_FLOWS.md)                                    |
| Entender los **productores periódicos**: worker ECS + Lambdas cron            | [`WORKERS_AND_SCHEDULED_TASKS.md`](./WORKERS_AND_SCHEDULED_TASKS.md)|
| Ver el **detalle de cada uno de los 5 jobs** del worker                       | [`WORKER_JOBS.md`](./WORKER_JOBS.md)                                |
| El **procedimiento operativo** de cutover / rollback del event-processor      | [`../../apps/apiv1/kace_cloud_api_event_processor/RUNBOOK.md`](../../apps/apiv1/kace_cloud_api_event_processor/RUNBOOK.md) |

---

## Los documentos, en una línea

| Documento | Tipo | Qué cubre |
|---|---|---|
| [`DOMAIN_EVENTS_GUIDE.md`](./DOMAIN_EVENTS_GUIDE.md) | **Guía / how-to** | La referencia canónica para trabajar con eventos: crear eventos, emitirlos desde use cases, escribir handlers, transporte (`RoutingEventBus`), idempotencia, testing, checklist para agregar un evento, troubleshooting, infra CDK y escalabilidad por BC. **Empieza aquí si vas a tocar código de eventos.** |
| [`EVENTS_FLOW_DIAGRAM.md`](./EVENTS_FLOW_DIAGRAM.md) | **Diagrama / snapshot** | Vista de pájaro del flujo productor→cola→consumidor, con la tabla resumen evento → cola → Lambda → acción, el inventario de los 7 eventos y la estructura del mensaje SQS/EventBridge. Ideal para onboarding o revisión con el equipo. |
| [`EVENT_PROCESSOR.md`](./EVENT_PROCESSOR.md) | **Referencia (consumidor)** | Cómo funciona el servicio `event-processor`: las 6 Lambdas (una por BC), el motor compartido `createEventLambdaHandler`, el pipeline por invocación, la deduplicación, los reintentos / DLQ / partial batch failure, y la infraestructura CDK (colas, perfiles, alarmas, métricas). |
| [`E2E_FLOWS.md`](./E2E_FLOWS.md) | **Recorridos E2E** | Dos flujos completos de principio a fin — `CaseCreated` (API → Lambda) y `ActionsQueueJob` (worker → cola) — hasta el consumo de un WS REST externo, incluyendo la cadena compartida `CONSUMO_REST_FLOW`. |
| [`WORKERS_AND_SCHEDULED_TASKS.md`](./WORKERS_AND_SCHEDULED_TASKS.md) | **Referencia (productores periódicos)** | El worker ECS `actions-queue-executions` (split `WORKER_MODE` fast/ans, health checks, ciclo de vida, env vars) y las 4 Lambdas cron (patrón Orchestrator). Quién alimenta las colas. |
| [`WORKER_JOBS.md`](./WORKER_JOBS.md) | **Referencia por job** | Detalle de los 5 jobs del worker (`ActionsQueueJob`, `AutomatedAssignmentJob`, `UsersActionsJob`, `GroupsActionsJob`, `AnsCalculateJob`): propósito, flujo, dependencias y salida de cada uno. |

---

## Cómo se relacionan

```
                         ¿VAS A ESCRIBIR / MODIFICAR EVENTOS?
                                       │
                                       ▼
                          DOMAIN_EVENTS_GUIDE.md  ◀── referencia canónica
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                         ▼
      EVENTS_FLOW_DIAGRAM.md     EVENT_PROCESSOR.md          E2E_FLOWS.md
      (mapa productor→cola→      (cómo consume cada          (recorridos completos
       consumidor; inventario)    Lambda; dedup; infra)       hasta el WS externo)

                         ¿VAS A TOCAR LOS PRODUCTORES PERIÓDICOS?
                                       │
                                       ▼
                       WORKERS_AND_SCHEDULED_TASKS.md  ◀── panorama worker ECS + cron
                                       │
                                       ▼
                              WORKER_JOBS.md  ◀── detalle de cada job
```

---

## Eventos y colas (estado actual)

| # | Evento (`eventName`) | Cola SQS FIFO (BC) | Lambda consumidora / Handler |
|---|---|---|---|
| 1 | `kace.core.case.created` | `*-cases` | `event-processor-cases` / `ExecuteActionsOnCaseCreated` |
| 2 | `kace.core.case.updated` | `*-cases` | `event-processor-cases` / `ExecuteActionsOnCaseUpdated` |
| 3 | `kace.core.case.post_processing.requested` | `*-case-post-processing` | `event-processor-case-post-processing` / `CasePostProcessingOnCaseCreated` |
| 4 | `kace.core.action_job.created` | `*-action-jobs` | `event-processor-action-jobs` / `ProcessJobOnActionJobCreated` |
| 5 | `kace.core.automated_actions.requested` | `*-automated-actions` | `event-processor-automated-actions` / `ProcessActionQueueOnCronJobRequested` |
| 6 | `kace.core.ws_rest_flow_execution.requested` | `*-ws-rest` | `event-processor-ws-rest` / `ExecuteWSRestFlowOnExecutionRequested` |
| 7 | `kace.core.report_execution.requested` | `*-reports` | `event-processor-reports` / `ExecuteReportOnExecutionRequested` |

> El prefijo `*` es `{serviceName}` del stack CDK del `event-processor`. El mapa `eventName → cola`
> vive en `eventRoutingConfig.js`. **EventBridge es solo archive** (90 días), no enruta a consumidores.

---

## Referencias de código

| Componente | Ruta |
|---|---|
| Clase base de evento | `packages/kace_cloud_core/src/shared/domain/events/DomainEvent.js` |
| Eventos de dominio | `packages/kace_cloud_core/src/<modulo>/domain/events/*.js` |
| Publisher (app) | `packages/kace_cloud_core/src/shared/application/events/EventPublisher.js` |
| Bus de producción | `packages/kace_cloud_core/src/shared/infrastructure/events/RoutingEventBus.js` |
| Mapa `eventName → cola` | `packages/kace_cloud_core/src/shared/infrastructure/events/eventRoutingConfig.js` |
| Factory multi-tenant del bus | `packages/kace_cloud_core/src/shared/infrastructure/events/buildRoutingEventBusFromTenant.js` |
| Deduplicación | `packages/kace_cloud_core/src/shared/application/events/EventDeduplicator.js` |
| Motor del consumidor | `apps/apiv1/kace_cloud_api_event_processor/src/shared/createEventLambdaHandler.mjs` |
| Handlers por BC | `apps/apiv1/kace_cloud_api_event_processor/src/{cases,action-jobs,automated-actions,ws-rest,case-post-processing,reports}/handler.mjs` |
| Stack CDK del consumidor | `apps/apiv1/kace_cloud_api_event_processor/lib/event-processor-stack.ts` |
| Worker ECS (jobs) | `apps/workers/kace_cloud_worker_actions_queue_executions/src/jobs/*.mjs` |

---

## Nota de mantenimiento

Estos documentos describen el código de `packages/kace_cloud_core` y
`apps/apiv1/kace_cloud_api_event_processor`. Si cambias el routing (`eventRoutingConfig.js`), agregas
un BC/cola en `event-processor-stack.ts`, o creas un domain event nuevo, **actualiza también**:
la tabla de eventos de este README, el inventario de [`EVENTS_FLOW_DIAGRAM.md`](./EVENTS_FLOW_DIAGRAM.md)
§6, la tabla de Lambdas de [`EVENT_PROCESSOR.md`](./EVENT_PROCESSOR.md) §4–§5 y las secciones §12/§16
de [`DOMAIN_EVENTS_GUIDE.md`](./DOMAIN_EVENTS_GUIDE.md).

> Aviso conocido: `CLAUDE.md` menciona RabbitMQ en el stack, pero **no existe RabbitMQ en el código**.
> El transporte real de eventos es **SQS FIFO + EventBridge (archive)**.
