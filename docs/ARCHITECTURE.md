# Arquitectura del Sistema KACE Cloud

## Visión General

KACE Cloud implementa una arquitectura **serverless** basada en microservicios, siguiendo principios de **Domain-Driven Design (DDD)** y **Clean Architecture**.

## Diagrama de Arquitectura

```
                                    ┌─────────────────────────────────────────────────────────┐
                                    │                      AWS Cloud                          │
                                    │                                                         │
┌──────────────┐                    │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│              │                    │  │   Route53   │    │     WAF     │    │  CloudFront │  │
│   Browser    │───────────────────▶│  │   (DNS)     │───▶│  (Firewall) │───▶│    (CDN)    │  │
│   (React)    │                    │  └─────────────┘    └─────────────┘    └──────┬──────┘  │
│              │                    │                                               │         │
└──────────────┘                    │                                               ▼         │
                                    │  ┌────────────────────────────────────────────────────┐ │
                                    │  │              API Gateway (REST)                    │ │
                                    │  │         + Cognito Authorizer                       │ │
                                    │  └────────────────────────┬───────────────────────────┘ │
                                    │                           │                             │
                                    │         ┌─────────────────┼─────────────────┐           │
                                    │         ▼                 ▼                 ▼           │
                                    │  ┌───────────┐     ┌───────────┐     ┌───────────┐      │
                                    │  │  Lambda   │     │  Lambda   │     │  Lambda   │      │
                                    │  │  Cases    │     │  Users    │     │  Clients  │      │
                                    │  └─────┬─────┘     └─────┬─────┘     └─────┬─────┘      │
                                    │        │                 │                 │            │
                                    │        └─────────────────┼─────────────────┘            │
                                    │                          ▼                              │
                                    │  ┌──────────────────────────────────────────────────┐   │
                                    │  │                @kace/core                        │   │
                                    │  │           (Business Logic Layer)                 │   │
                                    │  └──────────────────────┬───────────────────────────┘   │
                                    │                         │                               │
                                    │         ┌───────────────┼───────────────┐               │
                                    │         ▼               ▼               ▼               │
                                    │  ┌───────────┐   ┌───────────┐   ┌───────────┐          │
                                    │  │ PostgreSQL│   │    S3     │   │ RabbitMQ  │          │
                                    │  │   (RDS)   │   │ (Storage) │   │ (Queue)   │          │
                                    │  └───────────┘   └───────────┘   └───────────┘          │
                                    │                                                         │
                                    └─────────────────────────────────────────────────────────┘
```

## Capas de la Arquitectura

### 1. Capa de Presentación (Frontend)

**Ubicación**: `apps/kace-saas/`

```
Frontend (React SPA)
├── Componentes UI (Radix UI + Tailwind)
├── Estado Global (Redux Toolkit)
├── Estado del Servidor (TanStack Query)
├── Routing (React Router v6)
└── Autenticación (AWS Cognito)
```

**Responsabilidades**:
- Renderizado de interfaz de usuario
- Gestión de estado local y global
- Comunicación con APIs via HTTP
- Manejo de autenticación OAuth2/OIDC

### 2. Capa de API (Microservicios)

**Ubicación**: `apps/apiv1/`

```
API Gateway
├── Autorización Cognito
├── Rate Limiting
├── WAF Rules
└── Lambda Functions (95 servicios)
    ├── Handler (entry point)
    ├── Controller (routing)
    └── Schemas (validación)
```

**Responsabilidades**:
- Enrutamiento de peticiones HTTP
- Validación de entrada (Joi)
- Autorización y permisos
- Orquestación de casos de uso

### 3. Capa de Dominio (Core)

**Ubicación**: `packages/kace_cloud_core/`

```
@kace/core
├── Domain Layer
│   ├── Entities (Aggregates)
│   ├── Value Objects
│   ├── Domain Services
│   └── Domain Events
├── Application Layer
│   ├── Use Cases (Creator, Updater, Deleter, Finder)
│   ├── DTOs
│   └── Application Services
└── Infrastructure Layer
    ├── Repositories (Knex)
    ├── External Services
    └── Adapters
```

**Responsabilidades**:
- Lógica de negocio pura
- Reglas de dominio
- Validaciones de negocio
- Casos de uso

### 4. Capa de Infraestructura

**Ubicación**: `packages/kace_cloud_aws_infra/`, `packages/kace_cloud_database/`

```
Infrastructure
├── AWS CDK Stacks
│   ├── Lambda Functions
│   ├── API Gateway
│   ├── Cognito
│   └── IAM Roles
├── Database
│   ├── Knex Migrations
│   ├── Seeds
│   └── Connection Pool
└── External Services
    ├── S3 Client
    ├── RabbitMQ Client
    └── Email (Nodemailer)
```

## Patrones de Diseño

### Domain-Driven Design (DDD)

```
┌─────────────────────────────────────────────────────────────┐
│                      Bounded Context                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Aggregate  │  │   Entity    │  │    Value Object     │  │
│  │    Root     │──│             │──│                     │  │
│  │   (Case)    │  │ (CaseAns)   │  │ (CaseId, CaseDate)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  Domain Service                         ││
│  │         (WorkflowStepExecutorService)                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Módulos de Dominio (78 total)**:
- `cases` - Gestión de casos
- `users` - Usuarios del sistema
- `groups` - Grupos y permisos
- `classifications` - Clasificaciones
- `states` - Estados y transiciones
- `workflows` - Motor de workflows
- `actions` - Acciones automatizadas
- ...y más

### Repository Pattern

```javascript
// Interfaz abstracta
class Repository {
    async find(id) {}
    async save(entity) {}
    async delete(id) {}
    async search(criteria) {}
}

// Implementación concreta
class KnexCaseRepository extends KnexRepository {
    constructor(knexConfig) {
        super(knexConfig, 'casos');
    }

    async findByCriteria(criteria) {
        return this.search(criteria);
    }
}
```

### Use Case Pattern

```javascript
// Caso de uso: Crear un caso
class CaseCreator {
    constructor(repository, eventLogger) {
        this.repository = repository;
        this.eventLogger = eventLogger;
    }

    async execute(caseData) {
        // Validar datos de entrada
        const validatedData = await this.validate(caseData);

        // Crear entidad de dominio
        const caseEntity = Case.create(validatedData);

        // Persistir
        await this.repository.save(caseEntity);

        // Registrar evento
        await this.eventLogger.log('CASE_CREATED', caseEntity);

        return caseEntity;
    }
}
```

## Flujo de Datos

### Request Flow (Crear Caso)

```
1. Frontend                    2. API Gateway              3. Lambda Handler
   POST /cases ─────────────────▶ Auth Check ─────────────▶ handler.mjs
   { title, description }        (Cognito JWT)              │
                                                            ▼
4. Controller                  5. Use Case                 6. Repository
   controller.mjs ─────────────▶ CaseCreator ─────────────▶ KnexCaseRepository
   Validate(Joi)                 Business Logic              INSERT INTO casos
   │                             │                           │
   │                             ▼                           ▼
   │                          Domain Event               PostgreSQL
   │                          CASE_CREATED                  │
   │                             │                          │
   ◀─────────────────────────────┴──────────────────────────┘
   Response { id, status }
```

### Event Flow (Workflow Execution)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Trigger   │────▶│  WorkflowStep    │────▶│    Endpoint     │
│  (Action)   │     │    Executor      │     │   (HTTP Call)   │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
             ┌───────────┐     ┌───────────┐
             │ Function  │     │Conditional│
             │(Transform)│     │ (Branch)  │
             └───────────┘     └───────────┘
```

## Comunicación entre Servicios

### Síncrona (HTTP)

```
Frontend ──HTTP──▶ API Gateway ──▶ Lambda ──▶ @kace/core ──▶ PostgreSQL
                        │
                        └──▶ Cognito (Auth)
```

### Asíncrona (RabbitMQ)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Producer  │────▶│  RabbitMQ   │────▶│  Consumer   │
│   Lambda    │     │   Queue     │     │   Lambda    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                        │
      │           AdapterCreator               │
      └────────────────────────────────────────┘
```

## Seguridad

### Autenticación

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Usuario   │────▶│   Cognito   │────▶│  JWT Token  │
│             │     │  User Pool  │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌──────────────────────────┘
                    ▼
             ┌─────────────┐
             │ API Gateway │
             │ Authorizer  │
             └─────────────┘
```

### Autorización

```javascript
// Verificación de permisos en BaseController
async checkPermissions(user, action, resource) {
    const permissions = await this.permissionsService.getForUser(user.id);
    return permissions.canPerform(action, resource);
}
```

### Capas de Seguridad

1. **WAF** - Protección contra ataques comunes
2. **API Gateway** - Rate limiting, throttling
3. **Cognito** - Autenticación OAuth2/OIDC
4. **Lambda** - Validación de permisos
5. **Database** - Sanitización SQL (Knex)

## Escalabilidad

### Horizontal (Lambda)

```
Requests ──▶ API Gateway ──▶ Lambda (auto-scaling)
                              ├── Instance 1
                              ├── Instance 2
                              ├── Instance 3
                              └── Instance N
```

### Base de Datos

```
┌─────────────┐     ┌─────────────┐
│   Primary   │────▶│   Replica   │
│    (RW)     │     │    (RO)     │
└─────────────┘     └─────────────┘
```

## Monitoreo y Observabilidad

### Logging

```
Lambda ──▶ CloudWatch Logs ──▶ Log Insights
              │
              └──▶ EventLogger (audit trail)
```

### Métricas

- **Lambda**: Invocations, Duration, Errors, Throttles
- **API Gateway**: Latency, 4XX/5XX errors, Request count
- **RDS**: Connections, CPU, IOPS

## Decisiones Arquitectónicas

### ADR-001: Monorepo con pnpm

**Contexto**: Necesidad de compartir código entre múltiples servicios.

**Decisión**: Usar pnpm workspaces para gestionar el monorepo.

**Consecuencias**:
- (+) Código compartido fácilmente
- (+) Versionado coordinado
- (-) Mayor complejidad en CI/CD

### ADR-002: Serverless con Lambda

**Contexto**: Necesidad de escalabilidad automática y bajo costo operativo.

**Decisión**: Usar AWS Lambda para todos los microservicios.

**Consecuencias**:
- (+) Escalabilidad automática
- (+) Pago por uso
- (-) Cold starts
- (-) Límite de 15 minutos

### ADR-003: DDD para lógica de negocio

**Contexto**: Complejidad del dominio de gestión de casos.

**Decisión**: Implementar Domain-Driven Design en `@kace/core`.

**Consecuencias**:
- (+) Lógica de negocio aislada
- (+) Testabilidad mejorada
- (-) Mayor curva de aprendizaje

## Referencias

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
