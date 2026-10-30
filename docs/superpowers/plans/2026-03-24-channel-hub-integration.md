# Channel Hub Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Channel Hub integration module with full CRUD + registration via rest flow execution, spanning database, backend domain module, API microservice, and React frontend.

**Architecture:** New `channel_hub_accounts` table stores accounts. Domain module in `@kace/core` follows hexagonal/DDD pattern (entity, use cases, repository). New Lambda microservice exposes 6 endpoints (GET/POST only). React frontend adds a new page under Integraciones with table, form, and register action.

**Tech Stack:** Node.js 22+, PostgreSQL/Knex.js, AWS CDK 2.x, React 18.3, TanStack Query, Formik, Joi, pnpm workspaces.

**Design spec:** `docs/superpowers/specs/2026-03-24-channel-hub-integration-design.md`

---

## File Map

### Database
- **Create:** `packages/kace_cloud_database/migrations/20260324180000_table_channel_hub_accounts.js`
- **Create:** `packages/kace_cloud_database/seeds/20260324180100_channel_hub_rest_flow.js`

### @kace/core — Domain Module
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/domain/ChannelHubAccount.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/domain/ChannelHubAccountFinder.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/application/ChannelHubAccountResponse.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/application/ChannelHubAccountsCollectionResponse.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/application/create/ChannelHubAccountCreator.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/application/find/ChannelHubAccountFinder.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/application/update/ChannelHubAccountUpdater.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/application/delete/ChannelHubAccountDeleter.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/application/search/ChannelHubAccountSearcher.js`
- **Create:** `packages/kace_cloud_core/src/channel-hub-accounts/application/register/ChannelHubAccountRegistrar.js`
- **Modify:** `packages/kace_cloud_core/src/mail-accounts/application/create/MailAccountCreator.js` (line 8 — update import)
- **Modify:** `packages/kace_cloud_core/src/mail-accounts/application/update/MailAccountUpdater.js` (line 6 — update import)
- **Delete:** `packages/kace_cloud_core/src/mail-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js`

### API Microservice
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/package.json`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/cdk.json`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/tsconfig.json`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/jest.config.js`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/.eslintrc.js`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/bin/channel-hub.ts`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/lib/channel-hub-stack.ts`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/src/handler.mjs`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/src/controller.mjs`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/src/schemas.mjs`
- **Create:** `apps/apiv1/kace_cloud_api_channel_hub/test/channel-hub.test.mjs`

### Frontend
- **Create:** `apps/kace-saas/src/pages/ChannelHub/ChannelHub.jsx`
- **Create:** `apps/kace-saas/src/pages/ChannelHub/ChannelHubHandler.jsx`
- **Create:** `apps/kace-saas/src/pages/ChannelHub/components/channel-hub-table-container.jsx`
- **Create:** `apps/kace-saas/src/pages/ChannelHub/components/ChannelHubCreate.jsx`
- **Create:** `apps/kace-saas/src/pages/ChannelHub/components/ChannelHubCreateForm.jsx`
- **Create:** `apps/kace-saas/src/pages/ChannelHub/data/constants.jsx`
- **Create:** `apps/kace-saas/src/pages/ChannelHub/hooks/useActionsChannelHub.js`
- **Create:** `apps/kace-saas/src/pages/ChannelHub/utils/datatableProcess.js`
- **Modify:** `apps/kace-saas/src/utils/urlAndKeys.js` (add channel_hub entry)
- **Modify:** `apps/kace-saas/src/config/routesDictionary.js` (add CHANNEL_HUB routes)
- **Modify:** `apps/kace-saas/src/routes/routes.jsx` (add sidebar item under Integraciones)
- **Modify:** `apps/kace-saas/src/locale/en.json` (add translations)
- **Modify:** `apps/kace-saas/src/locale/es.json` (add translations)

---

## Task 1: Database Migration

**Files:**
- Create: `packages/kace_cloud_database/migrations/20260324180000_table_channel_hub_accounts.js`

- [ ] **Step 1: Create migration file**

```javascript
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
    return knex.schema.createTable('channel_hub_accounts', function (table) {
        table.string('id', 36).primary();
        table.string('email', 255).notNullable();
        table.string('name', 255).notNullable();
        table.string('country_id', 10).notNullable();
        table.string('rest_flow_id', 36).notNullable();
        table.string('channel_hub_connection_id', 255).nullable();
        table.boolean('is_active').notNullable().defaultTo(true);
        table.timestamp('created_at').notNullable();
        table.string('created_by', 36).notNullable();
        table.timestamp('updated_at').notNullable();
        table.string('updated_by', 36).notNullable();
        table.timestamp('deleted_at').nullable();
        table.string('deleted_by', 36).nullable();
        table.jsonb('channel_hub_error').nullable();

        table.foreign('rest_flow_id').references('id').inTable('ws_rest_flows');
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
    return knex.schema.dropTable('channel_hub_accounts');
}
```

- [ ] **Step 2: Run the migration**

Run: `cd packages/kace_cloud_database && pnpm run migrate:latest`
Expected: Migration applies successfully, `channel_hub_accounts` table created.

- [ ] **Step 3: Commit**

```bash
git add packages/kace_cloud_database/migrations/20260324180000_table_channel_hub_accounts.js
git commit -m "feat(database): add channel_hub_accounts table migration"
```

---

## Task 2: Database Seeder

**Files:**
- Create: `packages/kace_cloud_database/seeds/20260324180100_channel_hub_rest_flow.js`

- [ ] **Step 1: Create seeder file**

The seeder embeds the data from `tmp/inserts.sql`, removing schema prefixes.

```javascript
const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WS_REST_FLOWS_TABLE = 'ws_rest_flows';
const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';

const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const CREATED_AT = '2026-03-10 14:42:21.816000 -05:00';

const endpoints = [
    {
        id: '06cf3374-f17b-4109-8d37-b16584f91a73',
        type: 'authorization',
        description: 'Channel Hub - auth',
        url: 'https://ch-tst.auth.eu-west-1.amazoncognito.com/oauth2/token',
        method: 'POST',
        headers: JSON.stringify({ headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: 'Basic SECRET_CHANNEL_HUB_AUTH' } }),
        body: JSON.stringify({ body: { grant_type: 'client_credentials' } }),
        is_dynamic_body: true,
        is_active: true,
        created_at: CREATED_AT,
        created_by: SYSTEM_USER_ID,
        updated_at: CREATED_AT,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: null,
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: ['access_token'] }),
        context_position: 'channel_hub.auth',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
    },
    {
        id: '9867f4fd-67b5-4004-b3dc-4016b6134a8e',
        type: 'consumption',
        description: 'Channel Hub - Obtener connection-id',
        url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/connection/user/context.id',
        method: 'GET',
        headers: JSON.stringify({ headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' } }),
        body: JSON.stringify({ body: {} }),
        is_dynamic_body: true,
        is_active: true,
        created_at: CREATED_AT,
        created_by: SYSTEM_USER_ID,
        updated_at: CREATED_AT,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: '06cf3374-f17b-4109-8d37-b16584f91a73',
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: ['connection'] }),
        context_position: 'channel_hub.connection',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
    },
    {
        id: '22d39ff5-7b42-46b3-93b6-b78c193863ce',
        type: 'consumption',
        description: 'Channel Hub - Crear connection',
        url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/connection/email',
        method: 'POST',
        headers: JSON.stringify({ headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' } }),
        body: JSON.stringify({
            body: {
                user: 'context.channel_hub.user',
                countryId: 'context.channel_hub.countryId',
                customerId: 'context.channel_hub.customerId',
                serviceId: 'context.channel_hub.serviceId',
                channelId: 'context.channel_hub.channelId',
                operatorId: 'context.channel_hub.operatorId',
                providerAccountId: 'context.channel_hub.providerAccountId',
                limits: 'context.channel_hub.limits',
                billing: 'context.channel_hub.billing',
                webhooks: 'context.channel_hub.webhooks',
                serviceOwner: 'context.channel_hub.serviceOwner',
                operator: 'context.channel_hub.operator',
            },
        }),
        is_dynamic_body: true,
        is_active: true,
        created_at: CREATED_AT,
        created_by: SYSTEM_USER_ID,
        updated_at: CREATED_AT,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: '06cf3374-f17b-4109-8d37-b16584f91a73',
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: [] }),
        context_position: 'channel_hub.connection_response',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
    },
];

const flow = {
    id: '4f7f9d13-65b9-445d-a839-d8e0ece2ed03',
    description: 'Channel Hub - Crear conexion',
    is_active: true,
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: '2026-03-24 18:21:43.072000 -05:00',
    updated_by: '8a09ba2c-0231-4cc3-b02d-5b90054d6f90',
    deleted_at: null,
    deleted_by: null,
    external_code: 'channelhub-connection',
    json_diagram_properties: JSON.stringify({
        edges: [{ id: 'reactflow__edge-0-6957b09d-8634-4d13-986e-f54b3edb86c5', data: { is_visible: true }, type: 'custom', source: '0', target: '6957b09d-8634-4d13-986e-f54b3edb86c5', sourceHandle: null, targetHandle: null }],
        nodes: [
            { id: '0', data: { label: 'inicio' }, type: 'input', width: 150, height: 40, dragging: false, position: { x: 225, y: 75 }, selected: false, positionAbsolute: { x: 0, y: 0 } },
            { id: '6957b09d-8634-4d13-986e-f54b3edb86c5', data: { id: '22d39ff5-7b42-46b3-93b6-b78c193863ce', type: 'endpoint', label: 'Channel Hub - Crear connection' }, style: { color: 'black', wordBreak: 'break-word', backgroundColor: 'rgb(232, 196, 104)' }, width: 150, height: 58, dragging: false, position: { x: 219.51250000000005, y: 231 }, selected: false, positionAbsolute: { x: 219.51250000000005, y: 231 } },
        ],
    }),
    is_primary: true,
    initial_context: null,
};

const workflowStep = {
    id: '4fb9911e-d208-46ef-954f-f533d7220bae',
    flow_id: '4f7f9d13-65b9-445d-a839-d8e0ece2ed03',
    order: 1,
    endpoint_id: '22d39ff5-7b42-46b3-93b6-b78c193863ce',
    function_id: null,
    created_at: CREATED_AT,
    created_by: SYSTEM_USER_ID,
    updated_at: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    parent_step_id: null,
    conditional_id: null,
};

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    await knex(WS_REST_ENDPOINTS_TABLE).insert(endpoints);
    await knex(WS_REST_FLOWS_TABLE).insert(flow);
    await knex(WS_REST_WORKFLOW_STEPS_TABLE).insert(workflowStep);
}
```

- [ ] **Step 2: Run the seeder**

Run: `cd packages/kace_cloud_database && pnpm run seed:fresh`
Expected: Seed data inserts successfully.

- [ ] **Step 3: Commit**

```bash
git add packages/kace_cloud_database/seeds/20260324180100_channel_hub_rest_flow.js
git commit -m "feat(database): add Channel Hub rest flow seeder"
```

---

## Task 3: Domain Entity and Domain Finder

**Files:**
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/domain/ChannelHubAccount.js`
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/domain/ChannelHubAccountFinder.js`

- [ ] **Step 1: Create ChannelHubAccount entity**

**IMPORTANT:** The entity delegates audit fields (`created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`) to `AggregateRoot` via its setters — do NOT redeclare them as private fields. The `super()` call receives the raw ID value, not a `ValueObjectUuid`. The entity does NOT override `update()` or `delete()` — it inherits them from `AggregateRoot` which handles change tracking.

```javascript
import { AggregateRoot, ValueObjectBoolean, ValueObjectString } from '../../shared/index.js';
import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid.js';
import { ValueObjectJson } from '../../shared/domain/value-object/ValueObjectJson.js';

export class ChannelHubAccount extends AggregateRoot {
    /** @type {ValueObjectString} */
    #email;
    /** @type {ValueObjectString} */
    #name;
    /** @type {ValueObjectString} */
    #country_id;
    /** @type {ValueObjectUuid} */
    #rest_flow_id;
    /** @type {ValueObjectString} */
    #channel_hub_connection_id;
    /** @type {ValueObjectBoolean} */
    #is_active;
    /** @type {ValueObjectJson} */
    #channel_hub_error;

    constructor(data) {
        super(data.id);
        this.#email = new ValueObjectString('email', data.email);
        this.#name = new ValueObjectString('name', data.name);
        this.#country_id = new ValueObjectString('country_id', data.country_id);
        this.#rest_flow_id = new ValueObjectUuid('rest_flow_id', data.rest_flow_id);
        this.#channel_hub_connection_id = new ValueObjectString('channel_hub_connection_id', data.channel_hub_connection_id);
        this.#is_active = new ValueObjectBoolean('is_active', data.is_active ?? true);
        this.#channel_hub_error = new ValueObjectJson('channel_hub_error', data.channel_hub_error);

        // Delegate audit fields to AggregateRoot via setters
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.deleted_at = data.deleted_at;
        this.created_by = data.created_by;
        this.updated_by = data.updated_by;
        this.deleted_by = data.deleted_by;
    }

    static create(dto) {
        return new ChannelHubAccount(dto);
    }

    get email() { return this.#email; }
    get name() { return this.#name; }
    get country_id() { return this.#country_id; }
    get rest_flow_id() { return this.#rest_flow_id; }
    get channel_hub_connection_id() { return this.#channel_hub_connection_id; }
    get is_active() { return this.#is_active; }
    get channel_hub_error() { return this.#channel_hub_error; }

    // update() and delete() are inherited from AggregateRoot — do NOT override them.
    // AggregateRoot.update(dto) iterates dto entries and uses setters with change tracking.
    // AggregateRoot.delete(dto) validates and sets deleted_at/deleted_by via tracked setters.

    toJson() {
        return {
            id: this.id.value,
            email: this.#email.value,
            name: this.#name.value,
            country_id: this.#country_id.value,
            rest_flow_id: this.#rest_flow_id.value,
            channel_hub_connection_id: this.#channel_hub_connection_id.value,
            is_active: this.#is_active.value,
            created_at: this.created_at?.value,
            created_by: this.created_by?.value,
            updated_at: this.updated_at?.value,
            updated_by: this.updated_by?.value,
            deleted_at: this.deleted_at?.value,
            deleted_by: this.deleted_by?.value,
            channel_hub_error: this.#channel_hub_error.value,
        };
    }
}
```

- [ ] **Step 2: Create domain ChannelHubAccountFinder**

```javascript
import { ValueObjectUuid } from '../../shared/index.js';

export class ChannelHubAccountFinder {
    /** @type {KnexChannelHubAccountRepository} */
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(id) {
        return this.#repository.find(new ValueObjectUuid('id', id));
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/kace_cloud_core/src/channel-hub-accounts/domain/
git commit -m "feat(core): add ChannelHubAccount entity and domain finder"
```

---

## Task 4: Repository

**Files:**
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js`

- [ ] **Step 1: Create repository**

```javascript
import { ChannelHubAccount } from '../../domain/ChannelHubAccount.js';
import { KnexRepository } from '../../../shared/infrastructure/persistence/KnexRepository.js';
import { Helper } from '../../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../../shared/errors/QueryDBError.js';

export class KnexChannelHubAccountRepository extends KnexRepository {
    constructor(config) {
        super(config, 'channel_hub_accounts');
    }

    async save(account) {
        try {
            await this.connection(this.tableName).insert({
                id: account.id.value,
                email: account.email.value,
                name: account.name.value,
                country_id: account.country_id.value,
                rest_flow_id: account.rest_flow_id.value,
                channel_hub_connection_id: account.channel_hub_connection_id.value,
                is_active: account.is_active.value,
                created_at: account.created_at.value,
                created_by: account.created_by.value,
                updated_at: account.updated_at.value,
                updated_by: account.updated_by.value,
                channel_hub_error: account.channel_hub_error.value ? JSON.stringify(account.channel_hub_error.value) : null,
            });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('save');
        }
    }

    async find(id) {
        try {
            const result = await this.connection(this.tableName)
                .where({ id: id.value })
                .whereNull('deleted_at')
                .first('*');
            return !result ? null : new ChannelHubAccount(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }

    async update(account) {
        try {
            await this.connection(this.tableName)
                .where({ id: account.id.value })
                .update({
                    name: account.name.value,
                    country_id: account.country_id.value,
                    rest_flow_id: account.rest_flow_id.value,
                    channel_hub_connection_id: account.channel_hub_connection_id.value,
                    is_active: account.is_active.value,
                    updated_at: account.updated_at.value,
                    updated_by: account.updated_by.value,
                    channel_hub_error: account.channel_hub_error.value ? JSON.stringify(account.channel_hub_error.value) : null,
                });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('update');
        }
    }

    async delete(account) {
        try {
            await this.connection(this.tableName)
                .where({ id: account.id.value })
                .update({
                    deleted_at: account.deleted_at.value,
                    deleted_by: account.deleted_by.value,
                    updated_at: account.updated_at.value,
                    updated_by: account.updated_by.value,
                });
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('delete');
        }
    }

    async search(criteria) {
        try {
            const queryBuilder = this.connection(this.tableName).select('*');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_at');
            const rows = await queryBuilder;
            return rows.map((row) => new ChannelHubAccount(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('search');
        }
    }

    async count(criteria) {
        try {
            const queryBuilder = this.connection(this.tableName).count('* as count');
            criteria.convertToKnex(queryBuilder);
            queryBuilder.whereNull('deleted_at');
            const rows = await queryBuilder;
            return rows[0].count;
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('count');
        }
    }

    async findByEmail(email) {
        try {
            const result = await this.connection(this.tableName)
                .where({ email })
                .whereNull('deleted_at')
                .first();
            return !result ? null : new ChannelHubAccount(result);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByEmail');
        }
    }

    async updateConnectionId(id, connectionId, error, updatedAt, updatedBy) {
        try {
            const affectedRows = await this.connection(this.tableName)
                .where({ id })
                .whereNull('channel_hub_connection_id')
                .update({
                    channel_hub_connection_id: connectionId,
                    channel_hub_error: error ? JSON.stringify(error) : null,
                    updated_at: updatedAt,
                    updated_by: updatedBy,
                });
            return affectedRows;
        } catch (err) {
            Helper.logError(err.message, err);
            throw new QueryDBError('updateConnectionId');
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/kace_cloud_core/src/channel-hub-accounts/infrastructure/persistence/
git commit -m "feat(core): add KnexChannelHubAccountRepository"
```

---

## Task 5: Move and Adapt ChannelHubPayloadBuilder

**Files:**
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js`
- Modify: `packages/kace_cloud_core/src/mail-accounts/application/create/MailAccountCreator.js` (line 8)
- Modify: `packages/kace_cloud_core/src/mail-accounts/application/update/MailAccountUpdater.js` (line 6)
- Delete: `packages/kace_cloud_core/src/mail-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js`

- [ ] **Step 1: Create adapted ChannelHubPayloadBuilder in new location**

The builder accepts a generic interface — `account` must have an `email` property (either direct string or `.from_address.value` for mail accounts) and a `country_id` property.

```javascript
export class ChannelHubPayloadBuilder {
    /**
     * @param {Object} tenant - Tenant context object
     * @param {Object} account - Account with email and country_id (ChannelHubAccount or MailAccount)
     * @return {Object} Channel Hub connection payload
     */
    static buildConnectionPayload(tenant, account) {
        const email = account.from_address?.value ?? account.email?.value ?? account.email;
        const countryId = account.country_id?.value ?? 'co';
        const operatorId = account.channelHubAccountType ? account.channelHubAccountType() : 'imap';

        return {
            user: tenant.channel_hub_user.value,
            countryId,
            customerId: tenant.apps_service_name.value,
            serviceId: tenant.apps_service_name.value,
            channelId: 'email',
            operatorId,
            providerAccountId: email,
            limits: {
                messagesPerDay: 0,
                clientsPerDay: 0,
            },
            billing: {
                costPerMessage: '0.34',
            },
            webhooks: [
                {
                    redirectionMessageWebhook: `${tenant.apiUrl()}/webhook`,
                    redirectionStatusWebhook: '',
                    webhookParams: '',
                    webhookHeaders: `x-tenant-id = ${tenant.id.value}, x-api-key = ${tenant.webhook_api_key.value}`,
                    nameWebhook: 'main',
                },
            ],
            serviceOwner: tenant.apps_service_name.value,
            operator: {
                email,
                isSendOnly: false,
                userFoldersToExclude: [],
            },
        };
    }
}
```

- [ ] **Step 2: Update import in MailAccountCreator.js (line 8)**

Change:
```javascript
import { ChannelHubPayloadBuilder } from '../../infrastructure/mappers/ChannelHubPayloadBuilder.js';
```
To:
```javascript
import { ChannelHubPayloadBuilder } from '../../../channel-hub-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js';
```

- [ ] **Step 3: Update import in MailAccountUpdater.js (line 6)**

Change:
```javascript
import { ChannelHubPayloadBuilder } from '../../infrastructure/mappers/ChannelHubPayloadBuilder.js';
```
To:
```javascript
import { ChannelHubPayloadBuilder } from '../../../channel-hub-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js';
```

- [ ] **Step 4: Delete old file**

```bash
rm packages/kace_cloud_core/src/mail-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js
```

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_core/src/channel-hub-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js
git add packages/kace_cloud_core/src/mail-accounts/application/create/MailAccountCreator.js
git add packages/kace_cloud_core/src/mail-accounts/application/update/MailAccountUpdater.js
git rm packages/kace_cloud_core/src/mail-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js
git commit -m "refactor(core): move ChannelHubPayloadBuilder to channel-hub-accounts module"
```

---

## Task 6: Application Use Cases (CRUD)

**Files:**
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/application/ChannelHubAccountResponse.js`
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/application/ChannelHubAccountsCollectionResponse.js`
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/application/create/ChannelHubAccountCreator.js`
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/application/find/ChannelHubAccountFinder.js`
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/application/update/ChannelHubAccountUpdater.js`
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/application/delete/ChannelHubAccountDeleter.js`
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/application/search/ChannelHubAccountSearcher.js`

- [ ] **Step 1: Create ChannelHubAccountResponse DTO**

```javascript
export class ChannelHubAccountResponse {
    #account;

    constructor(account) {
        this.#account = account;
    }

    toJson() {
        if (!this.#account) return {};
        return {
            data: {
                id: this.#account.id.value,
                email: this.#account.email.value,
                name: this.#account.name.value,
                country_id: this.#account.country_id.value,
                rest_flow_id: this.#account.rest_flow_id.value,
                channel_hub_connection_id: this.#account.channel_hub_connection_id.value,
                is_active: this.#account.is_active.value,
                channel_hub_error: this.#account.channel_hub_error.value,
                created_at: this.#account.created_at.value,
                updated_at: this.#account.updated_at.value,
                created_by: this.#account.created_by.value,
                updated_by: this.#account.updated_by.value,
            },
        };
    }
}
```

- [ ] **Step 2: Create ChannelHubAccountsCollectionResponse**

```javascript
import { ChannelHubAccountResponse } from './ChannelHubAccountResponse.js';

export class ChannelHubAccountsCollectionResponse {
    #collection;
    #count;

    constructor(collection, count) {
        this.#collection = collection;
        this.#count = count;
    }

    toJson() {
        return {
            data: {
                items: this.#collection.map(
                    (account) => new ChannelHubAccountResponse(account).toJson().data
                ),
            },
            metadata: {
                count: this.#count,
            },
        };
    }
}
```

- [ ] **Step 3: Create ChannelHubAccountCreator**

```javascript
import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccount } from '../../domain/ChannelHubAccount.js';

export class ChannelHubAccountCreator {
    #repository;

    constructor(repository) {
        this.#repository = repository;
    }

    async execute(dto) {
        const account = ChannelHubAccount.create(dto);

        const existing = await this.#repository.findByEmail(dto.email);
        if (existing) {
            throw new CustomError(`Channel Hub account with email ${dto.email} already exists`, 400);
        }

        await this.#repository.save(account);
    }
}
```

- [ ] **Step 4: Create ChannelHubAccountFinder (application layer)**

```javascript
import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccountFinder as DomainFinder } from '../../domain/ChannelHubAccountFinder.js';
import { ChannelHubAccountResponse } from '../ChannelHubAccountResponse.js';

export class ChannelHubAccountFinder {
    #finder;

    constructor(repository) {
        this.#finder = new DomainFinder(repository);
    }

    async execute(id) {
        const account = await this.#finder.execute(id);

        if (!account || account.isDeleted()) {
            throw new CustomError('Channel Hub account not found', 404);
        }

        return new ChannelHubAccountResponse(account);
    }
}
```

- [ ] **Step 5: Create ChannelHubAccountUpdater**

```javascript
import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccountFinder as DomainFinder } from '../../domain/ChannelHubAccountFinder.js';

export class ChannelHubAccountUpdater {
    #finder;
    #repository;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainFinder(repository);
    }

    async execute(id, dto) {
        const account = await this.#finder.execute(id);

        if (!account) {
            throw new CustomError('The Channel Hub account you are trying to update does not exist', 404);
        }

        account.update(dto);
        await this.#repository.update(account);
    }
}
```

- [ ] **Step 6: Create ChannelHubAccountDeleter**

```javascript
import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccountFinder as DomainFinder } from '../../domain/ChannelHubAccountFinder.js';

export class ChannelHubAccountDeleter {
    #finder;
    #repository;

    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainFinder(repository);
    }

    async execute(id, dto) {
        const account = await this.#finder.execute(id);

        if (!account) {
            throw new CustomError('The Channel Hub account you are trying to delete does not exist', 404);
        }

        account.delete(dto);
        await this.#repository.delete(account);
    }
}
```

- [ ] **Step 7: Create ChannelHubAccountSearcher**

```javascript
import { Criteria } from '../../../shared/criteria/Criteria.js';
import { Counter } from '../../../shared/domain/Counter.js';
import { ChannelHubAccountsCollectionResponse } from '../ChannelHubAccountsCollectionResponse.js';

export class ChannelHubAccountSearcher {
    #repository;
    #counter;

    constructor(repository) {
        this.#repository = repository;
        this.#counter = new Counter(repository);
    }

    async execute(dtoCriteria) {
        const tablename = this.#repository.tableName;
        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationship,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            tablename
        );
        const rows = await this.#repository.search(criteria);
        const count = await this.#counter.execute({
            filter: dtoCriteria.filter,
            relationship: dtoCriteria.relationship,
        });

        return new ChannelHubAccountsCollectionResponse(rows, count);
    }
}
```

- [ ] **Step 8: Commit**

```bash
git add packages/kace_cloud_core/src/channel-hub-accounts/application/
git commit -m "feat(core): add Channel Hub account CRUD use cases"
```

---

## Task 7: Registrar Use Case

**Files:**
- Create: `packages/kace_cloud_core/src/channel-hub-accounts/application/register/ChannelHubAccountRegistrar.js`

- [ ] **Step 1: Create ChannelHubAccountRegistrar**

```javascript
import { CustomError } from '../../../shared/errors/CustomError.js';
import { ChannelHubAccountFinder as DomainFinder } from '../../domain/ChannelHubAccountFinder.js';
import { ChannelHubPayloadBuilder } from '../../infrastructure/mappers/ChannelHubPayloadBuilder.js';
import { TenantContext } from '../../../shared/infrastructure/context/TenantContext.js';
import { Helper } from '../../../shared/index.js';

export class ChannelHubAccountRegistrar {
    #repository;
    #finder;
    #workflowExecutor;

    constructor(repository, workflowExecutor) {
        this.#repository = repository;
        this.#finder = new DomainFinder(repository);
        this.#workflowExecutor = workflowExecutor;
    }

    async execute(id, currentUserId) {
        const account = await this.#finder.execute(id);

        if (!account) {
            throw new CustomError('Channel Hub account not found', 404);
        }

        if (account.channel_hub_connection_id.value) {
            throw new CustomError('This account is already registered in Channel Hub', 409);
        }

        const tenant = TenantContext.getTenant();
        const payload = ChannelHubPayloadBuilder.buildConnectionPayload(tenant, account);
        const initial_context = {
            channel_hub: {
                ...payload,
                connection_id: account.channel_hub_connection_id.value,
            },
        };

        Helper.logDebug('ChannelHubAccountRegistrar::BeginWorkflowExecution::InitialContext', initial_context);

        const response = await this.#workflowExecutor.execute({
            flow_id: account.rest_flow_id.value,
            initial_context,
        });

        Helper.logDebug('ChannelHubAccountRegistrar::BeginWorkflowExecution::Response', response.toJson());

        const connectionResponse = response.toJson()?.data?.context?.channel_hub?.connection_response;
        const now = new Date();

        if (connectionResponse?.statusCode && connectionResponse.statusCode === 400) {
            Helper.logError('ChannelHubAccountRegistrar::WorkflowExecution::Response::Error', connectionResponse);

            await this.#repository.updateConnectionId(
                account.id.value,
                null,
                connectionResponse,
                now,
                currentUserId
            );

            throw new CustomError('Channel Hub registration failed', 400);
        }

        const connectionId = connectionResponse?.connection?.id;
        if (!connectionId) {
            throw new CustomError('Channel Hub did not return a connection id', 500);
        }

        const affectedRows = await this.#repository.updateConnectionId(
            account.id.value,
            connectionId,
            null,
            now,
            currentUserId
        );

        if (affectedRows === 0) {
            throw new CustomError('Account was already registered by another request', 409);
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/kace_cloud_core/src/channel-hub-accounts/application/register/
git commit -m "feat(core): add ChannelHubAccountRegistrar use case"
```

---

## Task 8: API Microservice Scaffold

**Files:**
- Create: `apps/apiv1/kace_cloud_api_channel_hub/package.json`
- Create: `apps/apiv1/kace_cloud_api_channel_hub/cdk.json`
- Create: `apps/apiv1/kace_cloud_api_channel_hub/tsconfig.json`
- Create: `apps/apiv1/kace_cloud_api_channel_hub/jest.config.js`
- Create: `apps/apiv1/kace_cloud_api_channel_hub/.eslintrc.js`
- Create: `apps/apiv1/kace_cloud_api_channel_hub/bin/channel-hub.ts`
- Create: `apps/apiv1/kace_cloud_api_channel_hub/lib/channel-hub-stack.ts`

- [ ] **Step 1: Create package.json**

```json
{
    "name": "@kace/api-channel-hub",
    "version": "1.0.0",
    "bin": {
        "channel_hub": "bin/channel-hub.js"
    },
    "scripts": {
        "build": "tsc",
        "watch": "tsc -w",
        "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js --detectOpenHandles --forceExit",
        "cdk": "cdk",
        "api": "pnpm run cdk:synth && sam local start-api -t cdk.out/ChannelHubStack.template.json --docker-network kace_cloud_main_global-network --port 60095",
        "cdk:synth": "rm -rf cdk.out && cdk synth",
        "cdk:deploy": "cdk deploy --require-approval never",
        "version:patch": "pnpm version patch -m \"Upgrade to %s\" && git push --follow-tags",
        "version:minor": "pnpm version minor -m \"Upgrade to %s\" && git push --follow-tags",
        "version:major": "pnpm version major -m \"Upgrade to %s\" && git push --follow-tags",
        "predeploy:audit": "pnpm audit --omit=dev",
        "eslint-check": "eslint .",
        "eslint-fix": "eslint --fix .",
        "format": "prettier --write .",
        "format:check": "prettier --check .",
        "cdk:clean": "rm -rf cdk.out"
    },
    "devDependencies": {
        "@types/jest": "^29.5.12",
        "@types/node": "20.14.9",
        "aws-cdk": "^2.1005.0",
        "chance": "^1.1.12",
        "dotenv": "^16.4.7",
        "jest": "^29.7.0",
        "ts-jest": "^29.1.5",
        "ts-node": "^10.9.2",
        "typescript": "~5.5.3",
        "@kace/prettier_config": "workspace:*",
        "prettier": "^3.3.3"
    },
    "dependencies": {
        "@kace/api-common": "workspace:*",
        "@kace/aws-infra": "workspace:*",
        "@kace/core": "workspace:*",
        "@kace/database": "workspace:*",
        "@kace/eslint-config": "workspace:*",
        "@kace/prettier_config": "workspace:*",
        "aws-cdk-lib": "^2.185.0",
        "axios": "^1.7.9",
        "constructs": "^10.0.0",
        "joi": "^17.13.3",
        "pg": "^8.16.3",
        "source-map-support": "^0.5.21",
        "uuid": "^11.0.3"
    }
}
```

- [ ] **Step 2: Create cdk.json**

Copy from `apps/apiv1/kace_cloud_api_automation_settings/cdk.json` but change:
- `"app"` to `"npx ts-node --prefer-ts-exts bin/channel-hub.ts"`

- [ ] **Step 3: Create tsconfig.json**

Same as `apps/apiv1/kace_cloud_api_automation_settings/tsconfig.json` (no changes).

- [ ] **Step 4: Create jest.config.js**

```javascript
const dotenv = require('dotenv');

dotenv.config({ path: '../../../.env' });

module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.mjs'],
    transform: {},
    testTimeout: 30000,
};
```

- [ ] **Step 5: Create .eslintrc.js**

```javascript
module.exports = {
    extends: ['@kace/eslint-config'],
};
```

- [ ] **Step 6: Create bin/channel-hub.ts**

```typescript
import { ChannelHubStack } from '../lib/channel-hub-stack';
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

new ChannelHubStack(app, 'ChannelHubStack', props, kProps);
```

- [ ] **Step 7: Create lib/channel-hub-stack.ts**

**IMPORTANT:** `setDefaultOptions()` only creates standard CRUD routes (GET /, POST /, GET /{id}, POST /{id}, GET /{id}/delete, POST /search, POST /{id}/history, POST /advance-search). We need to manually add the `POST /{id}/register` route and change `/{id}/delete` from GET to POST.

```typescript
import { StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { KApiStack, KApiStackProps } from '@kace/aws-infra/src/KApiStack';

export class ChannelHubStack extends KApiStack {
    constructor(scope: Construct, id: string, props: StackProps, kProps: KApiStackProps) {
        super(scope, id, props, kProps);

        // Set up standard routes + lambda
        this.setDefaultOptions('channel-hub');

        // Add custom POST /{id}/register route
        // The KApiStack exposes the rest API and lambda function after setDefaultOptions
        // Add the register resource as a child of the {id} resource
        const api = this.getRestApi();
        const idResource = api.root.getResource('{id}');
        if (idResource) {
            const registerResource = idResource.addResource('register');
            registerResource.addMethod('POST', this.getLambdaIntegration(), this.getLambdaRestApiMethodOptions());
        }
    }
}
```

**Note:** Verify the exact method names (`getRestApi()`, `getLambdaIntegration()`, `getLambdaRestApiMethodOptions()`) from `KApiStack` at implementation time. The `/{id}/delete` route is already handled by remapping `POST → GET` in handler.mjs, so no CDK change is needed for it.

- [ ] **Step 8: Run pnpm install from root**

Run: `cd /home/magbeto/code/konecta/kace_cloud_main && pnpm install`
Expected: New workspace is detected and linked.

- [ ] **Step 9: Commit**

```bash
git add apps/apiv1/kace_cloud_api_channel_hub/
git commit -m "feat(api): scaffold kace_cloud_api_channel_hub microservice"
```

---

## Task 9: API Handler, Controller, and Schemas

**Files:**
- Create: `apps/apiv1/kace_cloud_api_channel_hub/src/handler.mjs`
- Create: `apps/apiv1/kace_cloud_api_channel_hub/src/controller.mjs`
- Create: `apps/apiv1/kace_cloud_api_channel_hub/src/schemas.mjs`

- [ ] **Step 1: Create handler.mjs**

The handler remaps custom routes (`/{id}/register` and `/{id}/delete` as POST) to the controller. Since `BaseController.#actions()` is private and has fixed routing, we handle the `register` action by calling it directly on the controller after `run()` for standard routes.

Approach: Override routing in handler for custom routes, delegate standard routes to controller.run().

```javascript
import { withTenantContext } from '@kace/api-common';
import { Controller } from './controller.mjs';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;

    const resource = event.resource;
    const method = event.httpMethod;

    if (method === 'POST' && resource === '/{id}/register') {
        const controller = new Controller(event, knexConfig);
        const response = await controller.runRegister();
        return response.toJson();
    }

    if (method === 'POST' && resource === '/{id}/delete') {
        event.resource = '/{id}/delete';
        event.httpMethod = 'GET';
    }

    const controller = new Controller(event, knexConfig);
    const response = await controller.run();
    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
```

- [ ] **Step 2: Create schemas.mjs**

```javascript
import Joi from 'joi';

export const ChannelHubCreateSchema = Joi.object({
    id: Joi.string().uuid().required(),
    email: Joi.string().email().required(),
    name: Joi.string().required(),
    country_id: Joi.string().max(10).required(),
    rest_flow_id: Joi.string().uuid().required(),
    is_active: Joi.boolean().default(true),
    created_at: Joi.date().required(),
    created_by: Joi.string().uuid().required(),
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().required(),
});

export const ChannelHubUpdateSchema = Joi.object({
    name: Joi.string().optional(),
    country_id: Joi.string().max(10).optional(),
    rest_flow_id: Joi.string().uuid().optional(),
    updated_at: Joi.date().required(),
    updated_by: Joi.string().uuid().required(),
});
```

- [ ] **Step 3: Create controller.mjs**

```javascript
import { BaseController, HttpResponse } from '@kace/api-common';
import { ChannelHubCreateSchema, ChannelHubUpdateSchema } from './schemas.mjs';
import { SearchSchema } from '@kace/api-common/src/validation/schemas/SearchSchema';

import { ChannelHubAccountCreator } from '@kace/core/src/channel-hub-accounts/application/create/ChannelHubAccountCreator.js';
import { ChannelHubAccountDeleter } from '@kace/core/src/channel-hub-accounts/application/delete/ChannelHubAccountDeleter.js';
import { ChannelHubAccountFinder } from '@kace/core/src/channel-hub-accounts/application/find/ChannelHubAccountFinder.js';
import { ChannelHubAccountSearcher } from '@kace/core/src/channel-hub-accounts/application/search/ChannelHubAccountSearcher.js';
import { ChannelHubAccountUpdater } from '@kace/core/src/channel-hub-accounts/application/update/ChannelHubAccountUpdater.js';
import { ChannelHubAccountRegistrar } from '@kace/core/src/channel-hub-accounts/application/register/ChannelHubAccountRegistrar.js';
import { KnexChannelHubAccountRepository } from '@kace/core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js';
import { WorkflowExecutor } from '@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor.js';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository.js';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';

import { Helper } from '@kace/core/src/shared/index.js';
import { v4 as uuidv4 } from 'uuid';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexChannelHubAccountRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'channel-hub', 'ChannelHubCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = this.payload();
            payload.id = uuidv4();
            payload.created_at = this.started_at;
            payload.created_by = this.user.id.value;
            payload.updated_at = this.started_at;
            payload.updated_by = this.user.id.value;

            const { value, error } = ChannelHubCreateSchema.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            await new ChannelHubAccountCreator(this.repository).execute(value);

            return HttpResponse.created({ event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'channel-hub', 'ChannelHubUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const payload = this.payload();
            payload.updated_at = new Date();
            payload.updated_by = this.user.id.value;

            const { value, error } = ChannelHubUpdateSchema.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            await new ChannelHubAccountUpdater(this.repository).execute(id, value);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin actionDelete');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'channel-hub', 'ChannelHubDelete');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const now = new Date();
            const dto = {
                updated_at: now,
                updated_by: this.user.id.value,
                deleted_at: now,
                deleted_by: this.user.id.value,
            };

            await new ChannelHubAccountDeleter(this.repository).execute(id, dto);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'channel-hub', 'ChannelHubRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const response = await new ChannelHubAccountFinder(this.repository).execute(id);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'channel-hub', 'ChannelHubRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const dtoCriteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            const response = await new ChannelHubAccountSearcher(this.repository).execute(dtoCriteria);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionIndex');
        }
    }

    async actionSearch() {
        Helper.logInfo('Begin actionSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'channel-hub', 'ChannelHubRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const { value, error } = SearchSchema.validate(this.payload(), { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            const response = await new ChannelHubAccountSearcher(this.repository).execute(value);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async runRegister() {
        Helper.logInfo('Begin runRegister');
        try {
            this.user = await this.getLoggedInUser();
        } catch (error) {
            Helper.logError('Error getLoggedInUser', error);
            return HttpResponse.badRequest({ message: error.message, errors: error, event: this.event });
        }

        try {
            const hasPermission = this.user.hasPermission('administrador', 'channel-hub', 'ChannelHubUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to register this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const workflowExecutor = new WorkflowExecutor(
                new KnexWSRestWorkflowStepRepository(this.database_connection),
                new KnexAllowedConnectionsRepository(this.database_connection),
                new KnexSecretsVaultRepository(this.database_connection),
                this.user
            );

            const registrar = new ChannelHubAccountRegistrar(this.repository, workflowExecutor);
            await registrar.execute(id, this.user.id.value);

            return HttpResponse.ok({ message: 'Account registered successfully', event: this.event });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            await this.destroyDbConnection();
            Helper.logInfo('End runRegister');
        }
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/apiv1/kace_cloud_api_channel_hub/src/
git commit -m "feat(api): add Channel Hub handler, controller, and schemas"
```

---

## Task 10: Frontend — URL Keys, Routes, Navigation, and i18n

**Files:**
- Modify: `apps/kace-saas/src/utils/urlAndKeys.js`
- Modify: `apps/kace-saas/src/config/routesDictionary.js`
- Modify: `apps/kace-saas/src/routes/routes.jsx`
- Modify: `apps/kace-saas/src/locale/en.json`
- Modify: `apps/kace-saas/src/locale/es.json`

- [ ] **Step 1: Add channel_hub to urlAndKeys.js**

Add after the `broker_mappers` entry:

```javascript
channel_hub: {
    url: "/channel-hub",
    key: "channel-hub",
    view: "channel_hub_accounts",
    entity: "channel_hub_accounts",
},
```

- [ ] **Step 2: Add routes to routesDictionary.js**

Add the import at the top of the file:

```javascript
import ChannelHub from "@/pages/ChannelHub/ChannelHub";
import ChannelHubCreate from "@/pages/ChannelHub/components/ChannelHubCreate";
```

Add the route entries (after BROKER_MAPPERS_UPDATE):

```javascript
CHANNEL_HUB: {
    path: "/channel-hub",
    metaData: null,
    parentKey: null,
    Component: ChannelHub,
},
CHANNEL_HUB_CREATE: {
    path: "/channel-hub/create",
    metaData: null,
    parentKey: "CHANNEL_HUB",
    Component: ChannelHubCreate,
},
CHANNEL_HUB_UPDATE: {
    path: "/channel-hub/update/:id",
    metaData: null,
    parentKey: "CHANNEL_HUB",
    Component: ChannelHubCreate,
},
```

- [ ] **Step 3: Add sidebar item to routes.jsx**

In the Integraciones (brokers) items array, add after the broker_mappers entry:

```javascript
{
    to: "/channel-hub",
    icon: <Cable width={SIZE_CHILDREN} height={SIZE_CHILDREN} />,
    name: t("navbar.channel_hub"),
    permissions: {
        moduleId: ["channel-hub"],
        permissions: ["ChannelHubRead"],
    },
},
```

Add `Cable` to the lucide-react import at the top of the file.

- [ ] **Step 4: Add i18n translations to es.json**

In the `navbar` object add:
```json
"channel_hub": "Channel Hub"
```

In the `modulesNames` object add:
```json
"channel-hub": "Channel Hub"
```

Add a new `channelHub` section:
```json
"channelHub": {
    "title": "Channel Hub",
    "email": "Correo electrónico",
    "name": "Nombre",
    "country_id": "País",
    "rest_flow_id": "Rest Flow",
    "channel_hub_connection_id": "Conexión CH",
    "not_registered": "Sin registrar",
    "register": "Registrar",
    "register_success": "Cuenta registrada exitosamente",
    "register_error": "Error al registrar la cuenta",
    "saved": "Cuenta guardada exitosamente",
    "error": "Error al guardar la cuenta",
    "basicInformation": "Información básica",
    "connectionDetails": "Detalles de conexión"
}
```

- [ ] **Step 5: Add i18n translations to en.json**

Same keys as es.json but in English:
```json
"channelHub": {
    "title": "Channel Hub",
    "email": "Email",
    "name": "Name",
    "country_id": "Country",
    "rest_flow_id": "Rest Flow",
    "channel_hub_connection_id": "CH Connection",
    "not_registered": "Not registered",
    "register": "Register",
    "register_success": "Account registered successfully",
    "register_error": "Error registering account",
    "saved": "Account saved successfully",
    "error": "Error saving account",
    "basicInformation": "Basic information",
    "connectionDetails": "Connection details"
}
```

Add `"channel_hub": "Channel Hub"` in `navbar` and `"channel-hub": "Channel Hub"` in `modulesNames`.

- [ ] **Step 6: Commit**

```bash
git add apps/kace-saas/src/utils/urlAndKeys.js
git add apps/kace-saas/src/config/routesDictionary.js
git add apps/kace-saas/src/routes/routes.jsx
git add apps/kace-saas/src/locale/en.json
git add apps/kace-saas/src/locale/es.json
git commit -m "feat(frontend): add Channel Hub routes, navigation, and i18n"
```

---

## Task 11: Frontend — Table Module (constants, hooks, utils)

**Files:**
- Create: `apps/kace-saas/src/pages/ChannelHub/data/constants.jsx`
- Create: `apps/kace-saas/src/pages/ChannelHub/hooks/useActionsChannelHub.js`
- Create: `apps/kace-saas/src/pages/ChannelHub/utils/datatableProcess.js`

- [ ] **Step 1: Create constants.jsx**

```javascript
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const HEADERS_CONST_CHANNEL_HUB = [
    "name",
    "email",
    "country_id",
    "channel_hub_connection_id",
    "created_at",
];

export const dataTableConfig = {
    key: URL_AND_KEYS.channel_hub.key,
    url: URL_AND_KEYS.channel_hub.url,
    view: URL_AND_KEYS.channel_hub.view,
    genericColumns: HEADERS_CONST_CHANNEL_HUB,
    entity: URL_AND_KEYS.channel_hub.entity,
};

export const FILTER_TRANSFORMATIONS = {
    name: (row) => ({
        ...row,
        label: "name",
        filterData: {
            field: "channel_hub_accounts.name",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    email: (row) => ({
        ...row,
        label: "email",
        filterData: {
            field: "channel_hub_accounts.email",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    country_id: (row) => ({
        ...row,
        label: "country_id",
        filterData: {
            field: "channel_hub_accounts.country_id",
            operator: "=",
            type: "AND",
            value: "",
        },
    }),
};

export const INITIAL_FORM = {
    id: "",
    email: "",
    name: "",
    country_id: "",
    rest_flow_id: "",
};
```

- [ ] **Step 2: Create useActionsChannelHub.js**

```javascript
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { AxiosHttpClient } from "@/services/AxiosHttpClient";

const useActionsChannelHub = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const { mutate: deleteAction } = useGeneralDelete({ keyQuery: URL_AND_KEYS.channel_hub.key });

    const { mutate: registerAction, isPending: isRegistering } = useMutation({
        mutationFn: async (id) => {
            const response = await AxiosHttpClient.post(`${URL_AND_KEYS.channel_hub.url}/${id}/register`);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.channel_hub.key] });
            toast.success(t("channelHub.register_success"));
        },
        onError: () => {
            toast.error(t("channelHub.register_error"));
        },
    });

    return {
        handleUpdate: (id) => {
            navigate(`/channel-hub/update/${id}`);
        },
        handleDelete: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.channel_hub.url });
        },
        handleSee: (id) => {
            navigate(`/channel-hub/update/${id}?action=see`);
        },
        handleRegister: (id) => {
            registerAction(id);
        },
        isRegistering,
    };
};

export default useActionsChannelHub;
```

- [ ] **Step 3: Create datatableProcess.js**

```javascript
import { FILTER_TRANSFORMATIONS } from "../data/constants";

export const processData = async (data) => {
    const normalizedData = data?.data ?? data;
    return normalizedData;
};

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processFilters = (defaultFilters) => ([
    ...defaultFilters
]);
```

- [ ] **Step 4: Commit**

```bash
git add apps/kace-saas/src/pages/ChannelHub/data/
git add apps/kace-saas/src/pages/ChannelHub/hooks/
git add apps/kace-saas/src/pages/ChannelHub/utils/
git commit -m "feat(frontend): add Channel Hub table constants, hooks, and utils"
```

---

## Task 12: Frontend — Page Components

**Files:**
- Create: `apps/kace-saas/src/pages/ChannelHub/ChannelHub.jsx`
- Create: `apps/kace-saas/src/pages/ChannelHub/ChannelHubHandler.jsx`
- Create: `apps/kace-saas/src/pages/ChannelHub/components/channel-hub-table-container.jsx`

- [ ] **Step 1: Create ChannelHub.jsx**

```jsx
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import ChannelHubHandler from "./ChannelHubHandler";

const ChannelHub = () => {
    return (
        <DashboardSectionCard title="channelHub.title">
            <ChannelHubHandler />
        </DashboardSectionCard>
    );
};

export default ChannelHub;
```

- [ ] **Step 2: Create ChannelHubHandler.jsx**

```jsx
import { useTranslation } from "react-i18next";
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";
import usePermissionsUser from "@/hooks/usePermissionsUser";
import { ChannelHubTableContainer } from "./components/channel-hub-table-container";
import useActionsChannelHub from "./hooks/useActionsChannelHub";
import { ROUTES } from "@/config/routesDictionary";

const ChannelHubHandler = () => {
    const { handleDelete, handleSee, handleUpdate, handleRegister } = useActionsChannelHub();
    const { t } = useTranslation();

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "channel-hub",
        actions: [
            { name: "ChannelHubUpdate", label: t("app.forms.edit"), handler: handleUpdate },
            { name: "ChannelHubDelete", label: t("app.forms.delete"), handler: handleDelete },
            { name: "ChannelHubRead", label: t("app.forms.see"), handler: handleSee },
        ],
        nameCreate: "ChannelHubCreate",
    });

    const registerAction = {
        name: "ChannelHubUpdate",
        label: t("channelHub.register"),
        handler: handleRegister,
        condition: (row) => !row.channel_hub_connection_id,
    };

    return (
        <div className="flex flex-col gap-4">
            {canBeCreate && <DefaultIndexActions createUrl={ROUTES.CHANNEL_HUB_CREATE.path} />}
            <ChannelHubTableContainer
                arrayAction={[...arrayAction, registerAction]}
            />
        </div>
    );
};

export default ChannelHubHandler;
```

- [ ] **Step 3: Create channel-hub-table-container.jsx**

```jsx
import PropTypes from "prop-types";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";

export const ChannelHubTableContainer = ({ arrayAction = [] }) => {
    const { renderData, query, filters, pagination, columnSelector } =
        useDataTable({
            dataTableConfig,
            actions: arrayAction,
            processFilters,
            processColumns,
            processData,
        });

    return (
        <DataTable
            renderData={renderData}
            query={query}
            filters={filters}
            pagination={pagination}
            columnSelector={columnSelector}
        />
    );
};

ChannelHubTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/kace-saas/src/pages/ChannelHub/ChannelHub.jsx
git add apps/kace-saas/src/pages/ChannelHub/ChannelHubHandler.jsx
git add apps/kace-saas/src/pages/ChannelHub/components/channel-hub-table-container.jsx
git commit -m "feat(frontend): add Channel Hub page, handler, and table container"
```

---

## Task 13: Frontend — Create/Edit Form

**Files:**
- Create: `apps/kace-saas/src/pages/ChannelHub/components/ChannelHubCreate.jsx`
- Create: `apps/kace-saas/src/pages/ChannelHub/components/ChannelHubCreateForm.jsx`

- [ ] **Step 1: Create ChannelHubCreate.jsx**

```jsx
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import ChannelHubCreateForm from "./ChannelHubCreateForm";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import { ROUTES } from "@/config/routesDictionary";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const ChannelHubCreate = () => {
    const { t } = useTranslation();
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    const id = params?.id;
    const isEditMode = Boolean(id) || pathname.includes("/channel-hub/update");

    const { data: fetchedData, isLoading: isFetching } = useGenericViewQuery({
        keyQuery: `channel-hub-${id}`,
        url: id ? `${URL_AND_KEYS.channel_hub.url}/${id}` : "",
        enabled: !!id,
    });

    const accountFromApi = fetchedData && (fetchedData.data ? fetchedData.data : fetchedData);

    const normalizeAccount = (a) => {
        if (!a) return {};
        const keys = ["id", "email", "name", "country_id", "rest_flow_id"];
        return keys.reduce((acc, key) => {
            const raw = a[key];
            const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
            acc[key] = value ?? "";
            return acc;
        }, {});
    };

    const data = accountFromApi ? normalizeAccount(accountFromApi) : {};

    const { mutate, isPending } = useGeneralMutation({ keyQuery: URL_AND_KEYS.channel_hub.key });
    const isSending = isPending || isFetching;

    const dataHandler = async (values, setErrors, setStatus) => {
        const payload = genericHandleSendInformation({
            values,
            urlService: URL_AND_KEYS.channel_hub.url,
            setFormikErrors: setErrors,
            setFormikStatus: setStatus,
            pending: isPending,
        });

        try {
            await mutate(payload);
            setStatus({ success: true, message: t("channelHub.saved") });
            navigate(ROUTES.CHANNEL_HUB.path);
        } catch (err) {
            if (err && err.errors) setErrors(err.errors);
            setStatus({ success: false, message: err.message || t("channelHub.error") });
            throw err;
        }
    };

    return (
        <DashboardSectionCard>
            <ChannelHubCreateForm
                dataHandler={dataHandler}
                data={data}
                isSending={isSending}
                isEditMode={isEditMode}
            />
        </DashboardSectionCard>
    );
};

export default ChannelHubCreate;
```

- [ ] **Step 2: Create ChannelHubCreateForm.jsx**

```jsx
import { Formik, Form } from "formik";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { joiFormikAdapter } from "@kace/utils";
import { formatTestId } from "@/utils/src/helpers";
import {
    KField,
    InputFormModal as Input,
    FormikStatusMessages,
} from "@kace/ui-shared";
import FormCard from "@/components/core/Cards/FormCard";
import InputCard from "@/components/core/Cards/InputCard";
import SectionForm from "@/components/core/Cards/section-form";
import { INITIAL_FORM } from "../data/constants";
import Joi from "joi";
import { useField } from "formik";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";

const ChannelHubFormSchema = Joi.object({
    id: Joi.string().allow(""),
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    name: Joi.string().required(),
    country_id: Joi.string().required(),
    rest_flow_id: Joi.string().uuid().required(),
});

const RestFlowSelect = ({ flows }) => {
    const { t } = useTranslation();
    const [field, meta, helpers] = useField("rest_flow_id");
    return (
        <div>
            <label htmlFor="rest_flow_id" className="text-sm font-medium">{t("channelHub.rest_flow_id")}</label>
            <select
                id="rest_flow_id"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={field.value}
                onChange={(e) => helpers.setValue(e.target.value)}
                onBlur={() => helpers.setTouched(true)}
                data-testid={formatTestId("channel_hub_form", "rest_flow_id")}
            >
                <option value="">{t("channelHub.rest_flow_id")}</option>
                {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>{flow.description}</option>
                ))}
            </select>
            {meta.touched && meta.error && <div className="text-red-500 text-xs mt-1">{meta.error}</div>}
        </div>
    );
};

const ChannelHubCreateForm = ({ dataHandler, data = {}, isSending = false, isEditMode = false }) => {
    const { t } = useTranslation();

    const { data: flowsData } = useGenericViewQuery({
        keyQuery: "ws-rest-flows-list",
        url: "/ws-rest-flows",
        enabled: true,
    });

    const flows = flowsData?.data?.items ?? flowsData?.items ?? [];

    const getInitial = () => {
        if (data && Object.keys(data).length !== 0) return { ...INITIAL_FORM, ...data };
        return { ...INITIAL_FORM };
    };

    const [formData, setFormData] = useState(getInitial);

    useEffect(() => {
        if (data && Object.entries(data).length !== 0) {
            setFormData((state) => ({ ...state, ...data }));
        }
    }, [data]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(ChannelHubFormSchema)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                await dataHandler(values, setErrors, setStatus);
            }}
        >
            {({ status }) => (
                <Form className="flex w-full justify-center" autoComplete="off">
                    <FormCard isId={!!data?.id} title={t("channelHub.title")} isSending={isSending}>
                        <div className="flex flex-col col-span-3 gap-8">
                            <FormikStatusMessages formikStatus={status} />
                            <SectionForm title={t("channelHub.basicInformation")} id="channel_hub_basic" dataTestId="channel_hub_basic">
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="email"
                                            label={t("channelHub.email")}
                                            placeholder={t("channelHub.email")}
                                            id="email"
                                            disabled={isEditMode}
                                            data-testid={formatTestId("channel_hub_form", "email")}
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="name"
                                            label={t("channelHub.name")}
                                            placeholder={t("channelHub.name")}
                                            id="name"
                                            data-testid={formatTestId("channel_hub_form", "name")}
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="country_id"
                                            label={t("channelHub.country_id")}
                                            placeholder="co, mx, cl, pe..."
                                            id="country_id"
                                            data-testid={formatTestId("channel_hub_form", "country_id")}
                                        />
                                    </KField>
                                </InputCard>
                            </SectionForm>

                            <SectionForm title={t("channelHub.connectionDetails")} id="channel_hub_connection" dataTestId="channel_hub_connection">
                                <InputCard>
                                    <KField>
                                        <RestFlowSelect flows={flows} />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                        </div>
                    </FormCard>
                </Form>
            )}
        </Formik>
    );
};

export default ChannelHubCreateForm;
```

- [ ] **Step 3: Commit**

```bash
git add apps/kace-saas/src/pages/ChannelHub/components/
git commit -m "feat(frontend): add Channel Hub create/edit form components"
```

---

## Task 14: Frontend — Roles Form Permissions Update

**Files:**
- Modify: Roles form permissions configuration (identify exact file from codebase)

- [ ] **Step 1: Identify the roles permission configuration file**

Search for where module permission groups are defined in the roles form. Look for files that map module IDs to permission names (e.g., where "BrokerAdapters" or "Users" permissions are listed).

The permissions come from the backend API and are automatically grouped by the `useRoleFormPermissionsHandler` hook. Adding permissions requires:
1. The backend controller checks `this.user.hasPermission('administrador', 'channel-hub', 'ChannelHubRead')` — this module ID (`channel-hub`) must exist in the permissions system.
2. The i18n `modulesNames` entry (already added in Task 10) maps `"channel-hub"` → `"Channel Hub"` for display.

If the permissions are automatically discovered from the backend, no frontend form changes are needed beyond the i18n entry. If they are hardcoded, add `"channel-hub"` with permissions `["ChannelHubCreate", "ChannelHubRead", "ChannelHubUpdate", "ChannelHubDelete"]` to the permissions list.

- [ ] **Step 2: Verify by checking how existing permissions appear**

Read `apps/kace-saas/src/pages/Roles/` files to confirm the pattern. The `modulesNames` i18n key added in Task 10 should be sufficient for the display name.

- [ ] **Step 3: Commit (if changes needed)**

```bash
git add apps/kace-saas/src/pages/Roles/
git commit -m "feat(frontend): add Channel Hub to roles permissions form"
```

---

## Task 15: Verify and Test

- [ ] **Step 1: Run frontend build**

Run: `cd apps/kace-saas && pnpm run build`
Expected: No build errors.

- [ ] **Step 2: Run frontend linting**

Run: `cd apps/kace-saas && pnpm run eslint-check`
Expected: No linting errors.

- [ ] **Step 3: Run backend linting on new microservice**

Run: `cd apps/apiv1/kace_cloud_api_channel_hub && pnpm run eslint-check`
Expected: No linting errors.

- [ ] **Step 4: Run CDK synth on new microservice**

Run: `cd apps/apiv1/kace_cloud_api_channel_hub && pnpm run cdk:synth`
Expected: CloudFormation template generated successfully.

- [ ] **Step 5: Final commit with all fixes**

Fix any issues found in steps 1-4 and commit.

```bash
git add -A
git commit -m "fix: resolve build and lint issues for Channel Hub integration"
```
