# Especificacion de Microservicios

Guia de referencia y especificacion para la creacion de microservicios AWS Lambda en KACE Cloud.

## Indice

1. [Arquitectura General](#arquitectura-general)
2. [Tipos de Servicio](#tipos-de-servicio)
3. [Estructura de un Microservicio](#estructura-de-un-microservicio)
4. [Patron Estandar (CRUD + Tenant)](#patron-estandar-crud--tenant)
5. [Patron Event-Driven (SQS/EventBridge)](#patron-event-driven-sqseventbridge)
6. [Patron Standalone (Sin Tenant)](#patron-standalone-sin-tenant)
7. [Catalogo de Servicios](#catalogo-de-servicios)
8. [Patrones Comunes](#patrones-comunes)
9. [Desarrollo Local](#desarrollo-local)
10. [Despliegue](#despliegue)
11. [Monitoreo](#monitoreo)
12. [Checklist de Creacion](#checklist-de-creacion)

---

## Arquitectura General

### Stack Tecnologico

| Componente | Tecnologia              |
|------------|-------------------------|
| Runtime    | Node.js 22+             |
| Compute    | AWS Lambda              |
| API        | AWS API Gateway (REST)  |
| Auth       | Amazon Cognito          |
| IaC        | AWS CDK 2.x             |
| Database   | PostgreSQL (Knex.js)    |
| DynamoDB   | Multi-tenancy + custom  |
| Events     | SQS FIFO + EventBridge  |
| Testing    | Jest (ESM)              |
| Monorepo   | pnpm workspaces         |

### Diagrama de Arquitectura

```
                        ┌──────────────────────────────────────────┐
                        │            API Gateway                    │
                        │        (REST + Cognito Auth)              │
                        └──────────────────┬───────────────────────┘
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
  ┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
  │  Lambda /cases     │     │  Lambda /users     │     │  Lambda /metrics   │
  │  (withTenantCtx)   │     │  (withTenantCtx)   │     │  (public, no auth) │
  └────────┬───────────┘     └────────┬───────────┘     └────────┬───────────┘
           │                          │                          │
           └──────────┬───────────────┘                          │
                      ▼                                          ▼
  ┌──────────────────────────────────────┐     ┌────────────────────────────┐
  │           @kace/core                  │     │  DynamoDB (tabla propia)   │
  │       (Business Logic Layer)          │     └────────────────────────────┘
  └──────────────────┬───────────────────┘
                     │
       ┌─────────────┼─────────────┬─────────────┐
       ▼             ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│PostgreSQL │ │ DynamoDB  │ │    S3     │ │ SQS/EB   │
│   (RDS)   │ │(multitnt) │ │           │ │ (events) │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
```

### Paquetes Compartidos

| Paquete                  | Uso                                           |
|--------------------------|-----------------------------------------------|
| `@kace/core`             | Logica de negocio (DDD, Use Cases, Repos)     |
| `@kace/api-common`       | `withTenantContext`, `BaseController`, `HttpResponse` |
| `@kace/aws-infra`        | `KApiStack` base para CDK                     |
| `@kace/eslint-config`    | Configuracion ESLint compartida               |
| `@kace/prettier_config`  | Configuracion Prettier compartida             |
| `@kace/database`         | Migraciones y seed Knex                       |

---

## Tipos de Servicio

Existen tres patrones segun el caso de uso:

| Tipo | Descripcion | Auth | Tenant | Ejemplo |
|------|-------------|------|--------|---------|
| **Estandar (CRUD)** | API REST con Cognito, multi-tenant, PostgreSQL | Si (Cognito) | Si (`withTenantContext`) | `kace_cloud_api_cases` |
| **Event-Driven** | Procesador de eventos SQS/EventBridge | No (trigger) | Manual | `kace_cloud_api_event_processor` |
| **Standalone** | Endpoint publico o con DynamoDB propio | No | No | `kace_cloud_api_metrics` |

---

## Estructura de un Microservicio

### Estructura de Directorios

```
apps/apiv1/kace_cloud_api_[nombre]/
├── bin/
│   └── [nombre].ts              # Entry point CDK
├── lib/
│   └── [nombre]-stack.ts        # Stack CDK (extends KApiStack)
├── src/
│   ├── handler.mjs              # Lambda handler
│   ├── controller.mjs           # Routing a use cases (servicios CRUD)
│   └── schemas.mjs              # Validacion Joi
├── test/
│   └── [nombre].test.mjs        # Tests unitarios
├── package.json
├── cdk.json
└── tsconfig.json
```

### package.json

Seguir este template exacto. Las dependencias workspace son obligatorias:

```json
{
    "name": "@kace/api-[nombre]",
    "version": "1.0.0",
    "bin": {
        "[nombre]": "bin/[nombre].js"
    },
    "scripts": {
        "build": "tsc",
        "watch": "tsc -w",
        "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit",
        "cdk": "cdk",
        "cdk:synth": "rm -rf cdk.out && cdk synth",
        "cdk:deploy": "cdk deploy --require-approval never",
        "cdk:clean": "rm -rf cdk.out",
        "eslint-check": "eslint .",
        "eslint-fix": "eslint --fix .",
        "format": "prettier --write .",
        "format:check": "prettier --check ."
    },
    "devDependencies": {
        "@kace/prettier_config": "workspace:*",
        "@jest/globals": "^29.7.0",
        "@types/jest": "^29.5.12",
        "@types/node": "20.14.9",
        "aws-cdk": "^2.1005.0",
        "jest": "^29.7.0",
        "ts-jest": "^29.1.5",
        "ts-node": "^10.9.2",
        "typescript": "~5.5.3",
        "prettier": "^3.3.3"
    },
    "dependencies": {
        "@kace/api-common": "workspace:*",
        "@kace/aws-infra": "workspace:*",
        "@kace/core": "workspace:*",
        "@kace/eslint-config": "workspace:*",
        "aws-cdk-lib": "^2.185.0",
        "constructs": "^10.0.0",
        "joi": "^17.13.3",
        "source-map-support": "^0.5.21"
    }
}
```

> Agregar dependencias adicionales segun el tipo de servicio (ej: `@aws-sdk/client-dynamodb` para servicios con DynamoDB propio).

### cdk.json

```json
{
    "app": "npx ts-node --prefer-ts-exts bin/[nombre].ts"
}
```

> Copiar el bloque `context` completo desde otro servicio existente (ej: `kace_cloud_api_tenant/cdk.json`).

### tsconfig.json

```json
{
    "compilerOptions": {
        "target": "ES2020",
        "module": "commonjs",
        "lib": ["es2020", "dom"],
        "declaration": true,
        "strict": true,
        "noImplicitAny": true,
        "strictNullChecks": true,
        "noImplicitThis": true,
        "alwaysStrict": true,
        "noUnusedLocals": false,
        "noUnusedParameters": false,
        "noImplicitReturns": true,
        "noFallthroughCasesInSwitch": false,
        "inlineSourceMap": true,
        "inlineSources": true,
        "experimentalDecorators": true,
        "strictPropertyInitialization": false,
        "esModuleInterop": true,
        "typeRoots": ["./node_modules/@types"]
    },
    "exclude": ["node_modules", "cdk.out"]
}
```

---

## Patron Estandar (CRUD + Tenant)

Este es el patron que sigue la **gran mayoria** (~90) de los servicios. Usa autenticacion Cognito, contexto multi-tenant, y PostgreSQL via `@kace/core`.

### bin/[nombre].ts

```typescript
#!/usr/bin/env node
import { NombreStack } from '../lib/[nombre]-stack';
import { config } from 'dotenv';
import path from 'node:path';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { App } from 'aws-cdk-lib';

config({ path: '../../../.env' });

const app = new App();
const props = {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
};

const kProps: KApiStackProps = {
    ...KApiStack.KProps(),
    pathHandler: path.join(__dirname, '../src/handler.mjs'),
};

new NombreStack(app, 'NombreStack', props, kProps);
```

### lib/[nombre]-stack.ts

**Caso simple** (CRUD estandar sin recursos custom):

```typescript
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { StackProps } from 'aws-cdk-lib';

export class NombreStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        // setDefaultOptions configura: Lambda + API Gateway + CRUD routes + Cognito auth + WAF + DynamoDB
        this.setDefaultOptions('[nombre]');
    }
}
```

**Caso con recursos adicionales** (como `cases` que tiene transiciones, sub-cases, etc.):

```typescript
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';

export class CasesStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        const path = 'cases';

        const lambdaFunction = this.getNodejsFunction(path);
        const lambdaRestApi = this.getLambdaRestApi(path, lambdaFunction);
        const methodOptions = this.getLambdaRestApiMethodOptions();

        this.setDefaultResources(lambdaRestApi, methodOptions);
        this.setBasePath(path, lambdaRestApi);
        this.setWafAssociation(lambdaRestApi);
        this.grantDynamoDbPermissions(path, lambdaFunction);
        this.grantEventPublishingPermissions(lambdaFunction);

        // Recursos custom adicionales
        const idResource = lambdaRestApi.root.getResource('{id}')
            ?? lambdaRestApi.root.addResource('{id}');
        const transitionResource = idResource.addResource('transition');
        transitionResource.addMethod('POST', undefined, methodOptions);
    }
}
```

### src/handler.mjs

```javascript
import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;
    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
```

### src/controller.mjs

```javascript
import { BaseController, HttpResponse } from '@kace/api-common';
import { schemaCreate, schemaUpdate } from './schemas.mjs';
import {
    EntityCreator,
    EntityFinder,
    EntityUpdater,
    EntityDeleter,
    KnexEntityRepository,
} from '@kace/core/src/[modulo]';

export class Controller extends BaseController {
    async actionCreate() {
        const data = this.getBody();
        await this.validate(data, schemaCreate);
        const repository = new KnexEntityRepository(this.knex);
        const creator = new EntityCreator(repository);
        const result = await creator.run(data);
        return HttpResponse.created(result);
    }

    async actionIndex() {
        const repository = new KnexEntityRepository(this.knex);
        const finder = new EntityFinder(repository);
        const result = await finder.run(this.getQueryParams());
        return HttpResponse.ok(result);
    }

    // ... actionRead, actionUpdate, actionDelete
}
```

### Metodos de KApiStack disponibles

| Metodo | Descripcion |
|--------|-------------|
| `this.setDefaultOptions(id)` | Configura todo en una linea (Lambda + API GW + CRUD + Auth + WAF + DynamoDB) |
| `this.getNodejsFunction(id)` | Crea Lambda con `NodejsFunction` (esbuild + Docker bundling) |
| `this.getLambdaRestApi(id, fn)` | Crea API Gateway con CORS |
| `this.getLambdaRestApiMethodOptions()` | Retorna opciones con Cognito auth |
| `this.setDefaultResources(api, opts)` | Agrega rutas CRUD estandar |
| `this.setBasePath(id, api)` | Configura base path mapping en staging/prod |
| `this.setWafAssociation(api)` | Asocia WAF en staging/prod |
| `this.grantDynamoDbPermissions(id, fn)` | Permisos de lectura a tabla multitenant |
| `this.grantEventPublishingPermissions(fn)` | Permisos para SQS + EventBridge |
| `this.isStagingOrProduction()` | Verifica si es staging o production |
| `this.nodejsFunctionDefaultProps()` | Props default de Lambda (override para customizar) |

### Override de nodejsFunctionDefaultProps

Para customizar timeout, memoria, o nodeModules del bundling:

```typescript
nodejsFunctionDefaultProps(): NodejsFunctionProps {
    const props = super.nodejsFunctionDefaultProps();
    return {
        ...props,
        timeout: Duration.seconds(60),
        memorySize: 512,
    };
}
```

---

## Patron Event-Driven (SQS/EventBridge)

Para servicios que procesan eventos asincrono (no API Gateway). Ejemplo: `kace_cloud_api_event_processor`.

### Diferencias con el patron estandar

- No usa `getLambdaRestApi` ni `setDefaultResources`
- El trigger es SQS/EventBridge, no API Gateway
- El handler recibe records de SQS, no eventos HTTP
- Puede requerir `grantDynamoDbPermissions` y `grantEventPublishingPermissions`

### lib/[nombre]-stack.ts

```typescript
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { Duration, StackProps, CfnOutput } from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export class EventProcessorStack extends KApiStack {
    static readonly ENDPOINT = 'event-processor';
    static readonly LAMBDA_TIMEOUT_SECONDS = 600;
    static readonly LAMBDA_MEMORY_SIZE = 512;

    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        // SQS Queue
        const eventsQueue = new sqs.Queue(this, 'EventsQueue', {
            queueName: `${this.config.appsServiceName}-events-queue.fifo`,
            fifo: true,
            // ...
        });

        // Lambda con trigger SQS
        const lambdaFunction = this.getNodejsFunction(EventProcessorStack.ENDPOINT);
        this.grantDynamoDbPermissions(EventProcessorStack.ENDPOINT, lambdaFunction);
        eventsQueue.grantConsumeMessages(lambdaFunction);

        lambdaFunction.addEventSource(
            new lambdaEventSources.SqsEventSource(eventsQueue, {
                batchSize: 5,
                reportBatchItemFailures: true,
            })
        );
    }

    nodejsFunctionDefaultProps() {
        const baseProps = super.nodejsFunctionDefaultProps();
        return {
            ...baseProps,
            timeout: Duration.seconds(EventProcessorStack.LAMBDA_TIMEOUT_SECONDS),
            memorySize: EventProcessorStack.LAMBDA_MEMORY_SIZE,
        };
    }
}
```

---

## Patron Standalone (Sin Tenant)

Para servicios con necesidades especiales: endpoint publico, DynamoDB propio, sin Cognito. Ejemplo: `kace_cloud_api_metrics` (Web Vitals).

### Diferencias con el patron estandar

- Extiende `KApiStack` pero **no** usa `setDefaultOptions`
- Crea su propia API Gateway **sin auth** (Cognito)
- Crea su propia tabla DynamoDB (no la multitenant)
- Override `grantDynamoDbPermissions` vacio (no necesita la tabla multitenant)
- Override `nodejsFunctionDefaultProps` con nodeModules propios (ej: solo `joi`, no `pg`/`knex`)
- El handler **no** usa `withTenantContext`

### lib/[nombre]-stack.ts

```typescript
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';
import { Duration, RemovalPolicy, StackProps, CfnOutput } from 'aws-cdk-lib';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

export class MetricsStack extends KApiStack {
    static readonly ENDPOINT = 'metrics';
    static readonly LAMBDA_TIMEOUT_SECONDS = 10;
    static readonly LAMBDA_MEMORY_SIZE = 256;

    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        // DynamoDB Table propia (no multitenant)
        const table = new dynamodb.Table(this, 'WebVitalsTable', {
            tableName: `${process.env.APPS_SERVICE_NAME}_kace_web_vitals`,
            partitionKey: { name: 'date', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            timeToLiveAttribute: 'ttl',
            removalPolicy: this.isStagingOrProduction()
                ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
        });

        // Lambda
        const lambdaFunction = this.getNodejsFunction(MetricsStack.ENDPOINT);
        table.grantWriteData(lambdaFunction);
        lambdaFunction.addEnvironment('WEB_VITALS_TABLE_NAME', table.tableName);

        // API Gateway publica (sin Cognito)
        const api = new apigateway.RestApi(this, 'MetricsApi', {
            restApiName: `${this.config.appsEnvironment}-kace-metrics`,
            deployOptions: {
                stageName: this.config.appsEnvironment,
                throttlingRateLimit: 100,
                throttlingBurstLimit: 200,
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: ['POST', 'OPTIONS'],
                allowHeaders: ['Content-Type'],
            },
        });

        const metricsResource = api.root.addResource('metrics');
        metricsResource.addMethod('POST',
            new apigateway.LambdaIntegration(lambdaFunction, { proxy: true })
        );

        // Outputs
        new CfnOutput(this, 'MetricsEndpoint', {
            value: `${api.url}metrics`,
            exportName: `${this.config.appsServiceName}-MetricsEndpoint`,
        });
    }

    // No necesita permisos a la tabla multitenant
    public grantDynamoDbPermissions(_id: string, _lambdaFunction: NodejsFunction) {}

    public nodejsFunctionDefaultProps(): NodejsFunctionProps {
        let props = {};
        if (this.isStagingOrProduction() && this.vpc && this.lambdaSG) {
            props = {
                vpc: this.vpc,
                vpcSubnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS },
                securityGroups: [this.lambdaSG],
            };
        }
        return {
            bundling: {
                nodeModules: ['joi'],  // Solo lo que necesite (no pg, knex, etc.)
                forceDockerBundling: true,
            },
            timeout: Duration.seconds(MetricsStack.LAMBDA_TIMEOUT_SECONDS),
            environment: {
                NODE_ENV: this.config.environment,
                API_VERSION: KApiStack.getApiVersion(),
                STAGE: this.config.appsEnvironment,
            },
            runtime: Runtime.NODEJS_22_X,
            memorySize: MetricsStack.LAMBDA_MEMORY_SIZE,
            ...props,
        };
    }
}
```

### src/handler.mjs (sin withTenantContext)

```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { MetricsService } from './services/MetricsService.mjs';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const service = new MetricsService(docClient, process.env.WEB_VITALS_TABLE_NAME);

export const handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    };

    try {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        // ... validacion y logica
        const result = await service.batchWrite(body.metrics);
        return { statusCode: 202, headers, body: JSON.stringify({ accepted: result }) };
    } catch (error) {
        console.error('Handler error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
    }
};
```

---

## Catalogo de Servicios

### Servicios Core (~95 total)

#### Gestion de Casos

| Servicio | Endpoint | Tipo |
|----------|----------|------|
| `kace_cloud_api_cases` | `/cases` | Estandar |
| `kace_cloud_api_case_attachments` | `/case-attachments` | Estandar |
| `kace_cloud_api_case_available_states` | `/case-available-states` | Estandar |
| `kace_cloud_api_case_calculate_ans` | `/case-calculate-ans` | Estandar |
| `kace_cloud_api_case_clone` | `/case-clone` | Estandar |
| `kace_cloud_api_case_close` | `/case-close` | Estandar |
| `kace_cloud_api_case_count` | `/case-count` | Estandar |
| `kace_cloud_api_case_count_by_group` | `/case-count-by-group` | Estandar |
| `kace_cloud_api_case_count_by_responsable` | `/case-count-by-responsable` | Estandar |
| `kace_cloud_api_case_descriptions` | `/case-descriptions` | Estandar |
| `kace_cloud_api_case_reclassify` | `/case-reclassify` | Estandar |
| `kace_cloud_api_case_re_open` | `/case-re-open` | Estandar |
| `kace_cloud_api_case_transitions` | `/case-transitions` | Estandar |

#### Gestion de Usuarios

| Servicio | Endpoint | Tipo |
|----------|----------|------|
| `kace_cloud_api_users` | `/users` | Estandar |
| `kace_cloud_api_user_notifications` | `/user-notifications` | Estandar |
| `kace_cloud_api_user_cases_assignment` | `/user-cases-assignment` | Estandar |
| `kace_cloud_api_user_group_relations` | `/user-group-relations` | Estandar |

#### Gestion de Clientes

| Servicio | Endpoint | Tipo |
|----------|----------|------|
| `kace_cloud_api_clients` | `/clients` | Estandar |
| `kace_cloud_api_client_contacts` | `/client-contacts` | Estandar |
| `kace_cloud_api_client_notifications` | `/client-notifications` | Estandar |
| `kace_cloud_api_clients_doc_types` | `/clients-doc-types` | Estandar |

#### Configuracion y Administracion

| Servicio | Endpoint | Tipo |
|----------|----------|------|
| `kace_cloud_api_group` | `/groups` | Estandar |
| `kace_cloud_api_roles` | `/roles` | Estandar |
| `kace_cloud_api_states` | `/states` | Estandar |
| `kace_cloud_api_transitions` | `/transitions` | Estandar |
| `kace_cloud_api_classifications` | `/classifications` | Estandar |
| `kace_cloud_api_permissions` | `/permissions` | Estandar |
| `kace_cloud_api_global_configurations` | `/global-configurations` | Estandar |
| `kace_cloud_api_shift_management` | `/shift-management` | Estandar |
| `kace_cloud_api_tenant` | `/tenant` | Estandar (DynamoDB) |

#### Workflows y Automatizacion

| Servicio | Endpoint | Tipo |
|----------|----------|------|
| `kace_cloud_api_actions` | `/actions` | Estandar |
| `kace_cloud_api_action_batch_executions` | `/action-batch-executions` | Estandar |
| `kace_cloud_api_actions_queue_executions` | `/actions-queue-executions` | Estandar |
| `kace_cloud_api_flow` | `/flows` | Estandar |

#### Integracion

| Servicio | Endpoint | Tipo |
|----------|----------|------|
| `kace_cloud_api_broker` | `/broker` | Estandar |
| `kace_cloud_api_broker_mapper` | `/broker-mapper` | Estandar |
| `kace_cloud_api_allowed_connections` | `/allowed-connections` | Estandar |
| `kace_cloud_api_mail_accounts` | `/mail-accounts` | Estandar |

#### Eventos y Observabilidad

| Servicio | Endpoint | Tipo |
|----------|----------|------|
| `kace_cloud_api_event_processor` | - (SQS/EventBridge trigger) | Event-Driven |
| `kace_cloud_api_event_logs` | `/event-logs` | Estandar |
| `kace_cloud_api_metrics` | `/metrics` (publico) | Standalone |

#### Utilidades

| Servicio | Endpoint | Tipo |
|----------|----------|------|
| `kace_cloud_api_s3_files` | `/s3-files` | Estandar |
| `kace_cloud_api_upload_s3_files` | `/upload-s3-files` | Estandar |
| `kace_cloud_api_download_s3_files` | `/download-s3-files` | Estandar |
| `kace_cloud_api_exports` | `/exports` | Estandar |
| `kace_cloud_api_imports` | `/imports` | Estandar |
| `kace_cloud_api_imports_processor` | - (scheduled) | Event-Driven |
| `kace_cloud_api_generate_csv` | `/generate-csv` | Estandar |
| `kace_cloud_api_geolocation` | `/geolocation` | Estandar |

---

## Patrones Comunes

### Rutas REST Estandar

`setDefaultResources` configura estas rutas automaticamente:

| Metodo | Ruta | Handler | Descripcion |
|--------|------|---------|-------------|
| GET | `/` | `actionIndex()` | Listar con paginacion |
| POST | `/` | `actionCreate()` | Crear nuevo |
| GET | `/{id}` | `actionRead()` | Obtener por ID |
| POST | `/{id}` | `actionUpdate()` | Actualizar |
| GET | `/{id}/delete` | `actionDelete()` | Eliminar |
| POST | `/search` | `actionSearch()` | Busqueda |
| POST | `/{id}/history` | `actionHistory()` | Historial |
| POST | `/advance-search` | `actionAdvanceSearch()` | Busqueda avanzada |

### Request/Response

```json
// POST /cases (Request)
{
    "title": "Nuevo caso",
    "priorityId": 1,
    "classificationId": 5
}

// Headers requeridos
{
    "Authorization": "Bearer <cognito-jwt>",
    "Content-Type": "application/json",
    "X-Tenant-Id": "<tenant-id>"
}
```

### Codigos de Estado

| Codigo | Uso |
|--------|-----|
| 200 | OK |
| 201 | Recurso creado |
| 202 | Aceptado (procesamiento asincrono) |
| 204 | Sin contenido (eliminacion) |
| 400 | Error de validacion |
| 401 | Token invalido |
| 403 | Sin permisos |
| 404 | No encontrado |
| 500 | Error del servidor |

### Validacion con Joi

```javascript
// src/schemas.mjs
import Joi from 'joi';

export const schemaCreate = Joi.object({
    title: Joi.string().required().max(200),
    description: Joi.string().max(5000),
    priorityId: Joi.number().integer().positive().required(),
});

export const schemaUpdate = Joi.object({
    title: Joi.string().max(200),
    description: Joi.string().max(5000),
});
```

### Imports: Siempre directos, nunca barrel files

```javascript
// CORRECTO - import directo
import { CaseCreator } from '@kace/core/src/cases';
import { KnexCaseRepository } from '@kace/core/src/cases';

// INCORRECTO - barrel file / index
import { CaseCreator } from '@kace/core';
```

### Tests (ESM con Jest)

```javascript
// test/[nombre].test.mjs
import { jest } from '@jest/globals';

// Mock ESM modules
jest.unstable_mockModule('../src/services/MyService.mjs', () => ({
    MyService: jest.fn().mockImplementation(() => ({
        run: jest.fn().mockResolvedValue({}),
    })),
}));

// Dynamic import DESPUES del mock
const { handler } = await import('../src/handler.mjs');

describe('Handler', () => {
    it('should return 200', async () => {
        // Arrange
        const event = { body: JSON.stringify({ /* ... */ }) };

        // Act
        const response = await handler(event);

        // Assert
        expect(response.statusCode).toBe(200);
    });
});
```

---

## Desarrollo Local

### Requisitos

```bash
node --version   # >= 22.x
pnpm --version   # >= 10.x
docker --version # Para SAM Local y CDK bundling
```

### Ejecutar tests

```bash
cd apps/apiv1/kace_cloud_api_[nombre]
pnpm install
pnpm test
```

### Ejecutar con SAM Local (solo servicios estandar)

```bash
pnpm run cdk:synth
pnpm run api
# Disponible en http://localhost:600XX
```

---

## Despliegue

### Individual

```bash
cd apps/apiv1/kace_cloud_api_[nombre]
pnpm run cdk:deploy
```

### Masivo (todos los servicios)

```bash
# Desde la raiz del monorepo
pnpm deploy
# Ejecuta con 15 workers concurrentes
```

---

## Monitoreo

### CloudWatch Logs

```bash
aws logs tail /aws/lambda/kace_cloud_api_[nombre] --follow
```

### Metricas Lambda

| Metrica | Umbral recomendado |
|---------|--------------------|
| Errors | > 5 en 5 min |
| Duration | > 10s (p95) |
| Throttles | > 0 |
| ConcurrentExecutions | > 80% del limite |

---

## Checklist de Creacion

Al crear un nuevo microservicio, verificar:

- [ ] Directorio: `apps/apiv1/kace_cloud_api_[nombre]/`
- [ ] `package.json` con dependencias workspace (`@kace/api-common`, `@kace/aws-infra`, `@kace/core`)
- [ ] `cdk.json` con context completo (copiar de tenant)
- [ ] `tsconfig.json` identico al template
- [ ] `bin/[nombre].ts` usa `KApiStack.KProps()`
- [ ] `lib/[nombre]-stack.ts` extiende `KApiStack`
- [ ] `src/handler.mjs` usa `withTenantContext` (si aplica)
- [ ] `src/schemas.mjs` con validacion Joi
- [ ] Tests en `test/` con patron ESM (`import { jest } from '@jest/globals'`)
- [ ] Scripts de npm identicos al template
- [ ] `pnpm install` exitoso
- [ ] `pnpm test` pasa
- [ ] `pnpm run cdk:synth` genera template valido
