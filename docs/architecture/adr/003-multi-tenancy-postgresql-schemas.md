# ADR-003: Multi-Tenancy with PostgreSQL Schemas

**Status:** ✅ Accepted

**Decision Makers:** CTO

---

## Context

KACE Cloud is a **multi-tenant SaaS platform** serving multiple organizations (tenants), each with:
- **Isolated data** (customer data must not leak between tenants)
- **Custom configurations** (different workflows, states, classifications per tenant)
- **Variable sizes** (from 10 users to 10,000+ users per tenant)
- **Compliance requirements** (GDPR, HIPAA, SOC 2 - data isolation mandatory)
- **Shared infrastructure** (cost-effective resource utilization)

Multi-tenancy can be implemented in several ways:
1. **Separate databases per tenant** (highest isolation, highest cost)
2. **Separate schemas per tenant** (good isolation, moderate cost)
3. **Shared tables with tenant_id column** (lowest isolation, lowest cost)

Requirements:
- **Strong data isolation** (regulatory compliance)
- **Per-tenant customization** (custom fields, workflows)
- **Cost efficiency** (shared RDS instance)
- **Scalability** (support 100+ tenants)
- **Performance** (fast queries, no cross-tenant data leaks)

---

## Decision

We will implement **multi-tenancy using separate PostgreSQL schemas** per tenant, with a shared RDS instance.

### Implementation Details

1. **Schema-Per-Tenant Model**
   - Each tenant has a dedicated schema (e.g., `kace_abc`, `kace_xyz`)
   - All tables replicated per schema (casos, usuarios, clientes, etc.)
   - Schema selected via `search_path` parameter at connection time

2. **Tenant Context Isolation**
   - `TenantContext` using AsyncLocalStorage (Node.js)
   - Injected via `withTenantContext` middleware in Lambda handler
   - Knex configuration built dynamically per request

3. **Shared Infrastructure**
   - Single RDS PostgreSQL instance (Multi-AZ)
   - Shared connection pool managed by Lambda
   - Shared migrations applied to all tenant schemas

4. **Tenant Configuration Management**
   - AWS DynamoDB table for tenant registry and configuration
   - Stores: tenant ID, schema name, settings, metadata
   - Fast lookups via partition key (tenant ID)
   - No need for PostgreSQL `public` schema for tenant metadata


---

## Architecture

### Tenant Registry (DynamoDB)

```
┌─────────────────────────────────────────────────────────────┐
│  DynamoDB Table: tenant-configurations                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Partition Key: tenantId (String)                     │   │
│  │                                                      │   │
│  │ Attributes:                                          │   │
│  │  - tenantId: "abc"                                   │   │
│  │  - schemaName: "kace_abc"                            │   │
│  │  - name: "Acme Corporation"                          │   │
│  │  - status: "active"                                  │   │
│  │  - createdAt: "2024-01-15T10:00:00Z"                 │   │
│  │  - settings: { ... } (JSON)                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ tenantId: "xyz"                                      │   │
│  │ schemaName: "kace_xyz"                               │   │
│  │ name: "XYZ Industries"                               │   │
│  │ ...                                                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  └── [100+ more tenant configurations]                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tenant Data Storage (PostgreSQL)

```
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL RDS Instance                                │
│                                                         │
│  ├── kace_abc (Schema for Tenant ABC)                  │
│  │   ├── casos                                         │
│  │   ├── usuarios                                      │
│  │   ├── clientes                                      │
│  │   ├── clasificaciones                               │
│  │   ├── estados                                       │
│  │   ├── acciones                                      │
│  │   └── [75+ more tables]                             │
│  │                                                      │
│  ├── kace_xyz (Schema for Tenant XYZ)                  │
│  │   ├── casos                                         │
│  │   ├── usuarios                                      │
│  │   ├── clientes                                      │
│  │   └── [75+ more tables]                             │
│  │                                                      │
│  └── [100+ more tenant schemas]                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Request Flow with Tenant Context

```
API Request
    │
    │ Header: X-Tenant-ID: abc
    │
    ▼
Lambda Handler
    │
    │ withTenantContext() middleware
    │
    ▼
Query DynamoDB for Tenant Config
    │
    │ const command = new GetCommand({
    │   TableName: "tenant-configurations",
    │   Key: { tenantId: "abc" }
    │ });
    │ const response = await dynamoClient.send(command);
    │
    │ Result: {
    │   tenantId: "abc",
    │   schemaName: "kace_abc",
    │   name: "Acme Corporation",
    │   status: "active",
    │   settings: { ... }
    │ }
    │
    ▼
Build Knex Config with Tenant Schema
    │
    │ {
    │   client: 'postgresql',
    │   connection: {
    │     host: process.env.DB_HOST,
    │     database: 'kace_cloud',
    │     searchPath: ['kace_abc']  // From DynamoDB
    │   },
    │   pool: { min: 0, max: 10 }
    │ }
    │
    ▼
TenantContext.run(tenantData, () => {
    │
    │ All queries in this context use 'kace_abc' schema
    │
    ▼
Repository Query
    │
    │ SELECT * FROM casos WHERE id = 123
    │ (PostgreSQL automatically resolves to: kace_abc.casos)
    │
    ▼
PostgreSQL
    │
    │ Returns data from kace_abc schema ONLY
    │ (Data isolation enforced by search_path)
    │
    ◄───┘
})
```

---

## Consequences

### ✅ Positive

1. **Strong Data Isolation**
   - Physical separation at schema level
   - Impossible to query another tenant's data (unless explicitly switching schema)
   - Meets compliance requirements (GDPR, HIPAA, SOC 2)
   - Row-level security not needed (schema-level isolation)

2. **Per-Tenant Customization**
   - Custom tables per tenant (if needed)
   - Custom indexes per tenant
   - Custom constraints per tenant
   - Flexible schema evolution per tenant (migrations can be selective)

3. **Cost Efficiency**
   - Single RDS instance shared across all tenants
   - Lower cost than separate databases (no per-DB overhead)
   - Shared connection pool

4. **Performance**
   - Fast queries (no tenant_id filtering required)
   - Indexes work efficiently (no multi-tenant index pollution)
   - Query optimizer works better (per-schema statistics)

5. **Backup & Restore**
   - Can backup/restore individual tenant schemas
   - Selective data recovery
   - Tenant migration simplified (export schema → import to new DB)

6. **Development Simplicity**
   - Developers work with single-tenant mental model
   - No need to remember tenant_id in every query
   - No risk of accidentally querying wrong tenant data

### ❌ Negative

1. **Schema Management Complexity**
   - Migrations must run on all tenant schemas
   - New tenant onboarding requires schema creation + migrations
   - **Mitigation**:
     - Automated migration scripts (apply to all schemas)
     - Tenant provisioning script
     - Migration status tracking per schema

2. **Connection Pool Overhead**
   - Each tenant requires separate connection with `search_path`
   - Connection pool fragmentation
   - **Mitigation**:
     - Knex connection pooling (reuse connections with same search_path)
     - Lambda warm starts reuse connections
     - Monitor connection pool usage

3. **Database Size**
   - Table definitions replicated per tenant (metadata overhead)
   - More schemas = larger pg_catalog
   - **Mitigation**:
     - PostgreSQL handles 1000+ schemas efficiently
     - Monitor database size
     - Archive inactive tenants

4. **Cross-Tenant Reporting**
   - Hard to run queries across all tenants
   - **Mitigation**:
     - Dedicated reporting Lambda that iterates schemas
     - Data warehouse for cross-tenant analytics (future)
     - Admin reports use UNION ALL across schemas

5. **Schema Limit**
   - PostgreSQL can handle 1000+ schemas, but performance degrades beyond that
   - **Mitigation**:
     - Current: 100 tenants (well below limit)
     - Future: Shard to multiple RDS instances if needed

---

## Implementation Example

### Tenant Context Middleware

```javascript
// @kace/api-common/middleware/withTenantContext.mjs
import { AsyncLocalStorage } from 'async_hooks';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const tenantStorage = new AsyncLocalStorage();
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

class TenantContext {
    static run(tenantData, callback) {
        return tenantStorage.run(tenantData, callback);
    }

    static get() {
        return tenantStorage.getStore();
    }
}

export function withTenantContext(handler) {
    return async (event) => {
        // 1. Extract tenant ID from headers
        const tenantId = event.headers['x-tenant-id'];
        if (!tenantId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing X-Tenant-ID header' })
            };
        }

        // 2. Load tenant configuration from DynamoDB
        const command = new GetCommand({
            TableName: process.env.TENANT_TABLE_NAME || 'tenant-configurations',
            Key: { tenantId }
        });

        const { Item: tenant } = await dynamoClient.send(command);

        if (!tenant) {
            return {
                statusCode: 404,
                body: JSON.stringify({ error: 'Tenant not found' })
            };
        }

        if (tenant.status !== 'active') {
            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'Tenant is not active' })
            };
        }

        // 3. Build tenant-specific Knex config
        const knexConfig = {
            client: 'postgresql',
            connection: {
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                searchPath: [tenant.schemaName] // e.g., ['kace_abc']
            },
            pool: { min: 0, max: 10 }
        };

        // 4. Run handler with tenant context
        const tenantContext = {
            tenantId: tenant.tenantId,
            schemaName: tenant.schemaName,
            name: tenant.name,
            settings: tenant.settings || {},
            knexConfig
        };

        return TenantContext.run(tenantContext, async () => {
            event.tenantContext = TenantContext.get();
            return handler(event);
        });
    };
}
```

### Repository Using Tenant Context

```javascript
// @kace/core/cases/infrastructure/persistence/KnexCaseRepository.js
import knex from 'knex';
import { TenantContext } from '@kace/api-common';

class KnexCaseRepository {
    constructor(knexConfig) {
        this.connection = knex(knexConfig);
    }

    async findById(id) {
        // Query automatically uses tenant schema from searchPath
        const record = await this.connection('casos') // Resolves to tenant_abc.casos
            .where('id', id)
            .first();
        return Case.reconstruct(record);
    }

    async create(case) {
        await this.connection('casos').insert({
            id: case.id,
            titulo: case.title,
            // ...
        });
    }
}
```

---

## Alternatives Considered

### 1. **Separate Database Per Tenant**

**Pros:**
- Maximum isolation (different RDS instances)
- Per-tenant scaling
- Per-tenant backup/restore

**Cons:**
- Very expensive (RDS instance per tenant)
- Management overhead (100+ databases)
- Connection pool fragmentation
- Hard to apply schema changes across tenants

**Rejected because:** Cost prohibitive, operational complexity.

---

### 2. **Shared Tables with tenant_id Column**

**Pros:**
- Simplest implementation
- Single schema
- Easy cross-tenant queries

**Cons:**
- Weak isolation (risk of data leaks via bugs)
- Must filter every query with tenant_id (easy to forget)
- Compliance concerns (regulators prefer physical isolation)
- Index pollution (tenant_id in every index)

**Rejected because:** Insufficient data isolation, compliance risk.

---

### 3. **Hybrid: Separate DB for Large Tenants + Shared DB for Small Tenants**

**Pros:**
- Optimizes cost and performance
- Large tenants get dedicated resources

**Cons:**
- Complexity (multiple deployment models)
- Hard to migrate tenants between models
- Two codebases to maintain

**Rejected because:** Unnecessary complexity for current scale.

---

## Migration Strategy

### Adding New Tenant

```javascript
// 1. Register tenant in DynamoDB
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const newTenant = {
    tenantId: 'new-tenant-id',
    schemaName: 'kace_new',
    name: 'New Tenant Inc',
    status: 'active',
    createdAt: new Date().toISOString(),
    settings: {
        // Custom tenant settings
        timezone: 'America/New_York',
        locale: 'en-US'
    }
};

await dynamoClient.send(new PutCommand({
    TableName: 'tenant-configurations',
    Item: newTenant
}));

// 2. Create PostgreSQL schema
await knex.raw('CREATE SCHEMA IF NOT EXISTS ??', ['kace_new']);

// 3. Run all migrations on new schema
await knex.migrate.latest({
    schemaName: 'kace_new'
});

// 4. Seed initial data (optional)
await knex.seed.run({
    schemaName: 'kace_new'
});

console.log(`Tenant ${newTenant.name} created successfully with schema ${newTenant.schemaName}`);
```

### Migrating Existing Tenant to New Schema

```sql
-- 1. Create new schema
CREATE SCHEMA tenant_abc_new;

-- 2. Copy data
pg_dump -n tenant_abc | psql -v search_path=tenant_abc_new

-- 3. Update tenant registry
UPDATE public.tenants SET schema = 'tenant_abc_new' WHERE id = 'abc';

-- 4. Drop old schema (after verification)
DROP SCHEMA tenant_abc CASCADE;
```

---

## Security Considerations

1. **Search Path Validation**
   - Always validate tenant ID before setting search_path
   - Prevent SQL injection via schema name

2. **Row-Level Security (Optional)**
   - Can add RLS policies as additional layer
   - Currently not implemented (schema isolation sufficient)

3. **Connection Credentials**
   - Use AWS Secrets Manager for database credentials
   - Rotate credentials regularly

4. **Audit Logging**
   - Log all schema switches
   - Track which tenant accessed data

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| **Data Leak Incidents** | 0 | 0 |
| **Schema Switch Latency** | < 10ms | 5ms |
| **Migration Time (per tenant)** | < 5 minutes | 3 minutes |
| **Number of Tenants Supported** | 100+ | 50 |
| **DB Size per Tenant** | < 10 GB | 3 GB avg |

---

## Related ADRs

- [ADR-001: Serverless Architecture with AWS Lambda](001-serverless-architecture-aws-lambda.md)

---

## References

- [PostgreSQL Schema Documentation](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [Multi-Tenancy Best Practices (AWS)](https://aws.amazon.com/blogs/database/multi-tenancy-best-practices/)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage)

---

**Revision History:**
- 2026-01-06: Documented in ADR format
