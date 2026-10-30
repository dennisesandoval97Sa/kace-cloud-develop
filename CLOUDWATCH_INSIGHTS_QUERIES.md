# CloudWatch Insights Queries - Multi-Tenant Logging

Este documento contiene queries útiles para CloudWatch Logs Insights para analizar logs multi-tenant en KACE Cloud.

---

## 📋 Tabla de Contenidos

1. [Queries Básicas](#queries-básicas)
2. [Queries por Tenant](#queries-por-tenant)
3. [Análisis de Errores](#análisis-de-errores)
4. [Performance y Latencia](#performance-y-latencia)
5. [Métricas y Estadísticas](#métricas-y-estadísticas)
6. [Debugging y Troubleshooting](#debugging-y-troubleshooting)

---

## Queries Básicas

### Ver una sola operacion
```sql
fields @timestamp, @message
| filter @message like /e5066cbc-96a2-4501-b89e-cd0f9e2004d4/
| sort @timestamp desc
```

### Ver todos los logs de un tenant específico

```sql
fields @timestamp, level, message, tenant_id, service
| filter tenant_id = "acme"
| sort @timestamp desc
| limit 100
```

### Ver logs de múltiples tenants

```sql
fields @timestamp, level, message, tenant_id, service
| filter tenant_id in ["acme", "globex", "initech"]
| sort @timestamp desc
| limit 200
```

### Filtrar por nivel de log

```sql
fields @timestamp, message, tenant_id, service
| filter level = "ERROR"
| sort @timestamp desc
| limit 50
```

---

## Queries por Tenant

### Contar requests por tenant

```sql
fields tenant_id
| stats count() as request_count by tenant_id
| sort request_count desc
```

### Top 10 tenants con más actividad

```sql
fields tenant_id
| filter level = "INFO" and message = "Request started"
| stats count() as requests by tenant_id
| sort requests desc
| limit 10
```

### Actividad de un tenant en las últimas 24 horas

```sql
fields @timestamp, message, level, path, method
| filter tenant_id = "acme"
| filter @timestamp >= ago(24h)
| sort @timestamp desc
```

### Distribución de requests por tenant y servicio

```sql
fields tenant_id, service
| filter message = "Request started"
| stats count() as requests by tenant_id, service
| sort requests desc
```

---

## Análisis de Errores

### Todos los errores de un tenant

```sql
fields @timestamp, message, error, stack, tenant_id
| filter tenant_id = "acme" and level = "ERROR"
| sort @timestamp desc
| limit 50
```

### Errores agrupados por tipo

```sql
fields error, errorName
| filter level = "ERROR"
| stats count() as error_count by error
| sort error_count desc
| limit 20
```

### Errores por tenant (últimas 24 horas)

```sql
fields tenant_id, error
| filter level = "ERROR"
| filter @timestamp >= ago(24h)
| stats count() as error_count by tenant_id
| sort error_count desc
```

### Top errores con stack trace

```sql
fields @timestamp, tenant_id, message, error, stack
| filter level = "ERROR" and ispresent(stack)
| sort @timestamp desc
| limit 20
```

### Tenant Context Errors (tenant no encontrado)

```sql
fields @timestamp, tenant_id, message, error
| filter message = "Request failed" and error like /not found/
| stats count() as count by tenant_id
| sort count desc
```

---

## Performance y Latencia

### Latencia promedio por tenant

```sql
fields tenant_id, duration
| filter message = "Request completed"
| stats avg(duration) as avg_latency, max(duration) as max_latency, count() as requests by tenant_id
| sort avg_latency desc
```

### Requests lentos (> 3 segundos)

```sql
fields @timestamp, tenant_id, service, duration, path
| filter message = "Request completed" and duration > 3000
| sort duration desc
| limit 50
```

### P50, P95, P99 de latencia por tenant

```sql
fields duration
| filter message = "Request completed" and tenant_id = "acme"
| stats pct(duration, 50) as p50, pct(duration, 95) as p95, pct(duration, 99) as p99
```

### Latencia de carga de contexto (cache hits)

```sql
fields @timestamp, tenant_id, cacheHit, duration
| filter message = "Tenant context loaded"
| stats count() as total, sum(cacheHit) as cache_hits, avg(duration) as avg_duration by tenant_id
```

### Requests por método HTTP y tenant

```sql
fields tenant_id, method
| filter message = "Request started"
| stats count() as requests by tenant_id, method
| sort requests desc
```

---

## Métricas y Estadísticas

### Requests por hora para un tenant

```sql
fields @timestamp
| filter tenant_id = "acme" and message = "Request started"
| stats count() as requests by bin(1h)
```

### Success rate por tenant

```sql
fields tenant_id, statusCode
| filter message = "Request completed"
| stats count() as total,
        sum(statusCode >= 200 and statusCode < 300) as success,
        sum(statusCode >= 400) as errors
        by tenant_id
```

### Distribución de status codes

```sql
fields statusCode
| filter message = "Request completed"
| stats count() as count by statusCode
| sort count desc
```

### Actividad por día de la semana

```sql
fields @timestamp, tenant_id
| filter message = "Request started"
| stats count() as requests by datefloor(@timestamp, 1d)
| sort @timestamp asc
```

---

## Debugging y Troubleshooting

### Trace completo de un request específico

```sql
fields @timestamp, level, message, requestId, tenant_id
| filter requestId = "abc123-def456-ghi789"
| sort @timestamp asc
```

### Logs de un tenant en un rango de tiempo específico

```sql
fields @timestamp, level, message, path, method
| filter tenant_id = "acme"
| filter @timestamp >= "2025-12-22T10:00:00.000Z" and @timestamp <= "2025-12-22T11:00:00.000Z"
| sort @timestamp asc
```

### Buscar por palabra clave en mensaje

```sql
fields @timestamp, tenant_id, message, level
| filter message like /authentication/
| sort @timestamp desc
| limit 100
```

### Debug logs de un servicio específico

```sql
fields @timestamp, message, tenant_id, level
| filter service = "kace_cloud_api_users" and level = "DEBUG"
| filter tenant_id = "acme"
| sort @timestamp desc
| limit 100
```

### Encontrar requests que fallaron después de cargar contexto

```sql
fields @timestamp, tenant_id, message, error
| filter tenant_id = "acme"
| filter message = "Tenant context loaded" or message = "Request failed"
| sort @timestamp asc
```

---

## Queries Avanzadas

### Tenant con más errores en la última hora

```sql
fields tenant_id
| filter level = "ERROR" and @timestamp >= ago(1h)
| stats count() as error_count by tenant_id
| sort error_count desc
| limit 1
```

### Correlación entre cache miss y latencia

```sql
fields cacheHit, duration
| filter message = "Tenant context loaded"
| stats avg(duration) as avg_duration by cacheHit
```

### Requests fallidos por path

```sql
fields path, statusCode
| filter message = "Request completed" and statusCode >= 400
| stats count() as failures by path
| sort failures desc
| limit 20
```

### Tenants inactivos (sin requests en últimas 24h)

```sql
# Ejecutar este query para ver tenants activos
fields tenant_id
| filter message = "Request started" and @timestamp >= ago(24h)
| stats count() as requests by tenant_id

# Luego comparar con lista total de tenants
```

### Análisis de timeout por tenant

```sql
fields @timestamp, tenant_id, duration, path
| filter message = "Request completed" and duration > 29000
| stats count() as near_timeout_requests by tenant_id
| sort near_timeout_requests desc
```

---

## Métricas EMF (CloudWatch Metrics)

Las métricas EMF generadas por `Helper.logMetric()` están disponibles en **CloudWatch Metrics** bajo el namespace `KACECloud/MultiTenant`:

### Métricas disponibles:

- **APIRequest**: Contador de requests totales por tenant
- **APILatency**: Latencia de requests en milliseconds
- **APIError**: Contador de errores por tenant
- **TenantContextError**: Errores al cargar contexto de tenant

### Ver métricas en CloudWatch Console:

1. Ir a CloudWatch > Metrics
2. Seleccionar `KACECloud/MultiTenant`
3. Filtrar por dimensión `TenantId`

### Crear alarmas:

```bash
# Ejemplo: Alarma si un tenant tiene más de 10 errores en 5 minutos
aws cloudwatch put-metric-alarm \
  --alarm-name "high-error-rate-acme" \
  --alarm-description "Alert when error rate is high for tenant acme" \
  --metric-name APIError \
  --namespace KACECloud/MultiTenant \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --dimensions Name=TenantId,Value=acme
```

---

## Dashboard Queries

### Query para dashboard de overview

```sql
fields tenant_id, level
| stats count() as total,
        sum(level = "ERROR") as errors,
        sum(level = "INFO") as info
        by tenant_id
| sort errors desc
```

### Query para latencia en tiempo real

```sql
fields @timestamp, tenant_id, duration
| filter message = "Request completed"
| filter @timestamp >= ago(5m)
| stats avg(duration) as avg_latency by bin(1m), tenant_id
```

---

## Tips y Mejores Prácticas

### 1. Usar filtros específicos primero

✅ **Bueno** (filtra primero):
```sql
fields @timestamp, message
| filter tenant_id = "acme"
| filter level = "ERROR"
| sort @timestamp desc
```

❌ **Malo** (escanea todo primero):
```sql
fields @timestamp, message, tenant_id, level
| sort @timestamp desc
| filter tenant_id = "acme"
```

### 2. Limitar resultados

Siempre usa `limit` para evitar escanear demasiados logs:

```sql
fields @timestamp, message
| filter tenant_id = "acme"
| limit 100
```

### 3. Usar time ranges específicos

```sql
# Últimas 24 horas
| filter @timestamp >= ago(24h)

# Rango específico
| filter @timestamp >= "2025-12-22T00:00:00.000Z" and @timestamp <= "2025-12-22T23:59:59.999Z"
```

### 4. Verificar presencia de campos antes de usar

```sql
# Verifica que el campo existe antes de filtrarlo
| filter ispresent(duration) and duration > 1000
```

### 5. Combinar múltiples condiciones

```sql
fields @timestamp, tenant_id, message, error
| filter (level = "ERROR" or level = "WARN")
      and tenant_id = "acme"
      and @timestamp >= ago(1h)
| sort @timestamp desc
```

---

## Formato de Logs Estructurados

Los logs generados por `Helper.logInfo()`, `Helper.logError()`, etc. tienen esta estructura:

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

### Campos estándar:

- `timestamp`: ISO 8601 timestamp
- `level`: INFO, ERROR, DEBUG, DEBUG2
- `tenant_id`: Identificador del tenant (o "system")
- `service`: Nombre de la Lambda (`AWS_LAMBDA_FUNCTION_NAME`)
- `message`: Mensaje principal del log
- `...metadata`: Campos adicionales específicos del contexto

### Campos específicos de error:

```json
{
  "timestamp": "2025-12-22T15:30:45.123Z",
  "level": "ERROR",
  "tenant_id": "acme",
  "service": "kace_cloud_api_users",
  "message": "Failed to create user",
  "error": "Duplicate email address",
  "stack": "Error: Duplicate email...\n  at ...",
  "errorName": "ValidationError"
}
```

---

## Exportar Resultados

### Exportar a CSV

Puedes exportar los resultados de cualquier query usando la consola de CloudWatch:

1. Ejecutar query
2. Click en "Actions" > "Export results to CSV"

### Usar AWS CLI

```bash
aws logs start-query \
  --log-group-name "/aws/lambda/kace_cloud_api_users" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, tenant_id, message | filter level = "ERROR" | limit 100'
```

---

## Recursos Adicionales

- [CloudWatch Logs Insights Query Syntax](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CWL_QuerySyntax.html)
- [CloudWatch Embedded Metric Format](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Embedded_Metric_Format.html)
- [BREAKING_CHANGES.md](./BREAKING_CHANGES.md) - Cambios en arquitectura multi-tenant

---

**Última actualización**: 2025-12-22
**Versión**: 1.0.0
