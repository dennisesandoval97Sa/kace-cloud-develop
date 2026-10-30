# Channel Hub Inbound Email Issue 05 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge the legacy interactions `/webhook` route onto the canonical Channel Hub inbound email processor so there is only one Channel Hub Email + Interaction ingestion behavior.

**Architecture:** Keep the public `/channel-hub` webhook as the canonical inbound adapter and make the legacy interactions webhook a transition adapter that validates the same Channel Hub payload, delegates to the same `ChannelHubInboundEmailProcessor`, and maps processor result categories through the same HTTP response mapper. Remove independent EmailCreator/InteractionCreator/WebhookMapper business orchestration from the legacy route; preserve non-webhook Interaction CRUD and Channel Hub account-management behavior.

**Tech Stack:** Node.js ESM, `@kace/api-common` response/schema utilities, `@kace/core` Channel Hub inbound processor, Jest API adapter tests.

**Constraints:** Work in the current workspace/branch; do not create a git worktree; do not commit. Use TDD: write failing tests, verify RED, implement minimal code, verify GREEN. Issue 01/02/03/04 changes are intentionally present.

---

## File Structure

- Create `packages/kace_cloud_api_common/src/validation/schemas/ChannelHubInboundEmailSchema.js` — single shared Joi schema for Channel Hub inbound webhook payloads.
- Create `packages/kace_cloud_api_common/src/http_responses/ChannelHubInboundEmailWebhookResponse.js` — single shared mapper from processor result categories to HTTP responses.
- Modify `packages/kace_cloud_api_common/src/index.js` — export the shared schema/response mapper.
- Create `packages/kace_cloud_core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js` — shared factory that wires repositories, allowed connection adapter, body/attachment downloaders, tenant-aware S3 storage, and scanner.
- Modify `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs` — re-export the shared schema so existing public webhook tests/imports keep working.
- Modify `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs` — use the shared schema, shared response mapper, and shared processor factory.
- Modify `apps/apiv1/kace_cloud_api_interactions/src/ControllerWebhook.mjs` — make legacy `/webhook` validate/delegate/map through the canonical Channel Hub processor; remove independent EmailCreator/InteractionCreator/WebhookMapper flow from this path.
- Create `apps/apiv1/kace_cloud_api_interactions/test/ControllerWebhook.test.mjs` — focused adapter tests proving legacy route delegation and response-category parity.
- Optionally tighten the webhook section in `apps/apiv1/kace_cloud_api_interactions/test/InteractionE2E.test.mjs` only if the focused unit tests cannot cover the acceptance criteria.

---

### Task 1: Extract shared Channel Hub schema and HTTP response mapper

**Files:**
- Create: `packages/kace_cloud_api_common/src/validation/schemas/ChannelHubInboundEmailSchema.js`
- Create: `packages/kace_cloud_api_common/src/http_responses/ChannelHubInboundEmailWebhookResponse.js`
- Modify: `packages/kace_cloud_api_common/src/index.js`
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs`
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs`
- Test: `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs`

- [ ] **Step 1: Preserve public webhook tests as the characterization test**

Run the existing public webhook adapter tests before changing code:

```bash
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
```

Expected: PASS before refactor. These tests characterize the current schema and response behavior that the legacy route must share.

- [ ] **Step 2: Move the Joi schema to api-common**

Create `packages/kace_cloud_api_common/src/validation/schemas/ChannelHubInboundEmailSchema.js` with the exact current schema shape from `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs`:

```js
import Joi from 'joi';

const recipientSchema = Joi.alternatives().try(
    Joi.string().email().max(120),
    Joi.object({
        email: Joi.string().email().max(120).required(),
        name: Joi.string().allow(null, ''),
    }).unknown(true)
);

const attachmentSchema = Joi.object({
    url: Joi.string().uri().required(),
    filename: Joi.string().max(255).allow(null, '').optional(),
    name: Joi.string().max(255).allow(null, '').optional(),
    fileName: Joi.string().max(255).allow(null, '').optional(),
    content_type: Joi.string().max(255).allow(null, '').optional(),
    contentType: Joi.string().max(255).allow(null, '').optional(),
    size: Joi.number().integer().min(0).optional(),
}).unknown(true);

export const channelHubSchema = Joi.object({
    messageId: Joi.string().max(255).when('messageIdOperator', {
        is: Joi.exist(),
        then: Joi.optional(),
        otherwise: Joi.required(),
    }),
    messageIdOperator: Joi.string().max(255),
    origin: Joi.alternatives()
        .try(
            Joi.string().email().max(120),
            Joi.object({
                email: Joi.string().email().max(120).required(),
                name: Joi.string().allow(null, ''),
            }).unknown(true)
        )
        .required(),
    subject: Joi.string().max(120),
    tags: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string()).min(1)).required(),
    destination: Joi.object({
        to: Joi.alternatives().try(recipientSchema, Joi.array().items(recipientSchema)),
        cc: Joi.alternatives().try(recipientSchema, Joi.array().items(recipientSchema)),
        bcc: Joi.alternatives().try(recipientSchema, Joi.array().items(recipientSchema)),
    })
        .or('to', 'cc', 'bcc')
        .required()
        .unknown(true),
    content: Joi.object({
        text: Joi.string().uri().required(),
        html: Joi.string().uri().optional(),
    })
        .required()
        .unknown(true),
    attachments: Joi.array().items(attachmentSchema).optional(),
}).options({ allowUnknown: true });
```

Export it from `packages/kace_cloud_api_common/src/index.js`:

```js
export { channelHubSchema } from './validation/schemas/ChannelHubInboundEmailSchema.js';
```

Make `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs` re-export the shared schema:

```js
export { channelHubSchema } from '@kace/api-common';
```

- [ ] **Step 3: Extract processor-result response mapping**

Create `packages/kace_cloud_api_common/src/http_responses/ChannelHubInboundEmailWebhookResponse.js`:

```js
import { HttpResponse } from './HttpResponse.js';

export class ChannelHubInboundEmailWebhookResponse {
    static fromProcessingResult(result, event) {
        if (result.accepted) {
            return HttpResponse.ok({
                message: 'Webhook received',
                data: result.data ?? {},
                event,
            });
        }

        if (result.nonRetryable) {
            return HttpResponse.badRequest({
                message: result.message ?? 'Channel Hub inbound email was rejected.',
                errors: {
                    code: result.code,
                    message: result.message,
                },
                event,
            });
        }

        return HttpResponse.internalServerError({
            message: result.message ?? 'Channel Hub inbound email processing failed.',
            errors: {
                code: result.code,
                message: result.message,
            },
            event,
        });
    }
}
```

Export it from `packages/kace_cloud_api_common/src/index.js`:

```js
export { ChannelHubInboundEmailWebhookResponse } from './http_responses/ChannelHubInboundEmailWebhookResponse.js';
```

Update `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs` to use the shared mapper instead of its private `#responseFromProcessingResult` method:

```js
import { ChannelHubInboundEmailWebhookResponse, HttpResponse } from '@kace/api-common';

// ...
return ChannelHubInboundEmailWebhookResponse.fromProcessingResult(result, this.#event);
```

- [ ] **Step 4: Verify public webhook remains GREEN**

Run:

```bash
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
```

Expected: PASS with the same 18 public webhook tests.

---

### Task 2: Share processor wiring between public and legacy webhook adapters

**Files:**
- Create: `packages/kace_cloud_core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js`
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs`
- Test: `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs`

- [ ] **Step 1: Create a shared factory using the public webhook wiring**

Create `packages/kace_cloud_core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js`:

```js
import { ChannelHubInboundEmailProcessor } from '../application/ChannelHubInboundEmailProcessor.js';
import { ChannelHubInboundAttachmentDownloader } from '../application/ChannelHubInboundAttachmentDownloader.js';
import { ChannelHubInboundTextBodyDownloader } from '../application/ChannelHubInboundTextBodyDownloader.js';
import { KnexEmailAttachmentRepository } from '../../emails/infrastructure/persistence/KnexEmailAttachmentRepository.js';
import { KnexEmailsBodyRepository } from '../../emails/infrastructure/persistence/KnexEmailsBodyRepository.js';
import { KnexEmailsRepository } from '../../emails/infrastructure/persistence/KnexEmailsRepository.js';
import { S3AttachmentStorage } from '../../emails/infrastructure/persistence/S3AttachmentStorage.js';
import { KnexInteractionRepository } from '../../interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { KnexMailAccountRepository } from '../../mail-accounts/infrastructure/persistence/KnexMailAccountRepository.js';
import { S3FileScanner, S3ScanService } from '../../s3-files/index.js';
import { KnexWorkspacesRepository } from '../../workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';

export function buildChannelHubInboundEmailProcessor(knexConfig) {
    const emailRepository = new KnexEmailsRepository(knexConfig);
    const emailBodyRepository = new KnexEmailsBodyRepository(emailRepository.connection);
    const emailAttachmentRepository = new KnexEmailAttachmentRepository(emailRepository.connection);
    const interactionRepository = new KnexInteractionRepository(emailRepository.connection);
    const mailAccountRepository = new KnexMailAccountRepository(emailRepository.connection);
    const workspaceRepository = new KnexWorkspacesRepository(emailRepository.connection);
    const allowedConnectionRepository = {
        isAllowedConnection: (url) => emailRepository.isAllowedConnection(url),
    };

    return new ChannelHubInboundEmailProcessor({
        emailRepository,
        emailBodyRepository,
        emailAttachmentRepository,
        interactionRepository,
        mailAccountRepository,
        workspaceRepository,
        allowedConnectionRepository,
        bodyDownloader: new ChannelHubInboundTextBodyDownloader({ allowedConnectionRepository }),
        attachmentDownloader: new ChannelHubInboundAttachmentDownloader({ allowedConnectionRepository }),
        attachmentStorage: new S3AttachmentStorage(),
        fileScanner: new S3FileScanner(new S3ScanService()),
    });
}
```

- [ ] **Step 2: Update public webhook controller to use factory**

In `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs`, replace the current private dependency wiring with:

```js
import { buildChannelHubInboundEmailProcessor } from '@kace/core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js';

// constructor:
this.#processorFactory = processorFactory ?? (() => buildChannelHubInboundEmailProcessor(this.#knexConfig));
```

Remove imports that are now owned by the factory.

- [ ] **Step 3: Verify public webhook remains GREEN**

Run:

```bash
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
```

Expected: PASS. Existing tests that inject `processorFactory` must still pass.

---

### Task 3: Make legacy interactions webhook delegate to canonical processor

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_interactions/src/ControllerWebhook.mjs`
- Create: `apps/apiv1/kace_cloud_api_interactions/test/ControllerWebhook.test.mjs`

- [ ] **Step 1: Write failing legacy adapter tests**

Create `apps/apiv1/kace_cloud_api_interactions/test/ControllerWebhook.test.mjs` with focused tests that call `actionCreate()` directly using an injected processor factory and a fake authorized `User` instance:

```js
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { ControllerWebhook } from '../src/ControllerWebhook.mjs';
import { User } from '@kace/core/src/users/index.js';
import { StatusEnum } from '@kace/core/src/shared/index.js';
import { AccountTypeEnum } from '@kace/core/src/shared/domain/enum/AccountTypeEnum.js';

const minimalPayload = {
    messageId: 'channel-hub-message-id',
    origin: 'customer@example.com',
    tags: 'workspace-reference-id',
    destination: {
        bcc: [{ email: 'support@example.com', name: 'Support' }],
    },
    content: {
        text: 'https://channel-hub-cdn.example.com/messages/msg-1.txt',
    },
};

function tenant() {
    return {
        apps_debug: { value: 'true' },
        aws_cognito_user_pool_id: { value: 'local-user-pool' },
        aws_cognito_app_client_id: { value: 'local-client' },
        aws_sqs_region: { value: 'us-east-1' },
        aws_sqs_events_queue_url: { value: 'https://sqs.example/queue.fifo' },
        aws_event_bridge_region: { value: 'us-east-1' },
        aws_event_bridge_event_bus_name: { value: 'local-bus' },
    };
}

function eventFor(payload, overrides = {}) {
    const t = tenant();
    return {
        resource: '/',
        httpMethod: 'POST',
        path: '/webhook',
        body: JSON.stringify(payload),
        headers: {},
        tenant: t,
        tenantContext: { tenant: t },
        kContext: { awsRequestId: 'test-request-id' },
        ...overrides,
    };
}

function authorizedUser() {
    const user = Object.create(User.prototype);
    Object.defineProperty(user, 'hasPermission', {
        value: jest.fn(() => true),
    });
    return user;
}

function responseBody(response) {
    return JSON.parse(response.toJson().body);
}

function controllerFor(resultOrProcessor, event = eventFor(minimalPayload)) {
    const processor = resultOrProcessor.execute
        ? resultOrProcessor
        : { execute: jest.fn().mockResolvedValue(resultOrProcessor) };
    const controller = new ControllerWebhook(event, {}, { processorFactory: () => processor });
    controller.user = authorizedUser();
    return { controller, processor };
}

describe('legacy interactions Channel Hub webhook adapter', () => {
    it('delegates validated Channel Hub payload to the canonical processor', async () => {
        const { controller, processor } = controllerFor({
            accepted: true,
            data: { email_id: 'email-id' },
        });

        const response = await controller.actionCreate();

        expect(processor.execute).toHaveBeenCalledWith(expect.objectContaining(minimalPayload));
        expect(response.toJson().statusCode).toBe(200);
        expect(responseBody(response).data).toEqual({ email_id: 'email-id' });
    });

    it('maps non-retryable processor results like the public Channel Hub webhook', async () => {
        const { controller } = controllerFor({
            accepted: false,
            nonRetryable: true,
            code: 'workspace_not_found_or_inactive',
            message: 'Workspace does not exist or is inactive.',
        });

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(400);
        expect(responseBody(response).errors).toEqual({
            code: 'workspace_not_found_or_inactive',
            message: 'Workspace does not exist or is inactive.',
        });
    });

    it('maps retryable processor results like the public Channel Hub webhook', async () => {
        const { controller } = controllerFor({
            accepted: false,
            retryable: true,
            code: 'processing_failed',
            message: 'Temporary failure.',
        });

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(500);
        expect(responseBody(response).errors).toEqual({
            code: 'processing_failed',
            message: 'Temporary failure.',
        });
    });

    it('rejects invalid Channel Hub payloads before calling the processor', async () => {
        const { messageId, ...invalidPayload } = minimalPayload;
        const processor = { execute: jest.fn() };
        const { controller } = controllerFor(processor, eventFor(invalidPayload));

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(400);
        expect(processor.execute).not.toHaveBeenCalled();
    });

    it('returns HTTP 400 for malformed JSON before calling the processor', async () => {
        const processor = { execute: jest.fn() };
        const { controller } = controllerFor(processor, eventFor(minimalPayload, { body: '{bad-json' }));

        const response = await controller.actionCreate();

        expect(response.toJson().statusCode).toBe(400);
        expect(responseBody(response).errors.code).toBe('invalid_json_payload');
        expect(processor.execute).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the legacy tests to verify RED**

Run:

```bash
pnpm --filter @kace/api-interactions test -- --runTestsByPath apps/apiv1/kace_cloud_api_interactions/test/ControllerWebhook.test.mjs --runInBand
```

Expected: FAIL because `ControllerWebhook` does not accept `processorFactory`, does not validate the Channel Hub schema, and still uses independent `EmailCreator`/`InteractionCreator` business logic.

- [ ] **Step 3: Replace independent legacy business logic with delegation**

Modify `apps/apiv1/kace_cloud_api_interactions/src/ControllerWebhook.mjs`:

```js
import {
    BaseController,
    channelHubSchema,
    ChannelHubInboundEmailWebhookResponse,
    HttpResponse,
} from '@kace/api-common';
import { buildChannelHubInboundEmailProcessor } from '@kace/core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js';
import { Helper } from '@kace/core/src/shared';

// Legacy transition adapter for /interactions/webhook. Do not add Channel Hub
// Email/Interaction business logic here; canonical behavior lives in
// ChannelHubInboundEmailProcessor and the public /channel-hub webhook.
export class ControllerWebhook extends BaseController {
    #event;
    #processorFactory;

    constructor(event, knexConfig, { processorFactory } = {}) {
        super(event, knexConfig);
        this.#event = event;
        this.#processorFactory = processorFactory ?? (() => buildChannelHubInboundEmailProcessor(knexConfig));
    }

    async actionCreate() {
        Helper.logInfo('Begin legacy Channel Hub webhook delegation');
        try {
            const hasPermission = this.user?.hasPermission?.('administrador', 'interactions', 'InteractionsCreate');

            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.#event,
                });
            }

            let payload;
            try {
                payload = this.payload();
            } catch (error) {
                return HttpResponse.badRequest({
                    message: 'Invalid JSON payload',
                    errors: {
                        code: 'invalid_json_payload',
                        message: error.message,
                    },
                    event: this.#event,
                });
            }

            const { error, value } = channelHubSchema.validate(payload, { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.#event });
            }

            const processor = this.#processorFactory();
            const result = await processor.execute(value);
            return ChannelHubInboundEmailWebhookResponse.fromProcessingResult(result, this.#event);
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End legacy Channel Hub webhook delegation');
        }
    }
}
```

Remove no-longer-used imports and constructor properties for `EmailCreator`, `WebhookMapper`, `InteractionCreator`, attachment downloader/storage/scanner, and the legacy repositories from `ControllerWebhook.mjs`.

- [ ] **Step 4: Verify legacy tests GREEN**

Run:

```bash
pnpm --filter @kace/api-interactions test -- --runTestsByPath apps/apiv1/kace_cloud_api_interactions/test/ControllerWebhook.test.mjs --runInBand
```

Expected: PASS.

---

### Task 4: Targeted verification and issue status update

**Files:**
- Modify: `.scratch/channel-hub-inbound-email-workspace-integration/issues/05-converge-legacy-interactions-webhook-on-canonical-channel-hub-processor.md`
- Validate: public webhook, legacy webhook, and non-webhook interaction tests.

- [ ] **Step 1: Run public webhook regression tests**

```bash
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run legacy webhook focused tests**

```bash
pnpm --filter @kace/api-interactions test -- --runTestsByPath apps/apiv1/kace_cloud_api_interactions/test/ControllerWebhook.test.mjs --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run core processor regression tests**

```bash
pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false
```

Expected: PASS.

- [ ] **Step 4: Run a focused non-webhook Interaction CRUD smoke if practical**

If the interactions app has a fast targeted CRUD test path, run it. If only the full E2E suite exists and is too broad for this slice, document that non-webhook Interaction CRUD files were not changed and run `git diff --check` instead.

```bash
git diff --check -- apps/apiv1/kace_cloud_api_interactions/src/ControllerWebhook.mjs apps/apiv1/kace_cloud_api_interactions/test/ControllerWebhook.test.mjs apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs packages/kace_cloud_api_common/src packages/kace_cloud_core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js
```

Expected: no whitespace errors.

- [ ] **Step 5: Update local Issue 05 after reviews, not before**

Only after spec review and code-quality review both approve, update `.scratch/channel-hub-inbound-email-workspace-integration/issues/05-converge-legacy-interactions-webhook-on-canonical-channel-hub-processor.md`:

```md
Status: completed
Labels: completed, reviewed
```

Check all acceptance criteria and add implementation notes, verification commands, and review outcomes.

---

## Review Plan

After implementation and targeted verification:

1. Dispatch a read-only spec compliance reviewer against Issue 05 and this plan.
2. Fix any spec gaps and rerun targeted verification.
3. Dispatch a read-only code-quality reviewer focused on security, reliability, maintainability, backwards compatibility, and test adequacy.
4. Fix all Critical/Important findings and request re-review.
5. Only then update the Issue 05 status to completed/reviewed.
