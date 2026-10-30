# Workspace Channel Hub Rule Callback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the Channel Hub email rule id produced by the create-tag RestFlow by making the RestFlow call a Workspace-owned callback endpoint after the Channel Hub POST succeeds.

**Architecture:** The Workspace API owns the write to `workspaces.rules.ruleId` through a new authenticated callback route, so the Event Processor stays a generic RestFlow executor. A database migration adds a reusable KACE service-account auth endpoint plus a final callback step to every active Channel Hub create-email-rule RestFlow. The callback validates the workspace/account/connection before preserving all existing rules and writing `ruleId`.

**Tech Stack:** Node.js ESM Lambdas, Joi validation, Knex/Postgres JSONB, AWS CDK API Gateway resources, Jest for API tests, node:test for database migration tests, RestFlow dynamic context replacement.

---

## File Structure

- Create `apps/apiv1/kace_cloud_api_workspaces/src/WorkspaceChannelHubRuleRecorder.mjs` — isolated Workspace domain service for validating and saving Channel Hub rule ids.
- Create `apps/apiv1/kace_cloud_api_workspaces/tests/WorkspaceChannelHubRuleRecorder.test.mjs` — unit tests for successful writes, idempotency, overwrites, and validation failures.
- Modify `apps/apiv1/kace_cloud_api_workspaces/src/WorkspaceSchema.mjs` — add `WorkspaceChannelHubRuleCreatedSchema` for the callback body.
- Modify `apps/apiv1/kace_cloud_api_workspaces/src/Controller.mjs` — add `runRecordChannelHubRuleCreated()` custom-route method.
- Modify `apps/apiv1/kace_cloud_api_workspaces/src/handler.mjs` — route `POST /{id}/channel-hub-tags/rule-created` before `BaseController.run()`.
- Modify `apps/apiv1/kace_cloud_api_workspaces/lib/workspace-stack.ts` — add API Gateway resource `/workspaces/{id}/channel-hub-tags/rule-created`.
- Modify `packages/kace_cloud_local_server/src/service-manifest.mjs` — add the same custom Workspace route for local API execution.
- Create `apps/apiv1/kace_cloud_api_workspaces/tests/WorkspaceChannelHubRuleCreatedRoute.test.mjs` — route/controller unit tests with module mocks.
- Create `packages/kace_cloud_database/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.js` — add KACE auth endpoint, `api.konecta.cloud` allowed connection, Workspace callback endpoint, failure hook config, and final RestFlow steps after active Channel Hub create-email-rule POST steps.
- Create `packages/kace_cloud_database/tests/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.test.js` — sqlite migration behavior tests.
- Modify `apps/apiv1/kace_cloud_api_event_processor/src/handler.mjs` — remove Workspace-specific rule-id persister wiring.
- Delete `apps/apiv1/kace_cloud_api_event_processor/src/WorkspaceChannelHubRuleIdPersister.mjs` — remove rejected tactical implementation.
- Modify `apps/apiv1/kace_cloud_api_event_processor/test/handler.test.mjs` — remove persister mocks and assertions.
- Delete `apps/apiv1/kace_cloud_api_event_processor/test/WorkspaceChannelHubRuleIdPersister.test.mjs` — remove tests for rejected tactical implementation.

---

## Callback Contract

The RestFlow callback endpoint must call:

```http
POST /workspaces/{workspaceId}/channel-hub-tags/rule-created
Authorization: Bearer context.kace.auth.id_token
Content-Type: application/json
```

Body after RestFlow context replacement:

```json
{
  "channel_hub_account_id": "5bef0eb7-6781-4423-806e-d320cc6ed619",
  "connection_id": "3E3R0BE70304do9a0Z6a9mqmTCK",
  "rule_id": "3E5FX4NM9SGdWZzz9Ad0ZNGHskf"
}
```

Success response shape:

```json
{
  "data": {
    "workspace_id": "95346f17-4ee8-420d-a0af-16d2ac394dd9",
    "channel_hub_account_id": "5bef0eb7-6781-4423-806e-d320cc6ed619",
    "connection_id": "3E3R0BE70304do9a0Z6a9mqmTCK",
    "rule_id": "3E5FX4NM9SGdWZzz9Ad0ZNGHskf",
    "changed": true
  }
}
```

The RestFlow endpoint row uses:

```json
{
  "headers": {
    "Authorization": "Bearer context.kace.auth.id_token"
  }
}
```

The RestFlow body row uses:

```json
{
  "body": {
    "channel_hub_account_id": "context.workspace.channel_hub_accounts[0].id",
    "connection_id": "context.channel_hub_tag.response.connectionId",
    "rule_id": "context.channel_hub_tag.response.id"
  }
}
```

---

## Must-Have Gates

These are non-negotiable checks the implementation must satisfy before merging:

1. **Account/connection binding:** `channel_hub_account_id` and `connection_id` must resolve to the same assigned `workspace.channel_hub_accounts[]` item. It is not enough for the account id and connection id to appear separately somewhere in the workspace.
2. **Custom route dispatch:** `POST /workspaces/{id}/channel-hub-tags/rule-created` must be handled outside `BaseController.run()`, following the Channel Hub `/register` pattern.
3. **Runtime route parity:** The route must exist in both CDK (`workspace-stack.ts`) and the local service manifest (`service-manifest.mjs`).
4. **Service auth and egress allow-list:** The RestFlow callback must use KACE service-account auth and `allowed_connections.connection = 'api.konecta.cloud'` so the HTTP client permits both `/auth-cognito` and `/workspaces/.../rule-created`.
5. **Callback failure semantics:** The Workspace callback RestFlow endpoint must configure `on_error` for 4xx/5xx statuses so `WorkflowStepExecutorService.#processEndpointResponse()` throws and `ExecuteWSRestFlowOnExecutionRequested` marks the execution `failed`; otherwise a 4xx callback can be recorded as a response while the execution still completes.

---

### Task 1: Workspace rule-recorder service

**Files:**
- Create: `apps/apiv1/kace_cloud_api_workspaces/src/WorkspaceChannelHubRuleRecorder.mjs`
- Create: `apps/apiv1/kace_cloud_api_workspaces/tests/WorkspaceChannelHubRuleRecorder.test.mjs`

- [ ] **Step 1: Write the failing service tests**

Create `apps/apiv1/kace_cloud_api_workspaces/tests/WorkspaceChannelHubRuleRecorder.test.mjs` with this content:

```js
import { jest } from '@jest/globals';
import {
    WorkspaceChannelHubRuleRecorder,
    WorkspaceChannelHubRuleRecorderError,
} from '../src/WorkspaceChannelHubRuleRecorder.mjs';

const WORKSPACE_ID = '95346f17-4ee8-420d-a0af-16d2ac394dd9';
const ACCOUNT_ID = '5bef0eb7-6781-4423-806e-d320cc6ed619';
const CONNECTION_ID = '3E3R0BE70304do9a0Z6a9mqmTCK';
const RULE_ID = '3E5FX4NM9SGdWZzz9Ad0ZNGHskf';
const USER_ID = '6bae1fbf-afd4-4bd0-b07e-24ed9dc5a13e';

const workspace = {
    id: WORKSPACE_ID,
    tag: 'TAGS',
    rules: {
        ruleName: 'TAGS',
        subjectContains: ['TAGS', 'WORK'],
        actionRules: { classifyAs: 'TAGS' },
    },
    channel_hub_accounts: [
        {
            id: ACCOUNT_ID,
            channel_hub_connection_id: CONNECTION_ID,
        },
    ],
};

function createConnectionMock() {
    const update = jest.fn().mockResolvedValue(1);
    const whereNull = jest.fn().mockReturnValue({ update });
    const where = jest.fn().mockReturnValue({ whereNull });
    const connection = jest.fn().mockReturnValue({ where });
    connection.update = update;
    connection.where = where;
    connection.whereNull = whereNull;
    return connection;
}

function createRecorder({ workspaceResult = workspace } = {}) {
    const connection = createConnectionMock();
    const repository = {
        find: jest.fn().mockResolvedValue(workspaceResult),
        connection,
    };
    const recorder = new WorkspaceChannelHubRuleRecorder({
        workspaceRepository: repository,
        now: () => new Date('2026-05-22T15:00:00.000Z'),
    });
    return { recorder, repository, connection };
}

async function execute(recorder, overrides = {}) {
    return recorder.execute({
        workspaceId: WORKSPACE_ID,
        channelHubAccountId: ACCOUNT_ID,
        connectionId: CONNECTION_ID,
        ruleId: RULE_ID,
        updatedBy: USER_ID,
        ...overrides,
    });
}

describe('WorkspaceChannelHubRuleRecorder', () => {
    it('persists the Channel Hub rule id while preserving existing workspace rules', async () => {
        const { recorder, repository, connection } = createRecorder();

        await expect(execute(recorder)).resolves.toEqual({
            workspace_id: WORKSPACE_ID,
            channel_hub_account_id: ACCOUNT_ID,
            connection_id: CONNECTION_ID,
            rule_id: RULE_ID,
            changed: true,
        });

        expect(repository.find).toHaveBeenCalledWith({ value: WORKSPACE_ID });
        expect(connection).toHaveBeenCalledWith('workspaces');
        expect(connection.where).toHaveBeenCalledWith({ id: WORKSPACE_ID });
        expect(connection.whereNull).toHaveBeenCalledWith('deleted_at');
        expect(connection.update).toHaveBeenCalledWith({
            rules: JSON.stringify({
                ruleName: 'TAGS',
                subjectContains: ['TAGS', 'WORK'],
                actionRules: { classifyAs: 'TAGS' },
                ruleId: RULE_ID,
            }),
            updated_at: '2026-05-22T15:00:00.000Z',
            updated_by: USER_ID,
        });
    });

    it('does not write when the same rule id is already persisted', async () => {
        const { recorder, connection } = createRecorder({
            workspaceResult: {
                ...workspace,
                rules: { ...workspace.rules, ruleId: RULE_ID },
            },
        });

        await expect(execute(recorder)).resolves.toEqual({
            workspace_id: WORKSPACE_ID,
            channel_hub_account_id: ACCOUNT_ID,
            connection_id: CONNECTION_ID,
            rule_id: RULE_ID,
            changed: false,
        });
        expect(connection.update).not.toHaveBeenCalled();
    });

    it('overwrites an old rule id when Channel Hub returns a different id', async () => {
        const { recorder, connection } = createRecorder({
            workspaceResult: {
                ...workspace,
                rules: { ...workspace.rules, ruleId: 'old-channel-rule-id' },
            },
        });

        await expect(execute(recorder)).resolves.toMatchObject({ changed: true, rule_id: RULE_ID });
        expect(connection.update).toHaveBeenCalledWith(
            expect.objectContaining({
                rules: JSON.stringify({
                    ...workspace.rules,
                    ruleId: RULE_ID,
                }),
            })
        );
    });

    it('parses rules when the repository returns JSONB as a string', async () => {
        const { recorder, connection } = createRecorder({
            workspaceResult: {
                ...workspace,
                rules: JSON.stringify(workspace.rules),
            },
        });

        await expect(execute(recorder)).resolves.toMatchObject({ changed: true });
        expect(connection.update).toHaveBeenCalledWith(
            expect.objectContaining({
                rules: JSON.stringify({ ...workspace.rules, ruleId: RULE_ID }),
            })
        );
    });

    it('rejects a missing workspace', async () => {
        const { recorder } = createRecorder({ workspaceResult: null });

        await expect(execute(recorder)).rejects.toMatchObject({
            name: 'WorkspaceChannelHubRuleRecorderError',
            statusCode: 404,
            message: 'Workspace not found',
        });
    });

    it('rejects a Channel Hub account that is not attached to the workspace', async () => {
        const { recorder } = createRecorder();

        await expect(
            execute(recorder, { channelHubAccountId: '6ecb6537-80b5-4bbd-8caa-17341659d6d2' })
        ).rejects.toBeInstanceOf(WorkspaceChannelHubRuleRecorderError);
    });

    it('rejects a connection id that belongs to a different assigned Channel Hub account', async () => {
        const { recorder } = createRecorder({
            workspaceResult: {
                ...workspace,
                channel_hub_accounts: [
                    {
                        id: ACCOUNT_ID,
                        channel_hub_connection_id: CONNECTION_ID,
                    },
                    {
                        id: '6ecb6537-80b5-4bbd-8caa-17341659d6d2',
                        channel_hub_connection_id: 'different-connection',
                    },
                ],
            },
        });

        await expect(execute(recorder, { connectionId: 'different-connection' })).rejects.toMatchObject({
            statusCode: 409,
            message: 'Channel Hub connection does not match workspace account',
        });
    });

    it('rejects empty identifiers before reading the workspace', async () => {
        const { recorder, repository } = createRecorder();

        await expect(execute(recorder, { ruleId: '   ' })).rejects.toMatchObject({
            statusCode: 400,
            message: 'rule_id is required',
        });
        expect(repository.find).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the service test and verify it fails because the service does not exist**

Run:

```bash
pnpm --filter @kace/api-workspaces test -- WorkspaceChannelHubRuleRecorder.test.mjs
```

Expected: FAIL with an import/module-not-found error for `WorkspaceChannelHubRuleRecorder.mjs`.

- [ ] **Step 3: Implement the service**

Create `apps/apiv1/kace_cloud_api_workspaces/src/WorkspaceChannelHubRuleRecorder.mjs` with this content:

```js
import { WorkspaceResponse } from '@kace/core/src/workspaces/application/WorkspaceResponse.js';

const WORKSPACES_TABLE = 'workspaces';

export class WorkspaceChannelHubRuleRecorderError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'WorkspaceChannelHubRuleRecorderError';
        this.statusCode = statusCode;
    }
}

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

const requireNonEmpty = (value, fieldName) => {
    const normalized = trimString(value);
    if (!normalized) {
        throw new WorkspaceChannelHubRuleRecorderError(`${fieldName} is required`, 400);
    }
    return normalized;
};

const parseRules = (rules) => {
    if (!rules) return {};
    if (typeof rules === 'string') return JSON.parse(rules);
    return { ...rules };
};

const workspaceToJson = (workspace) => {
    if (!workspace) return null;
    if (workspace.rules?.value !== undefined) {
        return new WorkspaceResponse(workspace).toJson().data;
    }
    if (typeof workspace.toJson === 'function') {
        const json = workspace.toJson();
        return json.data ?? json;
    }
    return workspace;
};

export class WorkspaceChannelHubRuleRecorder {
    #workspaceRepository;
    #now;

    constructor({ workspaceRepository, now = () => new Date() }) {
        this.#workspaceRepository = workspaceRepository;
        this.#now = now;
    }

    async execute({ workspaceId, channelHubAccountId, connectionId, ruleId, updatedBy }) {
        const normalizedWorkspaceId = requireNonEmpty(workspaceId, 'workspace_id');
        const normalizedAccountId = requireNonEmpty(channelHubAccountId, 'channel_hub_account_id');
        const normalizedConnectionId = requireNonEmpty(connectionId, 'connection_id');
        const normalizedRuleId = requireNonEmpty(ruleId, 'rule_id');
        const normalizedUpdatedBy = requireNonEmpty(updatedBy, 'updated_by');

        const workspace = workspaceToJson(await this.#workspaceRepository.find({ value: normalizedWorkspaceId }));
        if (!workspace) {
            throw new WorkspaceChannelHubRuleRecorderError('Workspace not found', 404);
        }

        const account = workspace.channel_hub_accounts?.find((item) => item?.id === normalizedAccountId);
        if (!account) {
            throw new WorkspaceChannelHubRuleRecorderError('Channel Hub account is not attached to workspace', 404);
        }

        if (account.channel_hub_connection_id !== normalizedConnectionId) {
            throw new WorkspaceChannelHubRuleRecorderError(
                'Channel Hub connection does not match workspace account',
                409
            );
        }

        const rules = parseRules(workspace.rules);
        const existingRuleId = trimString(rules.ruleId);
        const response = {
            workspace_id: normalizedWorkspaceId,
            channel_hub_account_id: normalizedAccountId,
            connection_id: normalizedConnectionId,
            rule_id: normalizedRuleId,
            changed: existingRuleId !== normalizedRuleId,
        };

        if (!response.changed) {
            return response;
        }

        await this.#workspaceRepository
            .connection(WORKSPACES_TABLE)
            .where({ id: normalizedWorkspaceId })
            .whereNull('deleted_at')
            .update({
                rules: JSON.stringify({ ...rules, ruleId: normalizedRuleId }),
                updated_at: this.#now().toISOString(),
                updated_by: normalizedUpdatedBy,
            });

        return response;
    }
}
```

- [ ] **Step 4: Run the service test and verify it passes**

Run:

```bash
pnpm --filter @kace/api-workspaces test -- WorkspaceChannelHubRuleRecorder.test.mjs
```

Expected: PASS for all `WorkspaceChannelHubRuleRecorder` tests.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add apps/apiv1/kace_cloud_api_workspaces/src/WorkspaceChannelHubRuleRecorder.mjs apps/apiv1/kace_cloud_api_workspaces/tests/WorkspaceChannelHubRuleRecorder.test.mjs
git commit -m "feat(workspaces): add channel hub rule recorder"
```

---

### Task 2: Workspace API callback route

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_workspaces/src/WorkspaceSchema.mjs`
- Modify: `apps/apiv1/kace_cloud_api_workspaces/src/Controller.mjs`
- Modify: `apps/apiv1/kace_cloud_api_workspaces/src/handler.mjs`
- Modify: `apps/apiv1/kace_cloud_api_workspaces/lib/workspace-stack.ts`
- Modify: `packages/kace_cloud_local_server/src/service-manifest.mjs`
- Create: `apps/apiv1/kace_cloud_api_workspaces/tests/WorkspaceChannelHubRuleCreatedRoute.test.mjs`

- [ ] **Step 1: Add the route/controller test**

Create `apps/apiv1/kace_cloud_api_workspaces/tests/WorkspaceChannelHubRuleCreatedRoute.test.mjs` with this content:

```js
import { jest } from '@jest/globals';

const recorderExecute = jest.fn();
const destroyDbConnection = jest.fn().mockResolvedValue(undefined);
const getLoggedInUser = jest.fn();
const hasPermission = jest.fn();

jest.unstable_mockModule('@kace/api-common', () => ({
    withTenantContext: (handler) => handler,
    HttpResponse: {
        ok: (payload) => ({ toJson: () => ({ statusCode: 200, body: JSON.stringify(payload) }) }),
        badRequest: (payload) => ({ toJson: () => ({ statusCode: 400, body: JSON.stringify(payload) }) }),
        forbidden: (payload) => ({ toJson: () => ({ statusCode: 403, body: JSON.stringify(payload) }) }),
        notFound: (payload) => ({ toJson: () => ({ statusCode: 404, body: JSON.stringify(payload) }) }),
        validationsFail: (payload) => ({ toJson: () => ({ statusCode: 422, body: JSON.stringify(payload) }) }),
        internalServerError: (payload) => ({ toJson: () => ({ statusCode: 500, body: JSON.stringify(payload) }) }),
    },
    BaseController: class {
        constructor(event, knexConfig) {
            this.event = event;
            this.knexConfig = knexConfig;
            this.database_connection = knexConfig;
        }
        payload() {
            return JSON.parse(this.event.body ?? '{}');
        }
        pathParameters() {
            return this.event.pathParameters ?? {};
        }
        validateId(id) {
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        }
        getLoggedInUser() {
            return getLoggedInUser();
        }
        destroyDbConnection() {
            return destroyDbConnection();
        }
        run() {
            throw new Error('BaseController.run should not handle the callback route');
        }
    },
}));

jest.unstable_mockModule('@kace/api-common/src/validation/schemas/SearchSchema', () => ({
    SearchSchema: { validate: jest.fn((value) => ({ value })) },
}));

jest.unstable_mockModule('@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js', () => ({
    KnexWorkspacesRepository: jest.fn().mockImplementation((connection) => ({ connection })),
}));

jest.unstable_mockModule('@kace/core/src/ws-rest-flow-executions/index.js', () => ({
    KnexWSRestFlowExecutionRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn(), logError: jest.fn() },
}));

jest.unstable_mockModule('@kace/core/src/workspaces/application/create/WorkspaceCreator.js', () => ({
    WorkspaceCreator: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/workspaces/application/delete/WorkspaceDeleter.js', () => ({
    WorkspaceDeleter: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/workspaces/application/find/WorkspaceFinder.js', () => ({
    WorkspaceFinder: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/workspaces/application/search/WorkspaceSearcher.js', () => ({
    WorkspaceSearcher: jest.fn(),
}));
jest.unstable_mockModule('@kace/core/src/workspaces/application/update/WorkspaceUpdater.js', () => ({
    WorkspaceUpdater: jest.fn(),
}));

jest.unstable_mockModule('../src/WorkspaceTagUpdateFlowQueuer.mjs', () => ({
    WorkspaceTagUpdateFlowQueuer: jest.fn(),
}));

jest.unstable_mockModule('../src/WorkspaceChannelHubRuleRecorder.mjs', () => ({
    WorkspaceChannelHubRuleRecorder: jest.fn().mockImplementation(() => ({ execute: recorderExecute })),
    WorkspaceChannelHubRuleRecorderError: class WorkspaceChannelHubRuleRecorderError extends Error {
        constructor(message, statusCode = 400) {
            super(message);
            this.name = 'WorkspaceChannelHubRuleRecorderError';
            this.statusCode = statusCode;
        }
    },
}));

const { handler } = await import('../src/handler.mjs');

const WORKSPACE_ID = '95346f17-4ee8-420d-a0af-16d2ac394dd9';
const ACCOUNT_ID = '5bef0eb7-6781-4423-806e-d320cc6ed619';
const USER_ID = '6bae1fbf-afd4-4bd0-b07e-24ed9dc5a13e';

function createEvent({ body, pathId = WORKSPACE_ID } = {}) {
    return {
        httpMethod: 'POST',
        resource: '/{id}/channel-hub-tags/rule-created',
        pathParameters: { id: pathId },
        body: JSON.stringify(
            body ?? {
                channel_hub_account_id: ACCOUNT_ID,
                connection_id: '3E3R0BE70304do9a0Z6a9mqmTCK',
                rule_id: '3E5FX4NM9SGdWZzz9Ad0ZNGHskf',
            }
        ),
        tenantContext: {
            knexConfig: { client: 'mock' },
        },
    };
}

describe('Workspace Channel Hub rule-created callback route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        hasPermission.mockReturnValue(true);
        getLoggedInUser.mockResolvedValue({ id: { value: USER_ID }, hasPermission });
        recorderExecute.mockResolvedValue({
            workspace_id: WORKSPACE_ID,
            channel_hub_account_id: ACCOUNT_ID,
            connection_id: '3E3R0BE70304do9a0Z6a9mqmTCK',
            rule_id: '3E5FX4NM9SGdWZzz9Ad0ZNGHskf',
            changed: true,
        });
    });

    it('routes POST /{id}/channel-hub-tags/rule-created to the custom controller method', async () => {
        const response = await handler(createEvent());

        expect(response.statusCode).toBe(200);
        expect(hasPermission).toHaveBeenCalledWith('administrador', 'workspaces', 'WorkspacesUpdate');
        expect(recorderExecute).toHaveBeenCalledWith({
            workspaceId: WORKSPACE_ID,
            channelHubAccountId: ACCOUNT_ID,
            connectionId: '3E3R0BE70304do9a0Z6a9mqmTCK',
            ruleId: '3E5FX4NM9SGdWZzz9Ad0ZNGHskf',
            updatedBy: USER_ID,
        });
        expect(destroyDbConnection).toHaveBeenCalledTimes(1);
    });

    it('returns 422 when the callback body is invalid', async () => {
        const response = await handler(createEvent({ body: { connection_id: '', rule_id: '' } }));

        expect(response.statusCode).toBe(422);
        expect(recorderExecute).not.toHaveBeenCalled();
        expect(destroyDbConnection).toHaveBeenCalledTimes(1);
    });

    it('returns 403 when the service account lacks WorkspacesUpdate permission', async () => {
        hasPermission.mockReturnValue(false);

        const response = await handler(createEvent());

        expect(response.statusCode).toBe(403);
        expect(recorderExecute).not.toHaveBeenCalled();
    });

    it('returns 400 when the path workspace id is invalid', async () => {
        const response = await handler(createEvent({ pathId: 'not-a-uuid' }));

        expect(response.statusCode).toBe(400);
        expect(recorderExecute).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the route test and verify it fails**

Run:

```bash
pnpm --filter @kace/api-workspaces test -- WorkspaceChannelHubRuleCreatedRoute.test.mjs
```

Expected: FAIL because the handler still delegates the custom route to `BaseController.run()` or because `runRecordChannelHubRuleCreated` is missing.

- [ ] **Step 3: Add the callback Joi schema**

Modify `apps/apiv1/kace_cloud_api_workspaces/src/WorkspaceSchema.mjs` by adding this export after the existing tag RestFlow id schema definitions:

```js
export const WorkspaceChannelHubRuleCreatedSchema = Joi.object({
    channel_hub_account_id: Joi.string().uuid().required(),
    connection_id: Joi.string().trim().required(),
    rule_id: Joi.string().trim().required(),
    execution_id: Joi.string().uuid().optional(),
});
```

Keep the existing `WorkspaceCreateSchema` and `WorkspaceUpdateSchema` exports unchanged.

- [ ] **Step 4: Add the controller custom method**

Modify `apps/apiv1/kace_cloud_api_workspaces/src/Controller.mjs`:

1. Update the first import:

```js
import {
    WorkspaceChannelHubRuleCreatedSchema,
    WorkspaceCreateSchema,
    WorkspaceUpdateSchema,
} from './WorkspaceSchema.mjs';
```

2. Add this import near `WorkspaceTagUpdateFlowQueuer`:

```js
import {
    WorkspaceChannelHubRuleRecorder,
    WorkspaceChannelHubRuleRecorderError,
} from './WorkspaceChannelHubRuleRecorder.mjs';
```

3. Add this method inside `Controller` before the final closing brace:

```js
    async runRecordChannelHubRuleCreated() {
        Helper.logInfo('Begin runRecordChannelHubRuleCreated');
        try {
            this.user = await this.getLoggedInUser();
        } catch (error) {
            Helper.logError('Error getLoggedInUser', error);
            return HttpResponse.badRequest({ message: error.message, errors: error, event: this.event });
        }

        try {
            const hasPermission = this.user.hasPermission('administrador', 'workspaces', 'WorkspacesUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const data = WorkspaceChannelHubRuleCreatedSchema.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const result = await new WorkspaceChannelHubRuleRecorder({
                workspaceRepository: this.repository,
            }).execute({
                workspaceId: id,
                channelHubAccountId: data.value.channel_hub_account_id,
                connectionId: data.value.connection_id,
                ruleId: data.value.rule_id,
                updatedBy: this.user.id.value,
            });

            return HttpResponse.ok({ data: result, event: this.event });
        } catch (error) {
            Helper.logError(error);
            if (error instanceof WorkspaceChannelHubRuleRecorderError) {
                const responseByStatus = {
                    400: HttpResponse.badRequest,
                    403: HttpResponse.forbidden,
                    404: HttpResponse.notFound,
                };
                const factory = responseByStatus[error.statusCode] ?? HttpResponse.badRequest;
                return factory({ message: error.message, errors: error, event: this.event });
            }
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            await this.destroyDbConnection();
            Helper.logInfo('End runRecordChannelHubRuleCreated');
        }
    }
```

- [ ] **Step 5: Route the custom endpoint in the handler**

Modify `apps/apiv1/kace_cloud_api_workspaces/src/handler.mjs` so `baseHandler` checks the route before calling `controller.run()`:

```js
import { withTenantContext } from '@kace/api-common';
import { Controller } from './Controller.mjs';

const CHANNEL_HUB_RULE_CREATED_ROUTE = '/{id}/channel-hub-tags/rule-created';

const baseHandler = async (event) => {
    const { knexConfig } = event.tenantContext;
    const controller = new Controller(event, knexConfig);

    if (event.httpMethod === 'POST' && event.resource === CHANNEL_HUB_RULE_CREATED_ROUTE) {
        const response = await controller.runRecordChannelHubRuleCreated();
        return response.toJson();
    }

    const response = await controller.run();
    return response.toJson();
};

export const handler = withTenantContext(baseHandler);
```

- [ ] **Step 6: Add the API Gateway resource**

Modify `apps/apiv1/kace_cloud_api_workspaces/lib/workspace-stack.ts` after the `shiftManagementResource` block:

```ts
        const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
        const channelHubTagsResource = idResource.addResource('channel-hub-tags');
        const ruleCreatedResource = channelHubTagsResource.addResource('rule-created');
        ruleCreatedResource.addMethod('POST', undefined, methodOptions);
```

The method must use `methodOptions` so Cognito/API auth remains enabled like the rest of the Workspace API.

- [ ] **Step 7: Add the local service manifest route**

Modify the `kace_cloud_api_workspaces` entry in `packages/kace_cloud_local_server/src/service-manifest.mjs` from:

```js
    { directory: 'kace_cloud_api_workspaces', basePath: 'workspaces', customRoutes: [] },
```

to:

```js
    {
        directory: 'kace_cloud_api_workspaces',
        basePath: 'workspaces',
        customRoutes: [{ method: 'POST', resource: '/{id}/channel-hub-tags/rule-created' }],
    },
```

This keeps local execution route discovery in sync with the deployed CDK route.

- [ ] **Step 8: Run Workspace API tests**

Run:

```bash
pnpm --filter @kace/api-workspaces test -- WorkspaceChannelHubRuleCreatedRoute.test.mjs WorkspaceChannelHubRuleRecorder.test.mjs WorkspaceSchema.test.mjs WorkspaceTagUpdateFlowQueuer.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

Run:

```bash
git add apps/apiv1/kace_cloud_api_workspaces/src/WorkspaceSchema.mjs apps/apiv1/kace_cloud_api_workspaces/src/Controller.mjs apps/apiv1/kace_cloud_api_workspaces/src/handler.mjs apps/apiv1/kace_cloud_api_workspaces/lib/workspace-stack.ts packages/kace_cloud_local_server/src/service-manifest.mjs apps/apiv1/kace_cloud_api_workspaces/tests/WorkspaceChannelHubRuleCreatedRoute.test.mjs
git commit -m "feat(workspaces): expose channel hub rule callback"
```

---

### Task 3: RestFlow callback catalog migration

**Files:**
- Create: `packages/kace_cloud_database/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.js`
- Create: `packages/kace_cloud_database/tests/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.test.js`

**Runtime configuration required before deploying this RestFlow step:**
- Secret Vault reference `KACE_RESTFLOW_CALLBACK_USERNAME` contains the login of an active KACE service account.
- Secret Vault reference `KACE_RESTFLOW_CALLBACK_PASSWORD` contains that service account password.
- The service account role grants `administrador / workspaces / WorkspacesUpdate`.
- The migration upserts `allowed_connections.connection = 'api.konecta.cloud'`; do not delete or deactivate that allowed connection in production because RestFlow callback auth and callback requests both use that domain.
- The Workspace callback endpoint config maps 4xx/5xx statuses in `on_error` to `workspace-channelhub-rule-callback-error`; that mapping is required so callback failures throw and mark the RestFlow execution failed.

- [ ] **Step 1: Write the migration test**

Create `packages/kace_cloud_database/tests/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.test.js` with this content:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import knexLib from 'knex';

import {
    CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
    KACE_API_ALLOWED_CONNECTION_ID,
    KACE_SERVICE_AUTH_ENDPOINT_ID,
    WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
    buildKaceApiAllowedConnectionRow,
    buildKaceServiceAuthEndpointRow,
    buildWorkspaceRuleCallbackEndpointRow,
    up,
    down,
} from '../../migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.js';

const CREATE_TAG_ENDPOINT_ID = '5ac4c03c-f840-4fa4-aaea-60734b08a02f';
const CREATE_TAG_FLOW_ID = '87a4be75-21eb-4da4-85dc-71c7fd7de006';
const CREATE_TAG_STEP_ID = 'd1eeda01-e373-40a1-8fe2-50a7107dd0ba';
const SECOND_STEP_ID = 'b25f4d4f-cf1f-4b89-8d9e-1d2cbbfcdd1a';

async function createSchema(db) {
    await db.schema.createTable('ws_rest_endpoints', (table) => {
        table.string('id', 36).primary();
        table.string('type');
        table.string('description');
        table.text('url');
        table.string('method');
        table.text('headers');
        table.text('body');
        table.boolean('is_dynamic_body');
        table.boolean('is_active');
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
        table.string('authorization_id', 36);
        table.boolean('is_dynamic_header');
        table.text('filter_input');
        table.text('context_position');
        table.text('on_success');
        table.text('on_error');
        table.integer('attempts');
        table.text('initial_context');
        table.text('body_type');
        table.text('cache_expires_in_path');
        table.integer('cache_default_ttl_seconds');
    });

    await db.schema.createTable('allowed_connections', (table) => {
        table.string('id', 36).primary();
        table.string('description', 255);
        table.string('connection', 255);
        table.text('certificate');
        table.boolean('is_active');
        table.boolean('has_ssl');
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
    });

    await db.schema.createTable('ws_rest_workflow_steps', (table) => {
        table.string('id', 36).primary();
        table.string('flow_id', 36);
        table.integer('order');
        table.string('endpoint_id', 36);
        table.string('function_id', 36);
        table.string('conditional_id', 36);
        table.string('parent_step_id', 36);
        table.timestamp('created_at');
        table.string('created_by', 36);
        table.timestamp('updated_at');
        table.string('updated_by', 36);
        table.timestamp('deleted_at');
        table.string('deleted_by', 36);
    });
}

async function seedCreateTagFlow(db) {
    await db('ws_rest_endpoints').insert({
        id: CREATE_TAG_ENDPOINT_ID,
        type: 'consumption',
        description: 'Channel Hub - Crear Tag (email rule)',
        url: 'https://api.konecta.cloud/one-channel-hub/tst/v1/channel/email/rule',
        method: 'POST',
        headers: JSON.stringify({ headers: { Authorization: 'Bearer context.channel_hub.auth.access_token' } }),
        body: JSON.stringify({ body: 'context.channel_hub_tag_request' }),
        is_dynamic_body: true,
        is_active: true,
        created_at: '2026-05-21 03:12:39.347 -05:00',
        created_by: 'e733cac1-001f-46fc-9ad4-b7ebffaca7d7',
        updated_at: '2026-05-21 08:29:11.814 -05:00',
        updated_by: 'e733cac1-001f-46fc-9ad4-b7ebffaca7d7',
        deleted_at: null,
        deleted_by: null,
        authorization_id: '06cf3374-f17b-4109-8d37-b16584f91a73',
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: [] }),
        context_position: 'channel_hub_tag.response',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
        body_type: 'json',
    });

    await db('ws_rest_workflow_steps').insert([
        {
            id: CREATE_TAG_STEP_ID,
            flow_id: CREATE_TAG_FLOW_ID,
            order: 2,
            endpoint_id: CREATE_TAG_ENDPOINT_ID,
            function_id: null,
            conditional_id: null,
            parent_step_id: null,
            created_at: '2026-05-22 12:00:00 -05:00',
            created_by: '7d15692d-5bf4-4135-8096-06e7b1098b54',
        },
        {
            id: SECOND_STEP_ID,
            flow_id: CREATE_TAG_FLOW_ID,
            order: 3,
            endpoint_id: null,
            function_id: 'b21e3fb8-63e4-4ca0-91a0-1e58908bfa2f',
            conditional_id: null,
            parent_step_id: null,
            created_at: '2026-05-22 12:00:00 -05:00',
            created_by: '7d15692d-5bf4-4135-8096-06e7b1098b54',
        },
    ]);
}

async function withDatabase(fn) {
    const db = knexLib({ client: 'sqlite3', connection: ':memory:', useNullAsDefault: true });
    try {
        await createSchema(db);
        await fn(db);
    } finally {
        await db.destroy();
    }
}

test('builder rows define KACE service auth, allowed connection, and Workspace callback endpoint', () => {
    const allowedConnection = buildKaceApiAllowedConnectionRow('2026-05-22 15:00:00 -05:00');
    const auth = buildKaceServiceAuthEndpointRow('2026-05-22 15:00:00 -05:00');
    const callback = buildWorkspaceRuleCallbackEndpointRow('2026-05-22 15:00:00 -05:00');

    assert.equal(allowedConnection.id, KACE_API_ALLOWED_CONNECTION_ID);
    assert.equal(allowedConnection.description, 'KACE Cloud API');
    assert.equal(allowedConnection.connection, 'api.konecta.cloud');
    assert.equal(allowedConnection.is_active, true);
    assert.equal(allowedConnection.has_ssl, false);

    assert.equal(auth.id, KACE_SERVICE_AUTH_ENDPOINT_ID);
    assert.equal(auth.description, 'KACE Cloud - RestFlow service account auth');
    assert.equal(auth.url, 'https://api.konecta.cloud/auth-cognito');
    assert.deepEqual(JSON.parse(auth.headers), {
        headers: {
            'Content-Type': 'application/json',
            'X-Client-Fingerprint': 'kace-restflow-callback',
        },
    });
    assert.deepEqual(JSON.parse(auth.body), {
        body: {
            username: 'SECRET_KACE_RESTFLOW_CALLBACK_USERNAME',
            password: 'SECRET_KACE_RESTFLOW_CALLBACK_PASSWORD',
        },
    });
    assert.deepEqual(JSON.parse(auth.filter_input), { filter_input: ['data.id_token'] });
    assert.equal(auth.context_position, 'kace.auth');

    assert.equal(callback.id, WORKSPACE_RULE_CALLBACK_ENDPOINT_ID);
    assert.equal(callback.description, 'Workspace - Persist Channel Hub Rule Id');
    assert.equal(callback.url, 'https://api.konecta.cloud/workspaces/context.workspace.id/channel-hub-tags/rule-created');
    assert.equal(callback.method, 'POST');
    assert.equal(callback.authorization_id, KACE_SERVICE_AUTH_ENDPOINT_ID);
    assert.deepEqual(JSON.parse(callback.headers), {
        headers: { Authorization: 'Bearer context.kace.auth.id_token' },
    });
    assert.deepEqual(JSON.parse(callback.body), {
        body: {
            channel_hub_account_id: 'context.workspace.channel_hub_accounts[0].id',
            connection_id: 'context.channel_hub_tag.response.connectionId',
            rule_id: 'context.channel_hub_tag.response.id',
        },
    });
    assert.equal(callback.context_position, 'workspace.channel_hub_tag_rule_created');
    assert.deepEqual(JSON.parse(callback.on_error), {
        on_error: {
            400: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            401: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            403: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            404: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            409: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            422: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
            500: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
        },
    });
});

test('up inserts callback endpoint and step after active create-tag POST endpoint', async () => {
    await withDatabase(async (db) => {
        await seedCreateTagFlow(db);

        await up(db);

        const allowedConnections = await db('allowed_connections').orderBy('id');
        assert.ok(allowedConnections.some((connection) => connection.id === KACE_API_ALLOWED_CONNECTION_ID));
        assert.ok(allowedConnections.some((connection) => connection.connection === 'api.konecta.cloud'));

        const endpoints = await db('ws_rest_endpoints').orderBy('id');
        assert.ok(endpoints.some((endpoint) => endpoint.id === KACE_SERVICE_AUTH_ENDPOINT_ID));
        assert.ok(endpoints.some((endpoint) => endpoint.id === WORKSPACE_RULE_CALLBACK_ENDPOINT_ID));

        const steps = await db('ws_rest_workflow_steps').where({ flow_id: CREATE_TAG_FLOW_ID }).orderBy('order');
        assert.equal(steps.length, 3);
        assert.equal(steps[0].id, CREATE_TAG_STEP_ID);
        assert.equal(steps[0].order, 2);
        assert.equal(steps[1].endpoint_id, WORKSPACE_RULE_CALLBACK_ENDPOINT_ID);
        assert.equal(steps[1].order, 3);
        assert.equal(steps[2].id, SECOND_STEP_ID);
        assert.equal(steps[2].order, 4);
    });
});

test('up is idempotent and does not duplicate callback steps', async () => {
    await withDatabase(async (db) => {
        await seedCreateTagFlow(db);

        await up(db);
        await up(db);

        const callbackSteps = await db('ws_rest_workflow_steps').where({
            flow_id: CREATE_TAG_FLOW_ID,
            endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
        });
        assert.equal(callbackSteps.length, 1);
    });
});

test('down removes callback step and restores shifted workflow orders', async () => {
    await withDatabase(async (db) => {
        await seedCreateTagFlow(db);
        await up(db);

        await down(db);

        const allowedConnections = await db('allowed_connections').orderBy('id');
        assert.equal(allowedConnections.some((connection) => connection.id === KACE_API_ALLOWED_CONNECTION_ID), false);

        const endpoints = await db('ws_rest_endpoints').orderBy('id');
        assert.equal(endpoints.some((endpoint) => endpoint.id === WORKSPACE_RULE_CALLBACK_ENDPOINT_ID), false);
        assert.equal(endpoints.some((endpoint) => endpoint.id === KACE_SERVICE_AUTH_ENDPOINT_ID), false);

        const steps = await db('ws_rest_workflow_steps').where({ flow_id: CREATE_TAG_FLOW_ID }).orderBy('order');
        assert.deepEqual(
            steps.map((step) => ({ id: step.id, order: step.order })),
            [
                { id: CREATE_TAG_STEP_ID, order: 2 },
                { id: SECOND_STEP_ID, order: 3 },
            ]
        );
    });
});
```

- [ ] **Step 2: Run the migration test and verify it fails because the migration does not exist**

Run:

```bash
node --test packages/kace_cloud_database/tests/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.test.js
```

Expected: FAIL with an import/module-not-found error for the migration file.

- [ ] **Step 3: Implement the migration**

Create `packages/kace_cloud_database/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.js` with this content:

```js
import { randomUUID } from 'node:crypto';

const ALLOWED_CONNECTIONS_TABLE = 'allowed_connections';
const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WS_REST_WORKFLOW_STEPS_TABLE = 'ws_rest_workflow_steps';
const SYSTEM_USER_ID = '7d15692d-5bf4-4135-8096-06e7b1098b54';
const CREATED_AT = '2026-05-22 15:00:00 -05:00';
const CHANNEL_HUB_CREATE_EMAIL_RULE_URL_PATTERN = '%/v1/channel/email/rule';

export const KACE_API_ALLOWED_CONNECTION_ID = '2aa5ab01-96ed-4f06-bfe8-467ffb04266d';
export const KACE_SERVICE_AUTH_ENDPOINT_ID = 'b62dbe60-3db6-4a98-8884-1fb469a09ace';
export const WORKSPACE_RULE_CALLBACK_ENDPOINT_ID = '9d7f3e6f-41d4-48ea-a8f1-8c725c0d7be0';
export const CALLBACK_ERROR_HOOK_EXTERNAL_CODE = 'workspace-channelhub-rule-callback-error';

const KACE_API_DOMAIN = 'api.konecta.cloud';
const CALLBACK_ERROR_STATUS_MAP = {
    400: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
    401: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
    403: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
    404: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
    409: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
    422: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
    500: CALLBACK_ERROR_HOOK_EXTERNAL_CODE,
};

export function buildKaceApiAllowedConnectionRow(createdAt = CREATED_AT) {
    return {
        id: KACE_API_ALLOWED_CONNECTION_ID,
        description: 'KACE Cloud API',
        connection: KACE_API_DOMAIN,
        certificate: null,
        is_active: true,
        has_ssl: false,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: createdAt,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
    };
}

export function buildKaceServiceAuthEndpointRow(createdAt = CREATED_AT) {
    return {
        id: KACE_SERVICE_AUTH_ENDPOINT_ID,
        type: 'authorization',
        description: 'KACE Cloud - RestFlow service account auth',
        url: 'https://api.konecta.cloud/auth-cognito',
        method: 'POST',
        headers: JSON.stringify({
            headers: {
                'Content-Type': 'application/json',
                'X-Client-Fingerprint': 'kace-restflow-callback',
            },
        }),
        body: JSON.stringify({
            body: {
                username: 'SECRET_KACE_RESTFLOW_CALLBACK_USERNAME',
                password: 'SECRET_KACE_RESTFLOW_CALLBACK_PASSWORD',
            },
        }),
        is_dynamic_body: true,
        is_active: true,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: createdAt,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: null,
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: ['data.id_token'] }),
        context_position: 'kace.auth',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: {} }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
        body_type: 'json',
        cache_expires_in_path: null,
        cache_default_ttl_seconds: null,
    };
}

export function buildWorkspaceRuleCallbackEndpointRow(createdAt = CREATED_AT) {
    return {
        id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
        type: 'consumption',
        description: 'Workspace - Persist Channel Hub Rule Id',
        url: 'https://api.konecta.cloud/workspaces/context.workspace.id/channel-hub-tags/rule-created',
        method: 'POST',
        headers: JSON.stringify({
            headers: {
                Authorization: 'Bearer context.kace.auth.id_token',
            },
        }),
        body: JSON.stringify({
            body: {
                channel_hub_account_id: 'context.workspace.channel_hub_accounts[0].id',
                connection_id: 'context.channel_hub_tag.response.connectionId',
                rule_id: 'context.channel_hub_tag.response.id',
            },
        }),
        is_dynamic_body: true,
        is_active: true,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: createdAt,
        updated_by: SYSTEM_USER_ID,
        deleted_at: null,
        deleted_by: null,
        authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID,
        is_dynamic_header: true,
        filter_input: JSON.stringify({ filter_input: [] }),
        context_position: 'workspace.channel_hub_tag_rule_created',
        on_success: JSON.stringify({ on_success: {} }),
        on_error: JSON.stringify({ on_error: CALLBACK_ERROR_STATUS_MAP }),
        attempts: 0,
        initial_context: JSON.stringify({ initial_context: {} }),
        body_type: 'json',
        cache_expires_in_path: null,
        cache_default_ttl_seconds: null,
    };
}

function buildCallbackStepRow({ flowId, order, createdAt = CREATED_AT }) {
    return {
        id: randomUUID(),
        flow_id: flowId,
        order,
        endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID,
        function_id: null,
        conditional_id: null,
        parent_step_id: null,
        created_at: createdAt,
        created_by: SYSTEM_USER_ID,
        updated_at: null,
        updated_by: null,
        deleted_at: null,
        deleted_by: null,
    };
}

async function ensureKaceApiAllowedConnection(knex) {
    const row = buildKaceApiAllowedConnectionRow();
    const existingByDomain = await knex(ALLOWED_CONNECTIONS_TABLE)
        .where({ connection: KACE_API_DOMAIN })
        .whereNull('deleted_at')
        .first('id');

    if (existingByDomain) {
        await knex(ALLOWED_CONNECTIONS_TABLE).where({ id: existingByDomain.id }).update({
            description: row.description,
            is_active: row.is_active,
            has_ssl: row.has_ssl,
            updated_at: row.updated_at,
            updated_by: row.updated_by,
        });
        return;
    }

    await knex(ALLOWED_CONNECTIONS_TABLE).insert(row);
}

async function upsertEndpoint(knex, row) {
    const existing = await knex(WS_REST_ENDPOINTS_TABLE).where({ id: row.id }).first('id');
    if (!existing) {
        await knex(WS_REST_ENDPOINTS_TABLE).insert(row);
        return;
    }

    await knex(WS_REST_ENDPOINTS_TABLE)
        .where({ id: row.id })
        .update({
            type: row.type,
            description: row.description,
            url: row.url,
            method: row.method,
            headers: row.headers,
            body: row.body,
            is_dynamic_body: row.is_dynamic_body,
            is_active: row.is_active,
            updated_at: row.updated_at,
            updated_by: row.updated_by,
            deleted_at: row.deleted_at,
            deleted_by: row.deleted_by,
            authorization_id: row.authorization_id,
            is_dynamic_header: row.is_dynamic_header,
            filter_input: row.filter_input,
            context_position: row.context_position,
            on_success: row.on_success,
            on_error: row.on_error,
            attempts: row.attempts,
            initial_context: row.initial_context,
            body_type: row.body_type,
            cache_expires_in_path: row.cache_expires_in_path,
            cache_default_ttl_seconds: row.cache_default_ttl_seconds,
        });
}

async function ensureEndpoints(knex) {
    await upsertEndpoint(knex, buildKaceServiceAuthEndpointRow());
    await upsertEndpoint(knex, buildWorkspaceRuleCallbackEndpointRow());
}

async function findCreateTagEndpointSteps(knex) {
    return knex(`${WS_REST_WORKFLOW_STEPS_TABLE} as steps`)
        .join(`${WS_REST_ENDPOINTS_TABLE} as endpoints`, 'steps.endpoint_id', 'endpoints.id')
        .select('steps.flow_id', 'steps.order')
        .where('endpoints.url', 'like', CHANNEL_HUB_CREATE_EMAIL_RULE_URL_PATTERN)
        .whereRaw('upper(endpoints.method) = ?', ['POST'])
        .whereNull('steps.deleted_at')
        .whereNull('endpoints.deleted_at')
        .orderBy('steps.flow_id')
        .orderBy('steps.order');
}

async function ensureCallbackSteps(knex) {
    const createTagSteps = await findCreateTagEndpointSteps(knex);

    for (const step of createTagSteps) {
        const existingCallbackStep = await knex(WS_REST_WORKFLOW_STEPS_TABLE)
            .where({ flow_id: step.flow_id, endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID })
            .whereNull('deleted_at')
            .first('id');

        if (existingCallbackStep) continue;

        const callbackOrder = step.order + 1;
        await knex(WS_REST_WORKFLOW_STEPS_TABLE)
            .where({ flow_id: step.flow_id })
            .whereNull('deleted_at')
            .where('order', '>=', callbackOrder)
            .increment('order', 1);

        await knex(WS_REST_WORKFLOW_STEPS_TABLE).insert(
            buildCallbackStepRow({ flowId: step.flow_id, order: callbackOrder })
        );
    }
}

async function removeCallbackSteps(knex) {
    const callbackSteps = await knex(WS_REST_WORKFLOW_STEPS_TABLE)
        .select('id', 'flow_id', 'order')
        .where({ endpoint_id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID })
        .whereNull('deleted_at')
        .orderBy('flow_id')
        .orderBy('order', 'desc');

    for (const step of callbackSteps) {
        await knex(WS_REST_WORKFLOW_STEPS_TABLE)
            .where({ flow_id: step.flow_id })
            .whereNull('deleted_at')
            .where('order', '>', step.order)
            .decrement('order', 1);

        await knex(WS_REST_WORKFLOW_STEPS_TABLE).where({ id: step.id }).del();
    }
}

async function removeOwnedAllowedConnection(knex) {
    await knex(ALLOWED_CONNECTIONS_TABLE).where({ id: KACE_API_ALLOWED_CONNECTION_ID }).del();
}

async function removeOwnedEndpoints(knex) {
    await knex(WS_REST_ENDPOINTS_TABLE).where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).del();

    const authStillReferenced = await knex(WS_REST_ENDPOINTS_TABLE)
        .where({ authorization_id: KACE_SERVICE_AUTH_ENDPOINT_ID })
        .first('id');

    if (!authStillReferenced) {
        await knex(WS_REST_ENDPOINTS_TABLE).where({ id: KACE_SERVICE_AUTH_ENDPOINT_ID }).del();
    }
}

export async function up(knex) {
    await ensureKaceApiAllowedConnection(knex);
    await ensureEndpoints(knex);
    await ensureCallbackSteps(knex);
}

export async function down(knex) {
    await removeCallbackSteps(knex);
    await removeOwnedEndpoints(knex);
    await removeOwnedAllowedConnection(knex);
}
```

- [ ] **Step 4: Run the migration test and verify it passes**

Run:

```bash
node --test packages/kace_cloud_database/tests/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add packages/kace_cloud_database/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.js packages/kace_cloud_database/tests/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.test.js
git commit -m "feat(database): add workspace rule callback restflow step"
```

---

### Task 4: Remove Event Processor Workspace-specific side effect

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_event_processor/src/handler.mjs`
- Modify: `apps/apiv1/kace_cloud_api_event_processor/test/handler.test.mjs`
- Delete: `apps/apiv1/kace_cloud_api_event_processor/src/WorkspaceChannelHubRuleIdPersister.mjs`
- Delete: `apps/apiv1/kace_cloud_api_event_processor/test/WorkspaceChannelHubRuleIdPersister.test.mjs`

- [ ] **Step 1: Run current Event Processor tests to confirm the persister assertions exist**

Run:

```bash
pnpm --filter @kace/api-event-processor test -- handler.test.mjs WorkspaceChannelHubRuleIdPersister.test.mjs
```

Expected before this task: tests pass on the current branch and include persister-specific coverage.

- [ ] **Step 2: Remove persister imports and call from the handler**

Modify `apps/apiv1/kace_cloud_api_event_processor/src/handler.mjs`:

1. Delete these imports:

```js
import { KnexWorkspacesRepository } from '@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import { WorkspaceChannelHubRuleIdPersister } from './WorkspaceChannelHubRuleIdPersister.mjs';
```

2. In `processWSRestFlowExecutionEvent`, delete this block after `await handler.handle(domainEvent);`:

```js
    await new WorkspaceChannelHubRuleIdPersister({
        executionRepository,
        workspaceRepository: new KnexWorkspacesRepository(knexInstance),
    }).persistFromExecution(domainEvent.aggregateId, { userId });
```

The function must end with the generic RestFlow handler only:

```js
    const handler = new ExecuteWSRestFlowOnExecutionRequested(executionRepository, workflowExecutor);
    await handler.handle(domainEvent);
```

- [ ] **Step 3: Remove the persister implementation file**

Run:

```bash
git rm apps/apiv1/kace_cloud_api_event_processor/src/WorkspaceChannelHubRuleIdPersister.mjs
```

- [ ] **Step 4: Update handler tests to remove persister mocks and assertions**

Modify `apps/apiv1/kace_cloud_api_event_processor/test/handler.test.mjs`:

1. Delete this variable:

```js
const mockPersistWorkspaceRuleIdFromExecution = jest.fn().mockResolvedValue(false);
```

2. Delete these module mocks:

```js
jest.unstable_mockModule('@kace/core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js', () => ({
    KnexWorkspacesRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('../src/WorkspaceChannelHubRuleIdPersister.mjs', () => ({
    WORKSPACES_REGISTER_TAG_SOURCE: 'workspaces.register_tags',
    WorkspaceChannelHubRuleIdPersister: jest.fn().mockImplementation(() => ({
        persistFromExecution: mockPersistWorkspaceRuleIdFromExecution,
    })),
}));
```

3. Delete these two test cases completely:

```js
it('should persist the Channel Hub rule id after a workspace register-tags REST flow execution', async () => {
    ...
});

it('should ask the workspace rule-id persister to inspect completed REST flow executions even when the event payload has no workspace source', async () => {
    ...
});
```

4. Keep the existing generic WS RestFlow test assertions that verify `ExecuteWSRestFlowOnExecutionRequested.handle()` runs.

- [ ] **Step 5: Remove persister tests**

Run:

```bash
git rm apps/apiv1/kace_cloud_api_event_processor/test/WorkspaceChannelHubRuleIdPersister.test.mjs
```

- [ ] **Step 6: Run Event Processor tests**

Run:

```bash
pnpm --filter @kace/api-event-processor test -- handler.test.mjs
```

Expected: PASS. Event Processor remains responsible for executing RestFlows, not Workspace-specific persistence.

- [ ] **Step 7: Commit Task 4**

Run:

```bash
git add apps/apiv1/kace_cloud_api_event_processor/src/handler.mjs apps/apiv1/kace_cloud_api_event_processor/test/handler.test.mjs
git commit -m "refactor(event-processor): remove workspace rule side effect"
```

---

### Task 5: End-to-end verification and deploy order

**Files:**
- No code files changed in this task.

- [ ] **Step 1: Run focused Workspace API tests**

Run:

```bash
pnpm --filter @kace/api-workspaces test -- WorkspaceChannelHubRuleCreatedRoute.test.mjs WorkspaceChannelHubRuleRecorder.test.mjs WorkspaceSchema.test.mjs WorkspaceTagUpdateFlowQueuer.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run focused database migration tests**

Run:

```bash
node --test packages/kace_cloud_database/tests/migrations/20260522150000_add_workspace_channel_hub_rule_callback_step.test.js packages/kace_cloud_database/tests/migrations/20260522120000_normalize_channel_hub_email_rule_flow.test.js
```

Expected: PASS.

- [ ] **Step 3: Run focused Event Processor tests**

Run:

```bash
pnpm --filter @kace/api-event-processor test -- handler.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Build the modified backend packages**

Run:

```bash
pnpm --filter @kace/api-workspaces build
pnpm --filter @kace/api-event-processor build
```

Expected: both TypeScript builds finish without errors.

- [ ] **Step 5: Deploy in the safe order**

Deploy Workspace API first so the callback route exists before the RestFlow catalog calls it:

```bash
pnpm --filter @kace/api-workspaces run cdk:deploy
```

Then deploy Event Processor cleanup:

```bash
pnpm --filter @kace/api-event-processor run cdk:deploy
```

Then run database migrations/seeds in the tenant environment so the RestFlow callback endpoint and step exist:

```bash
pnpm --filter @kace/database run migrate:latest
```

- [ ] **Step 6: Verify Secret Vault and service account before triggering a real create-tag flow**

Check the deployed tenant database has two Secret Vault rows with these references:

```text
KACE_RESTFLOW_CALLBACK_USERNAME
KACE_RESTFLOW_CALLBACK_PASSWORD
```

Check the referenced service account is active and its role grants:

```text
module: administrador
resource: workspaces
permission: WorkspacesUpdate
```

- [ ] **Step 7: Verify the deployed callback endpoint configuration before triggering a real flow**

Query the tenant database:

```sql
select id, authorization_id, headers, body, on_error
from ws_rest_endpoints
where id = '9d7f3e6f-41d4-48ea-a8f1-8c725c0d7be0';

select id, description, connection, is_active, has_ssl
from allowed_connections
where connection = 'api.konecta.cloud'
  and deleted_at is null;
```

Expected:

```text
authorization_id = b62dbe60-3db6-4a98-8884-1fb469a09ace
headers includes Authorization: Bearer context.kace.auth.id_token
body includes channel_hub_account_id, connection_id, rule_id context paths
on_error maps 400, 401, 403, 404, 409, 422, and 500 to workspace-channelhub-rule-callback-error
allowed_connections has an active api.konecta.cloud row
```

- [ ] **Step 8: Trigger the real workspace register-tags action**

Use a workspace that has:

```json
{
  "id": "95346f17-4ee8-420d-a0af-16d2ac394dd9",
  "tag_creation_flow_id": "87a4be75-21eb-4da4-85dc-71c7fd7de006",
  "channel_hub_accounts": [
    {
      "id": "5bef0eb7-6781-4423-806e-d320cc6ed619",
      "channel_hub_connection_id": "3E3R0BE70304do9a0Z6a9mqmTCK"
    }
  ]
}
```

Expected CloudWatch/Event Processor sequence:

```text
Channel Hub - Crear Tag (email rule) status 200
Workspace - Persist Channel Hub Rule Id status 200
ExecuteWSRestFlowOnExecutionRequested: Execution completed status completed
```

- [ ] **Step 9: Verify the workspace row**

Query the tenant database:

```sql
select id, rules
from workspaces
where id = '95346f17-4ee8-420d-a0af-16d2ac394dd9';
```

Expected `rules` contains the Channel Hub response id:

```json
{
  "ruleName": "TAGS",
  "subjectContains": ["TAGS", "WORK"],
  "actionRules": { "classifyAs": "TAGS" },
  "ruleId": "3E5FX4NM9SGdWZzz9Ad0ZNGHskf"
}
```

- [ ] **Step 10: Verify update-tag flow can run after rule id persistence**

Update the same workspace rules from the UI. Expected Event Processor sequence:

```text
Channel Hub - Actualizar tag (email rule) method PUT
url includes /channel/email/rule/3E3R0BE70304do9a0Z6a9mqmTCK/3E5FX4NM9SGdWZzz9Ad0ZNGHskf
ExecuteWSRestFlowOnExecutionRequested: Execution completed status completed
```

- [ ] **Step 11: Confirm the working tree only contains intended feature changes**

Run:

```bash
git status --short
```

Expected: only files from this plan are staged or modified. Unrelated pre-existing files such as `pnpm-lock.yaml`, `.superpowers/`, `apps/kace-saas/test-results/`, `apps/kace-saas/tests/`, `channel-hub-inbound-to-interaction-flow.html`, and `docs/testing/codex-goals/` remain untouched by this feature.

---

## Self-Review

- Spec coverage: The plan implements the approved Option 3 callback endpoint, persists `workspaces.rules.ruleId`, validates that the account id and connection id belong to the same assigned Channel Hub account, routes outside `BaseController.run()`, updates CDK and local route manifest, keeps Event Processor generic, adds service-account auth plus `api.konecta.cloud` allowed connection, configures callback `on_error` failure semantics, and documents deploy order.
- Placeholder scan: The plan uses concrete filenames, route paths, endpoint ids, endpoint URLs, secret reference names, commands, expected outputs, and JSON bodies. No placeholder task remains.
- Type consistency: The callback request uses `channel_hub_account_id`, `connection_id`, and `rule_id`; controller maps them to `channelHubAccountId`, `connectionId`, and `ruleId`; the service persists `rules.ruleId`; the RestFlow body uses the same source context paths that exist after the Channel Hub create-tag endpoint stores `channel_hub_tag.response`.
