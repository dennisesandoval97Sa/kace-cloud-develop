# Channel Hub Inbound Email Issue 04 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Channel Hub inbound email attachments as scanned, durable KACE S3 references with filenames, and render/download those filenames in the agent UI.

**Architecture:** Keep the public webhook thin and extend the existing core Channel Hub inbound processor. Validate attachment provider URLs before any external attachment download, download and upload attachments before the DB transaction, scan uploaded files before creating any `emails_attachments` row, then atomically persist Email, Email Body, Email Attachments, and Interaction. Store `emails_attachments.filename` as nullable/backward-compatible; response objects expose both `filename` and `name` so existing UI code remains compatible.

**Tech Stack:** Node.js ESM, Knex migrations/repositories, Jest for core/API webhook tests, Vitest + Testing Library for React UI helpers/components, S3 upload/scanner ports/mocks.

**Constraints:** Work in the current workspace/branch; do not create a git worktree; do not commit. Use TDD: write failing tests, verify RED, implement minimal code, verify GREEN. Do not implement Issue 05 legacy webhook convergence in this slice.

---

## File Structure

- Create `packages/kace_cloud_database/migrations/20260514123000_channel_hub_inbound_email_issue_04_attachment_filename.js` — nullable `emails_attachments.filename`.
- Modify `packages/kace_cloud_core/src/emails/domain/EmailAttachments.js` — nullable filename value.
- Modify `packages/kace_cloud_core/src/emails/infrastructure/persistence/KnexEmailAttachmentRepository.js` — save/update/find filename.
- Modify `packages/kace_cloud_core/src/emails/application/EmailAttachmentResponse.js` — include `filename` and `name`.
- Modify `packages/kace_cloud_core/src/emails/application/EmailResponse.js` — include `filename` and `name` in plural attachments.
- Modify `apps/apiv1/kace_cloud_api_emails/src/schemas.mjs` — allow nullable filename/name in attachment schema.
- Create `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundAttachmentDownloader.js` — secure attachment downloader with allowed-domain checks, manual redirects, timeout/size guard, and filename extraction.
- Modify `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js` — normalize/download/upload/scan/persist durable attachments.
- Modify `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs` — inject attachment repository/downloader/storage/scanner into processor.
- Modify `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs` — accept optional `attachments[]` with `url`, filename aliases, content-type aliases, and size.
- Modify `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.jsx` — display filename.
- Modify `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailPrint/renderEmailToPrintHtml.js` — print escaped filename.
- Modify `apps/kace-saas/src/pages/Agent/components/Interactions/utils/downloadAttachment.js` — use filename for individual downloads.
- Modify `apps/kace-saas/src/pages/Agent/components/Interactions/utils/downloadAttachmentsZip.js` — use filename for ZIP entries.
- Modify `apps/kace-saas/src/pages/Agent/components/Interactions/InteractionDetail.jsx` — use plural `email.attachments` as well as legacy `email.attachment` for ZIP download.
- Create `apps/kace-saas/src/pages/Agent/components/Interactions/emails/attachmentDisplayName.js` and specs for filename fallback behavior.
- Update tests under:
  - `packages/kace_cloud_core/tests/emails/EmailsAttachmentUnitTest.test.js`
  - `packages/kace_cloud_core/tests/emails/EmailsUnitTest.test.js`
  - `packages/kace_cloud_core/tests/emails/EmailsIntegration.test.js`
  - `packages/kace_cloud_core/tests/emails/domain/EmailAttachmentMother.js`
  - `packages/kace_cloud_core/tests/emails/domain/EmailsMother.js`
  - `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`
  - `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs`
  - frontend attachment/UI specs.

---

### Task 1: Add backward-compatible Attachment Filename storage and response shape

**Files:**
- Create: `packages/kace_cloud_database/migrations/20260514123000_channel_hub_inbound_email_issue_04_attachment_filename.js`
- Modify: `packages/kace_cloud_core/src/emails/domain/EmailAttachments.js`
- Modify: `packages/kace_cloud_core/src/emails/infrastructure/persistence/KnexEmailAttachmentRepository.js`
- Modify: `packages/kace_cloud_core/src/emails/application/EmailAttachmentResponse.js`
- Modify: `packages/kace_cloud_core/src/emails/application/EmailResponse.js`
- Modify: `apps/apiv1/kace_cloud_api_emails/src/schemas.mjs`
- Tests: `packages/kace_cloud_core/tests/emails/EmailsAttachmentUnitTest.test.js`, `packages/kace_cloud_core/tests/emails/EmailsUnitTest.test.js`, `packages/kace_cloud_core/tests/emails/EmailsIntegration.test.js`

- [ ] **Step 1: Write failing unit/response tests for filename**

Add to `EmailsAttachmentUnitTest.test.js`:

```js
it('should create EmailAttachment with nullable filename when absent', () => {
    const attachment = EmailAttachment.create(EmailAttachmentMother.dto({ filename: null }));

    expect(attachment.filename.value).toBeNull();
});

it('should update filename and track changedAttributes', () => {
    const attachment = EmailAttachment.create(EmailAttachmentMother.dto({ filename: null }));

    attachment.filename = 'invoice-2026.pdf';

    expect(attachment.filename.value).toBe('invoice-2026.pdf');
    expect(attachment.changedAttributes).toEqual({ filename: 'invoice-2026.pdf' });
});
```

Update `EmailAttachmentResponse` expected JSON:

```js
filename: attachment.filename.value,
name: attachment.filename.value,
```

Update `EmailsUnitTest` attachment expectations to include `filename` and `name`.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
pnpm --filter @kace/core tests tests/emails/EmailsAttachmentUnitTest.test.js tests/emails/EmailsUnitTest.test.js --coverage=false
```

Expected: FAIL because `EmailAttachment.filename` and response fields do not exist.

- [ ] **Step 3: Implement domain/response filename**

In `EmailAttachments.js`, import `ValueObjectString`, add private `#filename`, constructor param `filename = null`, getter/setter:

```js
this.#filename = new ValueObjectString('filename', filename, true);
```

```js
get filename() {
    return this.#filename;
}
set filename(value) {
    this.#filename = new ValueObjectString('filename', value, true);
    this.changedAttributes.filename = value;
}
```

Pass `filename` through `EmailAttachment.create()`.

In `EmailAttachmentResponse` and `EmailResponse` attachment mapping, include:

```js
filename: attachment.filename.value,
name: attachment.filename.value,
```

- [ ] **Step 4: Add migration and persistence**

Create migration:

```js
export async function up(knex) {
    const hasColumn = await knex.schema.hasColumn('emails_attachments', 'filename');
    if (!hasColumn) {
        await knex.schema.alterTable('emails_attachments', (table) => {
            table.string('filename', 255).nullable();
        });
    }
}

export async function down(knex) {
    const hasColumn = await knex.schema.hasColumn('emails_attachments', 'filename');
    if (hasColumn) {
        await knex.schema.alterTable('emails_attachments', (table) => {
            table.dropColumn('filename');
        });
    }
}
```

In `KnexEmailAttachmentRepository.save()` and `update()`, include:

```js
filename: emailAttachment.filename.value,
```

In `apps/apiv1/kace_cloud_api_emails/src/schemas.mjs`, add to `emailAttachmentSchema`:

```js
filename: Joi.string().max(255).allow(null, '').optional(),
name: Joi.string().max(255).allow(null, '').optional(),
```

- [ ] **Step 5: Update integration fixtures and verify GREEN**

Update attachment DTOs in email tests/mothers to include `filename` where useful. Update expectations for Email detail response attachments:

```js
expect(json.data.attachments[0]).toMatchObject({
    filename: 'attachment.jpg',
    name: 'attachment.jpg',
});
```

Run:

```bash
pnpm --filter @kace/core tests tests/emails/EmailsAttachmentUnitTest.test.js tests/emails/EmailsUnitTest.test.js tests/emails/EmailsIntegration.test.js --coverage=false
```

Expected: PASS.

---

### Task 2: Durable scanned Channel Hub attachment processing

**Files:**
- Create: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundAttachmentDownloader.js`
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js`
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs`
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs`
- Tests: `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`, `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs`

- [ ] **Step 1: Write failing processor tests for durable attachment success**

In `ChannelHubInboundEmailProcessor.test.js`:

- Add `filename` column to the manual `emails_attachments` test table.
- Add mocked dependencies to processor setup:

```js
const attachmentDownloader = { download: jest.fn() };
const attachmentStorage = { upload: jest.fn() };
const fileScanner = { execute: jest.fn() };
const attachmentUrl = 'https://channel-hub-cdn.example.com/attachments/invoice.pdf';
const durableAttachmentUrl = 'https://kace-bucket.s3.amazonaws.com/attachments/email-id/invoice.pdf';
```

Default mocks:

```js
attachmentDownloader.download.mockResolvedValue({
    buffer: Buffer.from('invoice-file'),
    contentType: 'application/pdf',
    filename: 'invoice.pdf',
    finalUrl: attachmentUrl,
});
attachmentStorage.upload.mockResolvedValue({
    s3Key: 'attachments/email-id/uuid_invoice.pdf',
    s3Url: durableAttachmentUrl,
});
fileScanner.execute.mockResolvedValue({ message: 'File validated successfully' });
```

Add test:

```js
it('downloads trusted Channel Hub attachments, uploads to KACE S3, scans, and persists durable filename records', async () => {
    const { workspace } = await createValidWorkspaceAndMailAccount();
    const payload = validPayload({
        workspaceId: workspace.id.value,
        payload: {
            attachments: [
                {
                    url: attachmentUrl,
                    filename: 'invoice.pdf',
                    content_type: 'application/pdf',
                    size: 12,
                },
            ],
        },
    });

    const result = await createProcessor().execute(payload);

    expect(result.accepted).toBe(true);
    expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(attachmentUrl);
    expect(attachmentDownloader.download).toHaveBeenCalledWith(attachmentUrl);
    expect(attachmentStorage.upload).toHaveBeenCalledWith(
        expect.objectContaining({
            buffer: Buffer.from('invoice-file'),
            contentType: 'application/pdf',
            filename: 'invoice.pdf',
        })
    );
    expect(fileScanner.execute).toHaveBeenCalledWith(
        expect.objectContaining({
            url: 'attachments',
            id: expect.any(String),
            fileName: expect.stringContaining('invoice.pdf'),
        })
    );

    const [attachment] = await emailRepository.connection('emails_attachments').select('*');
    expect(attachment.url).toBe(durableAttachmentUrl);
    expect(attachment.url).not.toBe(attachmentUrl);
    expect(attachment.size).toBe(12);
    expect(attachment.filename).toBe('invoice.pdf');
});
```

- [ ] **Step 2: Write failing tests for failure categories/no partial records**

Add tests:

```js
it('returns non-retryable and creates no records when an attachment URL is untrusted before downloads', async () => {
    const { workspace } = await createValidWorkspaceAndMailAccount();
    const payload = validPayload({
        workspaceId: workspace.id.value,
        payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
    });
    allowedConnectionRepository.isAllowedConnection.mockImplementation(async (url) => url !== attachmentUrl);

    const result = await createProcessor().execute(payload);

    expect(result.nonRetryable).toBe(true);
    expect(result.code).toBe('untrusted_attachment_url');
    expect(bodyDownloader.download).not.toHaveBeenCalled();
    expect(attachmentDownloader.download).not.toHaveBeenCalled();
    await expectNoRecordsCreated();
});

it.each([
    ['download failure', () => attachmentDownloader.download.mockRejectedValue(new Error('download failed'))],
    ['upload failure', () => attachmentStorage.upload.mockRejectedValue(new Error('upload failed'))],
    [
        'scanner rejection',
        () => fileScanner.execute.mockResolvedValue({ message: 'Threat detected', errors: { fileName: 'invoice.pdf' } }),
    ],
])('returns retryable and leaves no records when attachment %s occurs', async (_name, arrange) => {
    const { workspace } = await createValidWorkspaceAndMailAccount();
    arrange();
    const payload = validPayload({
        workspaceId: workspace.id.value,
        payload: { attachments: [{ url: attachmentUrl, filename: 'invoice.pdf' }] },
    });

    const result = await createProcessor().execute(payload);

    expect(result.retryable).toBe(true);
    expect(result.code).toBe('processing_failed');
    await expectNoRecordsCreated();
});
```

Add a duplicate replay test proving a repeated message with changed/untrusted attachment URL returns `already_processed` before attachment validation/download.

- [ ] **Step 3: Run processor tests to verify RED**

Run:

```bash
pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false
```

Expected: FAIL because processor ignores `attachments` and has no attachment dependencies.

- [ ] **Step 4: Implement secure Channel Hub attachment downloader**

Create `ChannelHubInboundAttachmentDownloader.js` modeled after the body downloader:

- constructor dependencies: `fetchFn = globalThis.fetch`, `allowedConnectionRepository`, `timeoutMs = 5000`, `maxBytes = 25 * 1024 * 1024`, `maxRedirects = 3`.
- `download(url)` validates each redirect hop with `allowedConnectionRepository.isAllowedConnection(url)` before fetch.
- use `redirect: 'manual'`.
- reject untrusted URL/redirect as `ChannelHubInboundAttachmentDownloadError` with `code = 'untrusted_attachment_url'`, `nonRetryable = true`.
- reject HTTP/network/read failures as retryable download errors (`nonRetryable = false`).
- return `{ buffer, contentType, filename, finalUrl, contentLength }`.
- derive filename from `Content-Disposition` first, then URL pathname.

- [ ] **Step 5: Implement processor attachment workflow**

Extend `ChannelHubInboundEmailProcessor` constructor with:

```js
emailAttachmentRepository,
attachmentDownloader,
attachmentStorage,
fileScanner,
```

In `execute()`:

```js
const attachments = this.#normalizeAttachments(payload?.attachments);
```

After duplicate replay lookup and before any body download, validate all attachment URLs:

```js
for (const attachment of attachments) {
    if (!(await this.#allowedConnectionRepository.isAllowedConnection(attachment.url))) {
        return ChannelHubInboundEmailProcessingResult.nonRetryable(
            'untrusted_attachment_url',
            'Attachment URL host is not trusted.'
        );
    }
}
```

After body downloads but before DB persistence:

```js
const durableAttachments = await this.#prepareDurableAttachments({
    emailId,
    attachments,
    createdAt: now,
    createdBy,
});
```

Because the current `#persistAtomically()` creates `emailId` internally, refactor it to create `emailId`, `now`, and `createdBy` before downloads that need the Email ID. Pass those values into `#persistAtomically()`.

`#prepareDurableAttachments()` should:

1. download each provider URL using `attachmentDownloader.download(url)`.
2. re-check `download.finalUrl` if present.
3. choose filename from payload alias (`filename`, `name`, `fileName`) or downloaded filename.
4. upload to KACE S3 using `{ emailId, buffer, contentType, filename }`.
5. scan the uploaded object using the existing `stored.s3Key.split('/')` convention.
6. throw a retryable error if scan result is not `File validated successfully` (accept `Security validation disabled` only if existing scanner behavior needs local/non-prod compatibility).
7. return EmailAttachment aggregates with durable `url: stored.s3Url`, `size`, and `filename`.

In `#persistAtomically()`, insert each durable attachment row inside the same transaction between EmailBody and Interaction inserts.

- [ ] **Step 6: Wire production dependencies and webhook schema**

In `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs`, import and instantiate:

```js
import { KnexEmailAttachmentRepository } from '@kace/core/src/emails/infrastructure/persistence/KnexEmailAttachmentRepository.js';
import { ChannelHubInboundAttachmentDownloader } from '@kace/core/src/channel-hub-inbound-emails/application/ChannelHubInboundAttachmentDownloader.js';
import { S3AttachmentStorage } from '@kace/core/src/emails/infrastructure/persistence/S3AttachmentStorage.js';
import { S3FileScanner, S3ScanService } from '@kace/core/src/s3-files/index.js';
```

Pass:

```js
emailAttachmentRepository,
attachmentDownloader: new ChannelHubInboundAttachmentDownloader({ allowedConnectionRepository }),
attachmentStorage: new S3AttachmentStorage(),
fileScanner: new S3FileScanner(new S3ScanService()),
```

In webhook schema:

```js
const attachmentSchema = Joi.object({
    url: Joi.string().uri().required(),
    filename: Joi.string().max(255).allow(null, '').optional(),
    name: Joi.string().max(255).allow(null, '').optional(),
    fileName: Joi.string().max(255).allow(null, '').optional(),
    content_type: Joi.string().max(255).allow(null, '').optional(),
    contentType: Joi.string().max(255).allow(null, '').optional(),
    size: Joi.number().integer().min(0).optional(),
}).unknown(true);
```

Add `attachments: Joi.array().items(attachmentSchema).optional()`.

Add webhook schema tests accepting valid attachments and rejecting non-URI attachment URLs.

- [ ] **Step 7: Verify processor/webhook GREEN**

Run:

```bash
pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
```

Expected: PASS.

---

### Task 3: Agent UI filename display and download behavior

**Files:**
- Create: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/attachmentDisplayName.js`
- Create tests for the helper and UI/download behavior.
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.jsx`
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailPrint/renderEmailToPrintHtml.js`
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/utils/downloadAttachment.js`
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/utils/downloadAttachmentsZip.js`
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/InteractionDetail.jsx`

- [ ] **Step 1: Write failing frontend tests**

Create helper spec:

```js
import { describe, expect, it } from 'vitest';
import { getAttachmentDisplayName } from './attachmentDisplayName';

describe('getAttachmentDisplayName', () => {
    it('prefers filename over legacy name', () => {
        expect(getAttachmentDisplayName({ filename: 'invoice.pdf', name: 'legacy.pdf' })).toBe('invoice.pdf');
    });

    it('falls back to name and then attachment', () => {
        expect(getAttachmentDisplayName({ name: 'legacy.pdf' })).toBe('legacy.pdf');
        expect(getAttachmentDisplayName({})).toBe('attachment');
    });
});
```

Extend `EmailDetail.spec.jsx`:

```jsx
it('displays attachment filename from the Email detail API', () => {
    render(
        <EmailDetail
            email={{
                ...baseEmail,
                body: { body: 'Plain', body_html: null },
                attachments: [{ id: 'att-1', filename: 'invoice.pdf', url: 'https://kace.example/invoice.pdf', size: 12 }],
            }}
            onBack={vi.fn()}
        />
    );

    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
});
```

Add utility tests that prove `downloadAttachment()` sets `link.download` from `filename`, and `downloadAttachmentsZip()` calls `zip.file(filename, blob)`.

- [ ] **Step 2: Run frontend tests to verify RED**

Run:

```bash
pnpm --filter kace-sass test src/pages/Agent/components/Interactions/emails/attachmentDisplayName.spec.js src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx src/pages/Agent/components/Interactions/utils/downloadAttachment.spec.js src/pages/Agent/components/Interactions/utils/downloadAttachmentsZip.spec.js
```

Expected: FAIL until helper/utilities are implemented.

- [ ] **Step 3: Implement filename helper and UI usage**

Create:

```js
export const getAttachmentDisplayName = (file) => file?.filename || file?.name || 'attachment';
```

Use it in:

- `EmailDetail.jsx` for displayed attachment text.
- `downloadAttachment.js` for `link.download`.
- `downloadAttachmentsZip.js` for `zip.file(...)`.
- `renderEmailToPrintHtml.js`; use `escapeHtml(getAttachmentDisplayName(file))` before interpolating into print HTML.

Update `InteractionDetail.jsx` ZIP handler:

```js
const attachments = email?.attachments ?? email?.attachment ?? [];
if (!interaction?.email_id || attachments.length === 0) return;
downloadAttachmentsZip(attachments);
```

- [ ] **Step 4: Verify frontend GREEN**

Run:

```bash
pnpm --filter kace-sass test src/pages/Agent/components/Interactions/emails/attachmentDisplayName.spec.js src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx src/pages/Agent/components/Interactions/utils/downloadAttachment.spec.js src/pages/Agent/components/Interactions/utils/downloadAttachmentsZip.spec.js
```

Expected: PASS.

---

### Task 4: Final Issue 04 verification and status update

**Files:**
- Modify: `.scratch/channel-hub-inbound-email-workspace-integration/issues/04-durable-scanned-email-attachments-with-attachment-filename.md`

- [ ] **Step 1: Run targeted verification**

Run:

```bash
pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js tests/emails/EmailsAttachmentUnitTest.test.js tests/emails/EmailsUnitTest.test.js tests/emails/EmailsIntegration.test.js --coverage=false
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
pnpm --filter kace-sass test src/pages/Agent/components/Interactions/emails/attachmentDisplayName.spec.js src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx src/pages/Agent/components/Interactions/utils/downloadAttachment.spec.js src/pages/Agent/components/Interactions/utils/downloadAttachmentsZip.spec.js
```

Expected: all commands exit 0.

- [ ] **Step 2: Smoke-test filename migration with SQLite**

Use a temporary in-memory SQLite script to prove `up()` adds `emails_attachments.filename` and `down()` removes it. Expected output:

```text
true
false
```

- [ ] **Step 3: Run required reviews before marking complete**

Run spec compliance review subagent, then code-quality review subagent. Fix any Critical/Important findings and re-review until approved.

- [ ] **Step 4: Update local issue status only after reviews approve**

Update `.scratch/channel-hub-inbound-email-workspace-integration/issues/04-durable-scanned-email-attachments-with-attachment-filename.md`:

```markdown
Status: completed
Labels: completed, reviewed
```

Check all acceptance criteria and append implementation/verification/review notes.

---

## Self-Review

**Spec coverage:** The plan covers nullable filename storage, preserving URL/size, trusted attachment URL checks, provider download, KACE S3 upload, scanner gate before DB rows, durable URL persistence, retryable failures with no partial DB records, API filename response, UI display/download/ZIP filename behavior, and tests.

**Scope:** Issue 04 only. It does not converge the legacy interactions webhook (Issue 05).

**Type consistency:** The DB/domain/API field is `filename`; frontend supports `filename` plus legacy `name` alias.
