# Tenant Context Usage Guide

## 🎯 Resumen

En lugar de usar `global.currentTenantId` o pasar el tenant como parámetro por toda la aplicación, usamos **AsyncLocalStorage** a través de `TenantContext` para disponibilizar el tenant en todo el call stack.

## ✅ Comparación de Enfoques

### ❌ Approach 1: Global Variable (NO RECOMENDADO)

```javascript
// ❌ Race conditions en Lambda con concurrencia > 1
global.currentTenant = tenant;
global.currentTenantId = tenantId;

// En cualquier parte
const tenant = global.currentTenant;
```

**Problemas**:
- Race conditions con múltiples requests concurrentes
- Requiere cleanup manual
- No thread-safe

### ⚠️ Approach 2: Parameter Passing (TEDIOSO)

```javascript
// ⚠️ Tedioso pasar tenant por todas las funciones
async function processCase(caseId, tenant) {
    await validateCase(caseId, tenant);
    await saveCase(caseId, tenant);
    await notifyUsers(caseId, tenant);
}

async function validateCase(caseId, tenant) {
    const s3Bucket = tenant.aws_s3_bucket.value;
    // ...
}
```

**Problemas**:
- Parámetros extra en todas las funciones
- Difícil refactorizar
- Coupling alto

### ✅ Approach 3: AsyncLocalStorage (RECOMENDADO)

```javascript
// ✅ Thread-safe, auto-cleanup, accessible desde cualquier lugar

// En middleware
await TenantContext.run(tenant, async () => {
    await processCase(caseId);
});

// En cualquier función del call stack
async function processCase(caseId) {
    const tenant = TenantContext.getTenant();
    const s3Bucket = tenant.aws_s3_bucket.value;

    await validateCase(caseId);
    await saveCase(caseId);
}
```

**Ventajas**:
- ✅ Thread-safe (sin race conditions)
- ✅ Auto-cleanup (garbage collected)
- ✅ No contamina firma de funciones
- ✅ Testeable
- ✅ Patrón estándar en Node.js

---

## 📚 API Reference

### TenantContext

```javascript
import {TenantContext} from '@kace/core/src/shared';
```

#### Methods

##### `TenantContext.run(tenant, fn)`

Ejecuta una función dentro del contexto de un tenant.

```javascript
await TenantContext.run(tenant, async () => {
    // Todo el código aquí tiene acceso al tenant
    await someOperation();
});
```

##### `TenantContext.getTenant()`

Obtiene el tenant actual del contexto.

```javascript
const tenant = TenantContext.getTenant();

if (tenant) {
    const dbHost = tenant.db_host.value;
    const s3Bucket = tenant.aws_s3_bucket.value;
}
```

**Returns**: `Tenant | null`

##### `TenantContext.getTenantId()`

Obtiene solo el ID del tenant actual.

```javascript
const tenantId = TenantContext.getTenantId();
console.log(`Processing for tenant: ${tenantId}`);
```

**Returns**: `string | null`

##### `TenantContext.getConfig(path)`

Obtiene un valor de configuración usando dot-notation.

```javascript
const s3Bucket = TenantContext.getConfig('aws_s3_bucket.value');
const dbHost = TenantContext.getConfig('db_host.value');
const timezone = TenantContext.getConfig('timezone.value');
```

**Returns**: `any | null`

##### `TenantContext.isInContext()`

Verifica si el código se está ejecutando dentro de un contexto de tenant.

```javascript
if (TenantContext.isInContext()) {
    const tenant = TenantContext.getTenant();
    // Usar tenant
} else {
    // Código sin tenant (ej: scripts, background jobs)
}
```

**Returns**: `boolean`

---

## 🚀 Uso en Handlers

### Opción 1: withTenantContext (Sin Middy)

El contexto se configura automáticamente:

```javascript
import {withTenantContext} from '@kace/api-common';
import {TenantContext} from '@kace/core/src/shared';
import {Controller} from './controller.mjs';

const baseHandler = async (event) => {
    // ✅ Tenant context ya está disponible aquí
    const tenant = TenantContext.getTenant();
    const s3Bucket = tenant.aws_s3_bucket.value;

    const {knexConfig} = event.tenantContext;
    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
```

### Opción 2: Con Middy

**IMPORTANTE**: Debes usar AMBOS middlewares:

```javascript
import middy from '@middy/core';
import {tenantMiddleware, tenantContextMiddleware} from '@kace/api-common';
import {TenantContext} from '@kace/core/src/shared';
import {Controller} from './controller.mjs';

const baseHandler = async (event, context) => {
    // ✅ Tenant context disponible
    const tenant = TenantContext.getTenant();
    const s3Bucket = tenant.aws_s3_bucket.value;

    const {knexConfig} = context;
    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

export const handler = middy(baseHandler)
    .use(tenantMiddleware())         // 1️⃣ Carga tenant
    .use(tenantContextMiddleware()); // 2️⃣ Configura AsyncLocalStorage
```

---

## 💡 Ejemplos de Uso

### Acceso a Configuración

```javascript
import {TenantContext} from '@kace/core/src/shared';

// Obtener tenant completo
const tenant = TenantContext.getTenant();

// Acceso a configuración de base de datos
const dbConfig = {
    host: tenant.db_host.value,
    port: tenant.db_port.value,
    database: tenant.db_database.value,
    user: tenant.db_user.value,
    password: tenant.db_password.value,
};

// Acceso a configuración de S3
const s3Config = {
    bucket: tenant.aws_s3_bucket.value,
    region: tenant.aws_s3_region.value,
    accessKeyId: tenant.aws_s3_access_key_id.value,
    secretAccessKey: tenant.aws_s3_secret_access_key.value,
};

// Acceso a configuración de aplicación
const appConfig = {
    environment: tenant.apps_environment.value,
    domain: tenant.apps_domain.value,
    timezone: tenant.timezone.value,
};
```

### Usando getConfig() Helper

```javascript
import {TenantContext} from '@kace/core/src/shared';

// Más conciso con getConfig
const dbHost = TenantContext.getConfig('db_host.value');
const s3Bucket = TenantContext.getConfig('aws_s3_bucket.value');
const timezone = TenantContext.getConfig('timezone.value');
```

### En Servicios y Utilities

```javascript
// services/S3Service.js
import {TenantContext} from '@kace/core/src/shared';
import {S3Client, PutObjectCommand} from '@aws-sdk/client-s3';

export class S3Service {
    uploadFile(key, body) {
        // ✅ No necesitas pasar tenant como parámetro
        const tenant = TenantContext.getTenant();

        const s3Client = new S3Client({
            region: tenant.aws_s3_region.value,
            credentials: {
                accessKeyId: tenant.aws_s3_access_key_id.value,
                secretAccessKey: tenant.aws_s3_secret_access_key.value,
            },
        });

        const command = new PutObjectCommand({
            Bucket: tenant.aws_s3_bucket.value,
            Key: key,
            Body: body,
        });

        return s3Client.send(command);
    }
}
```

### En Repositorios

```javascript
// repositories/CaseRepository.js
import {TenantContext} from '@kace/core/src/shared';
import knex from 'knex';

export class CaseRepository {
    async find(id) {
        const tenant = TenantContext.getTenant();

        const db = knex({
            client: 'pg',
            connection: {
                host: tenant.db_host.value,
                database: tenant.db_database.value,
                user: tenant.db_user.value,
                password: tenant.db_password.value,
            },
            searchPath: [tenant.db_schema.value],
        });

        return await db('cases').where('id', id).first();
    }
}
```

### En Domain Services

```javascript
// domain/services/CaseNotifier.js
import {TenantContext} from '@kace/core/src/shared';
import {EmailService} from '../../services/EmailService.js';

export class CaseNotifier {
    async notifyAssignee(caseEntity) {
        const tenantId = TenantContext.getTenantId();
        const timezone = TenantContext.getConfig('timezone.value');

        const emailService = new EmailService();

        await emailService.send({
            to: caseEntity.assignee.email,
            subject: `New case assigned - Tenant: ${tenantId}`,
            body: `Case #${caseEntity.id} assigned at ${new Date().toLocaleString('en-US', {timeZone: timezone})}`,
        });
    }
}
```

---

## 🧪 Testing

### Mock TenantContext en Tests

```javascript
import {TenantContext} from '@kace/core/src/shared';

describe('CaseService', () => {
    const mockTenant = {
        id: {value: 'test-tenant'},
        db_host: {value: 'localhost'},
        db_port: {value: 5432},
        aws_s3_bucket: {value: 'test-bucket'},
        // ... otros campos
    };

    it('should create case', async () => {
        // Ejecutar test dentro de tenant context
        await TenantContext.run(mockTenant, async () => {
            const service = new CaseService();
            const result = await service.createCase({
                title: 'Test Case',
            });

            expect(result).toBeDefined();
        });
    });
});
```

---

## ⚠️ Consideraciones Importantes

### 1. Solo funciona dentro de async call stack

```javascript
// ✅ Funciona (dentro de async function)
async function someFunction() {
    const tenant = TenantContext.getTenant();
}

// ❌ NO funciona (código síncrono fuera del contexto)
const tenant = TenantContext.getTenant(); // null
```

### 2. No usar en código fuera de handlers

```javascript
// ❌ NO hacer esto en nivel de módulo
import {TenantContext} from '@kace/core/src/shared';

const tenant = TenantContext.getTenant(); // Siempre null aquí

export class Service {
    // ✅ Hacer esto en métodos
    async doSomething() {
        const tenant = TenantContext.getTenant();
    }
}
```

### 3. Verificar disponibilidad en código compartido

```javascript
import {TenantContext} from '@kace/core/src/shared';

export function someUtility() {
    if (!TenantContext.isInContext()) {
        throw new Error('This function must be called within tenant context');
    }

    const tenant = TenantContext.getTenant();
    // ... usar tenant
}
```

---

## 🔄 Migración desde global

### Antes (usando global)

```javascript
// ❌ Código antiguo
async function processCase(caseId) {
    const tenantId = global.currentTenantId;
    console.log(`Processing case for tenant: ${tenantId}`);
}
```

### Después (usando TenantContext)

```javascript
// ✅ Código nuevo
import {TenantContext} from '@kace/core/src/shared';

async function processCase(caseId) {
    const tenantId = TenantContext.getTenantId();
    console.log(`Processing case for tenant: ${tenantId}`);
}
```

**Ventajas**:
- Más seguro (thread-safe)
- Mejor testing
- Código más limpio

---

## 📊 Logging Automático

El `Helper` ya usa `TenantContext` internamente:

```javascript
import {Helper} from '@kace/core/src/shared';

// ✅ tenant_id se incluye automáticamente
Helper.logInfo('Case created', {caseId: 123});

// Output:
// {
//   "timestamp": "2025-12-22T...",
//   "level": "INFO",
//   "tenant_id": "acme",  // ← Automático desde TenantContext
//   "message": "Case created",
//   "caseId": 123
// }
```

---

## 🆚 Comparación: TenantContext vs event.tenantContext

### event.tenantContext

```javascript
// Disponible solo en handler
const baseHandler = async (event) => {
    const {tenant, knexConfig} = event.tenantContext;

    // ❌ No disponible en funciones llamadas
    await someService.doSomething(); // No tiene acceso a tenant
};
```

### TenantContext

```javascript
// Disponible en TODO el call stack
const baseHandler = async (event) => {
    // ✅ Disponible aquí
    const tenant = TenantContext.getTenant();

    // ✅ Disponible en funciones llamadas
    await someService.doSomething(); // Tiene acceso via TenantContext
};
```

**Recomendación**: Usa ambos según el caso:
- `event.tenantContext` → Para knexConfig y acceso directo en handler
- `TenantContext` → Para acceder en servicios, utilities, repositorios

---

## 📖 Recursos Adicionales

- [AsyncLocalStorage Documentation](https://nodejs.org/api/async_context.html#class-asynclocalstorage)
- [BREAKING_CHANGES.md](./BREAKING_CHANGES.md)
- [CLOUDWATCH_INSIGHTS_QUERIES.md](./CLOUDWATCH_INSIGHTS_QUERIES.md)

---

**Última actualización**: 2025-12-22
**Versión**: 1.0.0
