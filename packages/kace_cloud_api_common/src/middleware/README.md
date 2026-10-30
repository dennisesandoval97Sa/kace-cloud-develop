# Multi-Tenant Middleware

Middleware para cargar dinámicamente la configuración de cada tenant desde DynamoDB antes de procesar requests en AWS Lambda.

## 📦 Componentes

### 1. `TenantContextManager`

Gestor central que maneja:
- Extracción y validación de subdomain
- Caching LRU con TTL de 5 minutos
- Construcción de configuración de tenant
- Generación de knexConfig dinámico

### 2. `tenantMiddleware` (Middy)

Middleware para handlers que usan [@middy/core](https://middy.js.org/).

### 3. `withTenantContext` (HOC)

Higher Order Component para handlers sin Middy (wrapper function).

## 🚀 Instalación

La dependencia `lru-cache` ya está instalada en el package.

## 📖 Uso

### Opción A: Con Middy (Recomendado para nuevos servicios)

```javascript
import middy from '@middy/core';
import {tenantMiddleware} from '@kace/api-common';
import {Controller} from './controller.mjs';

const baseHandler = async (event, context) => {
    // knexConfig viene del context, inyectado por middleware
    const {knexConfig, tenantConfig, tenant, subdomain} = context;

    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

export const handler = middy(baseHandler)
    .use(tenantMiddleware({cacheEnabled: true}));
```

### Opción B: Sin Middy (Para migración gradual)

**ANTES:**
```javascript
import {production as knexConfig} from '@kace/database/knexfile';
import {Controller} from './controller.mjs';

export const handler = async (event) => {
    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};
```

**DESPUÉS:**
```javascript
import {withTenantContext} from '@kace/api-common';
import {Controller} from './controller.mjs';

const baseHandler = async (event) => {
    // knexConfig y tenantConfig vienen del event.tenantContext
    const {knexConfig, tenantConfig, tenant, subdomain} = event.tenantContext;

    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
```

## 📊 Configuración del Tenant Disponible

⚠️ **IMPORTANTE**: El middleware **NO modifica `process.env`** para evitar race conditions en Lambda con concurrencia > 1.

Toda la configuración está disponible en el objeto `tenantConfig`:

```javascript
{
    database: {
        host: string,
        database: string,
        user: string,
        password: string,
        port: number,
        schema: string,
    },
    aws: {
        s3: {
            bucket: string,
            region: string,
            accessKeyId: string,
            secretAccessKey: string,
        }
    },
    security: {
        secretKey: string,
        secretIv: string,
        encryptionMethod: string,
    },
    application: {
        environment: string,
        domain: string,
        timezone: string,
    }
}
```

## 🔧 Opciones

### `tenantMiddleware(opts)`

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `cacheEnabled` | boolean | `true` | Habilita LRU cache |
| `required` | boolean | `true` | Si el tenant es requerido |
| `skipPaths` | string[] | `['/health', '/healthcheck', '/_health']` | Rutas que no requieren tenant |

### `withTenantContext(handler, opts)`

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `skipPaths` | string[] | `['/health', '/healthcheck', '/_health']` | Rutas que no requieren tenant |

## 📝 Extracción de Subdomain

El middleware extrae el subdomain con la siguiente prioridad:

1. **Custom Header**: `X-Tenant-Subdomain` (útil para testing/desarrollo)
2. **Domain Name**: Extrae de `event.requestContext.domainName` (ej: `acme.api.kace.cloud` → `acme`)

### Testing con Custom Header

```bash
curl -H "X-Tenant-Subdomain: acme" https://api.kace.cloud/users
```

## 🔒 Seguridad

### Validación RFC 1123

El subdomain se valida según RFC 1123:
- Longitud: 3-63 caracteres
- Caracteres: `a-z`, `0-9`, `-` (guiones)
- No puede empezar o terminar con guión
- Normalizado a lowercase

### Tenant Isolation

✅ **Garantizado**: No hay race conditions porque no se modifica `process.env`
✅ **Cache segregado**: Cada tenant tiene su propia entrada en el cache LRU
✅ **Conexiones independientes**: Cada tenant usa su propio pool de Knex

## ⚡ Performance

### LRU Cache

- **Max size**: 500 tenants
- **TTL**: 5 minutos
- **Renovación automática**: El TTL se renueva en cada acceso (hot tenants)
- **Evicción automática**: Los tenants más antiguos se eliminan cuando se alcanza el máximo

### Invalidación Manual

```javascript
import {TenantContextManager} from '@kace/api-common';

// Invalidar tenant específico (útil cuando se actualiza configuración)
TenantContextManager.invalidateTenant('acme');

// Limpiar todo el cache (útil para testing)
TenantContextManager.clearCache();

// Obtener estadísticas del cache
const stats = TenantContextManager.getCacheStats();
console.log(stats); // { size: 42, max: 500, ttl: 300000 }
```

### Connection Pool

El middleware crea un knexConfig con pool optimizado para Lambda:

```javascript
{
    pool: {
        min: 0,                      // No mantener conexiones idle
        max: 10,                     // Soporta concurrencia Lambda
        idleTimeoutMillis: 30000,     
        acquireTimeoutMillis: 10000, // Timeout al adquirir
    }
}
```

## 🚨 Manejo de Errores

El middleware retorna errores HTTP estandarizados:

- **404 Not Found**: Cuando el tenant no existe en DynamoDB
- **400 Bad Request**: Cuando el subdomain es inválido o no se encuentra

```json
{
    "error": true,
    "message": "Tenant not found: acme",
    "type": "TenantMiddlewareError"
}
```

## 🧪 Testing

Los tests requieren mockear `DynamoTenantRepository`. Ejemplo:

```javascript
jest.mock('@kace/core/src/tenant/infrastructure/aws/DynamoTenantRepository.js');

// Configurar mock
const mockTenant = {
    id: {value: 'tenant-123'},
    db_host: {value: 'db.acme.com'},
    // ... resto de propiedades
};

// En beforeEach
DynamoTenantRepository.mockImplementation(() => ({
    find: jest.fn().mockResolvedValue(mockTenant),
}));
```

## 📚 Recursos

- [Plan de Implementación Completo](../../../../TENANT_MIDDLEWARE_PLAN.md)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Middy Documentation](https://middy.js.org/)
- [LRU Cache](https://www.npmjs.com/package/lru-cache)

## ⚠️ Limitaciones Conocidas

1. **Tests**: Los tests unitarios tienen problemas con ESM y mocking. Los componentes funcionan en runtime pero los tests necesitan ajustes en la configuración de Jest.

2. **Feature Flags**: Para rollout gradual, considera implementar feature flags en variables de entorno Lambda:
   ```javascript
   const TENANT_MIDDLEWARE_ENABLED = process.env.TENANT_MIDDLEWARE_ENABLED === 'true';
   ```

## 📞 Soporte

Para issues o preguntas, referirse al archivo `TENANT_MIDDLEWARE_PLAN.md` en la raíz del paquete.
