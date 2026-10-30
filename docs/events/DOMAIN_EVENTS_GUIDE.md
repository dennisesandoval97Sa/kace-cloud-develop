# Guia de Domain Events - KACE Cloud

## Tabla de Contenidos

1. [Introduccion](#1-introduccion)
2. [Arquitectura General](#2-arquitectura-general)
3. [Conceptos Clave](#3-conceptos-clave)
4. [Convenciones de Nombres](#4-convenciones-de-nombres)
5. [Crear un Nuevo Domain Event](#5-crear-un-nuevo-domain-event)
6. [Emitir Eventos desde un Use Case](#6-emitir-eventos-desde-un-use-case)
7. [Crear un Event Handler (Consumidor)](#7-crear-un-event-handler-consumidor)
8. [Infraestructura de Transporte](#8-infraestructura-de-transporte)
9. [Idempotencia y Deduplicacion](#9-idempotencia-y-deduplicacion)
10. [Testing](#10-testing)
11. [Flujo Completo: De Publicacion a Procesamiento](#11-flujo-completo-de-publicacion-a-procesamiento)
12. [Eventos Existentes](#12-eventos-existentes)
13. [Guia Rapida: Agregar un Evento Nuevo (Checklist)](#13-guia-rapida-agregar-un-evento-nuevo-checklist)
14. [Errores Comunes y Troubleshooting](#14-errores-comunes-y-troubleshooting)
15. [Glosario](#15-glosario)

---

## 1. Introduccion

KACE Cloud implementa una **arquitectura event-driven** basada en **Domain Events** siguiendo los principios de Domain-Driven Design (DDD). Los eventos permiten desacoplar la logica de negocio del procesamiento secundario como notificaciones, analytics y auditorias.

### Principios Fundamentales

- **Los eventos son inmutables**: Una vez creados, no se modifican.
- **Los eventos nunca rompen el flujo principal**: Si falla la publicacion de un evento, el caso/entidad se guarda igual. Los errores se registran en logs.
- **Backward compatible**: El `EventPublisher` es opcional en los use cases. Si no se proporciona, el use case funciona exactamente como antes.
- **Procesamiento idempotente**: Cada evento se procesa exactamente una vez, incluso si SQS lo entrega multiples veces.

---

## 2. Arquitectura General

El transporte actual es **`RoutingEventBus`**: cada evento se enruta por su `eventName` a la **cola
SQS FIFO** del bounded context destino (hot path), y en paralelo se hace un `PutEvents` *best-effort*
a **EventBridge** como **sidecar de archivo/auditoría** (90 días, para replay) — EventBridge **no**
enruta a consumidores. Del lado del procesamiento hay **una Lambda por BC**, cada una consumiendo su
cola.

```
                            PUBLICACION                                 PROCESAMIENTO
                     ┌──────────────────────┐                    ┌──────────────────────┐
                     │    Lambda Handler    │                    │  event-processor     │
                     │   (API Gateway)      │                    │  (1 Lambda por BC)   │
                     └─────────┬────────────┘                    └──────────┬───────────┘
                               │                                            │
                     ┌─────────▼────────────┐                    ┌──────────▼───────────┐
                     │     Use Case         │                    │  Deduplication Check │
                     │  (CaseCreator, etc.) │                    │  (EventDeduplicator) │
                     └─────────┬────────────┘                    └──────────┬───────────┘
                               │                                            │
                     ┌─────────▼────────────┐                    ┌──────────▼───────────┐
                     │   EventPublisher     │                    │  Event Handlers      │
                     │   (Application Svc)  │                    │  (ej: ExecuteActions)│
                     └─────────┬────────────┘                    └──────────────────────┘
                               │
                     ┌─────────▼────────────┐
                     │   RoutingEventBus    │
                     │ (eventName → cola)   │
                     └───┬─────────────┬────┘
                         │ hot path    │ sidecar (best-effort)
              ┌──────────▼──┐    ┌─────▼──────────────┐
              │  SQS FIFO   │    │   EventBridge      │
              │ (1 por BC)  │    │ (archive 90d, sin  │
              │             │    │ reglas a consumidor)│
              └─────────────┘    └────────────────────┘
```

> Modelo anterior (retirado): un `HybridEventBus` clasificaba eventos en "críticos → SQS" y
> "no críticos → EventBridge". Eso **ya no aplica**: hoy **todos** los eventos van por SQS (uno por BC)
> y EventBridge es solo archivo. Ver §16 para los detalles de la arquitectura por BC.

### Capas de la Arquitectura Hexagonal

| Capa               | Componentes                                                                | Ubicacion                                                                 |
|--------------------|----------------------------------------------------------------------------|---------------------------------------------------------------------------|
| **Domain**         | `DomainEvent`, `CaseCreated`, etc.                                         | `src/shared/domain/events/`, `src/cases/domain/events/`                   |
| **Application**    | `EventBus` (port), `EventPublisher`, `EventDeduplicator`, handlers         | `src/shared/application/events/`, `src/cases/application/event-handlers/` |
| **Infrastructure** | `RoutingEventBus`, `EventBridgeEventBus`, `SQSEventBus`, `InMemoryEventBus`, `buildRoutingEventBusFromTenant` | `src/shared/infrastructure/events/`                                       |

---

## 3. Conceptos Clave

### DomainEvent

Clase base para todos los eventos del dominio. Cada evento contiene:

| Campo         | Tipo                | Descripcion                            |
|---------------|---------------------|----------------------------------------|
| `eventId`     | `string (UUID)`     | ID unico del evento (auto-generado)    |
| `eventName`   | `string`            | Nombre del evento con namespace        |
| `aggregateId` | `string (UUID)`     | ID de la entidad que produjo el evento |
| `osccurredOn` | `string (ISO 8601)` | Timestamp de cuando ocurrio            |
| `payload`     | `Object`            | Datos especificos del evento (frozen)  |
| `metadata`    | `Object`            | Contexto del evento (frozen)           |

**Metadata estandar:**

| Campo            | Descripcion                                | Ejemplo               |
|------------------|--------------------------------------------|-----------------------|
| `tenant_id`      | ID del tenant                              | `'acme-corp'`         |
| `user_id`        | Usuario que disparo la accion              | `'uuid-del-usuario'`  |
| `correlation_id` | ID para correlacionar eventos relacionados | `'uuid-correlacion'`  |
| `causation_id`   | ID del evento que causo este               | `'uuid-evento-causa'` |

### AggregateRoot

La clase base `AggregateRoot` tiene tres metodos para manejo de eventos:

```javascript
// Registra un evento para publicacion futura
aggregate.recordDomainEvent(event);

// Extrae todos los eventos pendientes (los limpia internamente)
const events = aggregate.pullDomainEvents();

// Verifica si hay eventos pendientes
const hasEvents = aggregate.hasDomainEvents();
```

### EventPublisher

Servicio de aplicacion que envuelve el `EventBus` con logging y manejo de errores:

```javascript
// Publica un solo evento
await eventPublisher.publish(event);

// Publica multiples eventos (de un aggregate)
await eventPublisher.publishAll(events);
```

---

## 4. Convenciones de Nombres

### Nombres de Eventos

Los eventos siguen un formato **namespaced** con puntos:

```
kace.<bounded-context>.<aggregate>.<accion_en_pasado>
```

**Ejemplos:**

| Evento                  | Nombre                            |
|-------------------------|-----------------------------------|
| Caso creado             | `kace.core.case.created`          |
| Estado de caso cambiado | `kace.core.case.state_changed`    |
| Caso asignado a usuario | `kace.core.case.assigned_to_user` |
| Cliente creado          | `kace.core.client.created`        |
| Usuario desactivado     | `kace.core.user.deactivated`      |
| Comentario agregado     | `kace.core.comment.added`         |

**Reglas:**
- Siempre en **pasado**: `created`, `updated`, `deleted`, `assigned`, `changed`
- Siempre en **ingles**
- Siempre con el prefijo `kace.core.`
- Palabras separadas por `_` (snake_case) dentro del ultimo segmento
- Se define como constante estatica `EVENT_NAME` en la clase del evento

### Nombres de Clases

| Tipo              | Patron                | Ejemplo                        |
|-------------------|-----------------------|--------------------------------|
| Evento de dominio | `<Aggregate><Accion>` | `CaseCreated`, `ClientCreated` |
| Event handler     | `<Accion>On<Evento>`  | `ExecuteActionsOnCaseCreated`  |
| Use case          | `<Aggregate><Verbo>`  | `CaseCreator`, `CaseUpdater`   |

### Ubicación de Archivos

```
packages/kace_cloud_core/src/
├── <modulo>/
│   ├── domain/
│   │   └── events/                    ← Clases de eventos del modulo
│   │       └── CaseCreated.js
│   └── application/
│       └── event-handlers/            ← Handlers que reaccionan a eventos
│           └── ExecuteActionsOnCaseCreated.js
└── shared/
    ├── domain/
    │   └── events/
    │       └── DomainEvent.js         ← Clase base (NO MODIFICAR)
    ├── application/
    │   └── events/
    │       ├── EventBus.js            ← Port/Interfaz (NO MODIFICAR)
    │       ├── EventPublisher.js      ← Servicio de publicacion
    │       ├── EventDeduplicator.js   ← Servicio de idempotencia
    │       └── EventDeduplicationRepository.js  ← Port para dedup
    └── infrastructure/
        └── events/
            ├── InMemoryEventBus.js                 ← Para tests y desarrollo
            ├── SQSEventBus.js                      ← Helper de transporte SQS FIFO
            ├── EventBridgeEventBus.js              ← Sidecar de archivo (PutEvents)
            ├── RoutingEventBus.js                  ← Produccion: eventName → cola + archive sidecar
            ├── eventRoutingConfig.js               ← Mapa eventName → queueUrl (desde Tenant)
            ├── buildRoutingEventBusFromTenant.js   ← Factory multi-tenant del bus
            └── KnexEventDeduplicationRepository.js ← Dedup en PostgreSQL
```

---

## 5. Crear un Nuevo Domain Event

### Paso 1: Crear la clase del evento

Crea un archivo en `src/<modulo>/domain/events/`:

```javascript
// src/clients/domain/events/ClientCreated.js
import {DomainEvent} from '../../../shared/domain/events/DomainEvent.js';

export class ClientCreated extends DomainEvent {
    static EVENT_NAME = 'kace.core.client.created';

    /**
     * @param {Object} params
     * @param {string} params.clientId - ID del cliente creado
     * @param {string} params.name - Nombre del cliente
     * @param {string} params.email - Email del cliente
     * @param {Object} [params.metadata={}] - Metadata del evento
     */
    constructor({clientId, name, email, metadata = {}}) {
        super({
            eventName: ClientCreated.EVENT_NAME,
            aggregateId: clientId,
            payload: {
                name,
                email,
            },
            metadata,
        });
    }
}
```

**Reglas importantes:**

- Siempre extiende `DomainEvent`
- Define `static EVENT_NAME` con el nombre completo del evento
- El `aggregateId` es el ID de la entidad principal
- El `payload` contiene SOLO los datos necesarios para los consumidores
- El `metadata` viene del contexto de ejecucion (tenant, usuario, etc.)
- **NUNCA** pongas datos sensibles (passwords, tokens) en el payload

---

## 6. Emitir Eventos desde un Use Case

### Patron de Publicacion

Los use cases reciben un `EventPublisher` **opcional** como ultimo parametro del constructor. Esto mantiene backward
compatibility.

```javascript
// src/clients/application/create/ClientCreator.js
import {ClientCreated} from '../../domain/events/ClientCreated.js';
import {Helper} from '../../../shared/infrastructure/utils/Helper.js';

export class ClientCreator {
    #repository;
    /** @type {EventPublisher|null} */
    #eventPublisher;

    /** @type {Tenant} */
    #tenant;

    /** @type {User} */
    #currentUser;

    /**
     * @param {KnexClientRepository} repository
     * @param {EventPublisher} [eventPublisher] - Opcional
     * @param {Tenant} tenant
     * @param {User} currentUser
     */
    constructor(repository, eventPublisher, tenant, currentUser) {
        this.#repository = repository;
        this.#eventPublisher = eventPublisher || null;
        this.#tenant = tenant ?? TenantContext.getTenant();
        this.#currentUser = currentUser;
    }

    async execute(dto) {
        // 1. Logica de negocio
        const client = Client.create(dto);

        // 2. Persistir
        const saved = await this.#repository.save(client);

        // 3. Publicar eventos (SIEMPRE despues de persistir)
        await this.#publishDomainEvents(saved);

        return new ClientResponse(saved);
    }

    /**
     * @private
     */
    async #publishDomainEvents(client) {
        // Si no hay publisher, no hacer nada (backward compatible)
        if (!this.#eventPublisher) {
            return;
        }

        try {
            // Registrar el evento en el aggregate
            client.recordDomainEvent(
                new ClientCreated({
                    clientId: client.id.value,
                    name: client.name.value,
                    email: client.email.value,
                    metadata: {
                        tenant_id: this.#tenant.id.value,
                        user_id: this.#currentUser.id.value,
                        correlation_id: null,
                        causation_id: null,
                    },
                })
            );

            // Extraer y publicar todos los eventos pendientes
            const domainEvents = client.pullDomainEvents();
            await this.#eventPublisher.publishAll(domainEvents);
        } catch (error) {
            // NUNCA dejar que un error de eventos rompa el flujo principal
            Helper.logError('ClientCreator: Failed to publish domain events', error);
        }
    }
}
```

### Inyeccion del EventPublisher en el Controller

```javascript
// controller.mjs (en la Lambda)
export class Controller extends BaseController {

    async actionCreate() {
        const creator = new ClientCreator(repository, this.eventPublisher, this.tenant, this.user);
        return await creator.execute(dto);
    }
}
```

### Orden de Operaciones (IMPORTANTE)

```
1. Validar datos de entrada
2. Ejecutar logica de negocio
3. Persistir en base de datos          ← PRIMERO guardar
4. Publicar eventos de dominio         ← DESPUES publicar
5. Retornar respuesta
```

**Nunca publiques eventos antes de persistir.** Si la persistencia falla, los eventos no deben haberse publicado.

---

## 7. Crear un Event Handler (Consumidor)

Los event handlers procesan eventos en la Lambda `kace_cloud_api_event_processor`.

### Convencion de Nombres

Los handlers siguen el patron **`[Accion]On[Evento]`**, donde:

- **Accion**: lo que hace el handler (ej: `Notification`, `AuditLog`, `SyncCache`)
- **On**: separador fijo
- **Evento**: el evento de dominio que dispara el handler (ej: `CaseCreated`, `ClientCreated`)

Ejemplos:

| Handler                       | Accion             | Evento                         |
|-------------------------------|--------------------|--------------------------------|
| `ExecuteActionsOnCaseCreated` | Ejecuta acciones   | Cuando se crea un caso         |
| `NotificationOnClientCreated` | Crea notificacion  | Cuando se crea un cliente      |
| `AuditLogOnCaseUpdated`       | Registra auditoria | Cuando se actualiza un caso    |
| `SyncCacheOnUserUpdated`      | Invalida cache     | Cuando se actualiza un usuario |

### Notification Handler (ejemplo)

Crea notificaciones para usuarios cuando ocurren eventos.

**Importante:** Los handlers deben usar el **patron Repository** para persistencia, no Knex directo. Esto mantiene la
consistencia con la arquitectura hexagonal y facilita el testing.

```javascript
// src/clients/application/event-handlers/NotificationOnClientCreated.js
import {v4 as uuidV4} from 'uuid';
import {UserNotification} from '../../../user-notifications/domain/UserNotification.js';
import {Helper} from '../../../shared/infrastructure/utils/Helper.js';

export class NotificationOnClientCreated {
    /** @type {import('../../../user-notifications/infrastructure/persistence/KnexUserNotificationRepository.js').KnexUserNotificationRepository} */
    #notificationRepository;

    /**
     * @param {KnexUserNotificationRepository} notificationRepository
     */
    constructor(notificationRepository) {
        this.#notificationRepository = notificationRepository;
    }

    /**
     * @param {DomainEvent} domainEvent
     * @returns {Promise<void>}
     */
    async handle(domainEvent) {
        const {name} = domainEvent.payload;
        const userId = domainEvent.metadata.user_id;

        if (!userId) {
            Helper.logInfo('NotificationOnClientCreated: No user_id, skipping');
            return;
        }

        const now = new Date().toISOString();

        const notification = UserNotification.create({
            id: uuidV4(),
            asunto: 'Nuevo cliente creado',
            mensaje: `Se ha creado el cliente "${name}" (ID: ${domainEvent.aggregateId}).`,
            fecha_inicio: now,
            fecha_fin: new Date(Date.now() + 86400000).toISOString(),
            leida: false,
            leida_por: null,
            user_id: userId,
            is_active: true,
            created_at: now,
            created_by: userId,
        });

        await this.#notificationRepository.save(notification);

        Helper.logInfo('NotificationOnClientCreated: Notification created', {
            clientId: domainEvent.aggregateId,
            userId,
        });
    }
}
```

### Registrar el Handler en el Event Processor

> **Arquitectura actual (Fase 3):** el `event-processor` ya **no** tiene un `handler.mjs` monolítico
> con un `switch`/`dispatchHandler()`. Hay **una Lambda por bounded context**, cada una en
> `src/<bc>/handler.mjs`, que registra un **`Map<EVENT_NAME → factory>`** y delega en el motor
> compartido `createEventLambdaHandler` (ver `EVENT_PROCESSOR.md`). El motor ya cubre normalización,
> agrupado por tenant, contexto multi-tenant, deduplicación idempotente y *partial batch failure* —
> el handler de cada BC solo aporta su `Map` y su `lambdaName`.

Si el evento pertenece a un **BC existente**, agrega la entrada al `Map` de ese handler. Ejemplo real
(`src/cases/handler.mjs`):

```javascript
import ExecuteActionsOnCaseCreated from '@kace/core/src/cases/application/event-handlers/ExecuteActionsOnCaseCreated';
import { CaseCreated, KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { createEventLambdaHandler } from '../shared/createEventLambdaHandler.mjs';

const handlerFactories = new Map([
    [
        CaseCreated.EVENT_NAME,
        // La factory arma sus dependencias por invocación a partir de la conexión Knex del tenant
        // (userRepository.connection), ya abierta por el motor. NO uses try/catch propio: deja que
        // el error se propague para que SQS reintente el mensaje vía batchItemFailures.
        async ({ userRepository }, event) => {
            const h = new ExecuteActionsOnCaseCreated(
                new KnexCaseRepository(userRepository.connection),
                /* ...demás dependencias... */
            );
            await h.handle(event);
        },
    ],
    // NUEVO: agregar aquí otra entrada [OtroEvento.EVENT_NAME, async (...) => {...}]
]);

export const handler = createEventLambdaHandler({
    handlerFactories,
    lambdaName: 'CasesEventProcessor',
});
```

Si el evento necesita un **BC nuevo** (su propia cola + Lambda), ver el checklist de §13 paso 4 y la
sección §16 ("Añadir un evento nuevo (post-Fase 3)").

---

## 8. Infraestructura de Transporte

### Implementaciones Disponibles

| Implementacion        | Uso                                                              | Soporta subscribe? |
|-----------------------|------------------------------------------------------------------|--------------------|
| `InMemoryEventBus`    | Tests y desarrollo local                                         | Si                 |
| `RoutingEventBus`     | **Produccion:** enruta `eventName → cola SQS` + sidecar archive  | No                 |
| `SQSEventBus`         | Helper de transporte a una cola SQS FIFO                         | No                 |
| `EventBridgeEventBus` | Sidecar de archivo/auditoria (`PutEvents`, retencion 90d)        | No                 |

> El productor **no instancia el bus a mano**: `BaseController.#buildEventPublisher()` llama a
> `buildRoutingEventBusFromTenant(tenant)`, que lee del `Tenant` las URLs de cola, la región y el bus
> de EventBridge, y arma el `RoutingEventBus` con su `EventBridgeEventBus` (archive) interno.

### InMemoryEventBus (Tests)

```javascript
import {InMemoryEventBus} from '@kace/core/src/shared/infrastructure/events/InMemoryEventBus.js';

const eventBus = new InMemoryEventBus();

// Suscribir un handler
eventBus.subscribe('kace.core.case.created', async (event) => {
    console.log('Caso creado:', event.aggregateId);
});

// Suscribir a TODOS los eventos
eventBus.subscribe('*', async (event) => {
    console.log('Evento:', event.eventName);
});

// Publicar
await eventBus.publish(event);

// Limpiar (para tests)
eventBus.clear();
```

### RoutingEventBus (Transporte de Produccion)

Es el bus que se usa en runtime. Por cada evento:

1. **Hot path (bloqueante):** resuelve la cola del `eventName` con el `queueMap` (de
   `eventRoutingConfig.js`) y hace `SendMessage` / `SendMessageBatch` a la **cola SQS FIFO** de ese BC.
2. **Sidecar (best-effort, en paralelo):** `PutEvents` al bus de EventBridge para **archivo/replay**.
   Si el sidecar falla, **no rompe** la publicación (se registra `RoutingEventBus.ArchiveSidecarFailures`).

```javascript
import {RoutingEventBus} from '@kace/core/src/shared/infrastructure/events/RoutingEventBus.js';

const bus = new RoutingEventBus({
    sqsClient,                 // @aws-sdk/client-sqs
    archiveBus,                // EventBridgeEventBus (sidecar de archivo)
    queueMap,                  // { 'kace.core.case.created': 'https://sqs.../cases.fifo', ... }
});

await bus.publish(event);                 // 1 evento → su cola + archive
await bus.publishBatch(events);           // agrupa por cola, chunks de 10, concurrencia 5
// publishBatch retorna { successful, failed, failedAggregateIds }
```

**Caracteristicas SQS FIFO** (las pone `RoutingEventBus` al enviar):

- `MessageGroupId` = `aggregateId` (orden por caso/agregado)
- `MessageDeduplicationId` = `eventId` (dedup nativa SQS, ventana 5 min)
- `MessageAttributes` incluyen `eventName` y `tenantId`

> **Fail-fast:** si un `eventName` no está en el `queueMap`, `publish()` lanza
> `RoutingEventBus: no queue registered for <eventName>`. Por eso agregar un evento nuevo exige
> registrar su cola en `eventRoutingConfig.js` (ver §13).

### EventBridgeEventBus (Sidecar de Archivo)

Hoy EventBridge **solo** se usa como archivo/auditoría (90 días) — **no enruta a consumidores**.
El `RoutingEventBus` lo invoca internamente como sidecar best-effort.

**Mapeo a EventBridge:**

| DomainEvent   | EventBridge Entry      |
|---------------|------------------------|
| `eventName`   | `DetailType`           |
| `toJson()`    | `Detail` (JSON string) |
| `aggregateId` | `Resources[0]`         |
| `occurredOn`  | `Time`                 |
| `'kace.core'` | `Source`               |

### Cuando usa cada transporte

| Escenario               | Transporte                | Razon                                              |
|-------------------------|---------------------------|----------------------------------------------------|
| Cualquier evento (prod) | SQS FIFO (cola del BC)    | Orden por agregado + entrega confiable + reintentos |
| Mismo evento (archivo)  | EventBridge (sidecar 90d) | Replay/auditoría; no enruta a consumidores          |
| Tests/local             | `InMemoryEventBus`        | Suscripción en memoria, sin AWS                     |

---

## 9. Idempotencia y Deduplicacion

### Por que es necesaria

SQS tiene entrega **at-least-once**: un mensaje puede llegar mas de una vez. El `EventDeduplicator` garantiza que cada
evento se procese **exactamente una vez**.

### Como funciona

```
1. Llega evento a la Lambda
2. EventDeduplicator.isAlreadyProcessed(eventId) → consulta tabla event_deduplication
3. Si ya existe → SKIP (no procesar de nuevo)
4. Si no existe → procesar normalmente
5. Al terminar → EventDeduplicator.markAsProcessed(domainEvent) → INSERT en tabla
```

### Tabla event_deduplication

```sql
CREATE TABLE event_deduplication
(
    event_id     VARCHAR(36) PRIMARY KEY, -- UUID del evento
    event_name   VARCHAR(255) NOT NULL,   -- nombre del evento
    aggregate_id VARCHAR(36)  NOT NULL,   -- ID del aggregate
    processed_at TIMESTAMP DEFAULT NOW()  -- cuando se proceso
);
```

### Uso en el handler

La idempotencia la aplica **el motor compartido**, no tu handler. Está en
`src/shared/runWithDeduplication.mjs` (lo invoca `createEventLambdaHandler` por cada evento). No
necesitas hacer nada adicional en los handlers de cada BC. El flujo ya incluye:

```javascript
// src/shared/runWithDeduplication.mjs (ya implementado, invocado por el motor)
// 1. ¿ya procesado? → EventDeduplicator.isAlreadyProcessed(eventId) → return { deduped: true }
// 2. factory = handlerFactories.get(eventName)  → si no existe → throw (irá a fallo/DLQ)
// 3. await factory({ userRepository }, domainEvent)  → ejecuta la lógica del BC
// 4. markAsProcessed(domainEvent)  → INSERT en event_deduplication (SOLO si el paso 3 tuvo éxito)
```

- `markAsProcessed` ocurre **solo después** de que el handler tuvo éxito: si el handler falla, el
  evento **no** se marca y SQS lo reintenta (at-least-once + barrera idempotente durable).
- Es la **segunda línea** de dedup; la primera es el `MessageDeduplicationId = eventId` de SQS FIFO
  (ventana de 5 min). La tabla `event_deduplication` cubre reintentos/replays más allá de esa ventana.

---

## 10. Testing

### Patron para tests de eventos en Use Cases

```javascript
import {jest} from '@jest/globals';
import {InMemoryEventBus} from '@kace/core/src/shared/infrastructure/events/InMemoryEventBus.js';
import {EventPublisher} from '@kace/core/src/shared/application/events/EventPublisher.js';

describe('ClientCreator', () => {
    let eventBus;
    let eventPublisher;

    beforeEach(() => {
        eventBus = new InMemoryEventBus();
        eventPublisher = new EventPublisher(eventBus);
    });

    it('should publish ClientCreated event after saving', async () => {
        // Arrange
        const publishedEvents = [];
        eventBus.subscribe('kace.core.client.created', (event) => {
            publishedEvents.push(event);
        });

        const creator = new ClientCreator(mockRepository, eventPublisher);

        // Act
        await creator.execute({
            id: 'client-uuid',
            name: 'Acme Corp',
            email: 'contact@acme.com',
            created_by: 'user-uuid',
        });

        // Assert
        expect(publishedEvents).toHaveLength(1);
        expect(publishedEvents[0].eventName).toBe('kace.core.client.created');
        expect(publishedEvents[0].aggregateId).toBe('client-uuid');
        expect(publishedEvents[0].payload.name).toBe('Acme Corp');
    });

    it('should work without eventPublisher (backward compatible)', async () => {
        // Arrange: sin eventPublisher
        const creator = new ClientCreator(mockRepository);

        // Act & Assert: no debe lanzar error
        const result = await creator.execute(dto);
        expect(result).toBeDefined();
    });
});
```

### Patron para tests de Domain Events

```javascript
import {CaseCreated} from '@kace/core/src/cases/domain/events/CaseCreated.js';
import {ValueObjectUuid} from '@kace/core/src/shared/domain/value-object/ValueObjectUuid.js';

describe('CaseCreated', () => {
    it('should create event with correct name and payload', () => {
        // Arrange
        const caseId = ValueObjectUuid.random();

        // Act
        const event = new CaseCreated({
            caseId,
            clientId: ValueObjectUuid.random(),
            responsibleId: ValueObjectUuid.random(),
            classificationId: ValueObjectUuid.random(),
            groupId: ValueObjectUuid.random(),
            transitionId: ValueObjectUuid.random(),
            metadata: {tenant_id: 'acme', user_id: 'user-1', correlation_id: null, causation_id: null},
        });

        // Assert
        expect(event.eventName).toBe('kace.core.case.created');
        expect(event.aggregateId).toBe(caseId);
        expect(event.payload.clientId).toBeDefined();
        expect(event.metadata.tenant_id).toBe('acme');
    });

    it('should be immutable', () => {
        const event = new CaseCreated({ /* ... */});

        // payload y metadata estan frozen
        expect(() => {
            event.payload.newField = 'x';
        }).toThrow();
    });

    it('should serialize and deserialize correctly', () => {
        const event = new CaseCreated({ /* ... */});
        const json = event.toJson();
        const restored = DomainEvent.fromJson(json);

        expect(restored.eventId).toBe(event.eventId);
        expect(restored.eventName).toBe(event.eventName);
    });
});
```

### Patron para tests de Event Handlers

```javascript
import {jest} from '@jest/globals';
import ExecuteActionsOnCaseCreated
    from '@kace/core/src/cases/application/event-handlers/ExecuteActionsOnCaseCreated.js';
import {DomainEvent} from '@kace/core/src/shared/domain/events/DomainEvent.js';
import {ValueObjectUuid} from '@kace/core/src/shared/domain/value-object/ValueObjectUuid.js';

describe('ExecuteActionsOnCaseCreated', () => {
    let mockCaseRepository;
    let mockActionExecutionService;

    beforeEach(() => {
        mockCaseRepository = {
            search: jest.fn().mockResolvedValue({ /* mock case */}),
        };
        mockActionExecutionService = {
            execute: jest.fn().mockResolvedValue(undefined),
        };
    });

    it('should execute actions for the created case', async () => {
        // Arrange
        const caseId = ValueObjectUuid.random();
        const event = new DomainEvent({
            eventName: 'kace.core.case.created',
            aggregateId: caseId,
            payload: {responsibleId: ValueObjectUuid.random()},
            metadata: {tenant_id: 'tenant-uuid', user_id: 'creator-uuid'},
        });

        const handler = new ExecuteActionsOnCaseCreated(
            mockCaseRepository,
            mockActionExecutionService
        );

        // Act
        await handler.handle(event);

        // Assert
        expect(mockCaseRepository.search).toHaveBeenCalled();
        expect(mockActionExecutionService.execute).toHaveBeenCalled();
    });
});
```

### Patron para tests de EventBus (mock)

```javascript
import {jest} from '@jest/globals';

// Mock simple del EventBus para unit tests de use cases
const mockEventBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    publishBatch: jest.fn().mockResolvedValue({successful: 1, failed: 0}),
};
const eventPublisher = new EventPublisher(mockEventBus);

// Verificar que se publico
expect(mockEventBus.publishBatch).toHaveBeenCalledWith(
    expect.arrayContaining([
        expect.objectContaining({
            eventName: 'kace.core.case.created',
        }),
    ])
);
```

### Ejecutar tests de eventos

```bash
# Todos los tests de eventos (desde packages/kace_cloud_core/)
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  --testPathPattern="events|Events|event" --no-coverage

# Tests del Lambda handler (desde apps/apiv1/kace_cloud_api_event_processor/)
node --experimental-vm-modules node_modules/jest/bin/jest.js --no-coverage

# Un test especifico
node --experimental-vm-modules node_modules/jest/bin/jest.js \
  --testPathPattern="CaseCreated.test" --no-coverage
```

**Nota ESM:** Si usas archivos `.mjs` para tests, debes importar jest explicitamente:

```javascript
import {jest} from '@jest/globals';
```

---

## 11. Flujo Completo: De Publicacion a Procesamiento

### Ejemplo: Creacion de un Caso

```
1. POST /api/cases → Lambda Handler
   │
2. │→ CaseCreator.execute(dto)
   │   │
   │   ├── Case.create(dto)
   │   ├── repository.save(case)                    ← Persiste en PostgreSQL
   │   │
   │   └── #publishDomainEvents(case)
   │       ├── case.recordDomainEvent(new CaseCreated({...}))
   │       ├── events = case.pullDomainEvents()
   │       └── eventPublisher.publishAll(events)
   │           │
3. │           └── EventPublisher.publishAll(events) → RoutingEventBus.publishBatch(events)
   │               │
   │               ├── queueMap['kace.core.case.created'] → cola cases-events.fifo
   │               ├── SendMessage(queueUrl, event)        ← hot path: SQS FIFO del BC cases
   │               │   ├── MessageGroupId: caseId          (orden por caso)
   │               │   └── MessageDeduplicationId: eventId
   │               └── EventBridge.PutEvents(event)         ← sidecar archive (best-effort)
   │
4. SQS → Lambda Event Source Mapping (batch de hasta 10)
   │
5. │→ event-processor-cases (invocado por SQS)
   │   │
   │   ├── DomainEvent.fromJson(eventPayload)       ← Deserializar
   │   ├── EventDeduplicator.isAlreadyProcessed()   ← Check idempotencia
   │   │
   │   ├── ExecuteActionsOnCaseCreated.handle()      ← Ejecuta acciones automaticas
   │   │   ├── CaseFinder.execute(caseId)
   │   │   ├── ActionExecutionDomainService.execute('create_case', case)
   │   │   └── UpdateSLATimers
   │   │
   │   └── EventDeduplicator.markAsProcessed()       ← Marca como procesado
   │       └── INSERT INTO event_deduplication (...)
   │
6. Respuesta API → 201 Created
```

### Ejemplo: Ejecucion de Acciones Automatizadas (EventBridge)

```
1. EventBridge Schedule (actions-queue-executions) → Lambda Orchestrator
   │
2. │→ actions_queue_executions (producer)
   │   │
   │   ├── Calcula acciones elegibles + casos aplicables
   │   ├── repository.save(execution)                     ← Persiste fila pending
   │   │
   │   └── EventPublisher.publish(new AutomatedActionsRequested({...}))
   │
3. │→ RoutingEventBus.publish(event)
   │   │
   │   ├── queueMap['kace.core.automated_actions.requested'] → cola automated-actions-events.fifo
   │   ├── SendMessage(queueUrl, event)                   ← hot path: SQS FIFO del BC automated-actions
   │   │     └── MessageGroupId: executionId
   │   └── EventBridge.PutEvents(event)                   ← sidecar archive (best-effort)
   │
4. SQS → Lambda Event Source Mapping → event-processor-automated-actions
   │
5. │→ event-processor-automated-actions
   │   │
   │   ├── DomainEvent.fromJson(body)                     ← motor: normaliza + agrupa por tenant
   │   ├── EventDeduplicator.isAlreadyProcessed(eventId)  ← Check idempotencia
   │   │
   │   ├── handlerFactories.get(eventName)                ← factory del Map en src/automated-actions/handler.mjs
   │   │   └── ProcessActionQueueOnCronJobRequested.handle(domainEvent)
   │   │       └── ActionQueueExecutor.executeByExecutionId(executionId)
   │   │           ├── Valida execution pending + trigger_type cron_job
   │   │           └── Procesa 1 ejecucion y actualiza estado
   │   │
   │   └── EventDeduplicator.markAsProcessed(domainEvent)
   │       └── INSERT INTO event_deduplication (...)
   │
6. Resultado final
   ├── La ejecucion en cola pasa a completed/failed
   └── No se invoca actions-queue-executor (flujo retirado)
```

> **Nota:** El productor es `actions_queue_executions` (worker ECS) y publica el evento de solicitud
> de ejecución. El `event-processor-automated-actions` consume ese evento **desde su cola SQS FIFO**
> y ejecuta la cola por `executionId`. El servicio `actions-queue-executor` queda retirado del flujo
> productivo.

---

## 12. Eventos Existentes

### Eventos Implementados

> Todos los eventos viajan por **SQS FIFO** (cola del BC destino) con sidecar de archivo en EventBridge.
> Ya **no** hay clasificación "crítico/no-crítico": el routing es por `eventName → cola`.

| Evento                                       | Clase                          | Cola SQS FIFO (BC)        | Lambda / Handler                                       |
|----------------------------------------------|--------------------------------|---------------------------|--------------------------------------------------------|
| `kace.core.case.created`                     | `CaseCreated`                  | `*-cases`                 | `event-processor-cases` / `ExecuteActionsOnCaseCreated` |
| `kace.core.case.updated`                     | `CaseUpdated`                  | `*-cases`                 | `event-processor-cases` / `ExecuteActionsOnCaseUpdated` |
| `kace.core.case.post_processing.requested`   | `CasePostProcessingRequested`  | `*-case-post-processing`  | `event-processor-case-post-processing` / `CasePostProcessingOnCaseCreated` |
| `kace.core.action_job.created`               | `ActionJobCreated`             | `*-action-jobs`           | `event-processor-action-jobs` / `ProcessJobOnActionJobCreated` |
| `kace.core.automated_actions.requested`      | `AutomatedActionsRequested`    | `*-automated-actions`     | `event-processor-automated-actions` / `ProcessActionQueueOnCronJobRequested` |
| `kace.core.ws_rest_flow_execution.requested` | `WSRestFlowExecutionRequested` | `*-ws-rest`               | `event-processor-ws-rest` / `ExecuteWSRestFlowOnExecutionRequested` |
| `kace.core.report_execution.requested`       | `ReportExecutionRequested`     | `*-reports`               | `event-processor-reports` / `ExecuteReportOnExecutionRequested` |

### Payload de cada evento

**CaseCreated:**

```json
{
  "eventName": "kace.core.case.created",
  "aggregateId": "uuid-del-caso",
  "payload": {
    "clientId": "uuid-del-cliente",
    "responsibleId": "uuid-del-responsable",
    "classificationId": "uuid-de-clasificacion",
    "groupId": "uuid-del-grupo",
    "transitionId": "uuid-de-transicion"
  },
  "metadata": {
    "tenant_id": null,
    "user_id": "uuid-del-creador",
    "correlation_id": null,
    "causation_id": null
  }
}
```

**AutomatedActionsRequested:**

```json
{
  "eventName": "kace.core.automated_actions.requested",
  "aggregateId": "uuid-de-la-ejecucion-en-cola",
  "payload": {
    "executionId": "uuid-de-la-ejecucion-en-cola",
    "actionId": "uuid-de-la-accion",
    "caseId": "uuid-del-caso",
    "clientId": "uuid-del-cliente",
    "triggerType": "cron_job"
  },
  "metadata": {
    "tenant_id": null,
    "user_id": "uuid-del-proceso",
    "correlation_id": null,
    "causation_id": null
  }
}
```

**CasePostProcessingRequested:** (`aggregateId` = `caseId`)

```json
{
  "eventName": "kace.core.case.post_processing.requested",
  "aggregateId": "uuid-del-caso",
  "payload": {
    "parentId": "uuid-del-caso-padre-o-null"
  },
  "metadata": {
    "tenant_id": "uuid",
    "user_id": "uuid-del-creador",
    "correlation_id": null,
    "causation_id": null
  }
}
```

**ReportExecutionRequested:** (`aggregateId` = `executionId`)

```json
{
  "eventName": "kace.core.report_execution.requested",
  "aggregateId": "uuid-de-la-ejecucion-de-reporte",
  "payload": {
    "reportName": "nombre-de-la-vista-o-reporte",
    "parameters": {}
  },
  "metadata": {
    "tenant_id": "uuid",
    "user_id": "uuid-del-solicitante",
    "correlation_id": null,
    "causation_id": null
  }
}
```

---

## 13. Guia Rapida: Agregar un Evento Nuevo (Checklist)

Cuando necesites agregar un nuevo evento al sistema, sigue estos pasos:

### 1. Crear el evento

- [ ] Crear archivo `src/<modulo>/domain/events/<Evento>.js`
- [ ] Extender `DomainEvent`
- [ ] Definir `static EVENT_NAME` con formato `kace.core.<aggregate>.<accion>`
- [ ] Documentar el constructor con JSDoc

### 2. Emitir desde el use case

- [ ] Agregar `eventPublisher` como parametro opcional del constructor
- [ ] Crear metodo privado `#publishDomainEvents()`
- [ ] Usar `aggregate.recordDomainEvent(new MiEvento({...}))`
- [ ] Llamar `eventPublisher.publishAll(aggregate.pullDomainEvents())`
- [ ] Envolver en try/catch (nunca romper flujo principal)
- [ ] Publicar DESPUES de persistir

### 3. Crear handler (si aplica)

- [ ] Crear `src/<modulo>/application/event-handlers/<Action>On<Evento>.js`
- [ ] Implementar metodo `async handle(domainEvent)`
- [ ] Registrar la factory en el `Map` (`handlerFactories`) del `src/<bc>/handler.mjs` del BC destino (ver §7)

### 4. Registrar el routing `eventName → cola`

Todo evento se enruta por SQS. Decide a qué **bounded context (cola)** va y registra el mapeo.

**Si reutilizas la cola de un BC existente** (lo más común):

- [ ] Agregar la entrada `eventName → campo de URL del Tenant` en
  `packages/kace_cloud_core/src/shared/infrastructure/events/eventRoutingConfig.js`
- [ ] Registrar el handler en el `Map` del `src/<bc>/handler.mjs` correspondiente (ver §7)

**Si necesitas un BC nuevo** (su propia cola + Lambda):

- [ ] Crear `src/<bc>/handler.mjs` en el `event-processor` y registrarlo en `event-processor-stack.ts`
  vía `buildBcInfra(idPrefix, bcKebab, profile)` (define cola FIFO + DLQ + Lambda + perfil)
- [ ] Agregar el campo de URL de cola al agregado `Tenant` y poblarlo en DynamoDB (backfill por tenant)
- [ ] Añadir la entrada en `eventRoutingConfig.js`
- [ ] Exportar el output de la cola y regenerar permisos IAM en los productores

> **IMPORTANTE:** EventBridge ya **no** enruta a consumidores (es solo archivo). Si olvidas registrar
> la cola en `eventRoutingConfig.js`, `RoutingEventBus.publish()` lanza
> `no queue registered for <eventName>` en el productor (fallo visible, no silencioso).

### 5. (Obsoleto) Clasificación crítico/no-crítico

> Ya **no existe** `HybridEventBus.DEFAULT_CRITICAL_EVENTS` ni la dicotomía SQS-críticos /
> EventBridge-no-críticos. **Todos** los eventos van por SQS FIFO (cola por BC). El orden por agregado
> lo da el `MessageGroupId = aggregateId`. Este paso se mantiene solo como nota histórica; no hay nada
> que configurar aquí.

### 6. Otorgar permisos IAM en el CDK Stack

Si la Lambda que publica eventos **no tiene permisos** para enviar a SQS/EventBridge, debes otorgarlos en su stack CDK:

- [ ] Configurar las variables de entorno de ARN de cola por BC (`AWS_*_EVENTS_QUEUE_ARN`) y `AWS_EVENTBRIDGE_EVENT_BUS_ARN`
- [ ] Llamar `this.grantEventPublishingPermissions(lambdaFunction)` en el stack de la Lambda productora

```typescript
// Ejemplo: cases-stack.ts
const lambdaFunction = this.getNodejsFunction(path);
this.grantDynamoDbPermissions(path, lambdaFunction);
this.grantEventPublishingPermissions(lambdaFunction); // ← Otorga sqs:SendMessage + events:PutEvents
```

> **Nota:** Este paso solo es necesario para Lambdas que **publican** eventos (productores). La Lambda del Event
> Processor (consumidor) ya tiene sus permisos configurados en `event-processor-stack.ts`.

### 7. Tests

- [ ] Test del evento: creacion, inmutabilidad, serializacion
- [ ] Test del use case: publicacion del evento, backward compatibility
- [ ] Test del handler: creacion correcta de notificacion
- [ ] Ejecutar suite completa:
  `node --experimental-vm-modules node_modules/jest/bin/jest.js --testPathPattern="events" --no-coverage`

### 8. Formato

- [ ] `pnpm exec prettier --write <archivos-nuevos>`

---

## 14. Errores Comunes y Troubleshooting

### "DomainEvent: aggregateId is required"

El `aggregateId` debe ser un UUID valido. Asegurate de pasar el `.value` del ValueObject:

```javascript
// MAL
new CaseCreated({caseId: kase.id});

// BIEN
new CaseCreated({caseId: kase.id.value});
```

### "EventPublisher: eventBus is required"

El `EventPublisher` necesita una instancia de `EventBus`:

```javascript
// MAL
const publisher = new EventPublisher();

// BIEN
const publisher = new EventPublisher(new InMemoryEventBus());
```

### Circular dependency / TDZ errors

**NUNCA** importes desde barrel files (`index.js`) en codigo fuente. Usa imports directos:

```javascript
// MAL - causa circular dependencies
import {DomainEvent} from '../../../shared';

// BIEN - import directo
import {DomainEvent} from '../../../shared/domain/events/DomainEvent.js';
```

### jest.fn() no definido en archivos .mjs

En archivos de test con extension `.mjs`, Jest no expone globals automaticamente:

```javascript
// NECESARIO en archivos .mjs
import {jest} from '@jest/globals';
```

### "is not authorized to perform: sqs:sendmessage"

La Lambda productora no tiene permisos IAM para enviar mensajes a la cola SQS. Solucion:

1. Verificar que las variables de entorno de ARN de cola por BC (`AWS_*_EVENTS_QUEUE_ARN`) y
   `AWS_EVENTBRIDGE_EVENT_BUS_ARN` están configuradas en el pipeline/CI
2. Agregar `this.grantEventPublishingPermissions(lambdaFunction)` en el stack CDK de la Lambda
3. Redesplegar el stack

```typescript
// Ejemplo en cases-stack.ts
this.grantDynamoDbPermissions(path, lambdaFunction);
this.grantEventPublishingPermissions(lambdaFunction); // ← Agregar esta linea
```

### "No matching export for import" o "ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING"

Verifica que los imports de plugins de `dayjs` no incluyan la extension `.d.ts`:

```javascript
// MAL - importa archivo de tipos, rompe esbuild y Node.js 22
import duration from 'dayjs/plugin/duration.d.ts';

// BIEN
import duration from 'dayjs/plugin/duration';
```

Node.js 22 tiene type stripping experimental que falla con archivos `.d.ts` bajo `node_modules`.

### Evento no se procesa / no llega al handler

1. Verificar que el evento se esta publicando (check logs del use case)
2. **Verificar que el `eventName` está en `eventRoutingConfig.js`** y que el `Tenant` tiene poblada la
   URL de cola correspondiente. Si falta, `RoutingEventBus.publish()` lanza
   `no queue registered for <eventName>` (o el builder falla por campo de Tenant ausente).
   **Este es el error más común al agregar eventos nuevos.**
3. Verificar que el `eventName` está registrado en el `Map` (`handlerFactories`) del `src/<bc>/handler.mjs`
   correcto. Si la factory no existe, el motor lanza y el mensaje va a fallo/DLQ.
4. Verificar que la cola SQS del BC y su Event Source Mapping están desplegados
5. Verificar que la tabla `event_deduplication` no tiene ya ese `eventId` (ya procesado → se omite)

### Handler falla pero SQS no reintenta

Si un handler falla y el mensaje no aparece en `batchItemFailures`, verifica que **la factory del
evento en `src/<bc>/handler.mjs` no tenga un try/catch propio**. Los errores deben propagarse al motor
(`createEventLambdaHandler`), que es quien empuja el `messageId` a `batchItemFailures` y emite
`EventProcessor.HandlerErrors`. Si una factory atrapa el error y no lo relanza, el motor lo da por
exitoso y SQS **no** reintenta. Revisa CloudWatch Logs y la métrica `EventProcessor.HandlerErrors`
del BC afectado.

---

## 15. Glosario

| Termino                     | Definicion                                                                     |
|-----------------------------|--------------------------------------------------------------------------------|
| **Domain Event**            | Objeto inmutable que representa algo que ocurrio en el dominio                 |
| **Aggregate**               | Entidad raiz que produce eventos (ej: `Case`, `Client`)                        |
| **AggregateRoot**           | Clase base que soporta `recordDomainEvent()` y `pullDomainEvents()`            |
| **EventBus**                | Port (interfaz) que define como se transportan los eventos                     |
| **EventPublisher**          | Servicio de aplicacion que envuelve el EventBus con logging                    |
| **RoutingEventBus**         | Bus de producción: enruta cada evento por `eventName` a su cola SQS FIFO + sidecar de archivo en EventBridge |
| **Event Handler**           | Clase que reacciona a un evento especifico (ej: crea notificacion)             |
| **EventDeduplicator**       | Servicio que garantiza procesamiento exactly-once                              |
| **Idempotencia**            | Propiedad de que procesar un evento multiples veces produce el mismo resultado |
| **FIFO Queue**              | Cola SQS que garantiza orden y deduplicacion nativa                            |
| **Fan-out**                 | Patron donde un evento se envia a multiples consumidores                       |
| **Dead Letter Queue (DLQ)** | Cola donde van los mensajes que fallaron despues de N reintentos               |
| **Partial Batch Failure**   | Capacidad de reportar solo los mensajes fallidos de un batch                   |

---

## Infraestructura AWS (CDK)

La infraestructura se define en `apps/apiv1/kace_cloud_api_event_processor/lib/event-processor-stack.ts`:

Cada BC se construye con `buildBcInfra(idPrefix, bcKebab, profile)`, que crea por BC: cola FIFO
principal, DLQ FIFO, Lambda y alarmas. El bus de EventBridge es único (archive). Recursos:

| Recurso             | Nombre                                  | Descripcion                                            |
|---------------------|-----------------------------------------|--------------------------------------------------------|
| SQS FIFO Queue (×6) | `{service}-{bc}-events-queue.fifo`       | Cola por BC: `cases`, `action-jobs`, `automated-actions`, `ws-rest`, `case-post-processing`, `reports` |
| SQS DLQ (×6)        | `{service}-{bc}-events-dlq.fifo`         | Dead Letter Queue por BC (14 días retención, tras 3 intentos) |
| EventBridge Bus     | `{service}-event-bus`                    | Bus único — **solo archivo/auditoría** (no enruta a consumidores) |
| EventBridge Archive | `{service}-events-archive`               | Archivo de 90 días para replay (patrón `source: ['kace.core']`) |
| Lambda (×6)         | `event-processor-{bc}`                   | Una por BC; consume su cola con `reportBatchItemFailures` |
| CloudWatch Alarms   | por BC + bus                             | DLQ > 5, errores ≥ 1, throttles > 10, p99 > 80% timeout; backlog solo `ws-rest`; `FailedInvocations` del bus |

> **Ya no existen** reglas de EventBridge `{service}-*-events-rule` que enruten a la Lambda: el routing
> a consumidores lo hace `RoutingEventBus` (eventName → cola SQS) en el productor. EventBridge quedó
> reducido a archive sidecar.

### Permisos IAM para Lambdas Productoras

Las Lambdas que publican eventos necesitan permisos `sqs:SendMessage` y `events:PutEvents`. El metodo
`grantEventPublishingPermissions()` de `KApiStack` los otorga automaticamente usando los ARNs configurados en
`KApiStackProps`:

`grantEventPublishingPermissions()` otorga `sqs:SendMessage` sobre **las 6 colas por BC** (las que
estén configuradas) y `events:PutEvents` sobre el bus de archivo. Las ARNs salen de variables de
entorno por BC:

| Propiedad KApiStackProps              | Variable de Entorno                          | Permiso IAM        |
|---------------------------------------|----------------------------------------------|--------------------|
| `awsCasesEventsQueueArn`              | `AWS_CASES_EVENTS_QUEUE_ARN`                 | `sqs:SendMessage`  |
| `awsActionJobsEventsQueueArn`         | `AWS_ACTION_JOBS_EVENTS_QUEUE_ARN`           | `sqs:SendMessage`  |
| `awsAutomatedActionsEventsQueueArn`   | `AWS_AUTOMATED_ACTIONS_EVENTS_QUEUE_ARN`     | `sqs:SendMessage`  |
| `awsWsRestEventsQueueArn`             | `AWS_WS_REST_EVENTS_QUEUE_ARN`               | `sqs:SendMessage`  |
| `awsCasePostProcessingEventsQueueArn` | `AWS_CASE_POST_PROCESSING_EVENTS_QUEUE_ARN`  | `sqs:SendMessage`  |
| `awsReportsEventsQueueArn`            | `AWS_REPORTS_EVENTS_QUEUE_ARN`               | `sqs:SendMessage`  |
| `awsEventBridgeEventBusArn`           | `AWS_EVENTBRIDGE_EVENT_BUS_ARN`              | `events:PutEvents` |

```typescript
// En cualquier stack que publique eventos:
const lambdaFunction = this.getNodejsFunction(path);
this.grantEventPublishingPermissions(lambdaFunction);
```

**Stacks que actualmente publican eventos** (llaman a `grantEventPublishingPermissions`):

| Stack                        | Lambda                    | Eventos que publica                                                                |
|------------------------------|---------------------------|------------------------------------------------------------------------------------|
| `CasesStack`                 | cases_lambda              | `kace.core.case.created`, `kace.core.case.updated`, `kace.core.case.post_processing.requested` |
| `WsHookRestFlowsStack`       | ws-hook-rest-flows_lambda | `kace.core.ws_rest_flow_execution.requested`                                       |
| `ActionBatchExecutionsStack` | action-batch_lambda       | `kace.core.action_job.created`                                                     |
| `ReportExecutionsStack`      | report-executions_lambda  | `kace.core.report_execution.requested`                                            |
| Worker ECS `actions-queue-executions` (servicio `fast`) | — | `kace.core.automated_actions.requested` |

> El worker ECS tiene su propio task role (no es `KApiStack`); ver `WORKERS_AND_SCHEDULED_TASKS.md` §2.4.

### Variables de Entorno (Tenant)

El `Tenant` lleva una URL de cola por BC (más región y bus de EventBridge), que
`buildRoutingEventBusFromTenant` usa para armar el `queueMap`:

```
aws_cases_events_queue_url
aws_action_jobs_events_queue_url
aws_automated_actions_events_queue_url
aws_ws_rest_events_queue_url
aws_case_post_processing_queue_url        (opcional / tolerante — backfill operativo)
aws_reports_events_queue_url
aws_event_bridge_event_bus_name           (bus de archivo)
aws_sqs_region / aws_event_bridge_region  (AWS Region)
```

Estos valores se exportan como CloudFormation Outputs desde el `event-processor-stack` y se pueblan por
tenant en DynamoDB.

---

## 16. Escalabilidad del Event Processor

### Estado Actual (Fase 3 implementada)

El event processor está dividido por **bounded context**: 1 Lambda + 1 cola SQS FIFO por BC. Los productores escriben directamente a la cola del BC consumidor vía `RoutingEventBus` (mapa eventName → queueUrl resuelto desde el Tenant DynamoDB). EventBridge solo se usa como sidecar de archive de 90 días para replay/audit — NO enruta a consumidores.

```
                              PRODUCTORES
        ┌──────────────────────────────────────────────────────┐
        │  cases lambda           │   ws-hook-rest-flows lambda │
        │  worker / schedulers    │   (otros productores)       │
        └────────────┬────────────┴───────────────┬─────────────┘
                     │                            │
                     ▼                            ▼
            ┌────────────────────────────────────────────┐
            │       RoutingEventBus (en @kace/core)      │
            │  eventName → queueUrl  (mapa explícito)    │
            │  publish(event):                           │
            │   1. SQS.SendMessage(queueMap[name], evt)  │
            │   2. EventBridge.PutEvents(evt) ← archive  │
            └─────────┬──────────────────────────┬───────┘
                      │ hot path                 │ archive sidecar
        ┌─────────────┼──────────┬─────────────┐ │
        ▼             ▼          ▼             ▼ ▼
   ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────────┐
   │ cases-  │  │action-   │  │automated│  │ EventBridge  │
   │ events  │  │jobs-     │  │actions- │  │ kace-event-  │
   │ SQS FIFO│  │events    │  │events   │  │ bus + Archive│
   └────┬────┘  │SQS FIFO  │  │SQS FIFO │  │ 90 días      │
        ▼       └────┬─────┘  └────┬────┘  │ SIN reglas a │
   ┌─────────┐  ┌──────────┐  ┌─────────┐ │ consumidores │
   │ cases   │  │action-   │  │automated│ └──────────────┘
   │ Lambda  │  │jobs Lamb.│  │actions L│
   └─────────┘  └──────────┘  └─────────┘
   (+ ws-rest, case-post-processing y reports: cada uno con su SQS FIFO + Lambda, mismo patrón → 6 BC en total)
```

### Perfiles por BC

| BC                   | Timeout (s) | Memory (MB) | Reserved | Batch | maxConc |
|----------------------|-------------|-------------|----------|-------|---------|
| cases                | 60          | 1024        | 100      | 10    | 100     |
| action-jobs          | 300         | 1024        | 100      | 10    | 100     |
| automated-actions    | 120         | 1024        | 100      | 10    | 100     |
| ws-rest              | 600         | 1024        | 200      | 1     | 200     |
| case-post-processing | 30          | 512         | 50       | 10    | 50      |
| reports              | 600         | 1024        | 50       | 1     | 50      |

> Los perfiles son la fuente de verdad en `apps/apiv1/kace_cloud_api_event_processor/lib/event-processor-stack.ts` (`static readonly` BcProfile). Ajustar ahí y re-desplegar.

### Añadir un evento nuevo (post-Fase 3)

1. Crear el `DomainEvent` (igual que antes — sección 5).
2. Decidir el BC de destino. Si es uno existente, ir al paso 4.
3. Si requiere un BC nuevo: crear `src/<bc>/handler.mjs`, registrarlo en `event-processor-stack.ts` vía `buildBcInfra`, exportar outputs, y regenerar permisos IAM en productores (`KApiStack.grantEventPublishingPermissions` cubre las colas por ARN).
4. Añadir la entrada eventName → campo de queue-url del Tenant en `packages/kace_cloud_core/src/shared/infrastructure/events/eventRoutingConfig.js`, y el campo correspondiente en el `Tenant` aggregate + poblarlo en DynamoDB.
5. Registrar el handler en `src/<bc>/handler.mjs` (entrada en `handlerFactories`).
6. Deploy de EventProcessorStack + stacks productores.

### Replay desde Archive

Si un evento se perdió o un handler tenía un bug, EventBridge Archive permite replay (90 días de retención):

```bash
aws events start-replay \
  --replay-name "replay-<descriptor>" \
  --event-source-arn arn:aws:events:<region>:<account>:archive/<svc>-events-archive \
  --destination Arn=<bus-arn> \
  --event-start-time "2026-05-24T00:00:00Z" \
  --event-end-time "2026-05-24T23:59:59Z"
```

Nota: el replay reenvía al EventBridge bus. Como en Fase 3 NO hay reglas bus→consumidor, para reprocesar hay que crear reglas EventBridge→SQS temporales o hacer re-drive manual.
