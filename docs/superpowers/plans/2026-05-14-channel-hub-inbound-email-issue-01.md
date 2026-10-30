# Channel Hub Inbound Email Issue 01 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Issue 01 tracer bullet for a plain-text Channel Hub inbound email whose receiving Mail Account appears only in BCC.

**Architecture:** Keep `apps/apiv1/kace_cloud_api_webhooks` thin: validate the minimal payload and delegate to a dedicated core processor in `packages/kace_cloud_core/src/channel-hub-inbound-emails/`. The core processor owns recipient normalization, Workspace/Mail Account validation, trusted plain-text body download, and a single DB transaction that creates Email, Email Body, and linked Interaction records.

**Tech Stack:** Node.js ESM, Jest, Knex, Joi, `@kace/core`, `@kace/database`.

---

## File Structure

- Create: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js`
  - Main issue-01 use case. Accepts a Channel Hub payload and dependency-injected repositories/downloader.
- Create: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessingResult.js`
  - Small result object/helpers for accepted, non-retryable, and retryable outcomes.
- Create: `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`
  - Core integration tests for the BCC happy path and non-retryable configuration/validation cases.
- Modify: `packages/kace_cloud_core/src/mail-accounts/infrastructure/persistence/KnexMailAccountRepository.js`
  - Add `findAllByEmailAccounts(emailAddresses)` with case-insensitive matching and distinct rows.
- Modify: `packages/kace_cloud_core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js`
  - Add `findActiveById(workspaceId)` and `hasMailAccount(workspaceId, mailAccountId)`.
- Modify: `packages/kace_cloud_core/src/interactions/domain/Interaction.js`
  - Add nullable `email_id` value object and getter/setter.
- Modify: `packages/kace_cloud_core/src/emails/domain/Email.js`
  - Use timestamp preservation for `received_at` instead of date-only truncation.
- Modify: `packages/kace_cloud_core/src/interactions/infrastructure/persistence/KnexInteractionRepository.js`
  - Persist `email_id` on save.
- Modify: `packages/kace_cloud_core/src/interactions/application/InteractionResponse.js`
  - Include `email_id` in response JSON.
- Modify: `packages/kace_cloud_core/tests/interactions/domain/InteractionMother.js`
  - Include optional `email_id` in test DTOs.
- Create: `packages/kace_cloud_database/migrations/20260514120000_channel_hub_inbound_email_issue_01.js`
  - Widen provider-derived identifiers and add nullable FK `interactions.email_id -> emails.id`.
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs`
  - Define minimal permissive Channel Hub schema: `messageId` or `messageIdOperator`, `origin`, `destination` with at least one of `to`/`cc`/`bcc`, `tags`, and `content.text`.
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs`
  - Build core repositories/downloader, call the processor, map accepted/non-retryable/retryable result to HTTP response.
- Create: `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs`
  - Controller/schema tests proving the minimal BCC payload is accepted and delegated through a thin controller seam.

---

## Task 1: Core test coverage first

**Files:**
- Create: `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`

- [ ] **Step 1: Write failing core tests**

Create tests that import the not-yet-existing processor and result behavior:

```js
import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexEmailsRepository } from '../../src/emails/infrastructure/persistence/KnexEmailsRepository.js';
import { KnexEmailsBodyRepository } from '../../src/emails/infrastructure/persistence/KnexEmailsBodyRepository.js';
import { KnexInteractionRepository } from '../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { KnexMailAccountRepository } from '../../src/mail-accounts/infrastructure/persistence/KnexMailAccountRepository.js';
import { KnexWorkspacesRepository } from '../../src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js';
import { ChannelHubInboundEmailProcessor } from '../../src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js';
import MailAccountMother from '../mail-accounts/domain/MailAccountMother.js';
import WorkspaceMother from '../workspaces/domain/WorkspaceMother.js';
import { globalSystemUserId } from '@kace/database/seeds/20241125105900_usuario_base.js';

const allowedBodyUrl = 'https://channel-hub-cdn.example.com/messages/msg-1.txt';

function validPayload(overrides = {}) {
    return {
        messageId: 'channel-hub-external-message-id-that-is-not-a-uuid',
        origin: 'customer@example.com',
        subject: 'Need support',
        tags: overrides.workspaceId,
        destination: {
            to: [],
            cc: [],
            bcc: [{ email: 'SUPPORT@EXAMPLE.COM', name: 'Support' }],
        },
        content: {
            text: allowedBodyUrl,
        },
        received_at: '2026-05-14T10:00:00.000Z',
        ...overrides.payload,
    };
}
```

Cover these behaviors:

1. **Happy path:** active Workspace + BCC-only Mail Account + allowed URL creates exactly one `emails`, one `emails_body`, and one `interactions` row. Assert:
   - `emails.sender === 'customer@example.com'`
   - `emails.bcc` contains `{ email: 'support@example.com', name: 'Support' }`
   - `emails.workspace_id` is the `tags` Workspace ID
   - `emails.account_id` is the matched Mail Account ID
   - `emails.message_id` stores the non-UUID external message ID
   - `emails_body.body` stores downloaded text, not the URL
   - `interactions.email_id === emails.id`
   - interaction defaults: `channel_id: 'email'`, `client_identifier: 'customer@example.com'`, `external_identifier: messageId`, `description: subject`, `conversation_id: messageId`, `priority: 'normal'`, `receipt_at: received_at`
   - all created records use Kace Bot `created_by` (`globalSystemUserId`)
2. **Workspace missing:** returns non-retryable, creates no rows, and downloader is not called.
3. **Workspace inactive:** returns non-retryable, creates no rows, and downloader is not called.
4. **No Mail Account match:** returns non-retryable, creates no rows.
5. **Multiple distinct Mail Account matches:** returns non-retryable, creates no rows.
6. **Matched Mail Account not assigned to Workspace:** returns non-retryable, creates no rows.
7. **Untrusted text body URL:** returns non-retryable, creates no rows, and downloader is not called.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js
```

Expected: FAIL because `ChannelHubInboundEmailProcessor.js` does not exist.

---

## Task 2: Minimal DB/domain/repository support

**Files:**
- Create: `packages/kace_cloud_database/migrations/20260514120000_channel_hub_inbound_email_issue_01.js`
- Modify: `packages/kace_cloud_core/src/interactions/domain/Interaction.js`
- Modify: `packages/kace_cloud_core/src/emails/domain/Email.js`
- Modify: `packages/kace_cloud_core/src/interactions/infrastructure/persistence/KnexInteractionRepository.js`
- Modify: `packages/kace_cloud_core/src/interactions/application/InteractionResponse.js`
- Modify: `packages/kace_cloud_core/tests/interactions/domain/InteractionMother.js`
- Modify: `packages/kace_cloud_core/src/mail-accounts/infrastructure/persistence/KnexMailAccountRepository.js`
- Modify: `packages/kace_cloud_core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js`

- [ ] **Step 1: Add migration**

Use:

```js
export async function up(knex) {
    await knex.schema.alterTable('emails', (table) => {
        table.string('message_id', 255).alter();
    });

    await knex.schema.alterTable('interactions', (table) => {
        table.string('client_identifier', 255).alter();
        table.string('external_identifier', 255).alter();
        table.string('conversation_id', 255).alter();
        table.string('email_id', 36).nullable();
        table.index('email_id');
        table.foreign('email_id').references('id').inTable('emails');
    });
}

export async function down(knex) {
    await knex.schema.alterTable('interactions', (table) => {
        table.dropForeign(['email_id']);
        table.dropIndex(['email_id']);
        table.dropColumn('email_id');
    });

    await knex.schema.alterTable('emails', (table) => {
        table.string('message_id', 36).alter();
    });

    await knex.schema.alterTable('interactions', (table) => {
        table.string('client_identifier', 36).alter();
        table.string('external_identifier', 36).alter();
        table.string('conversation_id', 36).alter();
    });
}
```

- [ ] **Step 2: Add nullable `email_id` to Interaction**

Add a private field, constructor assignment using `ValueObjectUuid('email_id', dto.email_id, true)`, getter, and setter.

- [ ] **Step 3: Preserve Email received timestamp**

Change `Email.received_at` to use `ValueObjectTimestamp('received_at', received_at)` so the stored value remains an ISO timestamp instead of a date-only string.

- [ ] **Step 4: Persist and expose `email_id`**

Insert `email_id: interaction.email_id.value` in `KnexInteractionRepository.save()` and include `email_id` in `InteractionResponse.toJson()`.

- [ ] **Step 5: Add lookup helpers**

Add:

```js
async findAllByEmailAccounts(emailAddresses) {
    const normalized = [...new Set(emailAddresses.map((email) => email.toLowerCase()))];
    if (normalized.length === 0) return [];

    const rows = await this.connection(this.tableName)
        .whereNull('deleted_at')
        .whereIn(this.connection.raw('lower(email_account)'), normalized);

    return rows.map((row) => new MailAccount(row));
}
```

Add workspace helpers that query `workspaces` with `deleted_at: null` and `is_active` truthy, plus the `workspaces_mail_accounts_relations` table.

- [ ] **Step 6: Run core tests to confirm remaining RED**

Expected: tests still fail because the processor does not exist yet.

---

## Task 3: Implement the core processor

**Files:**
- Create: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessingResult.js`
- Create: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js`

- [ ] **Step 1: Create processing result helpers**

Implement result methods:

```js
static accepted(data)
static nonRetryable(code, message)
static retryable(code, message, error)
```

Each result should expose booleans `accepted`, `retryable`, `nonRetryable`, a `status`, a `code`, and optional `data/error`.

- [ ] **Step 2: Implement processor validation and mapping**

Processor behavior:

1. External Message ID = `payload.messageIdOperator ?? payload.messageId`.
2. Workspace Reference = `payload.tags`.
3. Sender = normalized email from `payload.origin`.
4. Recipients normalize all `destination.to`, `destination.cc`, and `destination.bcc` values into arrays of `{ email: lowerCaseEmail, name: name ?? null }`.
5. Resolve receiving Mail Account by all recipient emails, case-insensitive.
6. Reject if active workspace is missing/inactive.
7. Reject if zero matches or more than one distinct Mail Account matches.
8. Reject if the single matched Mail Account is not assigned to the Workspace.
9. Reject if `content.text` URL is not allowed by `isAllowedConnection()`.
10. Download text body only after all configuration validation passes.
11. Convert downloader `buffer` to UTF-8 string.

- [ ] **Step 3: Implement atomic persistence**

Within one transaction:

```js
const emailId = uuidv4();
const now = new Date().toISOString();
const createdBy = globalSystemUserId;
```

Create:

- `Email` with subject, sender, normalized `to/cc/bcc`, priority, workspace ID, external message ID, matched account ID, received timestamp, and `s3_key` placeholder like `channel-hub/inbound/${emailId}`.
- `EmailBody` with downloaded plain text body.
- `Interaction` with stable defaults and `email_id: emailId`.

On transaction error, return retryable and rollback.

- [ ] **Step 4: Run tests to verify GREEN**

Run the core issue test command. Expected: all tests in `ChannelHubInboundEmailProcessor.test.js` pass.

---

## Task 4: Thin webhook adapter

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs`
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs`
- Create: `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs`

- [ ] **Step 1: Write failing webhook tests**

Add tests that:

1. Validate the minimal BCC payload passes `channelHubSchema`.
2. Validate payload missing both `messageId` and `messageIdOperator` fails.
3. Instantiate `Controller` with an injected fake processor factory, invoke `/channel-hub`, and assert the fake processor received the validated payload.
4. Assert the controller maps:
   - accepted result → HTTP 200
   - non-retryable result → HTTP 400
   - retryable result → HTTP 500

- [ ] **Step 2: Run webhook tests to verify RED**

Run:

```bash
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs
```

Expected: FAIL because schema/controller injection/processor mapping are not implemented.

- [ ] **Step 3: Implement Joi schema**

Schema requirements:

- `messageId` and `messageIdOperator` are alternatives: at least one is required.
- `origin` required.
- `tags` required.
- `destination` required and must have at least one of `to`, `cc`, `bcc`.
- `content.text` required.
- Unknown fields remain allowed.

- [ ] **Step 4: Keep controller thin**

Implement an optional constructor dependency seam:

```js
constructor(event, knexConfig, { processorFactory } = {}) {
    this.#event = event;
    this.#knexConfig = knexConfig;
    this.#processorFactory = processorFactory ?? (() => this.#buildChannelHubProcessor());
}
```

`#handleChannelHub()` should parse/validate, call `processor.execute(value)`, and map the result to `HttpResponse`.

- [ ] **Step 5: Build real processor dependencies in one helper**

`#buildChannelHubProcessor()` should instantiate:

- `KnexEmailsRepository`
- `KnexEmailsBodyRepository`
- `KnexInteractionRepository`
- `KnexMailAccountRepository`
- `KnexWorkspacesRepository`
- a lightweight repository object with `isAllowedConnection(url)` backed by `KnexEmailsRepository`
- `HttpAttachmentDownloader` as body downloader

No inbound business rules should be implemented in the controller.

- [ ] **Step 6: Run webhook tests to verify GREEN**

Run the webhook test command. Expected: all new webhook tests pass.

---

## Task 5: Issue 01 verification and review gate

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run targeted verification**

Run:

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs
```

- [ ] **Step 2: Run a focused issue acceptance checklist**

Re-read `.scratch/channel-hub-inbound-email-workspace-integration/issues/01-plain-text-bcc-inbound-channel-hub-email.md` and verify every acceptance criterion is either implemented or explicitly deferred only if outside Issue 01.

- [ ] **Step 3: Run spec review subagent**

Dispatch a fresh reviewer with:

- Issue 01 file
- The implementation diff
- The targeted test output

Reviewer must answer whether every acceptance criterion is met and list gaps as Critical/Important/Minor.

- [ ] **Step 4: Fix spec review findings**

Fix all Critical and Important findings, then re-run targeted tests.

- [ ] **Step 5: Run code-quality review subagent**

Dispatch a fresh reviewer with:

- The implementation diff
- Key architecture decisions from `CONTEXT.md` and ADR-004
- The targeted test output

Reviewer must list maintainability/security/test issues as Critical/Important/Minor.

- [ ] **Step 6: Fix code-quality findings**

Fix all Critical and Important findings, then re-run targeted tests.

- [ ] **Step 7: Mark Issue 01 complete locally**

Only after tests and both reviews pass, update the issue file status or leave a local progress note if the project convention does not support status transitions.

---

## Self-Review

- Spec coverage: Issue 01 acceptance criteria are covered by core tests, webhook tests, migrations, core processor, and review gate.
- Placeholder scan: No task says “TBD” or “implement later”; each task gives concrete files, methods, and commands.
- Type consistency: `email_id` is nullable UUID on Interaction, FK on `interactions`, and set to the saved Email ID in the processor.
