# C4 Model - Level 2: Container Architecture

## Overview

This document describes the **Container-level architecture** of KACE Cloud, showing the high-level technical building blocks (applications, databases, file systems, etc.) and how they communicate.

A **Container** in C4 terminology represents a separately runnable/deployable unit (e.g., web app, database, microservice) that executes code or stores data.

> **Source of truth:** this document is validated against the code in `develop`. Counts are reproducible:
> `ls -1 apps/apiv1 | wc -l`, `ls -1 packages/kace_cloud_core/src | wc -l`, `ls -1 packages | wc -l`,
> `ls -1 packages/kace_cloud_database/migrations | wc -l`.

## Container Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           KACE Cloud System                              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  [Container: React SPA]                                            │  │
│  │  Web Application                                                   │  │
│  │                                                                    │  │
│  │  Location: apps/kace-saas/                                         │  │
│  │  Runtime: Browser (Vite dev / CloudFront CDN)                      │  │
│  │  Technology: React 18.3, Redux Toolkit 2.3, TanStack Query v5,     │  │
│  │             Tailwind CSS 3.4, Radix UI, Axios 1.7, Vite 6          │  │
│  │  Port: 5174 (dev), HTTPS/443 (prod)                                │  │
│  │  IaC: apps/kace-saas/lib + apps/kace-saas/infraestructura          │  │
│  │       (CloudFront distribution, CSP + custom response headers)     │  │
│  │                                                                    │  │
│  │  Responsibilities:                                                 │  │
│  │  - User interface rendering                                        │  │
│  │  - State management (UI: Redux, Server: TanStack Query)            │  │
│  │  - Client-side routing (React Router v6)                           │  │
│  │  - Form validation (Joi + React Hook Form)                         │  │
│  │  - AWS Cognito OAuth integration + session heartbeat               │  │
│  │  - API consumption (Axios)                                         │  │
│  │  - File uploads (S3 presigned URLs)                                │  │
│  └────────────────────────────────────┬───────────────────────────────┘  │
│                                       │                                  │
│                                       │ HTTPS/REST + JWT                 │
│                                       │ (Authorization + X-Tenant-Id)    │
│                                       ▼                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  [Container: API Gateway]                                          │  │
│  │  AWS API Gateway (REST API v1) — ONE PER MICROSERVICE              │  │
│  │                                                                    │  │
│  │  Technology: AWS API Gateway REST (REGIONAL), AWS WAFv2            │  │
│  │  IaC: packages/kace_cloud_aws_infra/src/KApiStack.ts               │  │
│  │                                                                    │  │
│  │  Topology:                                                         │  │
│  │  - `LambdaRestApi` per service (`proxy: false`), each exposing     │  │
│  │    only the resources the service declares                         │  │
│  │  - All APIs share one custom domain via `BasePathMapping`,         │  │
│  │    where `basePath` is the service id                              │  │
│  │                                                                    │  │
│  │  Default resource set built by KApiStack:                          │  │
│  │    GET   /                 index                                   │  │
│  │    POST  /                 create                                  │  │
│  │    GET   /{id}             read                                    │  │
│  │    POST  /{id}             update      (NOT PUT)                   │  │
│  │    GET   /{id}/delete      delete      (NOT DELETE)                │  │
│  │    POST  /{id}/history     history                                 │  │
│  │    POST  /search           search                                  │  │
│  │    POST  /advance-search   advanced search                         │  │
│  │                                                                    │  │
│  │  Responsibilities:                                                 │  │
│  │  - REST API routing                                                │  │
│  │  - Cognito User Pool Authorizer (JWT) — conditional on enableAuth  │  │
│  │  - API Key + Usage Plan on the public webhook path                 │  │
│  │  - CORS: allowMethods = GET, POST, OPTIONS (+ credentials)         │  │
│  │  - Gateway responses for 4XX/5XX carrying CORS headers             │  │
│  │  - WAF Web ACL association (staging / production only)             │  │
│  │  - CloudWatch logging                                              │  │
│  └────────────────────────────────────┬───────────────────────────────┘  │
│                                       │                                  │
│                                       │ Invoke (event payload)           │
│                                       ▼                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  [Container: Lambda Microservices]                                 │  │
│  │  113 deployable packages in apps/apiv1                             │  │
│  │                                                                    │  │
│  │  Location: apps/apiv1/kace_cloud_api_*/src/                        │  │
│  │  Runtime: Node.js 22 (Runtime.NODEJS_22_X), x86_64                 │  │
│  │  Memory: 512 MB default (per-service overrides exist)              │  │
│  │  Timeout: 30 s default (event processors go up to 600 s)           │  │
│  │  Technology: ESM modules (.mjs), Joi validation, AWS SDK v3        │  │
│  │  Bundling: esbuild via NodejsFunction (SDK bundled, not external)  │  │
│  │                                                                    │  │
│  │  Domain APIs by bounded context (113 total):                       │  │
│  │  ├─ Case management (16)                                           │  │
│  │  ├─ Configuration & platform (17)                                  │  │
│  │  ├─ Classifications, states & transitions (10)                     │  │
│  │  ├─ Communications & channels (10)                                 │  │
│  │  ├─ Users, groups & access control (9)                             │  │
│  │  ├─ Reports, boards & analytics (7)                                │  │
│  │  ├─ Assignment, automation & shifts (6)                            │  │
│  │  ├─ WS REST flow engine (6)                                        │  │
│  │  ├─ Auxiliaries / Clients / Imports-Exports / Agendas (4 each)     │  │
│  │  ├─ Operations & tooling (4)                                       │  │
│  │  ├─ Actions / ANS / S3 files (3 each)                              │  │
│  │  ├─ Templates (2)                                                  │  │
│  │  └─ Event processing (1 package → 6 Lambdas)                       │  │
│  │                                                                    │  │
│  │  Pattern: Handler → Controller(s) → Use Cases → Repositories       │  │
│  │  One controller per endpoint; handler.mjs only picks the class,    │  │
│  │  rewrites event.resource and always ends in controller.run()       │  │
│  └───────────┬────────────────────────────────────┬───────────────────┘  │
│              │                                    │                      │
│              │ imports business logic             │ publishes            │
│              ▼                                    │ domain events        │
│  ┌────────────────────────────────────────────┐   │                      │
│  │  [Container: Core Business Logic]          │   │                      │
│  │  @kace/core NPM Package                    │   │                      │
│  │                                            │   │                      │
│  │  Location: packages/kace_cloud_core/       │   │                      │
│  │  Technology: JavaScript ESM, DDD           │   │                      │
│  │  Modules: 86 bounded contexts              │   │                      │
│  │                                            │   │                      │
│  │  Architecture: Hexagonal (Ports/Adapters)  │   │                      │
│  │  ├─ Domain: Entities, VOs, Domain Services,│   │                      │
│  │  │          Domain Events, Guards          │   │                      │
│  │  ├─ Application: Use Cases, DTOs,          │   │                      │
│  │  │               Event Handlers            │   │                      │
│  │  └─ Infrastructure: Repositories, Event    │   │                      │
│  │                     buses, External svcs   │   │                      │
│  │                                            │   │                      │
│  │  NOTE: consumers import deep paths         │   │                      │
│  │  (@kace/core/src/...). No barrel files.    │   │                      │
│  └──────────────┬─────────────────────────────┘   │                      │
│                 │                                 │                      │
│                 │ SQL (Knex)                      ▼                      │
│                 │                  ┌──────────────────────────────────┐  │
│                 │                  │  [Container: SQS FIFO queues]    │  │
│                 │                  │  One queue + one DLQ per BC      │  │
│                 │                  │                                  │  │
│                 │                  │  IaC: kace_cloud_api_event_      │  │
│                 │                  │       processor/lib              │  │
│                 │                  │                                  │  │
│                 │                  │  Queues (.fifo):                 │  │
│                 │                  │   <svc>-cases-events-queue       │  │
│                 │                  │   <svc>-action-jobs-events-queue │  │
│                 │                  │   <svc>-automated-actions-…      │  │
│                 │                  │   <svc>-ws-rest-events-queue     │  │
│                 │                  │   <svc>-case-post-processing-…   │  │
│                 │                  │   <svc>-reports-events-queue     │  │
│                 │                  │  + a *-events-dlq.fifo for each  │  │
│                 │                  │                                  │  │
│                 │                  │  maxReceiveCount: 3              │  │
│                 │                  │  DLQ retention: 14 days          │  │
│                 │                  │  visibility = timeout × 6        │  │
│                 │                  │  contentBasedDeduplication req'd │  │
│                 │                  └───────────────┬──────────────────┘  │
│                 │                                  │ SqsEventSource       │
│                 │                                  ▼                      │
│                 │                  ┌──────────────────────────────────┐  │
│                 │                  │  [Container: Event Processor]    │  │
│                 │                  │  6 SQS-triggered Lambdas         │  │
│                 │                  │                                  │  │
│                 │                  │  cases       60s /1024MB/batch10 │  │
│                 │                  │  action-jobs 300s/1024MB/batch10 │  │
│                 │                  │  automated-  120s/1024MB/batch10 │  │
│                 │                  │    actions                       │  │
│                 │                  │  ws-rest     600s/1024MB/batch 1 │  │
│                 │                  │  case-post-   30s/ 512MB/batch10 │  │
│                 │                  │    processing                    │  │
│                 │                  │  reports     600s/1024MB/batch 1 │  │
│                 │                  └──────────────────────────────────┘  │
│                 │                                                        │
│                 │                  ┌──────────────────────────────────┐  │
│                 │                  │  [Container: EventBridge bus]    │  │
│                 │                  │  Best-effort ARCHIVE sidecar     │  │
│                 │                  │                                  │  │
│                 │                  │  source: 'kace.core'             │  │
│                 │                  │  Failures do NOT break publish   │  │
│                 │                  │  Used for replay / audit         │  │
│                 │                  └──────────────────────────────────┘  │
│                 │                                                        │
│  ┌──────────────┴─────────────────────────────────────────────────────┐  │
│  │  [Container: Actions Queue Worker]                                 │  │
│  │  ECS on EC2 — long-running scheduler (NOT Lambda)                  │  │
│  │                                                                    │  │
│  │  Location: apps/workers/kace_cloud_worker_actions_queue_executions │  │
│  │  Two services from the SAME image, selected by WORKER_MODE:        │  │
│  │   - 'fast' : health port 8080, staleness 300 s, 2048 MiB           │  │
│  │   - 'ans'  : health port 8081, staleness 1800 s, 1536 MiB          │  │
│  │  Jobs: ActionsQueueJob, UsersActionsJob, GroupsActionsJob,         │  │
│  │        AutomatedAssignmentJob, AnsCalculateJob                     │  │
│  │  Runs against the READ REPLICA (DB_TARGET=replica)                 │  │
│  │  Log groups: /ecs/<svc>/actions-queue-executions-worker[-ans]      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│    ┌────────────────────────────┬──────────────────────────────┐         │
│    ▼                            ▼                              ▼         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐    │
│  │  [Container: │  │  [Container: │  │  [Container:                 │    │
│  │  PostgreSQL] │  │   AWS S3]    │  │   AWS DynamoDB]              │    │
│  │   Database   │  │   Storage    │  │   Tenant registry            │    │
│  │              │  │              │  │                              │    │
│  │  Technology: │  │  Technology: │  │  Holds per tenant:           │    │
│  │  PostgreSQL  │  │  AWS S3      │  │  - db_host / db_host_reader  │    │
│  │  16 (RDS /   │  │              │  │  - schema                    │    │
│  │  Aurora +    │  │  ONE BUCKET  │  │  - aws_s3_bucket             │    │
│  │  RDS Proxy)  │  │  PER TENANT  │  │  - aws_sqs_region            │    │
│  │              │  │  resolved    │  │  - aws_event_bridge_*        │    │
│  │  Writer +    │  │  from        │  │  - aws_*_events_queue_url    │    │
│  │  Reader      │  │  tenant.     │  │    (one per bounded context) │    │
│  │  endpoints   │  │  aws_s3_     │  │                              │    │
│  │              │  │  bucket      │  │  Read through an LRU cache   │    │
│  │  113 tables  │  │              │  │  in withTenantContext        │    │
│  │  325 Knex    │  │  Contents:   │  │                              │    │
│  │  migrations  │  │  - case      │  │                              │    │
│  │              │  │    attach-   │  │                              │    │
│  │  Schema per  │  │    ments     │  │                              │    │
│  │  tenant:     │  │  - email     │  │                              │    │
│  │  - cases     │  │    bodies &  │  │                              │    │
│  │  - usuarios  │  │    attach-   │  │                              │    │
│  │  - clients   │  │    ments     │  │                              │    │
│  │  - aux_cases │  │  - exports / │  │                              │    │
│  │  - ...       │  │    CSV       │  │                              │    │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘    │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                      Shared Packages (13 in packages/)                   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  [Container: @kace/api-common]                                     │  │
│  │  Shared API Utilities Package                                      │  │
│  │                                                                    │  │
│  │  Location: packages/kace_cloud_api_common/                         │  │
│  │  Technology: JavaScript ESM                                        │  │
│  │                                                                    │  │
│  │  Contents:                                                         │  │
│  │  - BaseController (run() + action* routing, auth, session cookie)  │  │
│  │  - ScheduleEventController (EventBridge-scheduled handlers)        │  │
│  │  - Response / HttpResponse (standardized response builder)         │  │
│  │  - BaseError + RuntimeError / MethodNotAllowedError /              │  │
│  │    ResourceNotFoundError                                           │  │
│  │  - withTenantContext, tenantMiddleware, TenantContextManager       │  │
│  │  - db-routing: DbRequestContext (read-after-write), serviceDbRouting│  │
│  │  - search-authorization: SearchAuthorizationService,               │  │
│  │    SearchPolicyRegistry, capabilityValidator, SearchAuditLogger    │  │
│  │  - security: ObjectIdentityAuthorization, ActiveGroupScope         │  │
│  │  - SearchSchema (Joi schema for pagination/filtering/sorting)      │  │
│  │  - eventbridgeOrchestratorHandler                                  │  │
│  │  - lru-cache, aws-jwt-verify, @aws-sdk/client-lambda               │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  [Container: @kace/aws-infra]                                      │  │
│  │  AWS CDK Infrastructure-as-Code Package                            │  │
│  │                                                                    │  │
│  │  Location: packages/kace_cloud_aws_infra/                          │  │
│  │  Technology: TypeScript, AWS CDK 2.x                               │  │
│  │                                                                    │  │
│  │  Contents:                                                         │  │
│  │  - KApiStack (base CDK stack: Lambda + LambdaRestApi + CORS +      │  │
│  │    Cognito authorizer + WAF + BasePathMapping + env injection)     │  │
│  │  - dbRoutingEnv (getDbTarget → DB_TARGET per service)              │  │
│  │  - OrchestratorHelper                                              │  │
│  │  - Globally injected env: SQL_GUARD_MODE, DB_TARGET, Cognito ids   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  [Container: @kace/database]                                       │  │
│  │  Database Configuration & Migration Package                        │  │
│  │                                                                    │  │
│  │  Location: packages/kace_cloud_database/                           │  │
│  │  Technology: Knex.js, PostgreSQL                                   │  │
│  │                                                                    │  │
│  │  Contents:                                                         │  │
│  │  - knexfile.js (database configuration)                            │  │
│  │  - 325 timestamped migrations (113 distinct tables)                │  │
│  │  - Seed scripts (initial data)                                     │  │
│  │  - Multi-environment support (dev, test, prod)                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  [Container: supporting packages]                                  │  │
│  │                                                                    │  │
│  │  - @kace/schemabuilder  (kace_cloud_schemas_builder)               │  │
│  │      Dynamic Joi schema generation + build memoization             │  │
│  │  - @kace/error-codes    (kace_cloud_error_codes)                   │  │
│  │      Public error code catalog — see ADR-005 / ADR-020             │  │
│  │  - @kace/file-extensions(kace_cloud_file_extensions)               │  │
│  │      Shared allowed-file-extension catalog                         │  │
│  │  - kace_cloud_db_sync   Table sync tooling between environments    │  │
│  │  - kace_cloud_perf      k6/Jest load-test suite (scenarios,        │  │
│  │                         runner, reporter)                          │  │
│  │  - kace_cloud_local_server  Local HTTP runner for handlers         │  │
│  │  - kace_cloud_aws_database  Aurora + RDS Proxy stack (source on a  │  │
│  │                         feature branch; only cdk.out on develop)   │  │
│  │  - @kace/eslint-config  (4-space indent, double quotes, no console)│  │
│  │  - @kace/prettier_config (120 char width, 4-space tabs)            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                      Other applications (apps/)                          │
│                                                                          │
│  - apps/asistencia_notificaciones_robotica  Scheduled notification       │
│      service with its own CDK stack (knex + nodemailer)                  │
│  - apps/kace_cloud_swagger                  API documentation UI          │
│  - apps/onescript_plugin_kace               Embedded "One Script"         │
│      form engine consumed by the SPA                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

## Container Details

### 1. React SPA (Web Application)

**Container Type:** Single-Page Application (Client-side web app)

**Technology Stack:**
- React 18.3.1 (functional components with hooks)
- Redux Toolkit 2.3 (UI state management)
- TanStack Query v5.59 (server state management, caching)
- React Router v6.27 (client-side routing)
- Vite 6.2 (build tool, dev server)
- Tailwind CSS 3.4 + Radix UI (styling and components)
- Axios 1.7 (HTTP client)
- React Hook Form + Joi 17.13 (form validation)

**Location:** `apps/kace-saas/`

**Deployment:**
- **Development**: Vite dev server on port 5174
- **Production**: `vite build && cdk deploy` → static assets on S3 behind a CloudFront distribution defined in `apps/kace-saas/lib/deployment-kace-admin-front-service.ts`, with CSP and custom response headers from `apps/kace-saas/infraestructura/utils/`

**Structure (measured):**
- 50 feature pages under `src/pages/`
- 31 reusable components under `src/components/core/`, plus `layouts/`, `modal/`, `ui-shared/` and a newer `componentsV2/{core,lib}`
- 33 custom hooks under `src/hooks/`
- 13 Redux slices under `src/redux/state/`
- 14 API services under `src/services/`
- Additional folders: `cognito-auth/`, `config/`, `constants/`, `context/`, `enums/`, `errors/`, `locale/`, `routes/`, `schemas/`, `utils/`

**Responsibilities:**
1. **User Interface Rendering**
2. **Client-Side Routing**: React Router with protected routes (`useAccessRoutes`)
3. **State Management**:
   - **UI State** (Redux): user info, permissions, modals, filters, banners
   - **Server State** (TanStack Query): API data, caching, invalidation, optimistic updates
4. **Authentication**: AWS Cognito OAuth 2.0 integration, session heartbeat (`useSessionHeartbeat`), inactivity logout (`useInactivityLogout`), session-conflict dialog
5. **API Communication**: Axios HTTP client with JWT Authorization headers
6. **Form Handling**: React Hook Form with Joi validation schemas
7. **File Uploads**: S3 presigned URL workflow

**Communication:**
- **Outbound**: HTTPS REST API calls to API Gateway with JWT bearer token
- **Inbound**: HTTP responses (JSON)

**Storage:**
- **Local/Session Storage**: tokens, user preferences, temporary form data
- **TanStack Query Cache**: API response caching (in-memory)

---

### 2. API Gateway (HTTP API Interface)

**Container Type:** AWS Managed Service (API Gateway REST API v1)

**Technology:** AWS API Gateway (REGIONAL endpoints), AWS WAFv2

**Topology — one REST API per microservice.** `KApiStack.getLambdaRestApi()` creates a `LambdaRestApi` with `proxy: false` for each service, and `setBasePath()` attaches it to the shared custom domain through a `BasePathMapping` whose `basePath` is the service id. There is no single monolithic API with all resources.

**Responsibilities:**
1. **Request Routing**: maps the declared resources to the service's Lambda
2. **Authentication**: `CognitoUserPoolsAuthorizer` with `authorizationType: COGNITO` — applied only when `config.enableAuth` is true. Services that opt out (e.g. `kace_cloud_api_webhooks`) must provide their own scheme.
3. **API Keys**: the webhook path uses `apiKeyRequired: true` with a Usage Plan (`<svc>-webhooks-channel-hub`)
4. **CORS**: `allowMethods: ['GET', 'POST', 'OPTIONS']`, `allowCredentials`, origins from `appsAllowedOrigins`
5. **Gateway responses**: explicit CORS headers on `DEFAULT_4XX` / `DEFAULT_5XX` so browser errors are readable
6. **WAF Integration**: `CfnWebACLAssociation` on the deployment stage — **only** when the environment is staging or production and `AWS_WAF_ARN` is set
7. **Custom Domain**: shared domain + per-service base path
8. **Logging**: CloudWatch request/response logging

### HTTP Methods: GET and POST Only

Information Security only authorizes `GET` and `POST`. `PUT`, `PATCH` and `DELETE` are **forbidden** — in API Gateway routes, in CORS configuration, and in frontend clients. This is enforced in four places:

| Layer | File | Enforcement |
|---|---|---|
| Routing | `packages/kace_cloud_aws_infra/src/KApiStack.ts` | `setUpdateResource` registers `POST /{id}`; `setDeleteResource` registers `GET /{id}/delete` |
| CORS | `KApiStack.ts` (`corsPreflightDefaultOptions`, `addGatewayResponses`) | `allowMethods: ['GET','POST','OPTIONS']` |
| Controller | `packages/kace_cloud_api_common/src/controllers/BaseController.js` | `const allowMethods = ['GET', 'POST'];` → anything else is a `MethodNotAllowedError` |
| Response | `packages/kace_cloud_api_common/src/http_responses/Response.js` | `'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'` |

Model writes as `POST` on a sub-resource (`POST /{id}/register`, `POST /{id}/delete` remapped to `GET` inside the handler).

---

### 3. Lambda Microservices (Serverless Backend)

**Container Type:** 113 deployable packages under `apps/apiv1`

**Technology:**
- Runtime: Node.js 22 (`Runtime.NODEJS_22_X`)
- Module System: ECMAScript Modules (.mjs)
- Memory: 512 MB default; event processors use 512–1024 MB
- Timeout: 30 s default; event processors 30–600 s
- Architecture: x86_64
- Bundling: esbuild through `NodejsFunction`; the AWS SDK is bundled (no `externalModules`), which is why `RoutingEventBus` imports `@aws-sdk/client-sqs` statically

**Location:** `apps/apiv1/kace_cloud_api_*/`

**Service Categories (113 total, verified):**

| Bounded context | Count |
|---|---|
| Case management | 16 |
| Configuration & platform | 17 |
| Classifications, states & transitions | 10 |
| Communications & channels | 10 |
| Users, groups & access control | 9 |
| Reports, boards & analytics | 7 |
| Assignment, automation & shifts | 6 |
| WS REST flow engine | 6 |
| Auxiliaries (custom fields) | 4 |
| Clients | 4 |
| Imports / Exports | 4 |
| Agendas & scheduling | 4 |
| Operations & tooling | 4 |
| Actions | 3 |
| ANS (SLA) | 3 |
| S3 files | 3 |
| Templates | 2 |
| Event processing (1 package → 6 Lambdas) | 1 |

Two packages (`kace_cloud_api_ans_calculate`, `kace_cloud_api_metrics`) have no `cdk:deploy` script and are not deployed by `pnpm deploy`; `kace_cloud_api_auth` is an empty leftover directory with no `package.json`.

**Standard Lambda Structure:**
```
handler.mjs        # Entry point with withTenantContext, picks the controller
controller.mjs     # One controller per endpoint, extends BaseController
schemas.mjs        # Joi validation schemas
```

**Communication:**
- **Inbound**: synchronous invocation from API Gateway, or `SqsEventSource` for the event processors, or EventBridge schedules for cron-style services
- **Outbound**:
  - PostgreSQL queries (Knex.js, writer or reader)
  - S3 API calls (AWS SDK)
  - SQS `SendMessage` / `SendMessageBatch` for domain events
  - EventBridge `PutEvents` (archive sidecar)
  - External HTTP requests (Axios)

**Deployment:**
- AWS CDK 2.x (Infrastructure as Code), one CloudFormation stack per service
- `pnpm deploy` runs `validate-env-deploy.sh`, then `pnpm -r run cdk:deploy` with `--workspace-concurrency=5` (`deploy:15` raises it to 15)

---

### 4. Core Business Logic (@kace/core)

**Container Type:** Shared NPM Package (imported by Lambda functions and by the ECS worker)

**Technology:** JavaScript ESM, Domain-Driven Design

**Location:** `packages/kace_cloud_core/`

**Size:** 86 directories under `src/` (bounded contexts plus `shared/`, `factories/`, `policies/`)

**Architecture:** Hexagonal (Ports & Adapters) with 3 layers

**Layers:**
1. **Domain Layer**: Entities (aggregate roots), Value Objects, Domain Services, **Domain Events**, Guards (`SQLInjectionGuard`, `SQLInjectionCriteriaGuard`)
2. **Application Layer**: Use Cases (Creator, Finder, Updater, Deleter, Searcher), DTOs (Response, CollectionResponse), **Event Handlers**
3. **Infrastructure Layer**: Repositories (`KnexXxxRepository` extending `KnexRepository`), Event buses, External Service Clients (S3, Cognito, Gmail, Graph)

**No barrel files.** Consumers import the specific module path; there is no aggregated `index.js` re-export at the package root.

**Communication:**
- **Imported by**: Lambda functions and the ECS worker (ES module imports)
- **Exports**: Use Cases, Entities, Repositories, Event Handlers, Event buses

---

### 5. PostgreSQL Database

**Container Type:** Relational Database (AWS RDS / Aurora, optionally behind RDS Proxy)

**Technology:** PostgreSQL 16

**Responsibilities:**
1. **Multi-Tenant Data Storage**: separate schema per tenant
2. **Transactional Integrity**: ACID compliance
3. **Schema Management**: Knex migrations
4. **Connection Pooling**: `pg` pooling, per-Lambda

**Schema Structure:**
- **113 distinct tables** created across the migration history
- Key tables: `cases`, `usuarios`, `clients`, `aux_cases`, `aux_clients`, `clasificaciones`, `estados`, `acciones`, `templates`, ~37 `history_*` tables

**Multi-Tenancy:**
- Separate schemas per tenant; the schema name comes from the tenant registry in DynamoDB
- Knex is configured with the `schema` option; `KnexRepository` qualifies every table name (`table()`, `qualifiedName()`, `trxTable()`)

**Read / Write Split (implemented, not future):**
- Each Lambda receives `DB_TARGET` from `KApiStack` (`getDbTarget(id)`)
- `withTenantContext` builds both `knexConfig` (writer) and `readerConfig` (reader) from the tenant's `db_host` / `db_host_reader`
- `KnexRepository` exposes `get writer`, `get reader` and `this.read`; `DbRequestContext.hasWritten()` forces reads back to the writer after a write in the same request (read-after-write consistency)
- Repositories must receive tenant **config objects**, never a prebuilt Knex instance — a prebuilt writer collapses the reader onto it silently

**Migrations:**
- **325 versioned migrations** in `packages/kace_cloud_database/migrations/`
- Automated via `pnpm run migrate:latest`
- SQLite is deprecated: no `client === 'sqlite3'` branches in new code, and persistence tests run against integration PostgreSQL

**Backup & Recovery:** automated RDS snapshots, point-in-time recovery enabled

---

### 6. AWS S3 Storage

**Container Type:** Object Storage (AWS Managed Service)

**Technology:** AWS S3

**Bucket model:** **one bucket per tenant**. The bucket is resolved at runtime as
`tenant?.aws_s3_bucket?.value ?? process.env.BUCKET ?? process.env.AWS_S3_BUCKET`
(see `S3AttachmentStorage.js`, `S3EmailBodyStorage.js`, `EmailZipGenerator.js`). There are no fixed per-environment `kace-attachments-*` buckets.

**Contents:** case attachments, template attachments, help attachments, email bodies and email attachments, report/CSV exports.

**Security:**
- Server-side encryption
- Bucket policies restricting access to Lambda/ECS IAM roles
- Presigned URLs for temporary browser access

**Workflow:**
1. Lambda generates presigned upload URL
2. React SPA uploads file directly to S3
3. Lambda creates the S3File metadata record in PostgreSQL
4. For downloads: Lambda generates a presigned download URL

---

### 7. Domain Event Transport (SQS FIFO + EventBridge)

> **There is no RabbitMQ in the system.** `amqplib` does not appear in any `package.json` or import in the monorepo. The `packages/kace_cloud_core/src/rabbitmq/` module is CRUD for *broker adapter/mapper configuration rows* stored in PostgreSQL; `RabbitMQConnection.js` is a value object, not a client.

**Container Type:** AWS SQS (FIFO) as the hot path + AWS EventBridge as an archive sidecar

**Publisher:** `RoutingEventBus` (`packages/kace_cloud_core/src/shared/infrastructure/events/RoutingEventBus.js`)
- One SQS FIFO queue per event name, resolved through `buildQueueMapFromTenant`
- Batching via `SendMessageBatchCommand` (max 10 entries, concurrency capped at 5 with `p-limit`)
- The EventBridge publish runs in parallel and is **best-effort**: its failure does not break publishing
- **Unmapped events fail fast at publish time** (throw)
- Built per tenant by `buildRoutingEventBusFromTenant(tenant)`; a tenant missing a required queue URL makes the builder throw, so the whole map must be populated

**Event → queue map** (`eventRoutingConfig.js`):

| Event name | Tenant field | Queue |
|---|---|---|
| `kace.core.case.created` | `aws_cases_events_queue_url` | cases |
| `kace.core.case.updated` | `aws_cases_events_queue_url` | cases |
| `kace.core.action_job.created` | `aws_action_jobs_events_queue_url` | action-jobs |
| `kace.core.automated_actions.requested` | `aws_automated_actions_events_queue_url` | automated-actions |
| `kace.core.ws_rest_flow_execution.requested` | `aws_ws_rest_events_queue_url` | ws-rest |
| `kace.core.report_execution.requested` | `aws_reports_events_queue_url` | reports |
| `kace.core.case.post_processing.requested` | `aws_case_post_processing_queue_url` | case-post-processing *(optional / tolerant: omitted when the URL is not yet backfilled)* |

**Queues** (`EventProcessorStack`): `<appsServiceName>-<bc>-events-queue.fifo` with a matching `-events-dlq.fifo`, `maxReceiveCount: 3`, DLQ retention 14 days, visibility timeout = handler timeout × 6.

**Consumers:** six Lambdas in `apps/apiv1/kace_cloud_api_event_processor/src/{cases,action-jobs,automated-actions,ws-rest,case-post-processing,reports}/handler.mjs`, all built on the shared `createEventLambdaHandler.mjs` (which does `normalizeRecords`, `groupByTenant`, `runWithDeduplication`).

**Alternative buses:** `SQSEventBus` (single queue), `EventBridgeEventBus` (archive), `InMemoryEventBus` (tests). Note that a failure while building the routing map falls back to `InMemoryEventBus`, which silently drops every event for that tenant — a known operational hazard.

---

### 8. Actions Queue Worker (ECS)

**Container Type:** Long-running container service on ECS backed by EC2 (`Ec2Service`, `EcsOptimizedImage.amazonLinux2023()`), **not** Lambda.

**Location:** `apps/workers/kace_cloud_worker_actions_queue_executions/`

**Why it exists:** the jobs are cron-style sweeps over every tenant whose runtime exceeds what a Lambda timeout allows.

**Structure:** `index.mjs` → `Scheduler` → `JobRunner` → jobs, with `TenantEnumerator` iterating tenants and `Health.mjs` exposing `/health`.

**Jobs:** `ActionsQueueJob`, `UsersActionsJob`, `GroupsActionsJob`, `AutomatedAssignmentJob`, `AnsCalculateJob`.

**Two services from one image**, selected by `WORKER_MODE`:

| Service | `WORKER_MODE` | Health port | Staleness | Memory reservation |
|---|---|---|---|---|
| Worker | `fast` | 8080 | 300 s | 2048 MiB |
| WorkerAns | `ans` | 8081 | 1800 s | 1536 MiB |

`AnsCalculateJob` is isolated in its own task because its heavy synchronous recalculation blocks the event loop; a freeze can then only recycle the `ans` task, never the fast worker or its health probe.

**Database target:** `DB_TARGET=replica` — the worker reads from the replica.

**Logs:** `/ecs/<appsServiceName>/actions-queue-executions-worker` and `...-worker-ans`.

---

## Container Communication Patterns

### 1. Synchronous Request-Response (HTTP)

```
React SPA
    │
    │ HTTPS POST /cases
    │ Authorization: Bearer <JWT>
    │ X-Tenant-Id: <tenant>
    ▼
API Gateway (the cases REST API)
    │
    │ Cognito User Pool Authorizer validates the JWT
    │ Invokes the cases Lambda
    ▼
handler.mjs
    │
    │ withTenantContext → DynamoDB tenant lookup (LRU cached)
    │ builds knexConfig (writer) + readerConfig (reader)
    │ selects the controller and rewrites event.resource
    ▼
Controller.run()   (BaseController)
    │
    │ authentication + session_key rotation
    │ routes to actionCreate()
    │ validates input (Joi)
    ▼
Use Case (CaseCreator)
    │
    │ Domain logic → Repository
    ▼
KnexCaseRepository extends KnexRepository
    │
    │ this.table('cases').insert(...)   → writer
    │ DbRequestContext.markWrite()
    ▼
PostgreSQL (writer)
    │
    ◄───┘
Controller.run() finally → destroyDbConnection() + session cookie
    │
    ▼
Response.toJson()   (payload limit enforced here)
```

### 2. Asynchronous Domain Events (SQS FIFO)

```
Lambda (e.g. cases) after a successful write
    │
    │ RoutingEventBus.publish(CaseCreated)
    │   ├─ SendMessage → <svc>-cases-events-queue.fifo   (blocking hot path)
    │   └─ PutEvents  → EventBridge bus 'kace.core'      (best effort, archive)
    ▼
SQS FIFO queue (MessageGroupId per aggregate,
                contentBasedDeduplication required)
    │
    │ SqsEventSource (batchSize 10, maxConcurrency 100)
    ▼
Lambda: event-processor/cases/handler.mjs
    │
    │ normalizeRecords → groupByTenant → runWithDeduplication
    ▼
Event Handler in @kace/core
    ExecuteActionsOnCaseCreated.handle(domainEvent)
    CasePostProcessingOnCaseCreated.handle(domainEvent)
    │
    │ may call external APIs, update the DB, send email,
    │ or publish further events
    ▼
PostgreSQL / External System
    │
    └─ on repeated failure (3 receives) → <svc>-cases-events-dlq.fifo
```

### 3. Scheduled Batch Processing (ECS Worker)

```
ECS task (WORKER_MODE=fast)
    │
    │ Scheduler tick
    ▼
TenantEnumerator → for each active tenant
    │
    ▼
JobRunner → ActionsQueueJob / UsersActionsJob / GroupsActionsJob /
            AutomatedAssignmentJob
    │
    │ reads through the replica (DB_TARGET=replica)
    │ may publish domain events onto SQS
    ▼
PostgreSQL (reader) + SQS

ECS task (WORKER_MODE=ans)  → AnsCalculateJob only, isolated
```

### 4. File Upload (S3 Presigned URLs)

```
React SPA
    │ 1. Request presigned upload URL
    ▼
Lambda (upload_s3_files)
    │ 2. Resolves the tenant bucket (tenant.aws_s3_bucket)
    │    Returns { uploadUrl, fileId }
    ▼
React SPA
    │ 3. Uploads the file directly to S3 (bypassing Lambda)
    ▼
AWS S3
    ◄───┘
React SPA
    │ 4. Confirms upload completion (POST)
    ▼
Lambda (s3_files) → 5. Creates the S3File record
    ▼
PostgreSQL
```

### 5. Inbound Email (Channel Hub Webhook)

```
Channel Hub
    │ POST /webhooks/channel-hub
    │ x-api-key: <usage plan key>
    ▼
API Gateway (webhooks REST API — Cognito authorizer DISABLED,
             apiKeyRequired: true)
    ▼
Lambda (webhooks) → thin controller
    ▼
@kace/core ChannelHubInboundEmailProcessor
    │ Email + Email Body + Attachments + Interaction
    │ + Channel Hub Account and Workspace validation
    ▼
S3 (bodies, attachments) + PostgreSQL (metadata)
```

---

## Deployment View

### Development Environment

```
Developer Machine
├── Vite dev server (port 5174) → React SPA
├── Docker Desktop
│   └── PostgreSQL 16.3 container (docker-compose.yml)
├── SAM Local (Docker) → Lambda functions
└── packages/kace_cloud_local_server → local HTTP runner for handlers
```

### Production Environment (AWS)

```
AWS Cloud
├── CloudFront CDN → React SPA (S3 bucket, own CDK stack)
├── Route53 → Custom domain DNS
├── WAFv2 Web ACL → associated to each API stage (staging/prod only)
├── API Gateway → one REGIONAL REST API per microservice,
│                 all mapped onto one custom domain by base path
├── Lambda Functions (113 packages; 6 of them SQS-triggered)
├── ECS on EC2 → actions queue worker (2 services)
├── SQS FIFO (6 queues + 6 DLQs)
├── EventBridge bus (domain event archive)
├── RDS / Aurora PostgreSQL 16 (writer + reader, optional RDS Proxy)
├── DynamoDB (tenant registry)
├── S3 Buckets (one per tenant)
├── Cognito User Pool
└── CloudWatch Logs/Metrics/Alarms (per-queue backlog alarms)
```

---

## Scalability Characteristics

| Container | Scalability Mechanism |
|---|---|
| **React SPA** | CloudFront CDN edge locations (global) |
| **API Gateway** | AWS auto-scaling |
| **Lambda Functions** | Auto-scaling; event processors capped per BC (`maxConc` 50–200) |
| **@kace/core** | Scales with its host (imported library) |
| **SQS FIFO** | Per-BC isolation: a slow BC cannot starve the others; DLQ absorbs poison messages |
| **ECS Worker** | Vertical (task size) + capacity provider on the EC2 ASG |
| **PostgreSQL** | Vertical scaling **plus an active read replica** (`DB_TARGET`) |
| **AWS S3** | Unlimited storage, auto-scaling |

---

## Security Characteristics

| Container | Security Measures |
|---|---|
| **React SPA** | HTTPS only, CSP headers (`infraestructura/utils/contentSecurityPolicy.ts`), XSS protection |
| **API Gateway** | Cognito authorizer, API keys + usage plan on webhooks, WAF (staging/prod), CORS restricted to GET/POST/OPTIONS |
| **Lambda** | IAM roles per stack, encrypted env vars, `SQL_GUARD_MODE` injected globally |
| **@kace/core** | `SQLInjectionGuard` / `SQLInjectionCriteriaGuard` as defense-in-depth; parameterized bindings and identifier allowlists are the actual protection |
| **@kace/api-common** | `SearchAuthorizationService` + `SearchPolicyRegistry` (per-search policies), `ObjectIdentityAuthorization` (server-managed fields, id-collision detection), `ActiveGroupScope` |
| **PostgreSQL** | VPC isolation, encrypted at rest/in transit, schema-per-tenant isolation |
| **AWS S3** | Encryption, bucket policies, presigned URLs, per-tenant bucket isolation |
| **SQS / EventBridge** | IAM-scoped `SendMessage` per bounded context (a publisher stack must call `grantEventPublishingPermissions` or the send is denied at runtime) |

---

## Testing

| Scope | Runner | Command | Threshold |
|---|---|---|---|
| `@kace/core` | Jest (ESM) | `pnpm run tests` (`maxWorkers=6`, per-file template databases, parallel) | 80% branches/functions/lines/statements |
| Microservices | Jest | `pnpm test` | per-package |
| Frontend | Vitest | `pnpm run test` / `test:coverage` | per-package |
| Load | k6 / custom | `packages/kace_cloud_perf` | n/a |

Integration tests (`*Integration.test.js`) must hit real resources — real DB and repository calls, not mocks.

---

**Document Status:** ✅ Validated against `develop`
**Last Updated:** 2026-08-27
**Version:** 2.0
**Author:** [Roberto Garcia](mailto:roberto.garcia@konecta-group.com)
