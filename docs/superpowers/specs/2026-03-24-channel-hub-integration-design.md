# Channel Hub Integration — Design Spec

**Date:** 2026-03-24
**Branch:** feature/natura-correos
**Status:** Approved

## Overview

New integration module "Channel Hub" that allows managing email accounts connected to the Channel Hub external service. Users can create accounts with email, name, country, and an associated rest flow, then "register" them to obtain a `connection_id` from Channel Hub via rest flow execution.

## 1. Database

### 1.1 New table: `channel_hub_accounts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | VARCHAR(36) | PK | UUID stored as string |
| email | VARCHAR(255) | NOT NULL | Immutable after creation |
| name | VARCHAR(255) | NOT NULL | Account name |
| country_id | VARCHAR(10) | NOT NULL | Country code (e.g. 'co', 'mx') |
| rest_flow_id | VARCHAR(36) | NOT NULL, FK → ws_rest_flows.id | Associated rest flow |
| channel_hub_connection_id | VARCHAR(255) | NULLABLE | Filled by "Register" action |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | |
| created_at | TIMESTAMP | NOT NULL | |
| created_by | VARCHAR(36) | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |
| updated_by | VARCHAR(36) | NOT NULL | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |
| deleted_by | VARCHAR(36) | NULLABLE | |
| channel_hub_error | JSONB | NULLABLE | Stores error response from Channel Hub on failed registration |

**Migration file:** `packages/kace_cloud_database/migrations/YYYYMMDDHHMMSS_table_channel_hub_accounts.js`

### 1.2 Seeder

**File:** `packages/kace_cloud_database/seeds/YYYYMMDDHHMMSS_channel_hub_rest_flow.js`

Contents embedded directly from `tmp/inserts.sql` (adjusted to remove schema prefixes like `kace_pruebas_correos.`):
- 3 records in `ws_rest_endpoints` (auth, get connection-id, create connection)
- 1 record in `ws_rest_flows` (Channel Hub - Crear conexion, external_code: `channelhub-connection`)
- 1 record in `ws_rest_workflow_steps`

Note: The seeder embeds the SQL data directly; it does not depend on the tmp/ file.

## 2. Backend — @kace/core module

### 2.1 Module structure

```
packages/kace_cloud_core/src/channel-hub-accounts/
├── domain/
│   └── ChannelHubAccount.js            # Entity (AggregateRoot)
├── application/
│   ├── create/ChannelHubAccountCreator.js
│   ├── find/ChannelHubAccountFinder.js
│   ├── update/ChannelHubAccountUpdater.js
│   ├── delete/ChannelHubAccountDeleter.js
│   ├── search/ChannelHubAccountSearcher.js
│   ├── register/ChannelHubAccountRegistrar.js
│   └── ChannelHubAccountResponse.js
└── infrastructure/
    ├── persistence/
    │   └── KnexChannelHubAccountRepository.js
    └── mappers/
        └── ChannelHubPayloadBuilder.js   # Moved from mail-accounts (infrastructure concern)
```

### 2.2 Entity: ChannelHubAccount

Fields: id, email, name, countryId, restFlowId, channelHubConnectionId, isActive, createdAt, createdBy, updatedAt, updatedBy, deletedAt, deletedBy.

### 2.3 Use cases

- **ChannelHubAccountCreator**: Validates uniqueness by email, creates record.
- **ChannelHubAccountFinder**: Finds by ID, returns DTO.
- **ChannelHubAccountUpdater**: Updates name, country_id, rest_flow_id. Email is NOT updatable.
- **ChannelHubAccountDeleter**: Soft delete (sets deleted_at, deleted_by).
- **ChannelHubAccountSearcher**: Paginated search with filters (name, email, country_id).
- **ChannelHubAccountRegistrar**: Key use case.
  **Dependencies:** `KnexChannelHubAccountRepository`, `WorkflowExecutor` (which requires `KnexWSRestWorkflowStepRepository`, `KnexAllowedConnectionsRepository`, `KnexSecretsVaultRepository`, and `currentUser`).
  **Tenant access:** Uses `TenantContext.getTenant()` (AsyncLocalStorage-based, available anywhere in the call stack).
  **Steps:**
  1. Find account by ID
  2. Validate `channel_hub_connection_id` is null (error if already registered)
  3. Build payload with `ChannelHubPayloadBuilder.buildConnectionPayload(tenant, channelHubAccount)` using `TenantContext.getTenant()`
  4. Execute the rest flow using the account's `rest_flow_id` directly: `workflowExecutor.execute({ flow_id: account.restFlowId, initial_context: payload })`
  5. Extract `connection_id` from response: `response.toJson()?.data?.context?.channel_hub?.connection_response?.connection?.id`
  6. **On success:** Update account with `channel_hub_connection_id`
  7. **On error (statusCode 400):** Store error in `channel_hub_error` field, log error, set `channel_hub_connection_id` to null
  **Concurrency safeguard:** The update query uses `WHERE channel_hub_connection_id IS NULL` and checks affected rows. If 0 rows affected, another request already registered — return conflict error.

### 2.4 ChannelHubPayloadBuilder

Moved from `packages/kace_cloud_core/src/mail-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js` to `channel-hub-accounts/infrastructure/mappers/`.

**Method signature:** `static buildConnectionPayload(tenant, account)` — accepts a generic interface with `email` and `country_id` properties, so it works for both `ChannelHubAccount` and `MailAccount`.

**Changes from original:**
- `countryId` comes from `account.country_id` (or value object equivalent) instead of hardcoded `'co'`
- `providerAccountId` and `operator.email` come from `account.email` (or `.from_address.value`)
- `operatorId` derives from account type (email channel)

**Migration strategy for mail-accounts:** Both `MailAccountCreator` (line 8) and `MailAccountUpdater` (line 6) import the builder. Update both imports to point to the new location. The generic interface ensures no adapter is needed — `mailAccount` already has `from_address` and can provide `country_id`.

### 2.5 Repository: KnexChannelHubAccountRepository

- Table: `channel_hub_accounts`
- Extends `KnexRepository`
- Methods: save, find, update, delete (soft), search (paginated with filters)

## 3. Backend — Microservice

### 3.1 Structure

```
apps/apiv1/kace_cloud_api_channel_hub/
├── bin/
│   └── channel-hub.js
├── lib/
│   └── channel-hub-stack.ts
├── src/
│   ├── handler.mjs
│   ├── controller.mjs
│   └── schemas.mjs
├── test/
│   └── channel-hub.test.js
├── package.json
├── cdk.json
└── jest.config.js
```

### 3.2 API Endpoints (GET and POST only per cybersecurity policy)

| Method | Resource | Action | Permission |
|--------|----------|--------|------------|
| POST | `/channel-hub` | Create account | ChannelHubCreate |
| GET | `/channel-hub/{id}` | Get account | ChannelHubRead |
| POST | `/channel-hub/{id}` | Update account | ChannelHubUpdate |
| POST | `/channel-hub/{id}/delete` | Soft delete | ChannelHubDelete |
| GET | `/channel-hub` | Search/list | ChannelHubRead |
| POST | `/channel-hub/{id}/register` | Execute rest flow | ChannelHubUpdate |

### 3.3 Joi Schemas

**schemaCreate:**
- email: string, email format, required
- name: string, required
- country_id: string, required
- rest_flow_id: string, UUID format, required

**schemaUpdate:**
- name: string, optional
- country_id: string, optional
- rest_flow_id: string, UUID format, optional
- (email is NOT included — immutable)

### 3.4 Controller

Extends `BaseController`. Action methods:
- `actionCreate()` → ChannelHubAccountCreator
- `actionRead()` → ChannelHubAccountFinder
- `actionUpdate()` → ChannelHubAccountUpdater
- `actionDelete()` → ChannelHubAccountDeleter
- `actionSearch()` → ChannelHubAccountSearcher
- `actionRegister()` → ChannelHubAccountRegistrar

Each action checks permissions via `this.user.hasPermission()`.

**Direct imports (no barrel files):**
```javascript
import { ChannelHubAccountCreator } from '@kace/core/src/channel-hub-accounts/application/create/ChannelHubAccountCreator.js';
import { ChannelHubAccountFinder } from '@kace/core/src/channel-hub-accounts/application/find/ChannelHubAccountFinder.js';
// etc.
```

**Registrar controller setup:**
```javascript
const workflowExecutor = new WorkflowExecutor(
    new KnexWSRestWorkflowStepRepository(knexConfig),
    new KnexAllowedConnectionsRepository(knexConfig),
    new KnexSecretsVaultRepository(knexConfig),
    this.user
);
const registrar = new ChannelHubAccountRegistrar(repository, workflowExecutor);
```

## 4. Frontend

### 4.1 Module structure

```
apps/kace-saas/src/pages/ChannelHub/
├── ChannelHub.jsx
├── ChannelHubHandler.jsx
├── components/
│   ├── channel-hub-table-container.jsx
│   ├── ChannelHubCreate.jsx
│   └── ChannelHubCreateForm.jsx
├── data/
│   └── constants.jsx
├── hooks/
│   └── useActionsChannelHub.js
└── utils/
    └── datatableProcess.js
```

### 4.2 Table columns

| Column | Filterable | Type |
|--------|-----------|------|
| Name | Yes | Text |
| Email | Yes | Text |
| Country | Yes | Select |
| Rest Flow | No | Shows flow description |
| Connection | No | Shows ID or "Sin registrar" |
| Actions | — | View, Edit, Delete, **Register** |

### 4.3 "Register" button behavior

- Only visible when `channel_hub_connection_id` is null
- Calls POST `/channel-hub/{id}/register`
- Shows spinner during execution
- On success: toast confirmation + invalidate query to refresh table
- On error: toast with error message

### 4.4 Form (create/edit)

- **Email**: text input, required, email validation. **Disabled in edit mode**
- **Name**: text input, required
- **Country**: select input, required (co, mx, cl, pe, etc.)
- **Rest Flow**: select input, required. Loaded from ws_rest_flows API

### 4.5 Navigation

In `routes.jsx`, under "Integraciones" group, add:

```javascript
{
    to: "/channel-hub",
    icon: <Cable width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
    name: t("navbar.channel_hub"),
    permissions: { role: "...", entity: "channel_hub", actions: ["ChannelHubRead"] }
}
```

### 4.6 Routes

In `routesDictionary.js`:
- `CHANNEL_HUB`: path `/channel-hub`, metaData `{ url: "/channel-hub", key: "channel_hub", view: "channel_hub" }`
- `CHANNEL_HUB_CREATE`: path `/channel-hub/create`, parentKey `CHANNEL_HUB`
- `CHANNEL_HUB_UPDATE`: path `/channel-hub/update/:id`, parentKey `CHANNEL_HUB`

## 5. Permissions

### 5.1 New permissions

- `ChannelHubCreate` — Create channel hub accounts
- `ChannelHubRead` — View and list channel hub accounts
- `ChannelHubUpdate` — Edit accounts and execute register action
- `ChannelHubDelete` — Soft delete accounts

### 5.2 Backend enforcement

Each controller action validates permissions via `this.user.hasPermission(role, 'channel_hub', actionName)`.

### 5.3 Frontend — Roles form update

Add Channel Hub permission checkboxes to the roles configuration form, following the existing pattern for other modules (Users, Groups, etc.).

## 6. Refactor

### 6.1 Move ChannelHubPayloadBuilder

- **From:** `packages/kace_cloud_core/src/mail-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js`
- **To:** `packages/kace_cloud_core/src/channel-hub-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js`
- **Files to update imports:**
  - `packages/kace_cloud_core/src/mail-accounts/application/create/MailAccountCreator.js` (line 8)
  - `packages/kace_cloud_core/src/mail-accounts/application/update/MailAccountUpdater.js` (line 6)

## 7. Summary of deliverables

1. **Migration**: `channel_hub_accounts` table (id as VARCHAR(36))
2. **Seeder**: Channel Hub rest flow endpoints, flow, and workflow step
3. **@kace/core module**: `channel-hub-accounts` with entity, 6 use cases, repository, payload builder
4. **API microservice**: `kace_cloud_api_channel_hub` (6 endpoints, GET/POST only)
5. **Frontend module**: Table, form, actions, register button
6. **Permissions**: 4 new permissions + roles form update
7. **Refactor**: Move ChannelHubPayloadBuilder from mail-accounts to new module + update 2 import sites

## 8. Testing strategy

- **Use cases:** Unit test each use case (Creator, Finder, Updater, Deleter, Searcher, Registrar)
- **Registrar:** Test happy path (connection_id returned), error path (statusCode 400 → channel_hub_error stored), and concurrency (already registered → conflict)
- **Payload builder:** Test output structure with different tenant/account combinations
- **Controller:** Test permission checks for each action
- **Coverage target:** 90% functions, lines, and statements per CLAUDE.md
