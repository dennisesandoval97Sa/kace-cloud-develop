# Channel Hub Large Body External Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept Channel Hub inbound emails whose text/HTML body is larger than the current 1 MiB inline limit by storing the full body in tenant S3, keeping only preview+metadata inline, and loading the full body lazily in the frontend.

**Architecture:** Keep the current `/channel-hub` webhook adapter and Email/Interaction persistence flow. Add email-body storage metadata to `emails_body`, a dedicated S3 body storage adapter, external-size-aware body processing in `ChannelHubInboundEmailProcessor`, an authorized Emails API body-read route, and frontend lazy-loading support in `EmailDetail`.

**Tech Stack:** Node.js ESM, Knex migrations/repositories, Jest with `@jest/globals`, node:test for migration tests, AWS SDK S3, API Gateway/CDK stacks, React/Vite/Vitest, TanStack Query, DOMPurify.

---

## Scope Check

This is one vertical slice because the webhook cannot accept large bodies safely unless all of these work together:

1. database can persist body storage metadata;
2. processor can externalize large bodies and clean up on failure;
3. detail API can expose preview+metadata without leaking S3 keys;
4. authorized body route can retrieve full content;
5. frontend can show preview first and load the full body on demand.

Do **not** change Channel Hub routing, tag/rule flows, attachment storage/scanning, or Workspace behavior in this plan.

Preserve unrelated local work. At plan creation time there are already unrelated modified/untracked files in the repo.

---

## Source Spec

Implement this design:

- `docs/superpowers/specs/2026-05-24-channel-hub-large-body-external-storage-design.md`

Note: `docs/superpowers/` is ignored by `.gitignore`; use `git add -f` for this plan/spec only if these docs should be committed.

---

## File Structure

### Database

- Create: `packages/kace_cloud_database/migrations/20260524190000_add_email_body_storage_metadata.js`
  - Add storage metadata columns to `emails_body`.
- Create: `packages/kace_cloud_database/tests/migrations/20260524190000_add_email_body_storage_metadata.test.js`
  - Prove `up` adds nullable/default metadata columns and `down` removes them.

### Core domain/repositories/storage

- Modify: `packages/kace_cloud_core/src/emails/domain/EmailBody.js`
  - Accept/get metadata fields for text and HTML body storage.
- Modify: `packages/kace_cloud_core/src/emails/infrastructure/persistence/KnexEmailsBodyRepository.js`
  - Save/update/read metadata fields.
- Modify: `packages/kace_cloud_core/src/emails/application/EmailResponse.js`
  - Return preview+metadata and omit raw S3 keys.
- Modify: `packages/kace_cloud_core/src/emails/application/EmailResponseBody.js`
  - Return the same metadata shape for body-only responses.
- Create: `packages/kace_cloud_core/src/emails/domain/ports/EmailBodyStoragePort.js`
  - Define `upload`, `download`, and `delete`.
- Create: `packages/kace_cloud_core/src/emails/infrastructure/persistence/S3EmailBodyStorage.js`
  - Store/retrieve/delete full external body content in tenant S3.
- Create: `packages/kace_cloud_core/src/emails/application/body/EmailBodyContentReader.js`
  - Resolve inline vs external full body content for the Emails API route.
- Optional create: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailBodyContent.js`
  - Shared constants and helpers for preview/metadata/HTML stripping.

### Channel Hub inbound processor

- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundTextBodyDownloader.js`
  - Enforce external max bytes, not inline max bytes.
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js`
  - Externalize large text/HTML bodies.
  - Deduplicate same text/html body URL downloads.
  - Clean up uploaded body keys on later failure.
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js`
  - Inject `S3EmailBodyStorage`.
- Modify: `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`
  - Add large body and cleanup coverage.

### Emails API

- Modify: `packages/kace_cloud_api_common/src/controllers/BaseController.js`
  - Route `GET /{id}/body` to `actionReadBody()`.
- Modify: `apps/apiv1/kace_cloud_api_emails/lib/emails-stack.ts`
  - Add API Gateway resource `/{id}/body` for GET.
- Modify: `apps/apiv1/kace_cloud_api_emails/src/controller.mjs`
  - Implement authorized `actionReadBody()`.
- Modify: `apps/apiv1/kace_cloud_api_emails/test/EmailsE2E.test.mjs`
  - Add API contract tests.
- Modify: `apps/kace_cloud_swagger/src/emails/emails.yaml`
  - Document new body metadata and body-read route.

### Frontend

- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailBodyContent.js`
  - Normalize legacy inline body and new metadata body shapes.
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.jsx`
  - Show preview for external bodies and load full content on demand.
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx`
  - Cover inline behavior, external preview, load success, load failure.
- Optional create: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/useExternalEmailBody.js`
  - Encapsulate lazy body loading.
- Review: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailPrint/HandleEmailPrint.jsx`
  - Decide whether print loads full body or clearly prints only preview.

---

## Constants and Contract

Use these names unless implementation discovers an existing better convention:

```js
export const INLINE_EMAIL_BODY_MAX_BYTES = 1024 * 1024;
export const EXTERNAL_EMAIL_BODY_MAX_BYTES =
    Number(process.env.CHANNEL_HUB_EXTERNAL_BODY_MAX_BYTES ?? 10 * 1024 * 1024);
export const BODY_PREVIEW_MAX_CHARS =
    Number(process.env.CHANNEL_HUB_BODY_PREVIEW_MAX_CHARS ?? 8 * 1024);
```

Storage modes:

```txt
inline
external
null/undefined => legacy inline row
```

External body API route:

```http
GET /emails/{id}/body?part=text
GET /emails/{id}/body?part=html
```

Recommended first response shape:

```json
{
    "data": {
        "content": "<p>full body</p>",
        "content_type": "text/html; charset=utf-8",
        "part": "html",
        "mode": "external"
    }
}
```

If a later implementation chooses raw content or a short-lived signed URL for large payload reasons, keep `bodyUrl` as the KACE API route and keep raw S3 keys out of all normal API responses.

---

## Task 1: Add `emails_body` storage metadata migration

**Files:**
- Create: `packages/kace_cloud_database/migrations/20260524190000_add_email_body_storage_metadata.js`
- Create: `packages/kace_cloud_database/tests/migrations/20260524190000_add_email_body_storage_metadata.test.js`

- [ ] **Step 1: Create a red migration test**

Use node:test style like existing migration tests.

Test requirements:

- create an in-memory SQLite database with a minimal `emails_body` table;
- call `up(db)`;
- verify these columns exist:
  - `body_text_storage_mode`
  - `body_text_s3_key`
  - `body_text_size_bytes`
  - `body_text_content_type`
  - `body_text_sha256`
  - `body_text_preview_truncated`
  - `body_html_storage_mode`
  - `body_html_s3_key`
  - `body_html_size_bytes`
  - `body_html_content_type`
  - `body_html_sha256`
  - `body_html_preview_truncated`
- insert a legacy-style row with only `id`, `email_id`, `body`, `body_html`;
- verify preview-truncated booleans default to `false` or equivalent SQLite value;
- call `down(db)`;
- verify added columns are removed.

- [ ] **Step 2: Run the red migration test**

```bash
node --test packages/kace_cloud_database/tests/migrations/20260524190000_add_email_body_storage_metadata.test.js
```

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Add the migration**

Implementation outline:

```js
export function up(knex) {
    return knex.schema.alterTable('emails_body', (table) => {
        table.string('body_text_storage_mode', 16).nullable();
        table.string('body_text_s3_key', 1024).nullable();
        table.bigInteger('body_text_size_bytes').nullable();
        table.string('body_text_content_type', 255).nullable();
        table.string('body_text_sha256', 64).nullable();
        table.boolean('body_text_preview_truncated').notNullable().defaultTo(false);

        table.string('body_html_storage_mode', 16).nullable();
        table.string('body_html_s3_key', 1024).nullable();
        table.bigInteger('body_html_size_bytes').nullable();
        table.string('body_html_content_type', 255).nullable();
        table.string('body_html_sha256', 64).nullable();
        table.boolean('body_html_preview_truncated').notNullable().defaultTo(false);
    });
}

export function down(knex) {
    return knex.schema.alterTable('emails_body', (table) => {
        table.dropColumn('body_text_storage_mode');
        table.dropColumn('body_text_s3_key');
        table.dropColumn('body_text_size_bytes');
        table.dropColumn('body_text_content_type');
        table.dropColumn('body_text_sha256');
        table.dropColumn('body_text_preview_truncated');
        table.dropColumn('body_html_storage_mode');
        table.dropColumn('body_html_s3_key');
        table.dropColumn('body_html_size_bytes');
        table.dropColumn('body_html_content_type');
        table.dropColumn('body_html_sha256');
        table.dropColumn('body_html_preview_truncated');
    });
}
```

- [ ] **Step 4: Run migration test and full database smoke**

```bash
node --test packages/kace_cloud_database/tests/migrations/20260524190000_add_email_body_storage_metadata.test.js
pnpm --filter @kace/database test:sqlite
```

Expected: PASS.

---

## Task 2: Extend EmailBody domain, repository, and response metadata

**Files:**
- Modify: `packages/kace_cloud_core/src/emails/domain/EmailBody.js`
- Modify: `packages/kace_cloud_core/src/emails/infrastructure/persistence/KnexEmailsBodyRepository.js`
- Modify: `packages/kace_cloud_core/src/emails/application/EmailResponse.js`
- Modify: `packages/kace_cloud_core/src/emails/application/EmailResponseBody.js`
- Modify/create focused core tests under `packages/kace_cloud_core/tests/emails/`

- [ ] **Step 1: Add red response/domain tests**

Add tests proving:

- legacy `EmailBody` rows with no metadata still serialize as inline;
- inline rows include:

```json
{
    "text": { "mode": "inline", "bodyUrl": null },
    "html": { "mode": "inline", "bodyUrl": null }
}
```

- external rows include body preview and metadata;
- external response does **not** include `body_text_s3_key` or `body_html_s3_key`;
- external response exposes relative body URLs:

```txt
/emails/{email_id}/body?part=text
/emails/{email_id}/body?part=html
```

- [ ] **Step 2: Run the red focused tests**

Use the relevant `--runTestsByPath` command once the test file path is chosen, for example:

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/emails/EmailResponseBodyMetadata.test.js --runInBand
```

- [ ] **Step 3: Add optional metadata fields to `EmailBody`**

Keep all new constructor parameters optional with legacy-safe defaults:

```txt
body_text_storage_mode = null
body_text_s3_key = null
body_text_size_bytes = null
body_text_content_type = null
body_text_sha256 = null
body_text_preview_truncated = false

body_html_storage_mode = null
body_html_s3_key = null
body_html_size_bytes = null
body_html_content_type = null
body_html_sha256 = null
body_html_preview_truncated = false
```

Avoid strict non-null value objects for nullable metadata unless the existing value object supports nullable mode.

- [ ] **Step 4: Update `KnexEmailsBodyRepository` save/update/read**

Add the new fields to:

- `save(emailBody)`;
- `update(emailBody)`;
- `findByEmailBodyId(emailId)`;
- `find(emailId)`.

- [ ] **Step 5: Update response serializers**

Keep existing fields for backward compatibility:

```json
{
    "body": "preview or full inline text",
    "body_html": "full inline html or null"
}
```

Add normalized metadata:

```json
{
    "text": {
        "mode": "inline|external",
        "size_bytes": 123,
        "content_type": "text/plain; charset=utf-8",
        "preview_truncated": false,
        "bodyUrl": null
    },
    "html": {
        "mode": "inline|external",
        "size_bytes": 456,
        "content_type": "text/html; charset=utf-8",
        "preview_truncated": true,
        "bodyUrl": "/emails/email-id/body?part=html"
    }
}
```

Rules:

- legacy/null mode serializes as `inline`;
- inline body URL is `null`;
- external body URL is relative KACE API path;
- raw S3 keys are omitted.

- [ ] **Step 6: Run focused core tests**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/emails/EmailResponseBodyMetadata.test.js --runInBand
```

Expected: PASS.

---

## Task 3: Add dedicated S3 email body storage

**Files:**
- Create: `packages/kace_cloud_core/src/emails/domain/ports/EmailBodyStoragePort.js`
- Create: `packages/kace_cloud_core/src/emails/infrastructure/persistence/S3EmailBodyStorage.js`
- Create: `packages/kace_cloud_core/tests/emails/S3EmailBodyStorage.test.js`

- [ ] **Step 1: Add red storage tests**

Tests should mock `s3Client.send` and prove:

- `upload({ emailId, part: 'html', buffer, contentType })` uses key prefix `email-bodies/{emailId}/`;
- generated key contains only generated/safe path pieces, not subject/sender/original URL;
- `upload` sends `PutObjectCommand` with `ContentType`;
- `download(s3Key)` sends `GetObjectCommand` and returns a Buffer/string plus content type;
- `delete(s3Key)` sends `DeleteObjectCommand`;
- empty `s3Key` delete is a no-op.

- [ ] **Step 2: Run the red storage test**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/emails/S3EmailBodyStorage.test.js --runInBand
```

- [ ] **Step 3: Implement the port**

Recommended port:

```js
export class EmailBodyStoragePort {
    async upload(_params) {
        throw new Error('Not implemented');
    }

    async download(_s3Key) {
        throw new Error('Not implemented');
    }

    async delete(_s3Key) {
        throw new Error('Not implemented');
    }
}
```

- [ ] **Step 4: Implement `S3EmailBodyStorage`**

Mirror `S3AttachmentStorage` tenant/env resolution:

- region from tenant or `AWS_S3_REGION`;
- credentials from tenant or env;
- bucket from tenant, `BUCKET`, or `AWS_S3_BUCKET`.

Upload return shape:

```js
{
    s3Key,
    contentType,
    sizeBytes: buffer.length,
    sha256
}
```

Key policy:

```txt
email-bodies/{emailId}/{part}-{uuid}.{txt|html}
```

- [ ] **Step 5: Run focused storage tests**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/emails/S3EmailBodyStorage.test.js --runInBand
```

Expected: PASS.

---

## Task 4: Add body processing helpers and external-size-aware downloader behavior

**Files:**
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundTextBodyDownloader.js`
- Optional create: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailBodyContent.js`
- Modify: `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`

- [ ] **Step 1: Add red downloader/helper tests**

Update existing downloader tests so:

- downloader default max is external max, not inline max;
- tests that expect `text_body_too_large` use an explicit low `maxBytes` or the external max;
- HTML oversized errors still use `html_body_too_large`;
- stream cancellation still happens when max bytes is exceeded.

Add helper tests if a helper file is created:

- `stripHtmlToTextPreview('<p>Hello<br>World</p>')` returns readable text;
- preview truncates at `BODY_PREVIEW_MAX_CHARS`;
- SHA-256 is stable;
- inline/external decision uses byte length, not JS string length.

- [ ] **Step 2: Run red focused tests**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --runInBand
```

- [ ] **Step 3: Update downloader constructor default**

Replace inline max default with external max:

```js
maxBytes = EXTERNAL_EMAIL_BODY_MAX_BYTES
```

Keep specific error code behavior unchanged.

- [ ] **Step 4: Add helper functions**

Recommended helper responsibilities:

- `bodyBuffer(download)`;
- `bodyByteLength(buffer)`;
- `sha256(buffer)`;
- `previewFromText(text, maxChars)`;
- `previewFromHtml(html, maxChars)`;
- `bodyStorageModeFor(buffer)`;
- `isOverExternalLimit(bufferOrDeclaredSize)`;

Do not add a heavy HTML parser unless already available; a conservative tag stripper is enough for preview.

- [ ] **Step 5: Run focused tests**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --runInBand
```

Expected: downloader/helper tests pass; processor externalization tests may still fail until Task 5/6.

---

## Task 5: Add red processor tests for external body behavior

**Files:**
- Modify: `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`

- [ ] **Step 1: Extend test schema setup**

In the test-local `emails_body` table setup, add the same storage metadata columns from the migration.

- [ ] **Step 2: Add `bodyStorage` mock**

Near existing mocks:

```js
const bodyStorage = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
};
```

Inject it in `createProcessor()`.

- [ ] **Step 3: Add test: oversized inline text is accepted externally**

Arrange:

- `bodyDownloader.download` returns a Buffer with `INLINE_EMAIL_BODY_MAX_BYTES + 1` bytes;
- `bodyStorage.upload` returns `email-bodies/email-id/text-body-id.txt` metadata.

Assert:

- `result.accepted === true`;
- `result.code` is not `text_body_too_large`;
- one email/body/interaction exists;
- `emails_body.body_text_storage_mode === 'external'`;
- `emails_body.body_text_s3_key` is set;
- `emails_body.body` is preview/truncated, not the full huge string;
- `bodyStorage.upload` was called;
- raw S3 key is not part of processing result.

- [ ] **Step 4: Add test: oversized inline HTML is accepted externally**

Arrange small text body and large HTML body.

Assert:

- `body_html_storage_mode === 'external'`;
- `body_html_s3_key` is set;
- `body_html` column is `null` or bounded preview according to implementation choice;
- inline image embedder still runs before storage decision.

- [ ] **Step 5: Add test: over external max remains non-retryable**

Use an explicit low max or mocked download metadata.

Assert:

- text over external max returns `text_body_too_large`;
- HTML over external max returns `html_body_too_large`;
- no DB records;
- no S3 uploads.

- [ ] **Step 6: Add test: same text/html URL downloads once**

Payload:

```js
content: {
    text: allowedHtmlBodyUrl,
    html: allowedHtmlBodyUrl,
}
```

Assert:

- `bodyDownloader.download` called once for that URL;
- both text/html metadata are persisted appropriately;
- webhook is accepted.

- [ ] **Step 7: Add cleanup tests**

Add tests proving:

- uploaded body object is deleted if DB persistence fails after body upload;
- uploaded body object is deleted if later attachment processing or scanning fails;
- uploaded body object is not deleted after successful transaction.

- [ ] **Step 8: Add duplicate replay guard test**

Prove duplicate replay returns `already_processed` without redownloading/reuploading body content.

- [ ] **Step 9: Run red processor tests**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --runInBand
```

Expected: new tests FAIL before implementation.

---

## Task 6: Implement external body processing in ChannelHubInboundEmailProcessor

**Files:**
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js`
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js`

- [ ] **Step 1: Add body storage dependency**

Constructor:

```js
#bodyStorage;

constructor({ ..., bodyStorage, ... }) {
    ...
    this.#bodyStorage = bodyStorage;
}
```

Factory:

```js
bodyStorage: new S3EmailBodyStorage()
```

- [ ] **Step 2: Track uploaded body keys**

In `execute()`:

```js
const uploadedBodyKeys = [];
```

In catch cleanup:

```js
await this.#cleanupUploadedBodies(uploadedBodyKeys);
await this.#cleanupUploadedAttachments(uploadedAttachmentKeys);
```

Use `Promise.allSettled`, matching attachment cleanup style.

- [ ] **Step 3: Download each unique body URL once**

Recommended map:

```js
const bodyDownloads = new Map();

async #downloadBodyOnce(url, options) {
    if (!bodyDownloads.has(url)) {
        bodyDownloads.set(url, this.#bodyDownloader.download(url, options));
    }
    return bodyDownloads.get(url);
}
```

Important:

- preserve text vs html error code behavior when URLs differ;
- when URLs are identical and URL is HTML, prefer `{ kind: 'html' }` for the single download if `htmlBodyUrl` is present.

- [ ] **Step 4: Replace hard inline-size rejection with externalization**

Remove the current behavior where `#isOversizedDownload(download)` over 1 MiB immediately returns `text_body_too_large`.

New behavior:

- if over external max: return `text_body_too_large` / `html_body_too_large`;
- if over inline max but within external max: upload to body storage and persist metadata;
- if within inline max: persist full inline content as today.

- [ ] **Step 5: Build a body record DTO before persistence**

Instead of passing only `textBody` and `htmlBody` into `#persistAtomically`, pass a prepared object:

```js
bodyRecord: {
    text: {
        body,
        storageMode,
        s3Key,
        sizeBytes,
        contentType,
        sha256,
        previewTruncated,
    },
    html: {
        bodyHtml,
        storageMode,
        s3Key,
        sizeBytes,
        contentType,
        sha256,
        previewTruncated,
    },
}
```

Persist to `emails_body` columns inside the transaction.

- [ ] **Step 6: Preserve HTML behavior**

Rules:

- If `htmlBodyUrl` exists, keep preferring it for `body_html`.
- Run `inlineImageEmbedder.execute(downloadedHtmlBody)` before storage decision.
- If `content.text` and `content.html` are same URL and content type/body appears HTML, store a text preview in `body` and HTML content/metadata in the HTML fields.
- Never store the original Channel Hub URL as body content.

- [ ] **Step 7: Add structured logs**

Add a single non-sensitive debug log after body decisions:

```txt
ChannelHubWebhook::bodyStorageDecision
```

Include:

- message id/operator id;
- connectionId;
- tag;
- text/html mode;
- text/html size bytes;
- whether body download was deduplicated.

Do not log:

- body content;
- signed Channel Hub URLs;
- S3 keys;
- signed S3 URLs.

- [ ] **Step 8: Run processor tests**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --runInBand
```

Expected: PASS.

---

## Task 7: Add full body reader service

**Files:**
- Create: `packages/kace_cloud_core/src/emails/application/body/EmailBodyContentReader.js`
- Create: `packages/kace_cloud_core/tests/emails/EmailBodyContentReader.test.js`

- [ ] **Step 1: Add red reader tests**

Test cases:

- legacy/null storage mode returns inline `body` for `part=text`;
- legacy/null storage mode returns inline `body_html` for `part=html`;
- `inline` mode returns inline content;
- `external` mode calls body storage `download(s3Key)`;
- unknown `part` throws a controlled 400-style error;
- missing email/body throws a controlled 404-style error;
- external body without `s3Key` throws a controlled 500/processing error;
- raw S3 keys are not returned in public DTO.

- [ ] **Step 2: Run red test**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/emails/EmailBodyContentReader.test.js --runInBand
```

- [ ] **Step 3: Implement service**

Suggested constructor:

```js
constructor({ emailRepository, emailBodyRepository, bodyStorage })
```

Suggested response:

```js
{
    email_id: emailId,
    part: 'text' | 'html',
    mode: 'inline' | 'external',
    content,
    content_type
}
```

- [ ] **Step 4: Run focused reader tests**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/emails/EmailBodyContentReader.test.js --runInBand
```

Expected: PASS.

---

## Task 8: Add authorized Emails API body-read route

**Files:**
- Modify: `packages/kace_cloud_api_common/src/controllers/BaseController.js`
- Modify: `apps/apiv1/kace_cloud_api_emails/lib/emails-stack.ts`
- Modify: `apps/apiv1/kace_cloud_api_emails/src/controller.mjs`
- Modify: `apps/apiv1/kace_cloud_api_emails/test/EmailsE2E.test.mjs`

- [ ] **Step 1: Add red API tests**

Add tests proving:

- `GET /emails/{id}/body?part=html` returns full HTML content for external body;
- `GET /emails/{id}/body?part=text` returns full text content for inline/legacy body;
- missing/invalid `part` returns bad request;
- request requires logged-in user and `EmailsRead`;
- response does not include raw S3 key.

If the existing E2E harness cannot easily cover API Gateway resource routing, add focused controller tests with event fixtures where:

```js
event.resource = '/{id}/body';
event.httpMethod = 'GET';
event.pathParameters = { id: 'email-id' };
event.queryStringParameters = { part: 'html' };
```

- [ ] **Step 2: Run red API tests**

```bash
pnpm --filter @kace/api-emails test -- --runTestsByPath apps/apiv1/kace_cloud_api_emails/test/EmailsE2E.test.mjs --runInBand
```

- [ ] **Step 3: Add route branch in `BaseController`**

In the GET switch:

```js
} else if (resource === '/{id}/body') {
    response = await this.actionReadBody();
}
```

Add default method:

```js
async actionReadBody() {
    return Promise.resolve(
        HttpResponse.internalServerError({
            message: 'Action "readBody" is not implemented yet',
            event: this.event,
        })
    );
}
```

- [ ] **Step 4: Add API Gateway resource in Emails stack only**

In `apps/apiv1/kace_cloud_api_emails/lib/emails-stack.ts`, after `setDefaultResources`:

```ts
const idResource = lambdaRestApi.root.getResource('{id}') ?? lambdaRestApi.root.addResource('{id}');
const bodyResource = idResource.addResource('body');
bodyResource.addMethod('GET', undefined, methodOptions);
```

Do not add this route globally to every API stack unless there is an existing convention for custom resources.

- [ ] **Step 5: Implement `Controller.actionReadBody()`**

Requirements:

- check `EmailsRead` permission like `actionRead()`;
- validate `id` using `validateId`;
- read `part` from `this.event.queryStringParameters?.part`;
- instantiate `EmailBodyContentReader` with:
  - existing email repository;
  - existing email body repository;
  - `new S3EmailBodyStorage()`;
- return `HttpResponse.ok({ data: ..., event: this.event })`;
- map controlled 400/404 errors to appropriate response if project error conventions exist.

- [ ] **Step 6: Run focused API tests and build**

```bash
pnpm --filter @kace/api-emails test -- --runTestsByPath apps/apiv1/kace_cloud_api_emails/test/EmailsE2E.test.mjs --runInBand
pnpm --filter @kace/api-emails build
```

Expected: PASS.

---

## Task 9: Update Swagger docs

**Files:**
- Modify: `apps/kace_cloud_swagger/src/emails/emails.yaml`

- [ ] **Step 1: Document the new body object metadata**

Update the email detail response schema/example to include:

- `body.text.mode`;
- `body.text.size_bytes`;
- `body.text.content_type`;
- `body.text.preview_truncated`;
- `body.text.bodyUrl`;
- same for `body.html`.

- [ ] **Step 2: Document `GET /emails/{id}/body`**

Add:

```yaml
/emails/{id}/body:
  get:
    summary: Read full email body part
    parameters:
      - name: id
        in: path
        required: true
      - name: part
        in: query
        required: true
        schema:
          type: string
          enum: [text, html]
```

Mention:

- requires `EmailsRead`;
- returns full body content for inline or external body;
- raw S3 keys are never exposed.

- [ ] **Step 3: Run any swagger generation/format command if available**

If no swagger test command exists, run at least a YAML parse/check command already used by the repo, or document that no automated check exists.

---

## Task 10: Add frontend lazy loading for external bodies

**Files:**
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailBodyContent.js`
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.jsx`
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx`
- Optional create: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/useExternalEmailBody.js`

- [ ] **Step 1: Add red `emailBodyContent` tests**

Update/create tests proving:

- legacy string body returns `{ plain, html, mode: 'inline' }`;
- legacy object `{ body, body_html }` returns inline content;
- new metadata body with `html.mode === 'external'` returns:
  - preview plain text;
  - `preferredPart: 'html'`;
  - `bodyUrl`;
  - `isExternal: true`;
- if external HTML is missing, external text is used.

- [ ] **Step 2: Add red `EmailDetail` tests**

Use React Testing Library + Vitest.

Test cases:

- existing inline HTML still renders and DOMPurify is called;
- external body shows preview and a "load full body" control;
- clicking load fetches the KACE `bodyUrl` and renders sanitized full HTML;
- fetch failure keeps preview visible and shows an error state;
- Email list/search is unaffected because only `EmailDetail` triggers the body fetch.

- [ ] **Step 3: Implement body content normalization**

Recommended return shape from `getEmailBodyContent({ body })`:

```js
{
    plain,
    html,
    preferredPart: 'html' | 'text',
    bodyUrl,
    isExternal,
    previewTruncated,
    contentType,
}
```

Keep backward compatibility with current callers.

- [ ] **Step 4: Implement lazy fetch**

Use existing `apiService` or `genericView` conventions.

If endpoint returns JSON:

```js
const response = await apiService.get(bodyUrl);
const content = response.data?.data?.content ?? '';
```

If endpoint returns raw content later, adapt here only.

- [ ] **Step 5: Update `EmailDetail` render behavior**

Rules:

- inline body renders exactly as today;
- external body renders preview plus load button;
- after loading, render full content in same sanitized HTML/plain text path;
- keep `DOMPurify.sanitize()` before `dangerouslySetInnerHTML`;
- disable the button while loading;
- show a small error message if loading fails.

- [ ] **Step 6: Review print behavior**

Choose one:

- print only preview and label it clearly as preview; or
- load full body before printing.

Document the chosen behavior in the test name or code comment.

- [ ] **Step 7: Run frontend tests**

```bash
pnpm --filter kace-sass test -- apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx --runInBand
```

If Vitest does not support `--runInBand`, use the nearest project-supported focused command:

```bash
pnpm --filter kace-sass test -- EmailDetail.spec.jsx
```

Expected: PASS.

---

## Task 11: End-to-end verification and regression suite

**Files:**
- All changed files from previous tasks.

- [ ] **Step 1: Run focused core regression**

```bash
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --runInBand
pnpm --filter @kace/core tests -- --runTestsByPath packages/kace_cloud_core/tests/emails/EmailBodyContentReader.test.js --runInBand
```

- [ ] **Step 2: Run API regression**

```bash
pnpm --filter @kace/api-emails test -- --runInBand
pnpm --filter @kace/api-emails build
```

- [ ] **Step 3: Run database migration smoke**

```bash
node --test packages/kace_cloud_database/tests/migrations/20260524190000_add_email_body_storage_metadata.test.js
pnpm --filter @kace/database test:sqlite
```

- [ ] **Step 4: Run frontend focused regression**

```bash
pnpm --filter kace-sass test -- EmailDetail.spec.jsx
```

- [ ] **Step 5: Manual payload simulation**

Create or adapt a processor test fixture matching the failure shape:

```json
{
    "content": {
        "text": "https://trusted-cdn.example/message_body.html?...",
        "html": "https://trusted-cdn.example/message_body.html?..."
    },
    "attachments": ["https://trusted-cdn.example/attachments/file.pdf"],
    "connectionId": "conn_support",
    "tag": "luigui2"
}
```

Expected:

- validation succeeds;
- route resolution succeeds;
- body download happens once;
- large body is externalized;
- attachment still processes normally;
- webhook result is accepted;
- `GET /emails/{id}` returns preview+metadata;
- `GET /emails/{id}/body?part=html` returns full body.

- [ ] **Step 6: Check logs**

Verify logs include `ChannelHubWebhook::bodyStorageDecision` with mode/size metadata but no:

- signed CloudFront URLs;
- body content;
- S3 keys;
- signed S3 URLs.

---

## Task 12: Commit/readiness checklist

- [ ] `git status --short` reviewed; no unrelated changes staged.
- [ ] If committing Superpowers docs, force-add them:

```bash
git add -f docs/superpowers/specs/2026-05-24-channel-hub-large-body-external-storage-design.md
git add -f docs/superpowers/plans/2026-05-24-channel-hub-large-body-external-storage.md
```

- [ ] Database migration has been run in a safe lower environment before webhook processor deploy.
- [ ] Backend can read legacy rows where metadata columns are null.
- [ ] Frontend is compatible with both old and new body response shapes.
- [ ] External body max is configured intentionally for the deployed API delivery mechanism.
- [ ] No raw S3 keys are exposed in API responses.
- [ ] No body content or signed URLs are logged.

---

## Out of Scope

- Changing Channel Hub registration, routing, `connectionId + tag` behavior, or RestFlow rules.
- Changing attachment storage/scanning behavior.
- Streaming implementation beyond what the current API stack supports.
- Full raw MIME archival.
- Lifecycle/retention policy for historical external body objects.
- UI redesign beyond preview/load-full-body behavior.
