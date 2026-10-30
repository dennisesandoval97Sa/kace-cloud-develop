# Guía A — Arquitectura

**Versión 1.00 — Documento normativo**

| Versión | Fecha | Descripción | Autor(es) |
| :---- | :---- | :---- | :---- |
| 1.00 | 2026-09-10 | Creación. Sustituye las secciones de arquitectura de la *Guía de Lineamientos y Convenciones* (v1.00, 11/03/2025) | Jose Roberto García López |

**Vigente desde:** fecha de aprobación por el Tech Lead.

Responde a: *¿cómo está construido el sistema y qué reglas no se negocian?*

Documentos hermanos: [Guía B — Estilo y convenciones](style-and-conventions.md) · [Guía C — Decisiones de tooling](tooling-decisions.md) · [Definition of Done](definition-of-done.md) · [Checklist para PR](../../.github/PULL_REQUEST_TEMPLATE.md) · [DevSecOps Handbook de Konecta](https://devsecops-hub.konecta.cloud/devsecops-handbook.html) (requiere sesión de Google).

Las reglas marcadas **[bloqueante]** impiden la aprobación de un PR. Cada una incluye el motivo: conocerlo evita reintroducir el problema por otra vía.

---

## 1. Principios

- **SOLID.** Una razón para cambiar por clase; abierto a extensión, cerrado a modificación; subtipos sustituibles; interfaces pequeñas; depender de abstracciones.
- **DRY, KISS, YAGNI.** No duplicar lo que ya resuelve `@kace/core`; la solución más simple que cumpla el criterio de aceptación; ninguna abstracción sin al menos dos usos reales.
- **Tell, Don't Ask** y **Ley de Demeter.** Los agregados ejecutan acciones sobre su estado; el código habla con sus colaboradores directos, no con los colaboradores de sus colaboradores.
- **Fail Fast.** Validar en el borde (Joi) y en los Value Objects; un error se propaga con contexto, nunca se traga.
- **Composición sobre herencia.** La única jerarquía obligatoria es la técnica: `AggregateRoot`, `KnexRepository`, `BaseController`.

---

## 2. Vista de conjunto

KACE Cloud es un monorepo pnpm con tres tipos de piezas:

| Pieza | Ubicación | Qué es |
| :--- | :--- | :--- |
| Microservicios | `apps/apiv1/kace_cloud_api_*` (95) | Un Lambda por bounded context expuesto en API Gateway. Contienen `handler.mjs`, controladores, `schemas.mjs` (Joi) y su stack CDK. No contienen lógica de negocio. |
| Frontend | `apps/kace-saas` | SPA React 18 con Vite. |
| Paquetes | `packages/` | `@kace/core` (dominio y casos de uso, 78 módulos), `@kace/api-common` (handler, controladores base, tenant, seguridad, respuestas HTTP), `@kace/database` (migraciones y seeds Knex), `@kace/aws-infra` y `@kace/aws-database` (CDK base), `@kace/schemabuilder`, `@kace/error-codes`, `@kace/file-extensions`, `@kace/eslint-config`, `@kace/prettier_config`, `@kace/local-server`, `@kace/perf`, `@kace/db-sync`. |

Infraestructura: AWS Lambda + API Gateway, PostgreSQL (Aurora con RDS Proxy, un esquema por tenant), DynamoDB `kace_multi_tenancy`, S3, Cognito, colas SQS FIFO y EventBridge para eventos de dominio, RabbitMQ y un worker ECS para acciones automatizadas.

Diagramas C4: [contexto](../architecture/c4-level-1-system-context.md), [contenedores](../architecture/c4-level-2-containers.md), [componentes](../architecture/c4-level-3-components.md). Vista narrativa: [ARCHITECTURE.md](../ARCHITECTURE.md).

Flujo de una petición:

```
API Gateway → handler.mjs (withTenantContext) → Controller.run() → validación Joi
→ caso de uso de @kace/core → agregado + repositorio → PostgreSQL (esquema del tenant)
→ evento de dominio (opcional) → cola SQS FIFO del tenant → Lambda event_processor → handler <Verbo>On<Evento>
```

---

## 3. `@kace/core`: hexagonal y DDD

### 3.1 Capas

Cada bounded context de `packages/kace_cloud_core/src/<contexto>/` tiene tres capas y una dirección de dependencia única: `infrastructure → application → domain`. El dominio no importa nada de las otras dos.

| Capa | Contiene | No contiene |
| :--- | :--- | :--- |
| `domain/` | Agregado (`Case.js`), Value Objects (`ValueObject*.js`), servicios de dominio, validadores, `events/` (`CaseCreated.js`), errores de dominio | Knex, AWS, HTTP, `process.env` |
| `application/` | Casos de uso por acción (`create/CaseCreator.js`, `find/`, `update/`, `delete/`, `search/`…), DTOs de respuesta (`CaseResponse.js`, `CaseViewCollectionResponse.js`), `event-handlers/` | Consultas SQL, detalles de transporte |
| `infrastructure/` | `persistence/KnexCaseRepository.js`, adaptadores S3/SQS/HTTP, cachés | Reglas de negocio |

Árbol real recortado de `cases/`:

```
cases/
├── domain/
│   ├── Case.js                     # AggregateRoot; propiedades snake_case (cliente_id, transicion_id)
│   ├── ValueObjectCanalId.js
│   ├── CaseFinder.js               # servicio de dominio
│   └── events/CaseCreated.js
├── application/
│   ├── create/CaseCreator.js
│   ├── find/ · find-all/ · get-one/ · search/ · update/ · delete/ · close/ · re-open/ · assign/
│   ├── CaseResponse.js · CaseViewResponse.js · CaseDataGridResponse.js
│   └── event-handlers/ExecuteActionsOnCaseCreated.js
├── infrastructure/
│   └── persistence/KnexCaseRepository.js
└── constants.js
```

### 3.2 Convenciones de nombre

| Elemento | Patrón | Ejemplo |
| :--- | :--- | :--- |
| Caso de uso | `<Agregado><Verbo>` en `application/<accion>/` | `CaseCreator`, `CaseFinder`, `CaseUpdater`, `CaseDeleter`, `CaseBulkCloser` |
| DTO de respuesta | `<Agregado>Response`, `<Agregado>CollectionResponse` | `CaseResponse`, `SubCaseRelationCollectionResponse` |
| Value Object | `ValueObject<Concepto>` | `ValueObjectUuid`, `ValueObjectMotivoBaja` |
| Evento | `<Agregado><AcciónEnPasado>`; nombre `kace.core.<agregado>.<accion>` | `CaseCreated` → `kace.core.case.created` |
| Handler de evento | `<Verbo>On<Evento>` | `ExecuteActionsOnCaseCreated` |
| Repositorio | `Knex<Agregado>Repository` | `KnexCaseRepository` |

### 3.3 Reglas

- **Propiedades del agregado en `snake_case`** (`cliente_id`, `responsable_id`). Reflejan las columnas de PostgreSQL y `changedAttributes` se persiste sin mapeo; por eso ESLint tiene `camelcase: 'off'`. No "corregirlas" a camelCase.
- **Los casos de uso reciben sus dependencias por constructor posicional** (repositorios, `EventPublisher`), ya construidas por el controlador. Un caso de uso no construye repositorios ni lee configuración.
- **Sin barrel files [bloqueante].** Importar del módulo concreto: `import { CaseCreator } from '@kace/core/src/cases/application/create/CaseCreator.js'`. Los `index.js` que existen (`shared/index.js` enlaza 788 módulos) son herencia y no crecen. Motivo: dependencias circulares, `jest.unstable_mockModule` queda inerte cuando el barril carga el módulo antes que el mock, y cada import innecesario alarga el arranque en frío del Lambda.
- **Un elemento exportado por archivo**, preferentemente.
- **Lógica de negocio solo en `@kace/core` [bloqueante].** Un controlador que calcula, decide o compone reglas de negocio está en la capa equivocada.

---

## 4. Lambdas y API

### 4.1 Estructura de un microservicio

```
apps/apiv1/kace_cloud_api_<name>/
├── bin/<name>.ts              # entrada CDK
├── lib/<name>-stack.ts        # stack (KApiStack o manual)
├── src/
│   ├── handler.mjs            # elige el controlador; termina en controller.run()
│   ├── controller.mjs         # BaseController con los action* de CRUD
│   ├── <endpoint>Controller.mjs  # un controlador por endpoint personalizado
│   └── schemas.mjs            # Joi
└── test/*.test.mjs
```

### 4.2 Reglas

- **Todo handler bajo `withTenantContext` [bloqueante].** Inyecta `event.tenantContext` con `knexConfig` y `readerConfig`. Son **objetos de configuración**, no instancias de Knex: no tienen `.raw()`, y un controlador que necesite SQL crudo construye `new KnexRepository(config)` y llama a `destroyConnection()` al terminar. El esquema del tenant es `config.schema`.

```javascript
import { withTenantContext } from '@kace/api-common';

const baseHandler = async (event) => {
    const { knexConfig, readerConfig } = event.tenantContext;
    let controller;
    if (event.resource === '/{id}/transition' && event.httpMethod === 'POST') {
        controller = new TransitionController({ ...event, resource: '/' }, knexConfig);
    } else {
        controller = new Controller(event, knexConfig);
    }
    return controller.run();
};

export const handler = withTenantContext(baseHandler);
```

- **Un controlador por endpoint [bloqueante].** Cada endpoint personalizado es una clase que extiende `BaseController` e implementa los `action*` estándar (`actionIndex`, `actionCreate`, `actionRead`, `actionUpdate`, `actionDelete`, `actionSearch`, `actionAdvanceSearch`, `actionHistory`). `handler.mjs` solo elige la clase, reescribe `event.resource` y termina **siempre** en `controller.run()`. `run()` es el único punto donde se encadenan autenticación, enrutado, `destroyDbConnection()` y la rotación de la `session_key` de Active Directory; un método `runXxx()` ad hoc pierde todo eso en silencio.
- **Permisos por ruta, nunca por `httpMethod` ni por un campo del cuerpo.** Un `action*` que bifurca a otro caso de uso según un dato del body es la señal de que falta un controlador.
- **Solo `GET`, `POST` y `OPTIONS` [bloqueante].** Exigencia de Seguridad Informática. `PUT`, `PATCH` y `DELETE` están prohibidos en API Gateway, en CORS y en el frontend. Las escrituras se modelan como `POST` sobre un subrecurso (`POST /{id}/register`; `POST /{id}/delete` remapeado a `GET` dentro del handler). `allowMethods` en `KApiStack` y `Access-Control-Allow-Methods` en `Response` se quedan en `GET, POST, OPTIONS`.
- **Validación en el borde con Joi** (`schemas.mjs`). El dominio valida invariantes en Value Objects; el borde valida forma, tipos y presencia. Nunca al revés.
- **Contrato público de errores.** Códigos del catálogo `@kace/error-codes` según [ADR-005](../architecture/adr/005-public-error-response-contract.md) y [ADR-020](../architecture/adr/020-public-error-code-catalog.md). El frontend traduce por código (`errors/publicErrorCodeI18n`), nunca por mensaje.
- **Arranque en frío.** Imports mínimos en `handler.mjs`; dependencias pesadas cargadas donde se usan.

---

## 5. Multi-tenancy

- Un **esquema PostgreSQL por tenant** ([ADR-003](../architecture/adr/003-multi-tenancy-postgresql-schemas.md)); el tenant se resuelve por subdominio y su configuración vive en DynamoDB `kace_multi_tenancy` (conexiones, buckets, URLs de colas).
- **Nada de `process.env` para configuración por tenant en runtime [bloqueante]**: base de datos, S3, secretos y colas salen de `event.tenantContext` o de la entidad `Tenant`. `process.env` solo lleva configuración de despliegue (`APPS_ENVIRONMENT`, `DB_TARGET`, `SQL_GUARD_MODE`).
- Todo DDL y toda consulta se cualifican con el esquema del tenant (§6). Depender de `search_path` funciona en local y falla en el tenant.
- Un cambio que rompe el contrato multi-tenant se documenta en `BREAKING_CHANGES.md` y `TENANT_CONTEXT_USAGE.md` (raíz del repo).

---

## 6. Persistencia

### 6.1 Repositorios

- **Todo repositorio Knex extiende `KnexRepository` [bloqueante]** (94 lo hacen). La base resuelve el esquema (`table()`, `qualifiedName()`, `trxTable()`), la separación lectura/escritura con read-after-write (`this.read`, `reader`, `writer` sobre `DbRequestContext`), `startTransaction()`, `count()`, `saveHistory()` y `destroyConnection()`. Una clase de persistencia suelta pierde en silencio cada mejora futura de la base.

```javascript
export class KnexThingRepository extends KnexRepository {
    constructor(config, readerConfig = null) {
        super(config, 'things', readerConfig);
    }
}
```

- **Se pasan objetos de configuración, nunca una instancia de Knex.** `#resolveReaderConnection()` colapsa el reader sobre el writer cuando el writer llega ya construido: todas las lecturas van al primario sin ningún error.
- **Lecturas por `this.read.table(...)`, escrituras por `this.table(...)`.** El destino de las lecturas lo decide `DB_TARGET` (`primary` o réplica). Los stacks que no usan `setDefaultOptions` deben cablear `DB_TARGET` con `addEnvironment` o la réplica queda inactiva en silencio.
- Tener que componer a mano un nombre de tabla con esquema es la señal de que no se está extendiendo la base.

### 6.2 SQL crudo [bloqueante]

Todo `.raw()`, `whereRaw`, `orderByRaw` o SQL construido fuera de `KnexRepository` pasa los **valores** como bindings (`?` o `:nombre`), nunca por interpolación. Los **identificadores** dinámicos (tablas, columnas, prefijos) se validan contra `/^[a-zA-Z_][a-zA-Z0-9_]*$/` o van por `knex.ref`. `SQLInjectionGuard` es defensa en profundidad: no sustituye la parametrización y en `SQL_GUARD_MODE=observe` no bloquea. Los caminos que construyen SQL fuera del repositorio (`EntityCandidateFinder`, `QueryTranslator`) deben cualificar `FROM` y `JOIN` con el esquema ellos mismos.

### 6.3 PostgreSQL único [bloqueante]

SQLite está deprecado. No se añaden ramas `client === 'sqlite3'` en migraciones ni repositorios, ni pruebas ancladas a `knexLib({ client: 'sqlite3' })`: una prueba sobre SQLite no ejercita la rama que corre en producción y su cobertura es falsa. Las migraciones usan `table.jsonb(...)` directamente; las pruebas de persistencia corren contra el PostgreSQL de integración.

### 6.4 Migraciones

Todo cambio de esquema es una migración Knex en `packages/kace_cloud_database/migrations/`; nunca un script manual ni un cambio directo.

- **Reversibles**: `down` escrito y probado (`migrate:rollback`). CI las ejecuta en `test-database`.
- **Compatibles con la versión desplegada anterior** (expand/contract): el código viejo debe seguir funcionando con el esquema nuevo durante el despliegue.
- **Sin `notNullable()` ni `defaultTo()` en migraciones nuevas.** Las restricciones y valores por defecto de negocio viven en los Value Objects del agregado y se validan antes de persistir; la columna queda neutra para que un cambio de regla no exija migración. Excepciones técnicas que sí van en la base: claves primarias, claves foráneas, índices únicos (incluidos los parciales, que cierran condiciones de carrera) y `deleted_at`. Las migraciones anteriores a esta guía no se retocan.
- **Tipo y longitud** solo cuando sea estrictamente necesario.
- **`table.foreign()` no crea índice en PostgreSQL.** Toda FK por la que se filtre lleva índice explícito; las tablas `history_*` indexan `entity_id`. `aux_clients` sin índice costó el 97 % de la carga de base de datos en una prueba de carga.
- **Esquema del tenant.** Las migraciones de `@kace/database` se ejecutan una vez por tenant con `searchPath: [DB_SCHEMA]` y no cualifican tablas a mano. El DDL que se ejecuta **en runtime** desde un repositorio (tablas auxiliares por tenant en `KnexAuxDefinitionsRepository`) va cualificado con `withSchema(this.schema)`: sin cualificar cae en `public` y el tenant recibe "permission denied for schema public".
- Las vistas que se consultan con `COUNT` incluyen `deleted_at IS NULL` para aprovechar los índices parciales.

---

## 7. Eventos de dominio y procesamiento asíncrono

Referencia completa: [DOMAIN_EVENTS_GUIDE.md](../events/DOMAIN_EVENTS_GUIDE.md), [EVENT_PROCESSOR.md](../events/EVENT_PROCESSOR.md), [WORKERS_AND_SCHEDULED_TASKS.md](../events/WORKERS_AND_SCHEDULED_TASKS.md).

- **Evento**: clase en `<contexto>/domain/events/<Agregado><Accion>.js` con `EVENT_NAME = 'kace.core.<agregado>.<accion_en_pasado>'`. Lo registra el agregado (`AggregateRoot`) y lo publica el caso de uso a través de `EventPublisher` **después** de confirmar la transacción.
- **Handler [bloqueante]**: en `<contexto>/application/event-handlers/<Verbo>On<Evento>.js`. Recibe dependencias ya construidas por constructor posicional y expone `handle(domainEvent)` con **un solo** argumento. La resolución por tenant se queda en la closure `handlerFactories` del microservicio `event_processor`. Un `handle(context, event)` que recibe `userRepository` u otra infraestructura del Lambda está en el sitio equivocado.
- **Transporte**: `RoutingEventBus` enruta `eventName → cola SQS FIFO` según la configuración del tenant, con `EventBridgeEventBus` como sidecar de archivo; `InMemoryEventBus` es solo para tests. Idempotencia por `EventDeduplicator` sobre PostgreSQL.
- **Fallos silenciosos conocidos**:
  - Una sola URL de cola ausente en el tenant hace que `buildRoutingEventBusFromTenant` falle y el bus caiga a `InMemoryEventBus`: **todos** los eventos del tenant se pierden sin error.
  - Un stack publicador sin `grantEventPublishingPermissions()` recibe `AccessDenied` en `SendMessage` en runtime; el ARN de la cola debe estar en `perBcArns` de `KApiStack`.
  - El ARN de la cola va al IAM del deploy (`.env`) y la URL al tenant (DynamoDB); si se desincronizan, el deploy queda en verde y el mensaje va a otra cuenta.
  - Un target EventBridge → SQS FIFO necesita `contentBasedDeduplication=true`; sin ello cada entrega se rechaza en silencio.
  - Publicar a una FIFO sin acotar concurrencia supera las 300 TPS y produce "Request is throttled"; usar `publishBatch` y limitar el fan-out.
- **Worker de acciones** (ECS): `/health` no debe compartir event loop con ticks pesados; el pool local de Knex (`poolMax`) es el techo real, no el de Aurora.

---

## 8. Frontend (`apps/kace-saas`)

El frontend **no sigue arquitectura hexagonal**. Es una SPA organizada por funcionalidad en la que conviven dos generaciones.

### 8.1 Generación 1: `src/pages/`

50 módulos (`Cases`, `Users`, `Workspaces`, `Dashboard`, `Reports`…). Cada uno es una página:

```
pages/Cases/
├── CasesHandler.jsx            # contenedor de la ruta: orquesta hooks y componentes
├── components/                 # UI propia; anida sub-módulos (AdminCase/{AdminCasePage.jsx, components/, hooks/, data/})
├── hooks/                      # useCasesTableData, useCasesActions, useSelectedCases
├── data/                       # Queries.js (claves y funciones de TanStack Query), Constants.jsx
└── helpers.js
```

Se **mantiene y se corrige**. No se crean páginas nuevas aquí ni se migran módulos sin ticket.

### 8.2 Generación 2: `src_v2/features/` (meta)

Feature-sliced, alias `@kace_v2`, generada con `pnpm run kace -- <feature>`. **Todo módulo nuevo se crea aquí.**

```
src_v2/
├── features/<feature>/
│   ├── pages/<Feature>Page.jsx
│   ├── components/
│   ├── hooks/use<Feature>.hook.js          # TanStack Query
│   ├── services/<feature>.service.js       # Axios
│   ├── schemas/<feature>.schema.js         # Joi
│   ├── utils/ · constants/
│   ├── __tests__/{hooks,components}/*.spec.js(x)   # Vitest
│   ├── e2e/<feature>.spec.js               # Cypress
│   └── README.md
└── shared/
    ├── ui/{atoms,molecules,organisms,icons}   # design system
    └── hooks/ · services/ · utils/ · constants/
```

### 8.3 Capas transversales de `src/`

| Carpeta | Papel |
| :--- | :--- |
| `components/core/` (29), `components/layouts/`, `components/modal/` | Componentes de producto reutilizables y estructura de página |
| `components/ui-shared/` (alias `@kace/ui-shared`) | Primitivas Radix + Tailwind. Es un barril heredado: se consume, no crece; lo nuevo va a `src_v2/shared/ui` |
| `componentsV2/` | Puente: componentes nuevos (`DataTable`, `Select`, `MultiSelect`) consumidos desde `pages/` y construidos sobre `src_v2/shared/ui` |
| `hooks/` (40) | Hooks genéricos: `useDataTable`, `useGeneralMutation`, `useGenericSearchQuery`, `useAccessRoutes`, `useInactivityLogout` |
| `services/` (17) | Adaptadores HTTP (`AxiosHttpClient`, `genericSearchService`, `deleteService`, `cognitoService`). **Único lugar donde se usa Axios** |
| `redux/state/` (13 slices) | Estado de UI y sesión: `user`, `groupInformation`, `filterCases`, `modalBehavior`… |
| `schemas/` (60+) | Un esquema Joi por entidad o formulario |
| `routes/`, `config/routesDictionary.js`, `enums/`, `constants/` | Rutas y catálogos |
| `cognito-auth/`, `locale/` (`en.json`, `es.json`), `errors/` | Autenticación, i18n, códigos públicos de error |

### 8.4 Reglas [bloqueante]

1. **Los componentes no llaman a Axios.** Llaman a hooks; los hooks a servicios; los servicios a la API.
2. **Todo dato de servidor pasa por TanStack Query** (`useQuery`, `useMutation`) desde un hook. Nunca `useEffect` + `fetch` en un componente.
3. **Redux Toolkit guarda solo estado de UI y sesión.** No cachea datos de servidor.
4. **Toda validación de formulario es un esquema Joi con React Hook Form.**
5. **Solo `GET` y `POST`** en los clientes HTTP (§4.2).
6. **Ninguna cadena visible sin clave en `en.json` y `es.json`**; `pnpm run validate-translations` en verde.
7. Rutas nuevas se dan de alta en `config/routesDictionary.js` y `routes/routes.jsx`; el acceso se controla con `useAccessRoutes` y `AccessControl`.
8. Los identificadores que llegan del cliente no son de confianza: el backend los valida con `ObjectIdentityAuthorization`; el frontend no asume que un id devuelto coincide con el enviado.

Jerarquía de providers, flujo de datos y estilos: [docs/frontend/README.md](../frontend/README.md).

---

## 9. Seguridad de aplicación

- **Autorización por recurso, no solo autenticación.** Identificadores del cuerpo mediante `ObjectIdentityAuthorization` (`@kace/api-common/src/security`); endpoints de búsqueda cubiertos por `SearchAuthorizationService` y verificados con `pnpm run search-auth:check` ([search-authorization.md](../architecture/search-authorization.md)).
- **Logs sin datos sensibles**: ni PII, ni tokens, ni credenciales. Ningún secreto en el código; el gate de secretos de Trivy bloquea el PR.
- **Checklists de Seguridad Informática** vigentes: [CheckListSeguridadBackend.pdf](../CheckListSeguridadBackend.pdf) y [CheckListSeguridadFrontend.pdf](../CheckListSeguridadFrontend.pdf).
- **Supply chain** según el DevSecOps Handbook: actions de GitHub pineadas por SHA (§6.3), imágenes por digest, SBOM CycloneDX (§3.5), gates de secretos y vulnerabilidades (§3.6), SLA por severidad (§3.7), nombres de rama (§5.2). Excepciones al gate en `.trivyignore` con motivo, alcance, responsable y fecha de caducidad.
- **Sin consultas N+1 ni listados sin paginación.**

---

## 10. Registros de decisiones (ADR)

- Ubicación única: `docs/architecture/adr/`, con el índice en su [README](../architecture/adr/README.md). Los dos registros de `docs/adr/` se trasladan allí renumerados (022 y 023) y `docs/adr/` se elimina.
- Plantilla: contexto, opciones consideradas, decisión, consecuencias, estado (Accepted, Superseded, Deprecated, Rejected) y fecha.
- Se escribe un ADR cuando una decisión cambia un contrato público, una regla de esta guía o la forma de desplegar. Se enlaza desde el PR que la implementa.
