# Channel Hub Inbound Email Issue 02 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Channel Hub inbound email webhook idempotent by External Message ID and map retryable/non-retryable failures to the correct HTTP responses.

**Architecture:** Keep the Issue 01 boundary: `/webhooks/channel-hub` stays a thin adapter and `ChannelHubInboundEmailProcessor` owns business behavior. Add a database-backed idempotency invariant on inbound Email records, pre-download duplicate detection, duplicate replay results, and tests for 4xx/5xx/no-partial-record behavior.

**Tech Stack:** Node.js ESM, Jest, Knex, Joi, `@kace/core`, `@kace/database`.

---

## File Structure

- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessingResult.js`
  - Add duplicate replay result helper while keeping duplicate as a successful/accepted outcome.
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js`
  - Add idempotency pre-check after configuration validation and trusted URL validation but before body download.
  - Add duplicate handling for unique-constraint races.
- Modify: `packages/kace_cloud_core/src/emails/infrastructure/persistence/KnexEmailsRepository.js`
  - Add `findByWorkspaceAndMessageId(workspaceId, messageId)`.
- Modify: `packages/kace_cloud_core/src/interactions/infrastructure/persistence/KnexInteractionRepository.js`
  - Add `findByEmailId(emailId)` for duplicate replay response enrichment.
- Create: `packages/kace_cloud_database/migrations/20260514121000_channel_hub_inbound_email_issue_02_idempotency.js`
  - Add unique DB constraints/indexes that enforce one Email per `(workspace_id, message_id)` and one Interaction per `email_id`.
- Modify: `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`
  - Add duplicate replay, retryable failure, no-partial-record, and idempotency race/unique-invariant tests.
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs`
  - Map duplicate replay result to HTTP 200 with clear already-processed data.
  - Map malformed JSON to 400 instead of generic 500.
- Modify: `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs`
  - Add duplicate replay mapping, invalid payload/missing tags 4xx, malformed JSON 4xx, and retryable 5xx tests.
- Modify: `.scratch/channel-hub-inbound-email-workspace-integration/issues/02-idempotent-replay-and-retryable-failure-responses.md`
  - Mark completed only after implementation, verification, and reviews pass.

---

## Task 1: Processor idempotency tests first

**Files:**
- Modify: `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`

- [ ] **Step 1: Write failing duplicate replay test**

Add a test after the happy path:

```js
it('returns an already-processed success and creates no duplicate records for a repeated External Message ID', async () => {
    const { workspace } = await createValidWorkspaceAndMailAccount();
    const payload = validPayload({ workspaceId: workspace.id.value });

    const first = await createProcessor().execute(payload);
    const second = await createProcessor().execute(payload);

    expect(first.accepted).toBe(true);
    expect(second.accepted).toBe(true);
    expect(second.alreadyProcessed).toBe(true);
    expect(second.code).toBe('already_processed');
    expect(second.data.email_id).toBe(first.data.email_id);
    await expect(tableCounts()).resolves.toEqual({
        emails: 1,
        bodies: 1,
        attachments: 0,
        interactions: 1,
    });
    expect(bodyDownloader.download).toHaveBeenCalledTimes(1);
});
```

Update `tableCounts()` and `resetSchema()` to include an `emails_attachments` test table so retryable no-partial tests can assert it remains empty.

- [ ] **Step 2: Write failing retryable failure tests**

Add tests:

```js
it('returns retryable and leaves no records when body download fails', async () => {
    const { workspace } = await createValidWorkspaceAndMailAccount();
    const payload = validPayload({ workspaceId: workspace.id.value });
    bodyDownloader.download.mockRejectedValue(new Error('temporary body download failure'));

    const result = await createProcessor().execute(payload);

    expect(result.retryable).toBe(true);
    expect(result.code).toBe('processing_failed');
    await expectNoRecordsCreated();
});

it('returns retryable and leaves no records when database persistence fails', async () => {
    const { workspace } = await createValidWorkspaceAndMailAccount();
    const payload = validPayload({ workspaceId: workspace.id.value });
    await emailRepository.connection.raw(`
        CREATE TRIGGER force_interaction_failure
        BEFORE INSERT ON interactions
        BEGIN
            SELECT RAISE(ABORT, 'forced interaction failure');
        END;
    `);

    const result = await createProcessor().execute(payload);

    expect(result.retryable).toBe(true);
    await expectNoRecordsCreated();
});
```

- [ ] **Step 3: Write failing unique invariant/race test**

Add a test that creates a record, bypasses the pre-check by directly trying another row with the same `(workspace_id, message_id)` through the persistence path if accessible, or uses DB insert to assert the unique constraint rejects duplicates after the migration is applied. If private methods make race simulation impractical, keep processor duplicate replay test plus migration smoke for uniqueness.

- [ ] **Step 4: Run core tests to verify RED**

Run:

```bash
pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false
```

Expected: FAIL because duplicate replay and uniqueness helpers are not implemented.

---

## Task 2: Database and repository support

**Files:**
- Create: `packages/kace_cloud_database/migrations/20260514121000_channel_hub_inbound_email_issue_02_idempotency.js`
- Modify: `packages/kace_cloud_core/src/emails/infrastructure/persistence/KnexEmailsRepository.js`
- Modify: `packages/kace_cloud_core/src/interactions/infrastructure/persistence/KnexInteractionRepository.js`

- [ ] **Step 1: Add idempotency migration**

Create migration:

```js
export async function up(knex) {
    await knex.schema.alterTable('emails', (table) => {
        table.unique(['workspace_id', 'message_id'], {
            indexName: 'emails_workspace_message_id_unique',
        });
    });

    await knex.schema.alterTable('interactions', (table) => {
        table.unique(['email_id'], {
            indexName: 'interactions_email_id_unique',
        });
    });
}

export async function down(knex) {
    await knex.schema.alterTable('interactions', (table) => {
        table.dropUnique(['email_id'], 'interactions_email_id_unique');
    });

    await knex.schema.alterTable('emails', (table) => {
        table.dropUnique(['workspace_id', 'message_id'], 'emails_workspace_message_id_unique');
    });
}
```

If Knex object-style unique options do not work with this repo's Knex version, use the positional index-name form that passes sqlite smoke and preserves Postgres compatibility.

- [ ] **Step 2: Add `findByWorkspaceAndMessageId`**

In `KnexEmailsRepository`:

```js
async findByWorkspaceAndMessageId(workspaceId, messageId) {
    const row = await this.connection(this.tableName)
        .where({
            workspace_id: typeof workspaceId === 'string' ? workspaceId : workspaceId?.value,
            message_id: messageId,
        })
        .whereNull('deleted_at')
        .first();
    return row ? new Email(row) : null;
}
```

- [ ] **Step 3: Add `findByEmailId`**

In `KnexInteractionRepository`:

```js
async findByEmailId(emailId) {
    const row = await this.connection(this.tableName)
        .where({ email_id: typeof emailId === 'string' ? emailId : emailId?.value })
        .whereNull('deleted_at')
        .first('*');
    return row ? new Interaction(row) : null;
}
```

- [ ] **Step 4: Run targeted tests**

Expected: tests still fail until processor duplicate behavior is implemented.

---

## Task 3: Idempotent processor behavior

**Files:**
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessingResult.js`
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js`

- [ ] **Step 1: Add duplicate replay result**

In `ChannelHubInboundEmailProcessingResult` add:

```js
static alreadyProcessed(data = null) {
    const result = new ChannelHubInboundEmailProcessingResult({
        status: 'accepted',
        code: 'already_processed',
        message: 'Channel Hub message was already processed.',
        data,
    });
    result.alreadyProcessed = true;
    return result;
}
```

Set `this.alreadyProcessed = code === 'already_processed' || status === 'already_processed'` in the constructor.

- [ ] **Step 2: Add duplicate pre-check**

After Workspace/Mail Account assignment and initial trusted URL validation, before body download:

```js
const existingEmail = await this.#emailRepository.findByWorkspaceAndMessageId(workspaceId, externalMessageId);
if (existingEmail) {
    return await this.#alreadyProcessedResult(existingEmail);
}
```

`#alreadyProcessedResult(email)` should try `interactionRepository.findByEmailId(email.id.value)` and return data:

```js
{
    already_processed: true,
    email_id: email.id.value,
    interaction_id: interaction?.id?.value ?? null,
}
```

- [ ] **Step 3: Handle unique-race duplicates**

In the catch block, detect unique-constraint errors for the new email idempotency index. If detected, query `findByWorkspaceAndMessageId(workspaceId, externalMessageId)` and return `alreadyProcessed` when found. Otherwise keep retryable behavior.

Use a helper that recognizes common sqlite/postgres signals:

```js
#isUniqueViolation(error) {
    return error?.code === '23505' || /unique/i.test(error?.message ?? '');
}
```

- [ ] **Step 4: Run core tests to verify GREEN**

Run the core issue command. Expected: all Channel Hub inbound tests pass.

---

## Task 4: Webhook adapter failure/duplicate mapping tests

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs`
- Modify: `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs`

- [ ] **Step 1: Add failing webhook tests**

Add tests:

```js
it('maps an already-processed replay result to HTTP 200 with replay data', async () => {
    const response = await controllerResponseFor({
        accepted: true,
        alreadyProcessed: true,
        nonRetryable: false,
        retryable: false,
        status: 'accepted',
        code: 'already_processed',
        message: 'Channel Hub message was already processed.',
        data: { already_processed: true, email_id: 'email-id', interaction_id: 'interaction-id' },
    });

    expect(response.toJson().statusCode).toBe(200);
    expect(responseBody(response).data).toEqual({
        already_processed: true,
        email_id: 'email-id',
        interaction_id: 'interaction-id',
    });
});

it('returns HTTP 400 for malformed JSON payloads', async () => {
    const controller = new Controller({ ...eventFor(minimalPayload), body: '{bad-json' }, {}, {
        processorFactory: () => ({ execute: jest.fn() }),
    });

    const response = await controller.handle();

    expect(response.toJson().statusCode).toBe(400);
});

it('returns HTTP 400 for missing Workspace Reference tags', async () => {
    const { tags, ...payload } = minimalPayload;
    const controller = new Controller(eventFor(payload), {}, {
        processorFactory: () => ({ execute: jest.fn() }),
    });

    const response = await controller.handle();

    expect(response.toJson().statusCode).toBe(400);
});
```

- [ ] **Step 2: Run webhook tests to verify RED**

Run:

```bash
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
```

- [ ] **Step 3: Implement malformed JSON 400**

In `#handleChannelHub`, wrap JSON parse:

```js
let payload;
try {
    payload = JSON.parse(this.#event.body || '{}');
} catch (error) {
    return HttpResponse.badRequest({
        message: 'Invalid JSON payload',
        errors: { code: 'invalid_json_payload', message: error.message },
        event: this.#event,
    });
}
```

Duplicate replay likely already maps to 200 through accepted result, but ensure response data/message clearly indicate replay.

- [ ] **Step 4: Run webhook tests to verify GREEN**

Expected: webhook tests pass.

---

## Task 5: Verification and review gate

**Files:**
- All files changed by Tasks 1-4.

- [ ] **Step 1: Run targeted verification**

Run:

```bash
pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
pnpm --filter @kace/core tests tests/emails/EmailsUnitTest.test.js --coverage=false
```

Run a sqlite migration smoke for the Issue 02 migration to ensure `up` adds unique indexes and `down` drops them.

- [ ] **Step 2: Run Issue 02 spec review subagent**

Reviewer input:

- Issue 02 file
- Issue 01 completed context
- Implementation diff
- Verification output

Reviewer must check every acceptance criterion and produce Critical/Important/Minor findings.

- [ ] **Step 3: Fix spec review findings**

Fix all Critical and Important findings and re-run targeted tests.

- [ ] **Step 4: Run Issue 02 code-quality review subagent**

Reviewer input:

- Implementation diff
- ADR/glossary constraints
- Verification output

Reviewer must check migration safety, race/idempotency behavior, retryability mapping, no-partial records, and test quality.

- [ ] **Step 5: Fix code-quality findings**

Fix all Critical and Important findings, re-run targeted tests, and re-review until approved.

- [ ] **Step 6: Mark Issue 02 complete locally**

Only after tests and reviews pass, set Issue 02 status to completed/reviewed with verification notes.

---

## Self-Review

- Spec coverage: Issue 02 acceptance criteria map to duplicate replay tests, unique storage migration, retryability mapping, no-partial record assertions, and webhook adapter result mapping tests.
- Placeholder scan: No unresolved placeholder steps; implementation details and exact files are named.
- Type consistency: Duplicate result remains HTTP-successful (`accepted: true`) while exposing `alreadyProcessed` and `code: already_processed`.
