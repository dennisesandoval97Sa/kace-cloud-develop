# Guía de Despliegue

Esta guía detalla los procesos de despliegue para los diferentes componentes de KACE Cloud.

## Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración de AWS](#configuración-de-aws)
3. [Variables de Entorno](#variables-de-entorno)
4. [Despliegue de Infraestructura Base](#despliegue-de-infraestructura-base)
5. [Despliegue de Base de Datos](#despliegue-de-base-de-datos)
6. [Despliegue de Microservicios](#despliegue-de-microservicios)
7. [Despliegue de Frontend](#despliegue-de-frontend)
8. [CI/CD con Bitbucket Pipelines](#cicd-con-bitbucket-pipelines)
9. [Rollback](#rollback)
10. [Troubleshooting](#troubleshooting)

## Requisitos Previos

### Software Requerido

```bash
# Verificar versiones
node --version      # >= 22.16.0
pnpm --version      # >= 10.11.0
aws --version       # >= 2.x
cdk --version       # >= 2.185.0
docker --version    # Para SAM Local
sam --version       # Para testing local
```

### Instalación de AWS CDK

```bash
npm install -g aws-cdk
cdk --version
```

### Instalación de SAM CLI

```bash
# macOS
brew install aws-sam-cli

# Linux
pip install aws-sam-cli

# Verificar
sam --version
```

## Configuración de AWS

### Credenciales

```bash
# Configurar credenciales
aws configure

# O usar variables de entorno
export AWS_ACCESS_KEY_ID=<tu-access-key>
export AWS_SECRET_ACCESS_KEY=<tu-secret-key>
export AWS_DEFAULT_REGION=us-east-1
```

### Verificar Acceso

```bash
aws sts get-caller-identity
```

### Bootstrap de CDK

```bash
# Primera vez en la cuenta/región
cdk bootstrap aws://<ACCOUNT-ID>/<REGION>
```

## Variables de Entorno

### Archivo .env

Crear archivo `.env` en la raíz del proyecto basado en `.env.example`:

```bash
# AWS Configuration
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# API Gateway
AWS_APIGATEWAY_DOMAIN_NAME=api.tudominio.com
AWS_APIGATEWAY_DOMAIN_NAME_ALIAS_TARGET=xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
AWS_APIGATEWAY_DOMAIN_NAME_ALIAS_HOSTED_ZONE_ID=ZXXXXXXXXXXXXX

# Cognito
AWS_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
AWS_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_COGNITO_DOMAIN=auth.tudominio.com

# Database
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=kace_cloud
DB_USER=kace_admin
DB_PASSWORD=your-secure-password
DB_SCHEMA=public

# S3
S3_BUCKET_NAME=kace-cloud-files
S3_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
S3_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
S3_REGION=us-east-1

# RabbitMQ
RABBITMQ_HOST=your-rabbitmq-host
RABBITMQ_PORT=5672
RABBITMQ_USER=admin
RABBITMQ_PASSWORD=your-password

# WAF
AWS_WAF_ARN=arn:aws:wafv2:us-east-1:123456789012:regional/webacl/your-waf/xxxxx

# Security
ENCRYPTION_KEY=your-32-char-encryption-key
ENCRYPTION_IV=your-16-char-iv

# CORS
CORS_ALLOWED_ORIGINS=https://app.tudominio.com,http://localhost:5173
```

### Symlink para Frontend

```bash
# Crear enlace simbólico para el frontend
cd apps/kace-saas
ln -s ../../.env .env
```

## Despliegue de Infraestructura Base

### 1. Infraestructura AWS

```bash
cd packages/kace_cloud_aws_infra

# Instalar dependencias
pnpm install

# Sintetizar template CloudFormation
pnpm run cdk:synth

# Ver cambios antes de desplegar
cdk diff

# Desplegar
pnpm run cdk:deploy
```

### Outputs Esperados

```bash
Outputs:
KaceAwsInfraStack.OutputAPIDomainName = api.tudominio.com
KaceAwsInfraStack.OutputDomainNameAliasHostedZoneId = ZXXXXXXXXXXXXX
KaceAwsInfraStack.OutputDomainNameAliasTarget = xxxx.execute-api.us-east-1.amazonaws.com
```

### 2. Actualizar .env

Actualizar las variables `AWS_APIGATEWAY_*` con los outputs obtenidos.

## Despliegue de Base de Datos

### Crear Base de Datos RDS

```bash
# Opción 1: Via AWS Console
# Crear instancia RDS PostgreSQL 14+

# Opción 2: Via CLI
aws rds create-db-instance \
    --db-instance-identifier kace-cloud-db \
    --db-instance-class db.t3.medium \
    --engine postgres \
    --engine-version 14.9 \
    --master-username kace_admin \
    --master-user-password <password> \
    --allocated-storage 20 \
    --vpc-security-group-ids sg-xxxxxxxx
```

### Ejecutar Migraciones

```bash
cd packages/kace_cloud_database

# Instalar dependencias
pnpm install

# Ejecutar todas las migraciones
pnpm run migrate

# Solo migraciones pendientes
pnpm run migrate:latest

# Verificar estado
pnpm run migrate:status
```

### Seeds (Datos Iniciales)

```bash
# Ejecutar seeds
pnpm run seed
```

## Despliegue de Microservicios

### Despliegue Completo

```bash
# Desde la raíz del proyecto
pnpm deploy

# Esto ejecuta:
# pnpm install && pnpm -r run --workspace-concurrency=15 cdk:deploy
```

### Despliegue Individual

```bash
cd apps/apiv1/kace_cloud_api_cases

# Sintetizar
pnpm run cdk:synth

# Ver cambios
cdk diff

# Desplegar
pnpm run cdk:deploy
```

### Despliegue por Grupo

```bash
# Solo servicios de casos
cd apps/apiv1
for dir in kace_cloud_api_case*; do
    echo "Deploying $dir..."
    cd $dir && pnpm run cdk:deploy && cd ..
done
```

### Verificar Despliegue

```bash
# Listar funciones Lambda
aws lambda list-functions --query 'Functions[?starts_with(FunctionName, `kace`)].[FunctionName]' --output table

# Verificar API Gateway
aws apigateway get-rest-apis --query 'items[?name==`kace-cloud-api`]'
```

## Despliegue de Frontend

### Build de Producción

```bash
cd apps/kace-saas

# Instalar dependencias
pnpm install

# Build
pnpm run build

# El output está en dist/
```

### Despliegue a S3 + CloudFront

```bash
# Subir a S3
aws s3 sync dist/ s3://kace-cloud-frontend/ --delete

# Invalidar cache de CloudFront
aws cloudfront create-invalidation \
    --distribution-id EXXXXXXXXXX \
    --paths "/*"
```

### Despliegue con CDK (si está configurado)

```bash
cd apps/kace-saas
pnpm run cdk:deploy
```

## CI/CD con Bitbucket Pipelines

### Pipeline de Desarrollo

El archivo `bitbucket-pipelines.yml` en cada paquete define el pipeline.

```yaml
image: node:22

pipelines:
  branches:
    develop:
      - step:
          name: Test and Lint
          caches:
            - node
          script:
            - npm ci
            - npm run eslint-check
            - npm test
      - step:
          name: Deploy to Development
          deployment: development
          script:
            - npm ci
            - npm run cdk:deploy
```

### Pipeline de Producción

```yaml
pipelines:
  branches:
    master:
      - step:
          name: Test
          script:
            - npm ci
            - npm test
      - step:
          name: Deploy to Production
          deployment: production
          trigger: manual
          script:
            - npm ci
            - npm run cdk:deploy
```

### Variables en Bitbucket

Configurar en Repository Settings > Pipelines > Repository Variables:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION
DB_HOST
DB_PASSWORD
... (todas las variables de .env)
```

## Rollback

### Rollback de Lambda

```bash
# Listar versiones
aws lambda list-versions-by-function --function-name kace_cloud_api_cases

# Rollback a versión anterior
aws lambda update-alias \
    --function-name kace_cloud_api_cases \
    --name live \
    --function-version 5
```

### Rollback de Base de Datos

```bash
cd packages/kace_cloud_database

# Ver migraciones aplicadas
pnpm run migrate:status

# Rollback última migración
pnpm run migrate:rollback

# Rollback múltiples
pnpm run migrate:rollback --all
```

### Rollback de CloudFormation

```bash
# Cancelar actualización en progreso
aws cloudformation cancel-update-stack --stack-name KaceCloudApiCases

# Rollback a versión anterior
aws cloudformation rollback-stack --stack-name KaceCloudApiCases
```

## Troubleshooting

### Lambda no se ejecuta

```bash
# Verificar logs
aws logs tail /aws/lambda/kace_cloud_api_cases --follow

# Verificar configuración
aws lambda get-function-configuration --function-name kace_cloud_api_cases

# Verificar permisos
aws lambda get-policy --function-name kace_cloud_api_cases
```

### Error de conexión a DB

```bash
# Verificar conectividad
nc -zv <DB_HOST> 5432

# Verificar security groups
aws ec2 describe-security-groups --group-ids sg-xxxxxxxx

# Verificar desde Lambda
# Asegurarse de que Lambda esté en la misma VPC que RDS
```

### Error de API Gateway

```bash
# Ver logs de API Gateway
aws logs tail /aws/apigateway/kace-cloud-api --follow

# Verificar integración
aws apigateway get-integration \
    --rest-api-id xxxxxxxxxx \
    --resource-id yyyyyy \
    --http-method POST
```

### Error de Cognito

```bash
# Verificar User Pool
aws cognito-idp describe-user-pool --user-pool-id us-east-1_XXXXXXXXX

# Verificar App Client
aws cognito-idp describe-user-pool-client \
    --user-pool-id us-east-1_XXXXXXXXX \
    --client-id xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Cold Start Lento

```javascript
// Habilitar Provisioned Concurrency en el stack CDK
const lambdaFunction = new NodejsFunction(this, 'Function', {
    // ...
    currentVersionOptions: {
        provisionedConcurrentExecutions: 2,
    },
});
```

### Memoria Insuficiente

```typescript
// Aumentar memoria en el stack CDK
const lambdaFunction = new NodejsFunction(this, 'Function', {
    memorySize: 512, // MB
    timeout: Duration.seconds(30),
});
```

## Checklist de Despliegue

### Pre-Despliegue

- [ ] Tests pasando localmente
- [ ] Linting sin errores
- [ ] Variables de entorno configuradas
- [ ] Credenciales AWS válidas
- [ ] Migraciones de BD revisadas

### Post-Despliegue

- [ ] Verificar endpoints respondiendo
- [ ] Revisar logs de CloudWatch
- [ ] Probar flujos críticos manualmente
- [ ] Verificar métricas de performance
- [ ] Notificar al equipo

## Contacto

Para soporte en despliegues:
- **Roberto Garcia**: roberto.garcia@konecta-group.com
- **Jordi Natividad**: jnatividad@konecta.com

## Debug Logging

Debug log emission (`Helper.logDebug`, `Helper.logDebug2`, `Helper.logTime`, `Helper.logTimeEnd`) is controlled by Lambda environment variables, with tenant config as fallback.

### Resolution chain (higher priority wins)

1. `APPS_DEBUG` — primary deploy-time toggle.
2. `APPS_DEBUG_OVERRIDE` — deprecated alias, kept for backwards compatibility with the `actions-queue-executions` worker (`apps/workers/kace_cloud_worker_actions_queue_executions/src/DebugOverride.mjs`).
3. `tenant.apps_debug` / `tenant.apps_debug_level` — per-tenant DynamoDB attributes (historical default).

For `APPS_DEBUG_LEVEL`, the chain is 2 levels:

1. `APPS_DEBUG_LEVEL` — primary deploy-time level.
2. `tenant.apps_debug_level` — historical per-tenant attribute.

### Accepted values

| Variable | Values | Effect |
|---|---|---|
| `APPS_DEBUG` | `'true'`, `'1'` | Enable debug logs |
| `APPS_DEBUG` | `'false'`, `'0'` | Disable debug logs |
| `APPS_DEBUG` | unset / empty / other | Fall through to next level |
| `APPS_DEBUG_LEVEL` | `'1'` | Standard debug (`logDebug` only) |
| `APPS_DEBUG_LEVEL` | `'2'` | Verbose (`logDebug` + `logDebug2`) |
| `APPS_DEBUG_LEVEL` | unset / empty / other | Fall through to tenant level |

### Configuring per environment

Set `APPS_DEBUG` and `APPS_DEBUG_LEVEL` in the CI/CD job before `pnpm deploy`. The values are read by the CDK process (`process.env`) and baked into every apiv1 Lambda's `Environment.Variables`.

Recommended defaults:

| Environment | `APPS_DEBUG` | `APPS_DEBUG_LEVEL` |
|---|---|---|
| local | per developer `.env` | per developer `.env` |
| dev | `true` | `1` |
| staging | unset | unset |
| production | `false` | unset |

### Changing the value

Env vars are deploy-time. To toggle debug, set the variable in CI and redeploy the service(s).

For incident response without redeploying code, you can edit the env var directly in the AWS Lambda console — it takes effect on the next cold start.

### CDK note: empty-string fallback

`KApiStack.ts` populates `appsDebug` and `appsDebugLevel` from `process.env` using the `?? ''` fallback (not `as string`). Reason: AWS CDK rejects `undefined` values in a Lambda's `environment` object at synth time. Empty string is a valid AWS env var value and `Helper.js` treats it as "no opinion" — resolution falls through to the next level. When adding new optional env vars to `KApiStack`, follow the same pattern.

The non-local environment block in `nodejsFunctionDefaultProps()` is intentionally minimal — when adding new env vars, ensure they are injected in BOTH the local (`...this.nodejsFunctionAppEnvVar()` spread) and the non-local (explicit per-var lines) branches so deployed Lambdas receive them.