# Documentación de Paquetes Compartidos

Los paquetes compartidos contienen la lógica de negocio, infraestructura y utilidades reutilizables en todo el monorepo.

## Índice de Paquetes

| Paquete | Descripción | Versión |
|---------|-------------|---------|
| [@kace/core](#kacecore) | Lógica de negocio y dominio (DDD) | 1.7.2 |
| [@kace/database](#kacedatabase) | Migraciones y configuración de BD | 1.7.2 |
| [@kace/api-common](#kaceapi-common) | Utilidades HTTP para APIs | 1.7.2 |
| [@kace/aws-infra](#kaceaws-infra) | CDK Stack base para Lambda | 1.7.2 |
| [@kace/schemabuilder](#kaceschemabuilder) | Constructor dinámico de schemas Joi | 1.7.2 |
| [@kace/eslint-config](#kaceeslint-config) | Configuración ESLint compartida | 1.7.2 |
| [@kace/prettier_config](#kaceprettier_config) | Configuración Prettier compartida | 1.7.2 |

---

## @kace/core

**Ubicación**: `packages/kace_cloud_core/`

### Descripción

Paquete central que contiene toda la lógica de negocio implementada con Domain-Driven Design (DDD). Incluye 78 módulos de dominio que cubren todas las funcionalidades del sistema.

### Arquitectura

```
kace_cloud_core/
├── src/
│   ├── cases/                    # Gestión de casos
│   │   ├── domain/
│   │   │   ├── Case.js           # Aggregate Root
│   │   │   ├── CaseId.js         # Value Object
│   │   │   └── CaseRepository.js # Repository Interface
│   │   ├── application/
│   │   │   ├── create/
│   │   │   │   └── CaseCreator.js
│   │   │   ├── update/
│   │   │   │   └── CaseUpdater.js
│   │   │   ├── delete/
│   │   │   │   └── CaseDeleter.js
│   │   │   └── find/
│   │   │       └── CaseFinder.js
│   │   └── infrastructure/
│   │       └── persistence/
│   │           └── KnexCaseRepository.js
│   ├── users/                    # Usuarios
│   ├── groups/                   # Grupos
│   ├── classifications/          # Clasificaciones
│   ├── states/                   # Estados
│   ├── transitions/              # Transiciones
│   ├── workflows/                # Workflows REST
│   ├── actions/                  # Acciones automatizadas
│   ├── rabbitmq/                 # Adaptadores RabbitMQ
│   ├── shared/                   # Código compartido
│   │   ├── domain/
│   │   │   ├── value-object/     # Value Objects base
│   │   │   └── services/         # Servicios de dominio
│   │   └── infrastructure/
│   │       └── persistence/
│   │           └── KnexRepository.js
│   └── index.js                  # Exportaciones
└── package.json
```

### Módulos de Dominio (78)

| Módulo                 | Descripción                 |
|------------------------|-----------------------------|
| `cases`                | Gestión completa de casos   |
| `users`                | Usuarios del sistema        |
| `groups`               | Grupos y permisos           |
| `roles`                | Roles de usuario            |
| `states`               | Estados de casos            |
| `transitions`          | Transiciones entre estados  |
| `classifications`      | Clasificaciones jerárquicas |
| `templates`            | Plantillas de notificación  |
| `actions`              | Acciones automatizadas      |
| `agendas`              | Calendarios y horarios      |
| `appointments`         | Citas                       |
| `ws_rest_flows`        | Workflows REST              |
| `ws_rest_endpoints`    | Endpoints de workflow       |
| `ws_rest_functions`    | Funciones de workflow       |
| `ws_rest_conditionals` | Condicionales de workflow   |
| `rabbitmq`             | Adaptadores de mensajería   |
| ...                    | (62 módulos más)            |

### Servicios Principales

#### WorkflowStepExecutorService

Motor de ejecución de workflows con soporte para:
- **Endpoints**: Llamadas HTTP con headers/body dinámicos
- **Functions**: Transformación de datos
- **Conditionals**: Lógica de branching

```javascript
import { WorkflowStepExecutorService } from '@kace/core';

const executor = new WorkflowStepExecutorService(dependencies);
const result = await executor.execute(workflowStep, context);
```

#### EventLogger

Servicio de logging para auditoría.

```javascript
import { EventLogger } from '@kace/core';

const logger = new EventLogger(repository);
await logger.log('CASE_CREATED', { caseId, userId, changes });
```

### Value Objects

```javascript
import {
    ValueObjectString,
    ValueObjectInt,
    ValueObjectJson,
    ValueObjectDate,
    ValueObjectBoolean
} from '@kace/core';

// Uso
const caseId = new ValueObjectInt(123);
const caseData = new ValueObjectJson({ title: 'Mi caso' });
```

### Uso

```javascript
import {
    CaseCreator,
    CaseFinder,
    KnexCaseRepository
} from '@kace/core';

// Crear instancias
const repository = new KnexCaseRepository(knexConfig);
const creator = new CaseCreator(repository, eventLogger);

// Usar
const newCase = await creator.execute({
    title: 'Nuevo caso',
    description: 'Descripción',
    priorityId: 1
});
```

### Dependencias Principales

- `knex` - Query builder SQL
- `pg` - Driver PostgreSQL
- `@aws-sdk/*` - SDKs de AWS
- `joi` - Validación
- `jsonwebtoken` - JWT
- `axios` - HTTP client

---

## @kace/database

**Ubicación**: `packages/kace_cloud_database/`

### Descripción

Gestión de la base de datos PostgreSQL incluyendo migraciones, seeds y configuración de conexión.

### Estructura

```
kace_cloud_database/
├── migrations/           # 209 archivos de migración
│   ├── 20240101000000_create_users.js
│   ├── 20240102000000_create_groups.js
│   └── ...
├── seeds/               # Datos iniciales
├── knexfile.js          # Configuración Knex
└── package.json
```

### Migraciones (209)

Las migraciones cubren todas las tablas del sistema:

| Categoría       | Tablas                                                    |
|-----------------|-----------------------------------------------------------|
| Core            | `casos`, `usuarios`, `grupos`, `roles`                    |
| States          | `estados`, `transiciones`                                 |
| Classifications | `clasificaciones`, `niveles_clasificacion`                |
| Workflows       | `ws_rest_flows`, `ws_rest_endpoints`, `ws_rest_functions` |
| Temporal        | `agendas`, `appointments`, `time_slots`                   |
| Config          | `global_configurations`, `auxiliar_definitions`           |

### Configuración (knexfile.js)

```javascript
export const production = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    },
    pool: { min: 2, max: 10 },
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations'
    }
};
```

### Scripts

```bash
# Ejecutar migraciones
pnpm run migrate

# Solo últimas migraciones
pnpm run migrate:latest

# Rollback
pnpm run migrate:rollback

# Estado
pnpm run migrate:status

# Seeds
pnpm run seed
```

---

## @kace/api-common

**Ubicación**: `packages/kace_cloud_api_common/`

### Descripción

Utilidades compartidas para todos los microservicios API, incluyendo controladores base, respuestas HTTP y manejo de errores.

### Estructura

```
kace_cloud_api_common/
├── src/
│   ├── controllers/
│   │   ├── BaseController.js    # Controlador base
│   │   └── ScheduleEventController.js
│   ├── http_responses/
│   │   ├── Response.js          # Respuestas HTTP
│   │   └── HttpResponse.js
│   ├── errors/
│   │   ├── BaseError.js
│   │   ├── MethodNotAllowedError.js
│   │   ├── ResourceNotFoundError.js
│   │   └── RuntimeError.js
│   ├── schemas/
│   │   └── SearchSchema.js      # Schemas de búsqueda
│   └── index.js
└── package.json
```

### BaseController

Clase base para todos los controladores de microservicios.

```javascript
import { BaseController } from '@kace/api-common';

class CasesController extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
    }

    async handleGet() {
        const cases = await this.caseFinder.execute();
        return this.ok(cases);
    }

    async handlePost() {
        const data = this.getBody();
        const newCase = await this.caseCreator.execute(data);
        return this.created(newCase);
    }
}
```

### HttpResponse

```javascript
import { HttpResponse } from '@kace/api-common';

// Respuestas exitosas
HttpResponse.ok(data);           // 200
HttpResponse.created(data);      // 201
HttpResponse.noContent();        // 204

// Respuestas de error
HttpResponse.badRequest(message);     // 400
HttpResponse.unauthorized();          // 401
HttpResponse.forbidden();             // 403
HttpResponse.notFound();              // 404
HttpResponse.internalServerError();   // 500
```

### Manejo de Errores

```javascript
import {
    BaseError,
    ResourceNotFoundError,
    MethodNotAllowedError
} from '@kace/api-common';

// Lanzar errores tipados
throw new ResourceNotFoundError('Case not found');
throw new MethodNotAllowedError('PUT method not supported');
```

### Características de Seguridad

- Sanitización de errores SQL
- Headers de seguridad (CSP, HSTS, X-Content-Type-Options)
- Validación de CORS
- Logging de errores

---

## @kace/aws-infra

**Ubicación**: `packages/kace_cloud_aws_infra/`

### Descripción

Stack CDK base para la infraestructura de microservicios AWS Lambda.

### KApiStack

Clase base que todos los microservicios extienden.

```typescript
// lib/cases-stack.ts
import { KApiStack, KApiStackProps } from '@kace/aws-infra';

export class CasesStack extends KApiStack {
    constructor(scope: Construct, id: string, props: KApiStackProps) {
        super(scope, id, props);

        // Configuración por defecto
        this.setDefaultOptions();

        // O personalizar
        this.setCustomOptions({
            memorySize: 512,
            timeout: Duration.seconds(60)
        });
    }
}
```

### KApiStackProps

```typescript
interface KApiStackProps extends StackProps {
    // API Gateway
    apiGatewayDomainName: string;
    apiGatewayDomainNameAliasTarget: string;
    apiGatewayDomainNameAliasHostedZoneId: string;

    // Cognito
    cognitoUserPoolId: string;
    cognitoClientId: string;

    // Database
    dbHost: string;
    dbPort: string;
    dbName: string;
    dbUser: string;
    dbPassword: string;

    // S3
    s3BucketName: string;
    s3AccessKeyId: string;
    s3SecretAccessKey: string;

    // WAF
    wafArn: string;

    // Security
    encryptionKey: string;
    encryptionIv: string;
}
```

### Recursos Creados

- Lambda Function (Node.js 22)
- API Gateway REST API
- Cognito Authorizer
- IAM Roles y Policies
- CloudWatch Log Groups
- Mapeo de dominio personalizado

---

## @kace/schemabuilder

**Ubicación**: `packages/kace_cloud_schemas_builder/`

### Descripción

Constructor dinámico de schemas Joi para validación de datos.

### Uso

```javascript
import { SchemaBuilder } from '@kace/schemabuilder';

// Definir estructura
const definition = {
    name: { type: 'string', required: true, min: 2, max: 100 },
    age: { type: 'number', min: 0, max: 150 },
    email: { type: 'string', format: 'email' },
    tags: {
        type: 'array',
        data_structure: { type: 'string' }
    },
    metadata: { type: 'json' }
};

// Construir schema
const schema = await SchemaBuilder.build(definition);

// Validar datos
const { error, value } = schema.validate(data);
```

### Tipos Soportados

| Tipo      | Builder              | Opciones                        |
|-----------|----------------------|---------------------------------|
| `string`  | StringSchemaBuilder  | min, max, pattern, format, enum |
| `number`  | NumberSchemaBuilder  | min, max, integer, positive     |
| `date`    | DateSchemaBuilder    | min, max, format                |
| `boolean` | BooleanSchemaBuilder | -                               |
| `array`   | ArraySchemaBuilder   | data_structure, min, max        |
| `json`    | -                    | Cualquier objeto JSON           |

### Formatos de String

- `email`
- `uuid`
- `uri`
- `date`
- `datetime`

---

## @kace/eslint-config

**Ubicación**: `packages/kace_cloud_eslint/`

### Descripción

Configuración ESLint compartida para mantener consistencia de código.

### Reglas Principales

```javascript
module.exports = {
    extends: ['standard'],
    rules: {
        'indent': ['error', 4],
        'quotes': ['error', 'double', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'always-multiline'],
        'no-console': 'error',
        'camelcase': 'off',
    }
};
```

### Uso

```json
// package.json del microservicio
{
    "eslintConfig": {
        "extends": "@kace/eslint-config"
    }
}
```

---

## @kace/prettier_config

**Ubicación**: `packages/kace_cloud_prettier_config_shared/`

### Descripción

Configuración Prettier compartida para formateo de código.

### Configuración

```javascript
module.exports = {
    trailingComma: 'es5',
    tabWidth: 4,
    semi: true,
    singleQuote: true,
    useTabs: false,
    bracketSpacing: true,
    arrowParens: 'always',
    printWidth: 120,
};
```

### Uso

```json
// package.json del microservicio
{
    "prettier": "@kace/prettier_config"
}
```

---

## Diagrama de Dependencias

```
┌─────────────────────────────────────────────────────────────────┐
│                        Microservicios                           │
│                    (apps/apiv1/kace_cloud_api_*)               │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
            ┌───────────┐ ┌───────────┐ ┌───────────────┐
            │@kace/core │ │@kace/     │ │@kace/         │
            │           │ │api-common │ │aws-infra      │
            └─────┬─────┘ └─────┬─────┘ └───────────────┘
                  │             │
                  ▼             │
        ┌─────────────────┐     │
        │ @kace/          │◀────┘
        │ schemabuilder   │
        └─────────────────┘
                  │
                  ▼
        ┌─────────────────┐
        │ @kace/database  │
        └─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Configuración (todos los paquetes)                 │
│         @kace/eslint-config    @kace/prettier_config           │
└─────────────────────────────────────────────────────────────────┘
```

## Versionado

Todos los paquetes siguen semantic versioning y se versionan juntos:

```
Versión actual: 1.7.2

Incremento:
- MAJOR: Cambios incompatibles
- MINOR: Nuevas funcionalidades compatibles
- PATCH: Bug fixes
```

El versionado se automatiza en CI/CD con bump de patch en merge a develop.
