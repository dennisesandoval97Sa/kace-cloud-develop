# BREAKING CHANGES - Multi-Tenant Architecture Migration

**Branch**: `feature/multi-tenant`
**Base**: `develop`
**Date**: 2025-12-22
**Impact**: 🔴 **HIGH** - Affects all Lambda handlers and infrastructure

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Critical Breaking Changes](#critical-breaking-changes)
3. [Migration Guide for Handlers](#migration-guide-for-handlers)
4. [Adding New Tenant Attributes](#adding-new-tenant-attributes)
5. [EventBridge/Scheduled Events Changes](#eventbridgescheduled-events-changes)
6. [Infrastructure Changes (CDK)](#infrastructure-changes-cdk)
7. [API Gateway Changes](#api-gateway-changes)
8. [Multi-Tenant Logging](#multi-tenant-logging)
9. [Testing Changes](#testing-changes)
10. [Rollout Strategy](#rollout-strategy)

---

## Overview

This branch (`feature/multi-tenant`) introduces **multi-tenant architecture** to KACE Cloud, moving from static `process.env` configuration to **dynamic tenant configuration** loaded from DynamoDB (`kace_multi_tenancy` table).

### What's Included in This Branch

This branch includes **one major feature sets**:

#### 1️⃣ Multi-Tenant Architecture (Primary Focus)
- ✅ **95 Lambda handlers migrated** to use tenant context
- ✅ **New middleware system** for tenant configuration injection
- ✅ **EventBridge Orchestrator** for multi-tenant scheduled events
- ✅ **DynamoDB-backend tenant repository** with LRU caching
- ⚠️ **process.env NO longer used for tenant-specific config**

---

## Critical Breaking Changes

### 🔴 1. `process.env` Configuration Removal

**BEFORE (deprecated):**
```javascript
const dbHost = process.env.DB_HOST;
const dbPassword = process.env.DB_PASSWORD;
const s3Bucket = process.env.AWS_S3_BUCKET;
```

**AFTER (required):**
```javascript
const baseHandler = async (event) => {
    const {tenant, knexConfig} = event.tenantContext;

    // Access tenant configuration through tenant object
    const dbHost = tenant.db_host.value;
    const s3Bucket = tenant.aws_s3_bucket.value;
};
```

**Why?**
- Prevents race conditions in Lambda with concurrency > 1
- Enables true multi-tenancy with isolated configurations
- Allows dynamic tenant configuration updates without redeployment

---

### 🔴 2. Handler Pattern Change

**BEFORE:**
```javascript
import { production as knexConfig } from '@kace/database/knexfile';
import { Controller } from './controller.mjs';

export const handler = async (event) => {
    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};
```

**AFTER:**
```javascript
import {withTenantContext} from '@kace/api-common';
import { Controller } from './controller.mjs';

const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
```

**Required for ALL handlers in:**
- `apps/apiv1/kace_cloud_api_*/src/handler.mjs` (95 microservices)

---

### 🔴 3. Tenant Header Requirement

**API requests MUST include:**

```http
X-Tenant-Id: your-tenant-id
```

**Priority of tenant extraction:**
1. Header `X-Tenant-Id` (recommended - production)
2. Path parameter `{tenantId}` (RESTful alternative)
3. Header `X-Tenant-Subdomain` (legacy fallback)
4. EventBridge `event.detail.tenant_id` (scheduled events)

**Missing header returns:**
```json
{
    "error": true,
    "message": "Tenant ID not found in request. Send X-Tenant-ID header, tenantId path parameter, or tenant_id in event.detail.",
    "type": "TenantMiddlewareError"
}
```

---

### 🔴 4. Scheduled Events (EventBridge) Architecture

**BEFORE:**
```typescript
// Scheduled rule invoked handler directly
const scheduleRule = new Rule(this, 'ScheduleRule', {
    schedule: Schedule.expression('cron(0 * * * ? *)'),
});
scheduleRule.addTarget(new LambdaFunction(lambdaFunction));
```

**AFTER:**
```typescript
// Scheduled rule invokes ORCHESTRATOR, which invokes handler per tenant
const orchestratorFunction = new NodejsFunction(this, 'OrchestratorFunction', {
    entry: path.join(__dirname, '../../kace_cloud_api_eventbridge_orchestrator/src/handler.mjs'),
    environment: {
        TARGET_LAMBDA_ARN: lambdaFunction.functionArn,
    },
});

const scheduleRule = new Rule(this, 'ScheduleRule', {
    schedule: Schedule.expression('cron(0 * * * ? *)'),
});
scheduleRule.addTarget(new LambdaFunction(orchestratorFunction));
```

**Impact:**
- Scheduled events now execute for ALL tenants automatically
- Each tenant receives isolated invocation with their configuration
- No code changes needed in handler (orchestrator injects `tenant_id`)

---

## Migration Guide for Handlers

### Step 1: Update Imports

```diff
- import { production as knexConfig } from '@kace/database/knexfile';
+ import {withTenantContext} from '@kace/api-common';
```

### Step 2: Wrap Handler

```diff
- export const handler = async (event) => {
+ const baseHandler = async (event) => {
+     const {knexConfig} = event.tenantContext;
+
      const controller = new Controller(event, knexConfig);
-     const response = await controller.run();
-     return response.toJson();
- };
+     const response = await controller.run();
+     return response.toJson();
+ };
+
+ export const handler = withTenantContext(baseHandler);
```

### Step 3: Access Tenant Configuration

```javascript
const baseHandler = async (event) => {
    const {tenant, knexConfig} = event.tenantContext;

    // Database config (already in knexConfig, but accessible via tenant)
    const dbHost = tenant.db_host.value;
    const dbSchema = tenant.db_schema.value;

    // AWS S3 config
    const s3Bucket = tenant.aws_s3_bucket.value;
    const s3Region = tenant.aws_s3_region.value;

    // Application config
    const timezone = tenant.timezone.value;
    const domain = tenant.apps_domain.value;

    // Security config
    const secretKey = tenant.secret_key.value;

    // AWS Cognito (optional - can be null)
    const cognitoPoolId = tenant.aws_cognito_user_pool_id?.value;
};
```

### Step 4: Handle EventBridge Events

```javascript
const baseHandler = async (event) => {
    const {knexConfig} = event.tenantContext;

    let controller;

    // Check if event is from EventBridge
    if (event?.source && event.source === 'aws.events') {
        controller = new EventController(event, knexConfig);
    } else {
        controller = new Controller(event, knexConfig);
    }

    const response = await controller.run();
    return response.toJson();
};
```

---

## Adding New Tenant Attributes

### ⚠️ CRITICAL RULES

1. **NEVER use `process.env` for tenant-specific configuration**
2. **ALWAYS add new attributes to the `Tenant` domain entity**
3. **Update DynamoDB table schema** for new attributes
4. **Follow the Value Object pattern** for validation

---

### Step-by-Step Guide

#### 1. Add Property to Tenant Entity

**File**: `packages/kace_cloud_core/src/tenant/domain/Tenant.js`

```javascript
export default class Tenant extends AggregateRoot {
    // Existing properties...

    /** @type {ValueObjectString} */
    #new_config_value; // Add private field

    constructor(dto) {
        super(dto.id);
        // Existing initialization...

        // Add initialization with proper Value Object
        this.#new_config_value = new ValueObjectString(
            'new_config_value',     // Field name
            dto.new_config_value,   // Value from DTO
            false                   // Required (false) or Optional (true)
        );
    }

    // Add getter
    get new_config_value() {
        return this.#new_config_value;
    }

    // Add setter (if mutable)
    set new_config_value(value) {
        value = new ValueObjectString('new_config_value', value, false);
        this.#new_config_value = value;
        this.changedAttributes.new_config_value = this.#new_config_value.value;
    }
}
```

#### 2. Choose Appropriate Value Object Type

```javascript
// For strings
new ValueObjectString('field_name', dto.field_name, isOptional);

// For integers
new ValueObjectInt('field_name', dto.field_name, isOptional);

// For booleans (stored as 0/1 in DynamoDB)
new ValueObjectInt('field_name', dto.field_name, isOptional);

// For generic values (no validation)
new ValueObject('field_name', dto.field_name, isOptional);
```

#### 3. Update DynamoDB Table

Add the new attribute to your tenant records in DynamoDB:

```javascript
// Using AWS SDK
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const command = new UpdateCommand({
    TableName: 'kace_multi_tenancy',
    Key: { id: 'your-tenant-id' },
    UpdateExpression: 'SET new_config_value = :val',
    ExpressionAttributeValues: {
        ':val': 'your-value'
    }
});
```

Or via Tenant API:

```bash
# Update tenant
PUT /tenant/{tenantId}
{
    "new_config_value": "your-value"
}
```

#### 4. Access New Attribute in Handlers

```javascript
const baseHandler = async (event) => {
    const {tenant} = event.tenantContext;

    // Access your new attribute
    const newValue = tenant.new_config_value.value;

    // Use it
    console.log('New config:', newValue);
};
```

---

### Example: Adding RabbitMQ Configuration

```javascript
// 1. Add to Tenant.js
/** @type {ValueObjectString} */
#rabbitmq_url;
/** @type {ValueObjectInt} */
#rabbitmq_port;

constructor(dto) {
    // ...
    this.#rabbitmq_url = new ValueObjectString('rabbitmq_url', dto.rabbitmq_url, false);
    this.#rabbitmq_port = new ValueObjectInt('rabbitmq_port', dto.rabbitmq_port, false);
}

get rabbitmq_url() {
    return this.#rabbitmq_url;
}

get rabbitmq_port() {
    return this.#rabbitmq_port;
}

// 2. Use in handler
const baseHandler = async (event) => {
    const {tenant} = event.tenantContext;

    const rabbitMQClient = new RabbitMQClient({
        url: tenant.rabbitmq_url.value,
        port: tenant.rabbitmq_port.value,
    });
};
```

---

## EventBridge/Scheduled Events Changes

### New Orchestrator Pattern

**What changed:**
- Scheduled events no longer invoke handlers directly
- New `kace_cloud_api_eventbridge_orchestrator` Lambda orchestrates multi-tenant execution
- Each tenant receives isolated invocation

### Migration for Scheduled Lambdas

**File**: `lib/*-stack.ts`

```diff
+ import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
+ import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
+ import * as path from 'path';

  export class YourStack extends KApiStack {
      constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
          super(scope, id, props, kProps);

          const endpoint = 'your-endpoint';
          const lambdaFunction = this.getNodejsFunction(endpoint);

+         // EventBridge Orchestrator Lambda for multi-tenant
+         const orchestratorFunction = new NodejsFunction(this, `${endpoint}OrchestratorFunction`, {
              functionName: `${endpoint}-orchestrator`,
+             entry: path.join(__dirname, '../../kace_cloud_api_eventbridge_orchestrator/src/handler.mjs'),
+             runtime: Runtime.NODEJS_22_X,
+             timeout: Duration.minutes(10),
+             memorySize: 512,
+             environment: {
+                 TARGET_LAMBDA_ARN: lambdaFunction.functionArn,
+                 NODE_OPTIONS: '--enable-source-maps',
+             },
+             bundling: {
+                 minify: false,
+                 sourceMap: true,
+                 externalModules: ['@aws-sdk/*'],
+             },
+         });
+
+         // Grant orchestrator permission to invoke handler
+         orchestratorFunction.addToRolePolicy(
+             new PolicyStatement({
+                 effect: Effect.ALLOW,
+                 actions: ['lambda:InvokeFunction'],
+                 resources: [lambdaFunction.functionArn],
+             })
+         );
+
+         // Grant orchestrator permission to read tenants from DynamoDB
+         orchestratorFunction.addToRolePolicy(
+             new PolicyStatement({
+                 effect: Effect.ALLOW,
+                 actions: ['dynamodb:Scan', 'dynamodb:GetItem'],
+                 resources: ['arn:aws:dynamodb:*:*:table/kace_multi_tenancy'],
+             })
+         );

          // EventBridge Schedule
          const scheduleRule = new Rule(this, `${endpoint}ScheduleRule`, {
-             schedule: Schedule.expression('cron(0 * * * ? *)'),
+             schedule: Schedule.expression(cronExpression),
+             description: 'Multi-tenant scheduled execution (via orchestrator)',
          });

-         scheduleRule.addTarget(new LambdaFunction(lambdaFunction));
+         scheduleRule.addTarget(new LambdaFunction(orchestratorFunction));
      }
  }
```

### Cron Expression Configuration

Define cron expressions as environment variables:

```typescript
// In CDK stack
const cronExpression = process.env.CRON_EXPRESSION || 'cron(0 * * * ? *)';
```

Or in `.env`:
```bash
IMPORT_CRON_EXPRESSION="0/1 * * * ? *"  # Every minute
```

---

## Infrastructure Changes (CDK)

### 1. API Gateway CORS Update

**File**: `packages/kace_cloud_aws_infra/src/KApiStack.ts`

```diff
  defaultCorsPreflightOptions: {
      allowHeaders: [
          'Content-Type',
          'Authorization',
+         'X-Tenant-Id',          // NEW: Required for multi-tenant
+         'X-Tenant-Subdomain',   // NEW: Legacy support
      ],
      allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowCredentials: true,
-     allowOrigins: Cors.ALL_ORIGINS,
+     allowOrigins: [process.env.APPS_ALLOWED_ORIGINS || '*'],
  }
```

### 2. Lambda Timeout Increases

Several Lambdas now have increased timeouts for multi-tenant orchestration:

```typescript
nodejsFunctionDefaultProps() {
    const baseProps = super.nodejsFunctionDefaultProps();
    return {
        ...baseProps,
        timeout: Duration.seconds(720),  // 12 minutes (was 300)
    };
}
```

**Affected services:**
- `kace_cloud_api_actions_queue_executions` → 720s
- `kace_cloud_api_actions_queue_executor` → 720s
- `kace_cloud_api_imports_processor` → 720s

---

## API Gateway Changes

### Required Headers

All API requests must include:

```http
X-Tenant-Id: your-tenant-id
Content-Type: application/json
Authorization: {token}
```

### Frontend Integration

**Update frontend API client:**

```javascript
// apps/kace-saas/src/services/api.js
const API_CLIENT = axios.create({
    baseURL: import.meta.env.VITE_DEV_BASE_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': import.meta.env.VITE_TENANT_ID,  // NEW
    },
});
```

**Add to `.env`:**
```bash
VITE_TENANT_ID=your-tenant-id
```

---

## Multi-Tenant Logging

### 🆕 Structured JSON Logging with Tenant ID

All logs are now formatted as **structured JSON** with tenant context automatically included.

**Log Format:**
```json
{
  "timestamp": "2025-12-22T15:30:45.123Z",
  "level": "INFO",
  "tenant_id": "acme",
  "service": "kace_cloud_api_users",
  "message": "User created",
  "userId": 123,
  "username": "john.doe"
}
```

### Updated Helper Methods

**BEFORE (deprecated):**
```javascript
Helper.logInfo('User created', userId, username);
Helper.logError('Failed', error);
```

**AFTER (recommended):**
```javascript
// Structured logging with metadata
Helper.logInfo('User created', { userId, username });
Helper.logError('Failed to create user', error);

// Metrics (creates CloudWatch Metrics)
Helper.logMetric('UserCreated', 1);
Helper.logMetric('APILatency', duration, 'Milliseconds');
```

### Backward Compatibility

Legacy variadic arguments still work:
```javascript
// This still works (legacy support)
Helper.logInfo('User created', userId, username);
```

But structured logging is preferred for better querying.

### Available Log Methods

```javascript
// Info level
Helper.logInfo(message, metadata);

// Error level (supports Error objects)
Helper.logError(message, error);
Helper.logError(message, { customField: value });

// Debug level
Helper.logDebug(message, metadata);

// Debug level 2 (verbose)
Helper.logDebug2(message, metadata);

// CloudWatch Embedded Metrics
Helper.logMetric(metricName, value, unit, dimensions);
```

### CloudWatch Metrics (EMF)

Metrics are automatically created in CloudWatch Metrics under namespace `KACECloud/MultiTenant`:

**Available Metrics:**
- `APIRequest` - Total requests per tenant
- `APILatency` - Request duration in milliseconds
- `APIError` - Error count per tenant
- `TenantContextError` - Tenant loading errors

**Dimensions:**
- `TenantId` - Tenant identifier
- `Service` - Lambda function name

**Example:**
```javascript
Helper.logMetric('CaseCreated', 1);
Helper.logMetric('DBQueryTime', 150, 'Milliseconds', { operation: 'SELECT' });
```

### CloudWatch Logs Insights Queries

**View logs for specific tenant:**
```sql
fields @timestamp, level, message, tenant_id
| filter tenant_id = "acme"
| sort @timestamp desc
| limit 100
```

**Count errors by tenant:**
```sql
fields tenant_id
| filter level = "ERROR"
| stats count() as error_count by tenant_id
| sort error_count desc
```

**Average latency per tenant:**
```sql
fields tenant_id, duration
| filter message = "Request completed"
| stats avg(duration) as avg_latency by tenant_id
| sort avg_latency desc
```

**Find slow requests:**
```sql
fields @timestamp, tenant_id, duration, path
| filter message = "Request completed" and duration > 3000
| sort duration desc
| limit 50
```

### Complete Query Reference

See [CLOUDWATCH_INSIGHTS_QUERIES.md](./CLOUDWATCH_INSIGHTS_QUERIES.md) for 30+ example queries including:
- Error analysis
- Performance monitoring
- Tenant activity tracking
- Debugging and troubleshooting

### How Tenant ID is Injected

The middleware automatically sets up `TenantContext` using **AsyncLocalStorage**:

```javascript
// In withTenantContext.js
import {TenantContext} from '@kace/core/src/shared';

export const withTenantContext = (handler, opts = {}) => {
    return async (event, context, callback) => {
        const tenantId = TenantContextManager.extractTenantId(event);
        const tenant = await TenantContextManager.getTenant(tenantId);

        // 🔥 Run handler in tenant context (AsyncLocalStorage)
        return await TenantContext.run(tenant, async () => {
            Helper.logInfo('Request started', {...});
            const result = await handler(event, context, callback);
            Helper.logMetric('APIRequest', 1);
            return result;
        });
    };
};
```

**Benefits of AsyncLocalStorage**:
- ✅ **Thread-safe**: No race conditions in Lambda concurrency
- ✅ **Auto-cleanup**: Garbage collected when request ends
- ✅ **Accessible everywhere**: Any function in call stack can access tenant via `TenantContext.getTenant()`

**Important**: Never manually set tenant context - the middleware handles this automatically using `TenantContext.run()`.

### Migration Impact

✅ **No breaking changes** - all existing `Helper.log*()` calls continue to work

✅ **Automatic tenant tracking** - logs automatically include tenant_id

✅ **Better debugging** - structured JSON enables powerful CloudWatch Insights queries

⚠️ **Recommendation**: Update logging calls to use structured format for better searchability

---

## Testing Changes

### Unit Tests

Mock the tenant context in your tests:

```javascript
// Test setup
const mockTenantContext = {
    tenant: {
        id: { value: 'test-tenant' },
        db_host: { value: 'localhost' },
        db_port: { value: 5432 },
        db_database: { value: 'test_db' },
        db_user: { value: 'test_user' },
        db_password: { value: 'test_pass' },
        db_schema: { value: 'public' },
        aws_s3_bucket: { value: 'test-bucket' },
        // ... other required fields
    },
    knexConfig: {
        client: 'pg',
        connection: {
            host: 'localhost',
            port: 5432,
            database: 'test_db',
            user: 'test_user',
            password: 'test_pass',
        },
    },
};

// In test
const event = {
    ...mockEvent,
    tenantContext: mockTenantContext,
};

const result = await baseHandler(event);
```

### Integration Tests

Include tenant header in requests:

```bash
curl -X POST https://api.kace.cloud/users \
  -H "X-Tenant-Id: test-tenant" \
  -H "Authorization: ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"username": "test"}'
```

---

## Rollout Strategy

### Phase 1: Infrastructure (DONE ✅)
- [x] Create `kace_multi_tenancy` DynamoDB table
- [x] Deploy Tenant API microservice
- [x] Populate initial tenant data

### Phase 2: Migration (IN PROGRESS 🔄)
- [x] Migrate 95 Lambda handlers
- [x] Update CDK stacks with orchestrator
- [x] Update API Gateway CORS
- [ ] Deploy to staging environment
- [ ] Validate all endpoints

### Phase 3: Frontend Updates (PENDING ⏳)
- [ ] Add `X-Tenant-Id` header to all API calls
- [ ] Update environment variables
- [ ] Test multi-tenant isolation

### Phase 4: Production Deployment (PENDING ⏳)
- [ ] Deploy infrastructure changes
- [ ] Deploy handler updates
- [ ] Monitor for errors
- [ ] Rollback plan ready

---

## Environment Variables Changes

### New Required Variables

Add to `.env`:

```bash
# Multi-tenant configuration
VITE_TENANT_ID=your-tenant-id                    # Frontend: Tenant identifier
AWS_DYNAMODB_MULTITENANT_TABLE_ARN=arn:aws:...  # Backend: DynamoDB table ARN
```

### Deprecated Variables

These are NO LONGER read from `process.env` at runtime (still needed for CDK deployment):

```bash
# ⚠️ These are now tenant-specific in DynamoDB
DB_HOST=
DB_DATABASE=
DB_USER=
DB_PASSWORD=
AWS_S3_BUCKET=
AWS_S3_REGION=
# ... etc
```

---

## Common Issues & Solutions

### Issue 1: "Tenant ID not found in request"

**Solution**: Add `X-Tenant-Id` header to your request:
```bash
curl -H "X-Tenant-Id: your-tenant-id" https://api.example.com/endpoint
```

### Issue 2: "Tenant not found: xyz"

**Solution**: Ensure tenant exists in DynamoDB `kace_multi_tenancy` table:
```bash
aws dynamodb get-item \
  --table-name kace_multi_tenancy \
  --key '{"id": {"S": "your-tenant-id"}}'
```

### Issue 3: Handler still using `process.env.DB_HOST`

**Solution**: Refactor handler to use tenant context:
```diff
- const dbHost = process.env.DB_HOST;
+ const {tenant} = event.tenantContext;
+ const dbHost = tenant.db_host.value;
```

### Issue 4: Scheduled event not executing for all tenants

**Solution**: Verify orchestrator is configured in CDK stack:
```typescript
scheduleRule.addTarget(new LambdaFunction(orchestratorFunction));
// NOT: scheduleRule.addTarget(new LambdaFunction(lambdaFunction));
```

---

## Accessing Tenant Configuration (TenantContext)

### 🆕 AsyncLocalStorage Pattern (Recommended)

Instead of using `global` or passing `tenant` as a parameter everywhere, use **TenantContext** (AsyncLocalStorage):

```javascript
import {TenantContext} from '@kace/core/src/shared';

// ✅ Access tenant from anywhere in the call stack
const tenant = TenantContext.getTenant();
const tenantId = TenantContext.getTenantId();

// ✅ Access configuration values
const s3Bucket = TenantContext.getConfig('aws_s3_bucket.value');
const dbHost = TenantContext.getConfig('db_host.value');
const timezone = TenantContext.getConfig('timezone.value');
```

### Benefits

- ✅ **Thread-safe**: No race conditions in Lambda concurrency
- ✅ **Auto-cleanup**: Garbage collected when request ends
- ✅ **No parameter passing**: Access from any function in call stack
- ✅ **Testable**: Easy to mock in tests
- ✅ **Standard pattern**: Node.js AsyncLocalStorage

### Usage in Services

```javascript
// services/S3Service.js
import {TenantContext} from '@kace/core/src/shared';

export class S3Service {
    async uploadFile(key, body) {
        // ✅ No need to pass tenant as parameter
        const tenant = TenantContext.getTenant();
        const s3Bucket = tenant.aws_s3_bucket.value;

        // ... use tenant config
    }
}
```

### Complete Guide

See [TENANT_CONTEXT_USAGE.md](./TENANT_CONTEXT_USAGE.md) for:
- API reference
- Examples for services, repositories, utilities
- Testing with TenantContext
- Migration from global variables

---

## Support & Questions

For questions or issues:
1. Review this document thoroughly
2. Check [TENANT_CONTEXT_USAGE.md](./TENANT_CONTEXT_USAGE.md)
3. Check `packages/kace_cloud_api_common/src/middleware/README.md`
4. Review example handlers in `apps/apiv1/kace_cloud_api_actions/src/handler.mjs`
5. Contact the platform team

---

## Summary Checklist for Developers

- [ ] I understand `process.env` should NOT be used for tenant-specific config
- [ ] I wrap my handlers with `withTenantContext(baseHandler)`
- [ ] I access configuration via `TenantContext.getTenant()` or `event.tenantContext.tenant`
- [ ] I use TenantContext in services/utilities instead of passing tenant as parameter
- [ ] I use the Tenant domain entity for new configuration attributes
- [ ] I send `X-Tenant-Id` header in API requests
- [ ] I use EventBridge orchestrator for scheduled events
- [ ] I test with multiple tenant configurations

---

**Last Updated**: 2025-12-22
**Document Version**: 1.0.0
**Migration Status**: 95/95 handlers migrated ✅
