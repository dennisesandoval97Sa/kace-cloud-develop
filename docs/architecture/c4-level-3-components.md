# C4 Model - Level 3: Component Architecture

## Overview

This document describes the **Component-level architecture** of KACE Cloud's major containers, showing the internal structure, key components, and their interactions.

A **Component** in C4 terminology represents a grouping of related functionality encapsulated behind a well-defined interface (e.g., classes, modules, packages).

> **Source of truth:** every code snippet below is taken from, or faithfully reduced from, real files in `develop`. File paths are given so each claim can be checked.

---

## Table of Contents

1. [Lambda Microservice Components](#1-lambda-microservice-components)
2. [@kace/core Internal Components](#2-kacecore-internal-components)
3. [React SPA Components](#3-react-spa-components)
4. [Shared Infrastructure Components](#4-shared-infrastructure-components)
5. [Event Processing Components](#5-event-processing-components)
6. [Data Flow Examples](#6-data-flow-examples)

---

## 1. Lambda Microservice Components

### Architecture Pattern: Handler → Controller(s) → Use Cases → Repositories

```
┌──────────────────────────────────────────────────────────────────┐
│  Lambda Function (e.g., kace_cloud_api_cases)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [Component: handler.mjs]                                  │  │
│  │  AWS Lambda Entry Point                                    │  │
│  │                                                            │  │
│  │  Responsibilities:                                         │  │
│  │  - Receive the Lambda event from API Gateway               │  │
│  │  - Apply the withTenantContext wrapper                     │  │
│  │  - SELECT the controller class for this endpoint           │  │
│  │  - Rewrite event.resource so BaseController routing works  │  │
│  │  - Always end in controller.run()                          │  │
│  │  - Return response.toJson()                                │  │
│  │                                                            │  │
│  │  It must NOT contain business logic, and must NOT call     │  │
│  │  ad-hoc runXxx() methods: run() is the only place where    │  │
│  │  authentication, action* routing, destroyDbConnection()    │  │
│  │  and session-cookie rotation are chained.                  │  │
│  │                                                            │  │
│  │  Real example — apps/apiv1/kace_cloud_api_cases/src:       │  │
│  │  ```javascript                                             │  │
│  │  const baseHandler = async (event) => {                    │  │
│  │    const { knexConfig, readerConfig } =                    │  │
│  │      event.tenantContext;                                  │  │
│  │    let controller;                                         │  │
│  │                                                            │  │
│  │    if (event.resource === '/{id}/transition'               │  │
│  │        && event.httpMethod === 'POST') {                   │  │
│  │      controller = new TransitionController(                │  │
│  │        { ...event, resource: '/' }, knexConfig);            │  │
│  │    } else if (event.resource === '/{id}/sub-cases/delete') {│  │
│  │      controller = new SubCasesController(                  │  │
│  │        { ...event, resource: '/{id}/delete',               │  │
│  │          httpMethod: 'GET' }, knexConfig);                 │  │
│  │    } else if (event.resource?.startsWith('/view')) {       │  │
│  │      controller = new ViewController(                      │  │
│  │        event, knexConfig, readerConfig);                   │  │
│  │    } else {                                                │  │
│  │      controller = new Controller(                          │  │
│  │        event, knexConfig, readerConfig);                   │  │
│  │    }                                                       │  │
│  │                                                            │  │
│  │    const response = await controller.run();                │  │
│  │    return response.toJson();                               │  │
│  │  };                                                        │  │
│  │                                                            │  │
│  │  export const handler = withTenantContext(baseHandler);    │  │
│  │  ```                                                       │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│                           │ Delegates to                         │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [Component: Controller.mjs]                               │  │
│  │  ONE CONTROLLER PER ENDPOINT (extends BaseController)      │  │
│  │                                                            │  │
│  │  Responsibilities:                                         │  │
│  │  - Implement the standard action* methods                  │  │
│  │  - Check permissions BY ROUTE (never by httpMethod)        │  │
│  │  - Harden the create payload (ObjectIdentityAuthorization) │  │
│  │  - Validate input with Joi schemas                         │  │
│  │  - Dependency injection: build repositories from CONFIG    │  │
│  │    objects, then inject them into use cases                │  │
│  │  - Map errors to HttpResponse                              │  │
│  │  - Override destroyDbConnection() to close its own pool    │  │
│  │                                                            │  │
│  │  Real example — kace_cloud_api_banners/src/Controller.mjs: │  │
│  │  ```javascript                                             │  │
│  │  export class Controller extends BaseController {          │  │
│  │    constructor(event, knexConfig) {                        │  │
│  │      super(event, knexConfig);                             │  │
│  │      // Pass CONFIG objects, never a built Knex instance:  │  │
│  │      // that collapses the reader onto the writer.         │  │
│  │      const { readerConfig } = this.event.tenantContext;    │  │
│  │      this.repository =                                     │  │
│  │        new KnexBannersRepository(knexConfig, readerConfig);│  │
│  │      this.started_at = new Date();                         │  │
│  │    }                                                       │  │
│  │                                                            │  │
│  │    async destroyDbConnection() {                           │  │
│  │      await this.repository.destroyConnection();            │  │
│  │      await super.destroyDbConnection();                    │  │
│  │    }                                                       │  │
│  │                                                            │  │
│  │    async actionCreate() {                                  │  │
│  │      const hasPermission = this.user.hasPermission(        │  │
│  │        'administrador', 'banners', 'BannerCreate');        │  │
│  │      if (!hasPermission)                                   │  │
│  │        return HttpResponse.forbidden({ event: this.event });│  │
│  │                                                            │  │
│  │      const payload = await secureObjectCreatePayload({     │  │
│  │        payload: this.payload(),                            │  │
│  │        userId: this.user.id.value,                         │  │
│  │        now: this.started_at,                               │  │
│  │        endpoint: 'POST /banners',                          │  │
│  │        resourceType: 'banners',                            │  │
│  │        repository: this.repository,                        │  │
│  │      });                                                   │  │
│  │                                                            │  │
│  │      const data = BannersCreateSchema.validate(            │  │
│  │        payload, { abortEarly: false });                    │  │
│  │      if (data.error)                                       │  │
│  │        return HttpResponse.validationsFail({               │  │
│  │          errors: data.error, event: this.event });          │  │
│  │                                                            │  │
│  │      await new BannerCreator(this.repository)              │  │
│  │        .execute(data.value);                               │  │
│  │      return HttpResponse.created({ event: this.event });   │  │
│  │    }                                                       │  │
│  │  }                                                         │  │
│  │  ```                                                       │  │
│  │                                                            │  │
│  │  ⚠ An action* that branches into a different use case      │  │
│  │  based on a request-body field means a controller is       │  │
│  │  missing — create a new one instead.                       │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│                           │ Uses                                 │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [Component: schemas.mjs / XxxSchema.mjs]                  │  │
│  │  Joi Validation Schemas                                    │  │
│  │                                                            │  │
│  │  Responsibilities:                                         │  │
│  │  - Define input validation rules (Joi)                     │  │
│  │  - Required fields, data types, formats                    │  │
│  │  - Custom validation (date ranges, enums)                  │  │
│  │                                                            │  │
│  │  Typical schemas:                                          │  │
│  │  - XxxCreateSchema : POST /            (create)            │  │
│  │  - XxxUpdateSchema : POST /{id}        (update — NOT PUT)  │  │
│  │  - SearchSchema    : POST /search      (pagination,        │  │
│  │                      filters, sorting; shared from         │  │
│  │                      @kace/api-common)                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Supporting Files:                                         │  │
│  │  - lib/[name]-stack.ts (AWS CDK stack, usually KApiStack)  │  │
│  │  - bin/[name].js (CDK app entry point)                     │  │
│  │  - test/[name].test.js (Jest unit tests)                   │  │
│  │  - cdk.json, package.json                                  │  │
│  │                                                            │  │
│  │  ⚠ Stacks NOT built on KApiStack's setDefaultOptions       │  │
│  │  (e.g. cases-stack.ts, users-stack.ts) must wire           │  │
│  │  addEnvironment('DB_TARGET', …) by hand, or the read       │  │
│  │  replica stays inactive silently.                          │  │
│  │  ⚠ A stack whose Lambda publishes domain events must call  │  │
│  │  grantEventPublishingPermissions, or SQS SendMessage is    │  │
│  │  denied at runtime.                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### `BaseController.run()` — the single exit point

`packages/kace_cloud_api_common/src/controllers/BaseController.js`

```javascript
async run() {
    try {
        this.user = await this.getLoggedInUser();
    } catch (error) {
        return HttpResponse.badRequest({ message: error.message, errors: error, event: this.event });
    }

    try {
        const actionsResult = await this.#actions();
        return await this.#attachSessionCookieIfNeeded(actionsResult);
    } finally {
        await this.destroyDbConnection();
    }
}
```

`#actions()` routes **by resource and method**, and only `GET` and `POST` exist:

| Method | Resource | Action |
|---|---|---|
| `GET` | `/` | `actionIndex()` |
| `GET` | `/{id}` | `actionRead()` |
| `GET` | `/{id}/delete` | `actionDelete()` |
| `GET` | `/{id}/body` | `actionReadBody()` |
| `GET` | `/search` | `actionSearch()` |
| `POST` | `/` | `actionCreate()` |
| `POST` | `/{id}` | `actionUpdate()` |
| `POST` | `/search` | `actionSearch()` |
| `POST` | `/advance-search` | `actionAdvanceSearch()` |
| `POST` | `/{id}/history` | `actionHistory()` |
| anything else | — | `HttpResponse.methodNotAllowed()` |

There are **no** `handleGet` / `handlePost` / `handlePut` / `handleDelete` methods.

`#attachSessionCookieIfNeeded()` rotates `usuarios.session_key` for Active Directory accounts on successful responses and returns it in a `Set-Cookie` header. An endpoint that bypasses `run()` silently loses authentication, connection teardown and session rotation — now and for anything added to `run()` later.

### Request Flow Through Components

```
API Gateway Event
    │
    ▼
handler.mjs
    │  1. withTenantContext() extracts the tenant id (header/claims)
    │  2. Loads the tenant from DynamoDB (LRU cached)
    │  3. Builds knexConfig (writer) + readerConfig (reader)
    │  4. Runs the rest inside TenantContext.run() (AsyncLocalStorage)
    │  5. Selects the controller and rewrites event.resource
    ▼
Controller.run()
    │  6. getLoggedInUser()
    │  7. #actions() routes to action*
    │  8. Permission check by route
    │  9. secureObjectCreatePayload / Joi validation
    ▼
Use Case (from @kace/core)
    │ 10. Entity.create(dto) — invariants enforced in the domain
    │ 11. Domain validations (uniqueness, existence)
    │ 12. repository.save(entity) + repository.saveHistory(entity)
    ▼
Repository (extends KnexRepository)
    │ 13. DbRequestContext.markWrite()
    │ 14. this.table() → schema-qualified writer query
    │     this.read.table() → reader query (until a write happens)
    ▼
PostgreSQL (writer / reader)
    │
    ◄─────┘
Controller
    │ 15. Wraps in HttpResponse
    ▼
Controller.run() finally → destroyDbConnection() + Set-Cookie
    ▼
handler.mjs → response.toJson()   (payload size limits enforced)
    ▼
API Gateway → React SPA
```

---

## 2. @kace/core Internal Components

### Domain-Driven Design Architecture (3 Layers)

```
┌────────────────────────────────────────────────────────────────────┐
│  @kace/core Package (packages/kace_cloud_core/)                    │
│  86 directories under src/ — no barrel files, deep imports only    │
│                                                                    │
│  Example Bounded Context: cases/                                   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Layer 1: Domain]                                           │  │
│  │  Business Logic & Domain Models                               │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Case.js]                                  │  │  │
│  │  │  Aggregate Root                                        │  │  │
│  │  │                                                        │  │  │
│  │  │  Encapsulates:                                         │  │  │
│  │  │  - Case entity + its invariants                        │  │  │
│  │  │  - Business rules (state transition validity)          │  │  │
│  │  │  - Aggregate children (descriptions, transitions)      │  │  │
│  │  │                                                        │  │  │
│  │  │  Methods:                                              │  │  │
│  │  │  - static create(dto): factory + validation            │  │  │
│  │  │  - transition(...) / canTransitionTo(...)              │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Domain Events]                            │  │  │
│  │  │  domain/events/                                        │  │  │
│  │  │                                                        │  │  │
│  │  │  - CaseCreated.js   → 'kace.core.case.created'         │  │  │
│  │  │  - CaseUpdated.js   → 'kace.core.case.updated'         │  │  │
│  │  │                                                        │  │  │
│  │  │  Every event carries eventName + aggregateId and is    │  │  │
│  │  │  published through an EventBus implementation.         │  │  │
│  │  │  THIS IS LIVE IN PRODUCTION — not a future plan.       │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Value Objects]                            │  │  │
│  │  │  domain/value-objects/                                 │  │  │
│  │  │                                                        │  │  │
│  │  │  Immutable, equality by value, no identity.            │  │  │
│  │  │  Every entity field is a VO exposing `.value`, which   │  │  │
│  │  │  is why repositories map `entity.field.value`.         │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Domain Services]                          │  │  │
│  │  │                                                        │  │  │
│  │  │  - CaseFinder.js (domain queries)                      │  │  │
│  │  │  - ActionExecutionDomainService                        │  │  │
│  │  │  - UpdateSLATimers                                     │  │  │
│  │  │  - UniquenessValidator (shared/validation)             │  │  │
│  │  │                                                        │  │  │
│  │  │  Operations that don't fit in a single entity.         │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Guards]  shared/domain/guards/            │  │  │
│  │  │                                                        │  │  │
│  │  │  - SQLInjectionGuard.js                                │  │  │
│  │  │  - SQLInjectionCriteriaGuard.js                        │  │  │
│  │  │  - shared/domain/security/SQLInjectionDictionary.js    │  │  │
│  │  │                                                        │  │  │
│  │  │  Defense-in-depth ONLY. It does not substitute for     │  │  │
│  │  │  parameterized bindings, and under SQL_GUARD_MODE=     │  │  │
│  │  │  observe it does not block at all.                     │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Layer 2: Application]                                      │  │
│  │  Use Cases, DTOs & Event Handlers                            │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Use Cases]                                │  │  │
│  │  │  Naming: [Entity][Action]                              │  │  │
│  │  │                                                        │  │  │
│  │  │  Commands (writes):                                    │  │  │
│  │  │  - application/create/XxxCreator.js                    │  │  │
│  │  │  - application/update/XxxUpdater.js                    │  │  │
│  │  │  - application/delete/XxxDeleter.js                    │  │  │
│  │  │                                                        │  │  │
│  │  │  Queries (reads):                                      │  │  │
│  │  │  - application/find/XxxFinder.js                       │  │  │
│  │  │  - application/search/XxxSearcher.js                   │  │  │
│  │  │                                                        │  │  │
│  │  │  Real example — banners/application/create/            │  │  │
│  │  │  BannerCreator.js:                                     │  │  │
│  │  │  ```javascript                                         │  │  │
│  │  │  export class BannerCreator {                          │  │  │
│  │  │    #repository; #bannerFinder; #uniquenessValidator;   │  │  │
│  │  │                                                        │  │  │
│  │  │    constructor(repository) {                           │  │  │
│  │  │      this.#repository = repository;                    │  │  │
│  │  │      this.#bannerFinder =                              │  │  │
│  │  │        new DomainBannerFinder(repository);             │  │  │
│  │  │      this.#uniquenessValidator =                       │  │  │
│  │  │        new UniquenessValidator(repository);            │  │  │
│  │  │    }                                                   │  │  │
│  │  │                                                        │  │  │
│  │  │    async execute(dto) {                                │  │  │
│  │  │      const banner = Banner.create(dto);                │  │  │
│  │  │                                                        │  │  │
│  │  │      const result =                                    │  │  │
│  │  │        await this.#bannerFinder.execute(               │  │  │
│  │  │          banner.id.value);                             │  │  │
│  │  │      if (result) throw new CustomError(                │  │  │
│  │  │        `Banner with id ... already exists`, 400);      │  │  │
│  │  │                                                        │  │  │
│  │  │      await this.#uniquenessValidator.validate(         │  │  │
│  │  │        'descripcion', dto.descripcion);                │  │  │
│  │  │      await this.#repository.save(banner);              │  │  │
│  │  │      await this.#repository.saveHistory(banner);       │  │  │
│  │  │    }                                                   │  │  │
│  │  │  }                                                     │  │  │
│  │  │  ```                                                   │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Event Handlers]                           │  │  │
│  │  │  application/event-handlers/                           │  │  │
│  │  │  Naming: <Verb>On<Event>                               │  │  │
│  │  │                                                        │  │  │
│  │  │  - cases/…/ExecuteActionsOnCaseCreated.js              │  │  │
│  │  │  - cases/…/ExecuteActionsOnCaseUpdated.js              │  │  │
│  │  │  - cases/…/CasePostProcessingOnCaseCreated.js          │  │  │
│  │  │  - action-jobs/…/ProcessJobOnActionJobCreated.js       │  │  │
│  │  │  - actions-queue-executions/…/                         │  │  │
│  │  │      ProcessActionQueueOnCronJobRequested.js           │  │  │
│  │  │  - report-executions/…/                                │  │  │
│  │  │      ExecuteReportOnExecutionRequested.js              │  │  │
│  │  │  - ws-rest-flow-executions/…/                          │  │  │
│  │  │      ExecuteWSRestFlowOnExecutionRequested.js          │  │  │
│  │  │                                                        │  │  │
│  │  │  Contract: dependencies arrive as POSITIONAL           │  │  │
│  │  │  constructor arguments, already built; handle()        │  │  │
│  │  │  takes a SINGLE argument (the domain event).           │  │  │
│  │  │  Per-tenant wiring stays in the microservice's         │  │  │
│  │  │  handlerFactories closure — a handle(context, event)   │  │  │
│  │  │  receiving Lambda infrastructure means the handler     │  │  │
│  │  │  is in the wrong place.                                │  │  │
│  │  │                                                        │  │  │
│  │  │  ```javascript                                         │  │  │
│  │  │  export default class ExecuteActionsOnCaseCreated {    │  │  │
│  │  │    constructor(caseRepository, actionExecutionService, │  │  │
│  │  │                caseFinder = new CaseFinder(            │  │  │
│  │  │                  caseRepository)) { … }                │  │  │
│  │  │                                                        │  │  │
│  │  │    async handle(domainEvent) {                         │  │  │
│  │  │      const kase = await this.#caseFinder.execute(      │  │  │
│  │  │        domainEvent.aggregateId);                       │  │  │
│  │  │      await this.#actionExecutionService.execute(       │  │  │
│  │  │        ActionTriggers.CREATE_CASE.value, kase);        │  │  │
│  │  │      await this.#updateSLATimers(kase);                │  │  │
│  │  │    }                                                   │  │  │
│  │  │  }                                                     │  │  │
│  │  │  ```                                                   │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: DTOs]                                     │  │  │
│  │  │  - XxxResponse.js (single entity)                      │  │  │
│  │  │  - XxxCollectionResponse.js (multiple)                 │  │  │
│  │  │  - XxxSearchCollectionResponse.js / XxxCountResponse.js│  │  │
│  │  │                                                        │  │  │
│  │  │  Serialize domain entities for API responses and hide  │  │  │
│  │  │  the internal domain structure.                        │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Layer 3: Infrastructure]                                   │  │
│  │  Persistence, Event Transport & External Integrations        │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: KnexRepository]  (base class)             │  │  │
│  │  │  shared/infrastructure/persistence/KnexRepository.js   │  │  │
│  │  │                                                        │  │  │
│  │  │  EVERY Knex repository extends it (94+ do). It owns:   │  │  │
│  │  │  - constructor(config, table, readerConfig = null)     │  │  │
│  │  │  - schema resolution: table(), qualifiedName(),        │  │  │
│  │  │    trxTable(trx, name)                                 │  │  │
│  │  │  - read/write split: get writer, get reader, this.read │  │  │
│  │  │    with read-after-write via DbRequestContext          │  │  │
│  │  │  - saveHistory() into the history_* table              │  │  │
│  │  │  - count(criteria), startTransaction(),                │  │  │
│  │  │    destroyConnection()                                 │  │  │
│  │  │                                                        │  │  │
│  │  │  Having to build a schema-qualified table name by hand │  │  │
│  │  │  is the signal that the base class is not being used.  │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Repositories]                             │  │  │
│  │  │  infrastructure/persistence/KnexXxxRepository.js       │  │  │
│  │  │                                                        │  │  │
│  │  │  Real example — banners:                               │  │  │
│  │  │  ```javascript                                         │  │  │
│  │  │  export class KnexBannersRepository                    │  │  │
│  │  │      extends KnexRepository {                          │  │  │
│  │  │    constructor(config, readerConfig = null) {          │  │  │
│  │  │      super(config, 'banners', readerConfig);           │  │  │
│  │  │    }                                                   │  │  │
│  │  │                                                        │  │  │
│  │  │    async save(banner) {                                │  │  │
│  │  │      try {                                             │  │  │
│  │  │        DbRequestContext.markWrite();                   │  │  │
│  │  │        await this.table().insert({                     │  │  │
│  │  │          id: banner.id.value,                          │  │  │
│  │  │          descripcion: banner.descripcion.value,        │  │  │
│  │  │          propiedades:                                  │  │  │
│  │  │            JSON.stringify(banner.propiedades.value),   │  │  │
│  │  │          // … explicit column allowlist                │  │  │
│  │  │          created_at: banner.created_at.value,          │  │  │
│  │  │          created_by: banner.created_by.value,          │  │  │
│  │  │        });                                             │  │  │
│  │  │      } catch (error) {                                 │  │  │
│  │  │        throw new QueryDBError('save');                 │  │  │
│  │  │      }                                                 │  │  │
│  │  │    }                                                   │  │  │
│  │  │  }                                                     │  │  │
│  │  │  ```                                                   │  │  │
│  │  │                                                        │  │  │
│  │  │  ⚠ save() uses an EXPLICIT column allowlist: adding a  │  │  │
│  │  │  new column requires editing the insert mapping by     │  │  │
│  │  │  hand (update/bulk paths pick it up automatically).    │  │  │
│  │  │  ⚠ Reads go through this.read.table(...), writes       │  │  │
│  │  │  through this.table(...).                              │  │  │
│  │  │  ⚠ Raw SQL built outside KnexRepository must           │  │  │
│  │  │  self-qualify FROM/JOIN with the tenant schema.        │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Event Buses]                              │  │  │
│  │  │  shared/infrastructure/events/                         │  │  │
│  │  │                                                        │  │  │
│  │  │  - RoutingEventBus.js      SQS hot path + EventBridge  │  │  │
│  │  │                            archive sidecar (default)   │  │  │
│  │  │  - SQSEventBus.js          single-queue transport      │  │  │
│  │  │  - EventBridgeEventBus.js  archive transport           │  │  │
│  │  │  - InMemoryEventBus.js     tests                       │  │  │
│  │  │  - eventRoutingConfig.js   eventName → queueUrl map    │  │  │
│  │  │  - buildRoutingEventBusFromTenant.js  per-tenant factory│  │  │
│  │  │                                                        │  │  │
│  │  │  ⚠ If the routing map cannot be built, callers that    │  │  │
│  │  │  fall back to InMemoryEventBus silently DROP every     │  │  │
│  │  │  event for that tenant.                                │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: External Services]                        │  │  │
│  │  │                                                        │  │  │
│  │  │  - S3AttachmentStorage / S3EmailBodyStorage            │  │  │
│  │  │    (bucket resolved per tenant)                        │  │  │
│  │  │  - EmailZipGenerator                                   │  │  │
│  │  │  - Gmail client (@googleapis/gmail)                    │  │  │
│  │  │  - Microsoft Graph + MSAL clients                      │  │  │
│  │  │  - Nodemailer sender                                   │  │  │
│  │  │  - Cognito client                                      │  │  │
│  │  │  - ChannelHubInboundEmailProcessor(+Factory)           │  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  [Component: Context]                                  │  │  │
│  │  │  shared/infrastructure/context/DbRequestContext.js     │  │  │
│  │  │                                                        │  │  │
│  │  │  AsyncLocalStorage-backed flag: markWrite() /          │  │  │
│  │  │  hasWritten(). Once a write happens in a request,      │  │  │
│  │  │  subsequent reads are forced back onto the writer.     │  │  │
│  │  │  Outside a run, reader falls back to writer (fail-open)│  │  │
│  │  └────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Bounded Contexts (86 directories under `src/`)

```
packages/kace_cloud_core/src/
├── cases/                          # Case management (core aggregate)
├── case-attachments/               # Case file associations
├── case-descriptions/              # Notes / comments on cases
├── case_session_durations/         # Time tracking
├── aux_casos/ aux_clientes/        # Custom-field values
├── aux_usuarios/ aux_definitions/  # Custom-field definitions
├── auxiliaries/                    # Auxiliary catalogue
├── clients/ client-notifications/  # Customer management
├── users/ grupos/ role/            # Identity & RBAC
├── user-group-relationships/ user-lists/ user-notifications/
├── policies/                       # Authorization policies
├── classifications/                # Hierarchical categories
├── ClassificationsLevelDistinction/ classification-group-relationships/
├── classification-template-relations/
├── state/ states/ transition/ transition-rules/
├── actions/ action-jobs/ action-update-model/
├── action-job-processing/ actions-queue-executions/
├── automated-assignment-runs/ automation-settings/
├── shift-management/
├── ws-rest-flows/ ws-rest-endpoints/ ws-rest-workflow-step/
├── ws-rest-conditionals/ ws-rest-flow-executions/ ws_rest_functions/
├── flow/
├── ans/                            # SLA management
├── templates/ template-attachments/
├── emails/ mails/ mail-accounts/
├── channel-hub-accounts/ channel-hub-inbound-emails/
├── comments/ interactions/
├── reports/ report-executions/ boards/ csv-export-views/ event-log/
├── imports/ exports/
├── s3-files/
├── agendas/ agendas-groups/ appointments/ appointment-time-slots/
├── banners/ helps/ helps_attachments/ literals/
├── custom-lists/ group-lists/ field-list/
├── global-config/ schemas/ secrets-vault/ tenant/ workspaces/
├── geolocation/ allowed-conections/ one-script/ plugins/
├── background-executions/ fake-cases/ fake-clients/
├── rabbitmq/                       # Broker adapter/mapper CONFIG CRUD only
│                                   # (no AMQP client anywhere in the repo)
├── auth-cognito/
├── factories/
└── shared/                         # Base classes, guards, events, context
```

---

## 3. React SPA Components

### Frontend Architecture (Feature-Based Structure)

```
┌────────────────────────────────────────────────────────────────────┐
│  React SPA (apps/kace-saas/)                                       │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Component: main.jsx]                                       │  │
│  │  Application Entry Point                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                            │                                       │
│                            ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Component: App.jsx]                                        │  │
│  │  Root Component                                              │  │
│  │                                                              │  │
│  │  Responsibilities:                                           │  │
│  │  - Redux Provider (store)                                    │  │
│  │  - React Router (BrowserRouter)                              │  │
│  │  - TanStack Query Provider (QueryClient)                     │  │
│  │  - Cognito auth wrapper                                      │  │
│  │  - Global error boundary                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Component Layer: Pages]  — 50 feature modules              │  │
│  │                                                              │  │
│  │  src/pages/                                                  │  │
│  │  Actions · ActionUpdateModel · Agenda · Agent ·              │  │
│  │  AllowedConnections · Ans · AssignmentMonitor ·              │  │
│  │  AuthValidation · AutomationSettings · Auxiliaries ·         │  │
│  │  Banners · Broker · Cases · ChannelHub · Classifications ·   │  │
│  │  CustomList · Dashboard · ExportAndIMportAuxiliaries ·       │  │
│  │  ExportAndImportData · Flows · GeneralSetup · GenerateCsv ·  │  │
│  │  Geolocation · Group · GroupConfiguration · GroupList ·      │  │
│  │  Helps · Interactions · Literal · Logout · MailAccounts ·    │  │
│  │  MassiveExecution · NotFound · NotificationsAgent ·          │  │
│  │  NotificationsClient · OneScript · Reports · RestEndPoints · │  │
│  │  RestFlow · RestFunctions · Roles · Schedules · States ·     │  │
│  │  Templates · TimeSlots · TransitionRules · User · UserList · │  │
│  │  VaultSecrets · Workspaces                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Component Layer: Components]                               │  │
│  │                                                              │  │
│  │  src/components/core/      31 reusable modules:              │  │
│  │    AccessControl · AdvancedSearch · AnsUser · Attachment ·   │  │
│  │    ButtonIcon · Cards · CasesTableComponent · DatePicker ·   │  │
│  │    DefaultIndexActions · Editor · ErrorPage · FormOneScript ·│  │
│  │    Helps · HighImpactCases · ImportsDashboardTable ·         │  │
│  │    InputSelect · LoaderPage · ModalForm · multiselector ·    │  │
│  │    MyAgenda · SearchClient · SelectByUrl · SelectColor ·     │  │
│  │    SelectContainer · SelectIcon · selectors · SideBar ·      │  │
│  │    SessionConflictDialog · switchState · TitleWithGoBack     │  │
│  │  src/components/layouts/   layout shells                     │  │
│  │  src/components/modal/     modal system                      │  │
│  │  src/components/ui-shared/ Radix UI primitives               │  │
│  │  src/componentsV2/{core,lib}  newer component generation     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Component Layer: Redux State]  — 13 slices                 │  │
│  │                                                              │  │
│  │  src/redux/state/                                            │  │
│  │  ├── user.js                     # user, roles, permissions  │  │
│  │  ├── client.js                   # selected client           │  │
│  │  ├── states.js                   # case states cache         │  │
│  │  ├── filterCases.js              # case list filters         │  │
│  │  ├── modalBehavior.js            # modal orchestration       │  │
│  │  ├── applicationSelectedSlice.js # active application        │  │
│  │  ├── generalSetupSlice.js        # tenant-level setup        │  │
│  │  ├── groupInformation.js         # active group              │  │
│  │  ├── showGroupSelect.js          # group selector visibility │  │
│  │  ├── loadingCaseInformation.js   # case detail loading       │  │
│  │  ├── myAgendaBehavior.js         # agenda UI state           │  │
│  │  ├── nextCountItemsSlice.js      # pagination hints          │  │
│  │  └── bannerSlice.js              # banners                   │  │
│  │                                                              │  │
│  │  Redux holds UI state only. Server state lives in            │  │
│  │  TanStack Query.                                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Component Layer: Custom Hooks]  — 33 hooks                 │  │
│  │                                                              │  │
│  │  src/hooks/                                                  │  │
│  │  Data:      useDataTable · useDataTableColumns ·             │  │
│  │             useGenericGetQuery · useGenericSearchQuery ·     │  │
│  │             useGenericSearchInfiniteQuery · useGenericView-  │  │
│  │             Query · useGeneralMutation · useGeneralDelete ·  │  │
│  │             useOptionsList · useSelectByProviderQuery ·      │  │
│  │             useSchemaFields · useAuxiliariesOptions ·        │  │
│  │             useApiMetaData · useTableColumnsByType           │  │
│  │  Access:    useAccessRoutes · usePermissionsUser ·           │  │
│  │             useGroupMembershipValidation                     │  │
│  │  Session:   useSessionHeartbeat · useInactivityLogout ·      │  │
│  │             useFingerprint · useUserInformation              │  │
│  │  UI:        useInfiniteScrollGate · infiniteScrollViewport · │  │
│  │             useDebounced · useFilterTableHandler ·           │  │
│  │             dataTableFilterSync · useSubmenuBoards           │  │
│  │  Feature:   useFormOneScript · useConfigAgentData ·          │  │
│  │             useAllowedConnections · useBannersInformation ·  │  │
│  │             useGeolocation · useValidateCrontab              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Component Layer: Services]  — 14 modules                   │  │
│  │                                                              │  │
│  │  src/services/                                               │  │
│  │  ├── AxiosHttpClient.js       # base HTTP client             │  │
│  │  ├── genericSearchService.js  # POST /search                 │  │
│  │  ├── genericSearch.js         # search helpers               │  │
│  │  ├── genericView.js           # GET /{id}                    │  │
│  │  ├── genericFilter.js         # filter builders              │  │
│  │  ├── createSchemaFilter.js    # dynamic filter schemas       │  │
│  │  ├── generic-send-information.js / genericHandleSend-        │  │
│  │  │   Information.js           # write paths                  │  │
│  │  ├── deleteService.js         # GET /{id}/delete             │  │
│  │  ├── searchClient.js · userService.js · cognitoService.js    │  │
│  │  ├── CryptoKeyService.js · urlValidator.js                   │  │
│  │                                                              │  │
│  │  ⚠ Only GET and POST are authorized. AxiosHttpClient still   │  │
│  │  exposes put()/delete() wrappers and generic-send-           │  │
│  │  information.js still calls put() — these are legacy paths   │  │
│  │  that contradict the platform policy and should be           │  │
│  │  migrated to POST sub-resources.                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Component: Cognito Auth]  src/cognito-auth/                │  │
│  │                                                              │  │
│  │  - OAuth 2.0 / OIDC flow                                     │  │
│  │  - JWT token management and refresh                          │  │
│  │  - Protected route wrapper                                   │  │
│  │  - Works with the server-side session cookie rotated by      │  │
│  │    BaseController (SessionConflictDialog surfaces conflicts) │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Other folders: config/ · constants/ · context/ · enums/ ·   │  │
│  │  errors/ · locale/ · routes/ · schemas/ · utils/             │  │
│  │  (utils/security/SQLInjectionDictionary.js mirrors the       │  │
│  │   backend dictionary for client-side pre-validation)         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Example (Create a record)

```
User submits a form
    │
    ▼
React Hook Form  (validates with a Joi schema)
    │
    ▼
useGeneralMutation (TanStack Query useMutation)
    │
    ▼
services/genericHandleSendInformation.js
    │  Axios POST /<resource>
    │  Headers: { Authorization: Bearer <JWT>, X-Tenant-Id }
    ▼
API Gateway → Lambda → PostgreSQL
    │
    ◄───┘
onSuccess
    │  1. queryClient.invalidateQueries([...])
    │  2. Notification via Redux dispatch
    │  3. navigate(...)
    ▼
List view refetches (cache invalidation)
```

---

## 4. Shared Infrastructure Components

### @kace/api-common Package

```
┌────────────────────────────────────────────────────────────┐
│  @kace/api-common (packages/kace_cloud_api_common/)        │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: BaseController]                       │    │
│  │  src/controllers/BaseController.js                 │    │
│  │                                                    │    │
│  │  Lifecycle:                                        │    │
│  │  - run(): getLoggedInUser → #actions →             │    │
│  │           #attachSessionCookieIfNeeded             │    │
│  │           finally destroyDbConnection()            │    │
│  │  - #actions(): routes by resource + method,        │    │
│  │                GET/POST only                       │    │
│  │  - #attachSessionCookieIfNeeded(): rotates         │    │
│  │    usuarios.session_key for Active Directory       │    │
│  │    accounts and sets the session cookie            │    │
│  │                                                    │    │
│  │  Overridable action methods:                       │    │
│  │  actionIndex · actionCreate · actionRead ·         │    │
│  │  actionReadBody · actionUpdate · actionDelete ·    │    │
│  │  actionSearch · actionAdvanceSearch · actionHistory│    │
│  │                                                    │    │
│  │  Helpers: payload(), resource(), httpMethod(),     │    │
│  │  getHeader(), user (with hasPermission()), tenant  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: ScheduleEventController]              │    │
│  │  src/controllers/ScheduleEventController.js        │    │
│  │  Base class for EventBridge-scheduled handlers     │    │
│  │  (no HTTP request, no Cognito user)                │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: Response / HttpResponse]              │    │
│  │  src/http_responses/                               │    │
│  │                                                    │    │
│  │  HttpResponse factories used across the codebase:  │    │
│  │  ok · created · badRequest · validationsFail ·     │    │
│  │  unauthorized · forbidden · notFound ·             │    │
│  │  methodNotAllowed · internalServerError            │    │
│  │                                                    │    │
│  │  Response instance API:                            │    │
│  │  - toJson()          serialize + enforce payload   │    │
│  │                      limits (payloadLimits.js)     │    │
│  │  - addHeaders(...)   e.g. Set-Cookie               │    │
│  │  - isSuccessful() / isOk() / isForbidden() /       │    │
│  │    isNotFound() / isClientError() / isServerError()│    │
│  │  - getValidOrigin()  CORS origin negotiation       │    │
│  │                                                    │    │
│  │  Always emits:                                     │    │
│  │  'Access-Control-Allow-Methods': 'GET, POST,       │    │
│  │                                   OPTIONS'         │    │
│  │                                                    │    │
│  │  ChannelHubInboundEmailWebhookResponse is a        │    │
│  │  dedicated response shape for the webhook path.    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: Errors]  src/errors/                  │    │
│  │  - BaseError                                       │    │
│  │  - runtime/RuntimeError                            │    │
│  │  - runtime/MethodNotAllowedError                   │    │
│  │  - runtime/ResourceNotFoundError                   │    │
│  │                                                    │    │
│  │  The public error CODE catalog lives in a separate │    │
│  │  package, @kace/error-codes (ADR-005, ADR-020).    │    │
│  │  Domain errors (CustomError, QueryDBError) live in │    │
│  │  @kace/core/src/shared.                            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: Multi-Tenancy]  src/middleware/       │    │
│  │                                                    │    │
│  │  - withTenantContext(handler)                      │    │
│  │      1. TenantContextManager.extractTenantId(event)│    │
│  │      2. TenantContextManager.getTenant(id)         │    │
│  │         → DynamoDB, LRU cached                     │    │
│  │      3. buildKnexConfig(tenant, {preferReplica})   │    │
│  │         buildReaderConfig(tenant, {preferReplica}) │    │
│  │      4. event.tenantContext = { tenant, knexConfig,│    │
│  │         readerConfig, tenant_id, … }               │    │
│  │      5. TenantContext.run(tenant, …)               │    │
│  │         (AsyncLocalStorage isolation)              │    │
│  │                                                    │    │
│  │  - tenantMiddleware() / tenantContextMiddleware()  │    │
│  │      Middy-based equivalent, used in pipelines     │    │
│  │  - TenantContextManager: cache + config builders   │    │
│  │                                                    │    │
│  │  ⚠ knexConfig is a CONFIG OBJECT, not a Knex       │    │
│  │  instance — it has no .raw(). Controllers needing  │    │
│  │  raw SQL must build a repository and destroy it.   │    │
│  │  The schema is config.schema.                      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: DB Routing]  src/db-routing/          │    │
│  │  - DbRequestContext: markWrite() / hasWritten()    │    │
│  │    → read-after-write consistency per request      │    │
│  │  - serviceDbRouting: which services prefer the     │    │
│  │    replica (mirrors DB_TARGET from KApiStack)      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: Search Authorization]                 │    │
│  │  src/search-authorization/                         │    │
│  │                                                    │    │
│  │  - SearchAuthorizationService: authorizes a search │    │
│  │    request against the caller's capabilities       │    │
│  │  - SearchPolicyRegistry: searchPolicies,           │    │
│  │    getSearchPolicy, getSearchPermissionDefinitions,│    │
│  │    createAdvancedPermission                        │    │
│  │  - capabilityValidator / filterMatcher /           │    │
│  │    relationshipMatcher: validate requested filters │    │
│  │    and relationship expansions                     │    │
│  │  - SearchAuditLogger: records authorization        │    │
│  │    decisions                                       │    │
│  │  - SearchAuthorizationError                        │    │
│  │                                                    │    │
│  │  See docs/architecture/search-authorization.md     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: Object Identity Security]             │    │
│  │  src/security/                                     │    │
│  │                                                    │    │
│  │  ObjectIdentityAuthorization.js exports:           │    │
│  │  - secureObjectCreatePayload(): strips and resets   │    │
│  │    SERVER_MANAGED_FIELDS, resolves the canonical   │    │
│  │    create identity, detects id collisions          │    │
│  │  - applyServerManagedFields, SERVER_MANAGED_FIELDS │    │
│  │  - assertAuthorizedRelationships,                  │    │
│  │    buildBroadRelationshipRules                     │    │
│  │  - assertCreateRouteUpdateAuthorized               │    │
│  │  - createRepositoryIdCollisionFinder               │    │
│  │  - objectIdentityErrorResponse,                    │    │
│  │    isObjectIdentityAuthorizationError,             │    │
│  │    ObjectIdentityAuthorizationError                │    │
│  │  - auditObjectIdentityDecision                     │    │
│  │                                                    │    │
│  │  ActiveGroupScope.js:                              │    │
│  │  - activeGroupScopeFromAuthenticatedUser (ADR-019) │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: Validation]  src/validation/schemas/  │    │
│  │  - SearchSchema: shared pagination / filter /      │    │
│  │    sort Joi schema for every POST /search          │    │
│  │  - ChannelHubInboundEmailSchema                    │    │
│  │  - caseStaleSnapshotFields                         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  [Component: Handlers]  src/handlers/              │    │
│  │  - eventbridge-orchestrator.mjs                    │    │
│  │    Shared entry point for EventBridge-scheduled    │    │
│  │    fan-out across tenants                          │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### packages/kace_cloud_aws_infra — `KApiStack`

| Concern | Implementation |
|---|---|
| Lambda | `NodejsFunction`, `Runtime.NODEJS_22_X`, `memorySize: 512`, `timeout: Duration.seconds(30)` |
| API | one `LambdaRestApi` per service, `proxy: false`, `EndpointType.REGIONAL` |
| Routes | `setIndexResource`, `setCreateResource`, `setReadResource`, `setUpdateResource` (POST), `setDeleteResource` (GET `/{id}/delete`), `setHistoryResource`, `setSearchResource`, `setAdvanceSearchResource` |
| CORS | `corsPreflightDefaultOptions()` → `['GET','POST','OPTIONS']`; `addGatewayResponses()` for 4XX/5XX |
| Auth | `createCognitoUserPoolsAuthorizer()`, applied only when `config.enableAuth` |
| Domain | `setBasePath()` → `BasePathMapping` with `basePath = id` |
| WAF | `setWafAssociation()` only in staging/production with `AWS_WAF_ARN` |
| Env | `DB_TARGET` from `getDbTarget(id)`, `SQL_GUARD_MODE` (default `enforce`), Cognito ids, AWS CSS vars |

---

## 5. Event Processing Components

```
┌────────────────────────────────────────────────────────────────────┐
│  apps/apiv1/kace_cloud_api_event_processor/                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Component: shared/createEventLambdaHandler.mjs]            │  │
│  │  Shared SQS handler factory used by all six consumers        │  │
│  │                                                              │  │
│  │  Pipeline:                                                   │  │
│  │   normalizeRecords.mjs   SQS record → DomainEvent            │  │
│  │   groupByTenant.mjs      batch → per-tenant buckets          │  │
│  │   runWithDeduplication.mjs  idempotency guard                │  │
│  │   → builds per-tenant dependencies (handlerFactories closure)│  │
│  │   → invokes the @kace/core event handler's handle(event)     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  [Components: the six consumers]                             │  │
│  │                                                              │  │
│  │  cases/handler.mjs                                           │  │
│  │    ← kace.core.case.created / kace.core.case.updated         │  │
│  │    → ExecuteActionsOnCaseCreated, ExecuteActionsOnCaseUpdated│  │
│  │                                                              │  │
│  │  case-post-processing/handler.mjs                            │  │
│  │    ← kace.core.case.post_processing.requested                │  │
│  │    → CasePostProcessingOnCaseCreated                         │  │
│  │      (history, fake cases, parent linkage — the async        │  │
│  │       offload that keeps the synchronous path fast)          │  │
│  │                                                              │  │
│  │  action-jobs/handler.mjs                                     │  │
│  │    ← kace.core.action_job.created                            │  │
│  │    → ProcessJobOnActionJobCreated                            │  │
│  │                                                              │  │
│  │  automated-actions/handler.mjs                               │  │
│  │    ← kace.core.automated_actions.requested                   │  │
│  │    → ProcessActionQueueOnCronJobRequested                    │  │
│  │                                                              │  │
│  │  ws-rest/handler.mjs                                         │  │
│  │    ← kace.core.ws_rest_flow_execution.requested              │  │
│  │    → ExecuteWSRestFlowOnExecutionRequested                   │  │
│  │                                                              │  │
│  │  reports/handler.mjs (+ buildReportViewRepository.mjs)       │  │
│  │    ← kace.core.report_execution.requested                    │  │
│  │    → ExecuteReportOnExecutionRequested                       │  │
│  │      (streaming export: pg-query-stream + lib-storage)       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  Failure handling: 3 receives → the bounded context's              │
│  <bc>-events-dlq.fifo (14-day retention).                          │
│  Visibility timeout is the handler timeout × 6.                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. Data Flow Examples

### Example 1: Create Case (Full Stack, synchronous path + async fan-out)

```
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: User Interaction                                       │
├─────────────────────────────────────────────────────────────────┤
│  Agent fills the case form in pages/Cases and submits.          │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: Frontend Validation & Mutation                         │
├─────────────────────────────────────────────────────────────────┤
│  React Hook Form validates with a Joi schema                    │
│  useGeneralMutation → mutation.mutate(dto)                      │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 3: API Service Call                                       │
├─────────────────────────────────────────────────────────────────┤
│  POST https://<domain>/cases                                    │
│  Authorization: Bearer <JWT>                                    │
│  X-Tenant-Id: <tenant>                                          │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 4: API Gateway (the `cases` REST API)                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Cognito User Pool Authorizer validates the JWT              │
│  2. Adds the claims to the request context                      │
│  3. Invokes the cases Lambda                                    │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 5: Lambda Handler                                         │
├─────────────────────────────────────────────────────────────────┤
│  withTenantContext:                                             │
│    - extracts the tenant id                                     │
│    - loads the tenant from DynamoDB (LRU cached)                │
│    - builds knexConfig (writer) + readerConfig (reader)         │
│    - runs the handler inside TenantContext.run()                │
│                                                                 │
│  handler.mjs picks Controller (no /view, no /{id}/… match)      │
│    const response = await controller.run();                     │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 6: Controller                                             │
├─────────────────────────────────────────────────────────────────┤
│  run() → getLoggedInUser() → #actions() → actionCreate()        │
│    1. Permission check by route                                 │
│    2. secureObjectCreatePayload() hardens server-managed fields │
│    3. Joi validation (create schema + auxiliaries schema)       │
│    4. Instantiates the use case with the repositories           │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 7: Use Case (@kace/core)                                  │
├─────────────────────────────────────────────────────────────────┤
│  1. Case.create(dto)          → domain invariants               │
│  2. Domain validations        → uniqueness, existence, ANS      │
│  3. repository.save(kase)     → writer                          │
│  4. repository.saveHistory(kase)                                │
│  5. Auxiliary values persisted into aux_cases                   │
│  6. Publishes CaseCreated through RoutingEventBus               │
│  7. Returns a Response DTO                                      │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 8: Repository (extends KnexRepository)                    │
├─────────────────────────────────────────────────────────────────┤
│  DbRequestContext.markWrite();                                  │
│  await this.table().insert({ … explicit column allowlist … });  │
│                                                                 │
│  this.table() resolves to "<tenant_schema>"."cases"             │
│  Any read after this point is served by the WRITER              │
│  (read-after-write consistency).                                │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 9: PostgreSQL (writer)                                    │
├─────────────────────────────────────────────────────────────────┤
│  INSERT INTO "<tenant_schema>"."cases" ( … ) VALUES ( … );      │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 10: Event Publication (still inside the request)          │
├─────────────────────────────────────────────────────────────────┤
│  RoutingEventBus.publish(CaseCreated):                          │
│    ├─ SendMessage → <svc>-cases-events-queue.fifo   (blocking)  │
│    └─ PutEvents  → EventBridge 'kace.core'          (best effort)│
│                                                                 │
│  An unmapped event name throws here — it is never silently      │
│  dropped, unless the bus itself fell back to InMemoryEventBus.  │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 11: Response Construction                                 │
├─────────────────────────────────────────────────────────────────┤
│  HttpResponse.created(...)                                      │
│  run() finally → destroyDbConnection()                          │
│  #attachSessionCookieIfNeeded() may add Set-Cookie              │
│  handler.mjs → response.toJson() (payload limits enforced)      │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 12: Frontend Processing (TanStack Query onSuccess)        │
├─────────────────────────────────────────────────────────────────┤
│  1. queryClient.invalidateQueries(['cases'])                    │
│  2. Success notification (Redux dispatch)                       │
│  3. navigate to the case detail                                 │
└─────────────────────────────────────────────────────────────────┘

        ── meanwhile, asynchronously ──
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step A: Event Processor (cases)                                │
├─────────────────────────────────────────────────────────────────┤
│  SqsEventSource delivers the batch (batchSize 10)               │
│  normalizeRecords → groupByTenant → runWithDeduplication        │
│  ExecuteActionsOnCaseCreated.handle(event):                     │
│    - CaseFinder.execute(aggregateId)                            │
│    - ActionExecutionDomainService.execute(CREATE_CASE, kase)    │
│    - UpdateSLATimers                                            │
│  Failures redrive; after 3 receives → cases DLQ                 │
└─────────────────────────────────────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step B: Event Processor (case-post-processing)                 │
├─────────────────────────────────────────────────────────────────┤
│  CasePostProcessingOnCaseCreated.handle(event)                  │
│  Offloads history, fake-case and parent-linkage work that used  │
│  to run inside the synchronous request.                         │
└─────────────────────────────────────────────────────────────────┘
```

### Example 2: Inbound Email from Channel Hub

```
Channel Hub
    │ POST /webhooks/channel-hub
    │ x-api-key: <usage plan key>
    ▼
API Gateway (webhooks REST API)
    │ enableAuth = false → NO Cognito authorizer
    │ apiKeyRequired = true → usage plan check
    ▼
apps/apiv1/kace_cloud_api_webhooks/src/handler.mjs
    │ withTenantContext → thin controller (ADR-004)
    ▼
@kace/core ChannelHubInboundEmailProcessor
    │ ChannelHubInboundEmailProcessorFactory builds the dependencies
    │ ChannelHubInboundTextBodyDownloader   → body
    │ ChannelHubInboundAttachmentDownloader → attachments
    │ ChannelHubInlineImageEmbedder         → inline images
    │ Validates the Channel Hub Account and the Workspace
    ▼
S3 (bodies + attachments, tenant bucket)
PostgreSQL (Email, EmailBody, EmailAttachment, Interaction)
```

---

**Document Status:** ✅ Validated against `develop`
**Last Updated:** 2026-08-27
**Version:** 2.0
**Author:** [Roberto Garcia](mailto:roberto.garcia@konecta-group.com)
