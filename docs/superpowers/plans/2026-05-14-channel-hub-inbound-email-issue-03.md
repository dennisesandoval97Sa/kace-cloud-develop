# Channel Hub Inbound Email Issue 03 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store Channel Hub HTML email bodies durably, return an explicit plain/HTML body object from the Email detail API, and render the preferred HTML body safely in the agent UI with plain-text fallback.

**Architecture:** Keep `/webhooks/channel-hub` as a thin adapter and put ingest behavior in `@kace/core`. Store original HTML in `emails_body.body_html` without ingest-time sanitization; sanitize only in the React render/print layer. Preserve backward compatibility for existing rows and existing UI callers by supporting both legacy string bodies and the new body object.

**Tech Stack:** Node.js ESM, Knex migrations/repositories, Jest tests for core/API webhook, Vitest + Testing Library for React UI, DOMPurify for render-time sanitization.

**Constraints:** Work in the current workspace/branch; do not create a git worktree; do not commit. Use TDD: add failing tests first, run them to verify RED, implement minimal code, rerun to GREEN.

---

## File Structure

- Modify `packages/kace_cloud_database/migrations/20251216141230_table_emails_body.js` only if tests need the base table definition documented; prefer a new additive migration instead.
- Create `packages/kace_cloud_database/migrations/20260514122000_channel_hub_inbound_email_issue_03_html_body.js` — add/drop nullable `emails_body.body_html`.
- Modify `packages/kace_cloud_core/src/emails/domain/EmailBody.js` — add nullable `body_html` value object, getter/setter, and `create()` input.
- Modify `packages/kace_cloud_core/src/emails/infrastructure/persistence/KnexEmailsBodyRepository.js` — persist/read `body_html` while staying compatible with DB rows missing the column in older tests only after the test schemas are updated.
- Modify `packages/kace_cloud_core/src/emails/application/EmailResponseBody.js` — include `body_html`.
- Modify `packages/kace_cloud_core/src/emails/application/EmailResponse.js` — include `body_html` inside the explicit `body` object returned by Email detail.
- Modify `packages/kace_cloud_core/src/emails/application/create/EmailCreator.js` — pass `dto.body.body_html ?? null`.
- Modify `packages/kace_cloud_core/src/emails/application/update/EmailUpdater.js` — preserve/update `body_html`.
- Modify `apps/apiv1/kace_cloud_api_emails/src/schemas.mjs` — allow optional nullable `body_html`.
- Modify `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js` — check, download, and persist `payload.content.html` when present.
- Modify `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs` — accept optional `content.html` URI.
- Modify `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js` — add `body_html` test table column and HTML ingest tests.
- Modify `packages/kace_cloud_core/tests/emails/EmailsBodyUnitTest.test.js` — add domain/response tests for nullable and present `body_html`.
- Modify `packages/kace_cloud_core/tests/emails/EmailsUnitTest.test.js` — add response shape assertions for `body.body_html`.
- Modify `packages/kace_cloud_core/tests/emails/EmailsIntegration.test.js` — prove create/update/find persist and return `body_html`.
- Modify `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs` — prove optional `content.html` is schema-valid.
- Create `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailBodyContent.js` — normalize legacy string body vs new object body and escape plain text for print fallback.
- Modify `apps/kace-saas/src/pages/Agent/components/Interactions/hooks/useInteractionEmail.js` — return Email detail objects from the API as well as legacy arrays.
- Modify `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.jsx` — prefer sanitized HTML body, fallback to plain body as React text, support `attachments` and legacy `attachment`.
- Modify `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailPrint/renderEmailToPrintHtml.js` — prefer sanitized HTML body, fallback to escaped plain body.
- Create `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx` — cover safe HTML rendering and plain-text fallback.
- Create `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailBodyContent.spec.js` — cover body normalization and escaping.

---

### Task 1: Backend HTML Email Body storage and API shape

**Files:**
- Create: `packages/kace_cloud_database/migrations/20260514122000_channel_hub_inbound_email_issue_03_html_body.js`
- Modify: `packages/kace_cloud_core/src/emails/domain/EmailBody.js`
- Modify: `packages/kace_cloud_core/src/emails/infrastructure/persistence/KnexEmailsBodyRepository.js`
- Modify: `packages/kace_cloud_core/src/emails/application/EmailResponseBody.js`
- Modify: `packages/kace_cloud_core/src/emails/application/EmailResponse.js`
- Modify: `packages/kace_cloud_core/src/emails/application/create/EmailCreator.js`
- Modify: `packages/kace_cloud_core/src/emails/application/update/EmailUpdater.js`
- Modify: `apps/apiv1/kace_cloud_api_emails/src/schemas.mjs`
- Test: `packages/kace_cloud_core/tests/emails/EmailsBodyUnitTest.test.js`
- Test: `packages/kace_cloud_core/tests/emails/EmailsUnitTest.test.js`
- Test: `packages/kace_cloud_core/tests/emails/EmailsIntegration.test.js`

- [ ] **Step 1: Write failing EmailBody unit tests**

Add tests in `packages/kace_cloud_core/tests/emails/EmailsBodyUnitTest.test.js`:

```js
it('should create EmailBody with nullable HTML body when absent', () => {
    const body = EmailBody.create(EmailBodyMother.dto({ body_html: null }));

    expect(body.body_html.value).toBeNull();
});

it('should create EmailBody with original HTML body when present', () => {
    const html = '<main><h1>Hello</h1><script>alert("stored-original")</script></main>';
    const body = EmailBody.create(EmailBodyMother.dto({ body_html: html }));

    expect(body.body_html).toBeInstanceOf(ValueObjectEmailBody);
    expect(body.body_html.value).toBe(html);
});

it('should update body_html and mark changedAttributes', () => {
    const body = EmailBody.create(EmailBodyMother.dto({ body_html: null }));
    const html = '<p>Updated HTML</p>';

    body.body_html = html;

    expect(body.body_html.value).toBe(html);
    expect(body.changedAttributes).toEqual({ body_html: html });
});
```

Update the `EmailBodyResponse` expectation to include `body_html: body.body_html.value`.

- [ ] **Step 2: Run unit tests to verify RED**

Run:

```bash
pnpm --filter @kace/core tests tests/emails/EmailsBodyUnitTest.test.js --coverage=false
```

Expected: FAIL because `EmailBody.body_html` does not exist and response JSON omits it.

- [ ] **Step 3: Implement EmailBody nullable body_html**

In `packages/kace_cloud_core/src/emails/domain/EmailBody.js`, add:

```js
/** @type {ValueObjectString} */
#body_html;
```

Initialize with a nullable email-body value object:

```js
this.#body_html = new ValueObjectEmailBody('body_html', body_html, true);
```

Add getter/setter:

```js
get body_html() {
    return this.#body_html;
}
set body_html(value) {
    this.#body_html = new ValueObjectEmailBody('body_html', value, true);
    this.changedAttributes.body_html = value;
}
```

Include `body_html = null` in the constructor params and pass it through `static create()`.

- [ ] **Step 4: Implement response shape**

In `EmailBodyResponse.toJson()` and `EmailResponse.toJson()`, include:

```js
body_html: this.#emailBody.body_html.value,
```

and:

```js
body_html: this.#body.body_html.value,
```

inside the returned `body` object.

- [ ] **Step 5: Rerun unit tests to verify GREEN for domain/response**

Run:

```bash
pnpm --filter @kace/core tests tests/emails/EmailsBodyUnitTest.test.js tests/emails/EmailsUnitTest.test.js --coverage=false
```

Expected: PASS after updating `EmailsUnitTest` expected JSON to include `body_html`.

- [ ] **Step 6: Write failing repository/integration tests for body_html**

In `packages/kace_cloud_core/tests/emails/EmailsIntegration.test.js`, add `body_html` to the email body DTO in create/update tests and assert:

```js
expect(bodies[0].body).toBe(bodyDto.body);
expect(bodies[0].body_html).toBe(bodyDto.body_html);
```

For update, assert:

```js
expect(updatedBody.body).toBe('Updated body content');
expect(updatedBody.body_html).toBe('<p>Updated HTML content</p>');
```

In the finder test near the top of the file, assert:

```js
expect(json.data.body).toMatchObject({
    body: bodyDto.body,
    body_html: bodyDto.body_html,
});
```

If the test schema in the file manually creates `emails_body`, add:

```js
table.text('body_html').nullable();
```

- [ ] **Step 7: Run integration tests to verify RED**

Run:

```bash
pnpm --filter @kace/core tests tests/emails/EmailsIntegration.test.js --coverage=false
```

Expected: FAIL because repository save/update omits `body_html`.

- [ ] **Step 8: Implement repository/create/update/schema persistence**

In `KnexEmailsBodyRepository.save()` and `update()`, include:

```js
body_html: emailBody.body_html.value,
```

In `EmailCreator`, pass:

```js
body_html: dto.body.body_html ?? null,
```

In `EmailUpdater`, when creating a new body pass `body_html: dto.body.body_html ?? null`; when updating an existing body pass:

```js
body_html: dto.body.body_html ?? currentBody.body_html.value ?? null,
```

In `apps/apiv1/kace_cloud_api_emails/src/schemas.mjs`, add:

```js
body_html: Joi.string().allow(null, '').optional(),
```

- [ ] **Step 9: Add additive migration**

Create `packages/kace_cloud_database/migrations/20260514122000_channel_hub_inbound_email_issue_03_html_body.js`:

```js
/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    const hasColumn = await knex.schema.hasColumn('emails_body', 'body_html');
    if (!hasColumn) {
        await knex.schema.alterTable('emails_body', (table) => {
            table.text('body_html').nullable();
        });
    }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    const hasColumn = await knex.schema.hasColumn('emails_body', 'body_html');
    if (hasColumn) {
        await knex.schema.alterTable('emails_body', (table) => {
            table.dropColumn('body_html');
        });
    }
}
```

- [ ] **Step 10: Verify backend API/storage tests**

Run:

```bash
pnpm --filter @kace/core tests tests/emails/EmailsBodyUnitTest.test.js tests/emails/EmailsUnitTest.test.js tests/emails/EmailsIntegration.test.js --coverage=false
```

Expected: PASS.

---

### Task 2: Channel Hub HTML body ingest

**Files:**
- Modify: `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js`
- Modify: `packages/kace_cloud_core/tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js`
- Modify: `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs`
- Modify: `apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs`

- [ ] **Step 1: Write failing processor test for HTML download/storage**

In `ChannelHubInboundEmailProcessor.test.js`, add a constant:

```js
const allowedHtmlBodyUrl = 'https://channel-hub-cdn.example.com/messages/msg-1.html';
const downloadedHtml = '<article><h1>Hello</h1><script>alert("stored-original")</script></article>';
```

Add `body_html` to the manual `emails_body` test table:

```js
table.text('body_html');
```

Add test:

```js
it('downloads trusted Channel Hub HTML body and stores original HTML separately from plain text', async () => {
    const { workspace } = await createValidWorkspaceAndMailAccount();
    const payload = validPayload({
        workspaceId: workspace.id.value,
        payload: {
            content: {
                text: allowedBodyUrl,
                html: allowedHtmlBodyUrl,
            },
        },
    });
    bodyDownloader.download.mockImplementation(async (url) => ({
        buffer: Buffer.from(url === allowedHtmlBodyUrl ? downloadedHtml : downloadedPlainText, 'utf8'),
        finalUrl: url,
    }));

    const result = await createProcessor().execute(payload);

    expect(result.accepted).toBe(true);
    expect(allowedConnectionRepository.isAllowedConnection).toHaveBeenCalledWith(allowedHtmlBodyUrl);
    expect(bodyDownloader.download).toHaveBeenCalledWith(allowedBodyUrl);
    expect(bodyDownloader.download).toHaveBeenCalledWith(allowedHtmlBodyUrl);

    const [emailBody] = await emailRepository.connection('emails_body').select('*');
    expect(emailBody.body).toBe(downloadedPlainText);
    expect(emailBody.body_html).toBe(downloadedHtml);
    expect(emailBody.body_html).not.toBe(allowedHtmlBodyUrl);
});
```

- [ ] **Step 2: Write failing processor test for untrusted HTML URL**

Add:

```js
it('returns non-retryable and creates no records when the HTML body URL is untrusted', async () => {
    const { workspace } = await createValidWorkspaceAndMailAccount();
    const payload = validPayload({
        workspaceId: workspace.id.value,
        payload: {
            content: {
                text: allowedBodyUrl,
                html: allowedHtmlBodyUrl,
            },
        },
    });
    allowedConnectionRepository.isAllowedConnection.mockImplementation(async (url) => url !== allowedHtmlBodyUrl);

    const result = await createProcessor().execute(payload);

    expect(result.nonRetryable).toBe(true);
    expect(result.code).toBe('untrusted_html_body_url');
    expect(bodyDownloader.download).not.toHaveBeenCalled();
    await expectNoRecordsCreated();
});
```

- [ ] **Step 3: Run processor tests to verify RED**

Run:

```bash
pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false
```

Expected: FAIL because the processor ignores `content.html`.

- [ ] **Step 4: Implement HTML URL validation/download/storage**

In `ChannelHubInboundEmailProcessor.execute()`:

```js
const htmlBodyUrl = payload?.content?.html;
```

After validating the text URL, if `htmlBodyUrl` exists:

```js
if (!(await this.#isAllowedUrl(htmlBodyUrl))) {
    return ChannelHubInboundEmailProcessingResult.nonRetryable(
        'untrusted_html_body_url',
        'HTML body URL host is not trusted.'
    );
}
```

Before persistence, download HTML only when present:

```js
let htmlBody = null;
if (htmlBodyUrl) {
    const htmlBodyDownload = await this.#bodyDownloader.download(htmlBodyUrl);
    if (htmlBodyDownload.finalUrl && !(await this.#isAllowedUrl(htmlBodyDownload.finalUrl))) {
        return ChannelHubInboundEmailProcessingResult.nonRetryable(
            'untrusted_html_body_url',
            'HTML body URL host is not trusted.'
        );
    }
    htmlBody = htmlBodyDownload.buffer.toString('utf8');
}
```

Pass `htmlBody` into `#persistAtomically()` and into `EmailBody.create({ body_html: htmlBody })`.

- [ ] **Step 5: Add webhook schema acceptance for optional content.html**

In `apps/apiv1/kace_cloud_api_webhooks/src/schemas.mjs`, change `content` to:

```js
content: Joi.object({
    text: Joi.string().uri().required(),
    html: Joi.string().uri().optional(),
})
```

In `channelHubWebhook.test.mjs`, add:

```js
it('accepts an optional Channel Hub HTML body URL', () => {
    const { error, value } = channelHubSchema.validate(
        {
            ...minimalPayload,
            content: {
                ...minimalPayload.content,
                html: 'https://channel-hub-cdn.example.com/messages/msg-1.html',
            },
        },
        { abortEarly: false }
    );

    expect(error).toBeUndefined();
    expect(value.content.html).toBe('https://channel-hub-cdn.example.com/messages/msg-1.html');
});
```

- [ ] **Step 6: Verify ingest/webhook tests**

Run:

```bash
pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
```

Expected: PASS.

---

### Task 3: Agent UI safe rendering and body compatibility

**Files:**
- Create: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailBodyContent.js`
- Create: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailBodyContent.spec.js`
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/hooks/useInteractionEmail.js`
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.jsx`
- Modify: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailPrint/renderEmailToPrintHtml.js`
- Create: `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx`

- [ ] **Step 1: Write failing body normalization tests**

Create `emailBodyContent.spec.js`:

```js
import { describe, expect, it } from 'vitest';
import { escapeHtml, getEmailBodyContent } from './emailBodyContent';

describe('emailBodyContent', () => {
    it('normalizes the new Email detail body object', () => {
        expect(
            getEmailBodyContent({
                body: {
                    body: 'Plain text',
                    body_html: '<p>HTML text</p>',
                },
            })
        ).toEqual({
            plain: 'Plain text',
            html: '<p>HTML text</p>',
        });
    });

    it('normalizes a legacy string body as plain text', () => {
        expect(getEmailBodyContent({ body: 'Legacy plain text' })).toEqual({
            plain: 'Legacy plain text',
            html: '',
        });
    });

    it('escapes plain text for print fallback', () => {
        expect(escapeHtml('<script>alert("x")</script> & text')).toBe(
            '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; text'
        );
    });
});
```

- [ ] **Step 2: Run normalization tests to verify RED**

Run:

```bash
pnpm --filter kace-sass test -- src/pages/Agent/components/Interactions/emails/emailBodyContent.spec.js --runInBand
```

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement body normalization helper**

Create `emailBodyContent.js`:

```js
export const getEmailBodyContent = (email) => {
    const body = email?.body;

    if (body && typeof body === 'object') {
        return {
            plain: body.body ?? '',
            html: body.body_html ?? '',
        };
    }

    return {
        plain: body ?? '',
        html: '',
    };
};

export const escapeHtml = (value = '') =>
    String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

export const plainTextToHtml = (value = '') => escapeHtml(value).replace(/\r?\n/g, '<br />');
```

- [ ] **Step 4: Write failing EmailDetail render tests**

Create `EmailDetail.spec.jsx` with mocked i18n/print helper:

```jsx
import { render, screen } from '@testing-library/react';
import DOMPurify from 'dompurify';
import { describe, expect, it, vi } from 'vitest';
import EmailDetail from './EmailDetail';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock('./emailPrint/HandleEmailPrint', () => ({
    HandleEmailPrint: () => vi.fn(),
}));

const baseEmail = {
    id: 'email-id',
    subject: 'Support request',
    sender: 'customer@example.com',
    to: [{ email: 'support@example.com', name: 'Support' }],
    priority: 'normal',
    attachment: [],
    received_at: '2026-05-14T10:00:00.000Z',
};

describe('EmailDetail', () => {
    it('prefers sanitized HTML body when body_html is present', () => {
        const sanitizeSpy = vi.spyOn(DOMPurify, 'sanitize');

        render(
            <EmailDetail
                email={{
                    ...baseEmail,
                    body: {
                        body: 'Plain fallback',
                        body_html: '<p><strong>Hello</strong></p><script>alert("x")</script>',
                    },
                }}
                onBack={vi.fn()}
            />
        );

        expect(sanitizeSpy).toHaveBeenCalledWith(
            '<p><strong>Hello</strong></p><script>alert("x")</script>'
        );
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(document.querySelector('.email-body script')).toBeNull();
    });

    it('falls back to plain text as text content when HTML is absent', () => {
        render(
            <EmailDetail
                email={{
                    ...baseEmail,
                    body: {
                        body: '<script>alert("plain")</script> Plain body',
                        body_html: null,
                    },
                }}
                onBack={vi.fn()}
            />
        );

        expect(screen.getByText('<script>alert("plain")</script> Plain body')).toBeInTheDocument();
        expect(document.querySelector('.email-body script')).toBeNull();
    });
});
```

- [ ] **Step 5: Run EmailDetail tests to verify RED**

Run:

```bash
pnpm --filter kace-sass test -- src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx --runInBand
```

Expected: FAIL because `EmailDetail` currently injects unsanitized `email.body` directly and does not understand body objects.

- [ ] **Step 6: Implement safe rendering and compatibility in EmailDetail**

In `EmailDetail.jsx`, import:

```js
import DOMPurify from 'dompurify';
import { getEmailBodyContent } from './emailBodyContent';
```

Replace the body destructuring/rendering with:

```js
const { subject, sender, to = [], priority, attachment = [], attachments = [], body, received_at } = email;
const renderedAttachments = attachments.length ? attachments : attachment;
const emailBodyContent = getEmailBodyContent({ body });
const sanitizedHtmlBody = emailBodyContent.html ? DOMPurify.sanitize(emailBodyContent.html) : null;
```

Render content:

```jsx
{sanitizedHtmlBody ? (
    <div
        className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed email-body"
        dangerouslySetInnerHTML={{ __html: sanitizedHtmlBody }}
    />
) : (
    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed email-body whitespace-pre-wrap">
        {emailBodyContent.plain || t('genericTexts.noContent')}
    </div>
)}
```

Render attachments from `renderedAttachments.map(...)`.

Update `EmailDetail.propTypes.body` to accept both:

```js
body: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
        body: PropTypes.string,
        body_html: PropTypes.string,
    }),
]),
attachments: PropTypes.arrayOf(...),
```

- [ ] **Step 7: Fix Email detail API hook compatibility**

In `useInteractionEmail.js`, return object details as well as legacy arrays:

```js
const emailDetail = Array.isArray(data) ? data[0] : data;

return {
    email: emailDetail ?? null,
    isLoading,
};
```

- [ ] **Step 8: Update print rendering**

In `renderEmailToPrintHtml.js`, import:

```js
import { getEmailBodyContent, plainTextToHtml } from '../emailBodyContent';
```

Replace `safeHtml` with:

```js
const bodyContent = getEmailBodyContent(email);
const safeHtml = bodyContent.html
    ? DOMPurify.sanitize(bodyContent.html)
    : bodyContent.plain
      ? plainTextToHtml(bodyContent.plain)
      : `<p>${t('genericTexts.noContent')}</p>`;
```

Use `(email.attachments ?? email.attachment)?.length` for attachment count/list to support both response shapes.

- [ ] **Step 9: Verify frontend tests**

Run:

```bash
pnpm --filter kace-sass test -- src/pages/Agent/components/Interactions/emails/emailBodyContent.spec.js src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx --runInBand
```

Expected: PASS.

---

### Task 4: End-to-end targeted verification and issue status update

**Files:**
- Modify: `.scratch/channel-hub-inbound-email-workspace-integration/issues/03-html-email-body-storage-and-safe-rendering.md`

- [ ] **Step 1: Run full targeted verification suite**

Run:

```bash
pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js tests/emails/EmailsBodyUnitTest.test.js tests/emails/EmailsUnitTest.test.js tests/emails/EmailsIntegration.test.js --coverage=false
pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand
pnpm --filter kace-sass test -- src/pages/Agent/components/Interactions/emails/emailBodyContent.spec.js src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx --runInBand
```

Expected: all commands exit 0.

- [ ] **Step 2: Smoke-test the migration with SQLite**

Run a temporary SQLite smoke script equivalent to:

```js
import knexLib from 'knex';
import * as migration from './packages/kace_cloud_database/migrations/20260514122000_channel_hub_inbound_email_issue_03_html_body.js';

const knex = knexLib({ client: 'sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
await knex.schema.createTable('emails_body', (table) => {
    table.string('id', 36).primary();
    table.string('email_id', 36);
    table.text('body');
});
await migration.up(knex);
console.log(await knex.schema.hasColumn('emails_body', 'body_html'));
await migration.down(knex);
console.log(await knex.schema.hasColumn('emails_body', 'body_html'));
await knex.destroy();
```

Expected output:

```text
true
false
```

- [ ] **Step 3: Update local issue status after verification and reviews**

Only after implementation tests pass and both review subagents approve, update `.scratch/channel-hub-inbound-email-workspace-integration/issues/03-html-email-body-storage-and-safe-rendering.md`:

```markdown
Status: completed
Labels: completed, reviewed
```

Append an implementation note with the verification commands and review result.

---

## Self-Review

**Spec coverage:** The plan covers nullable `emails_body.body_html`, backward-compatible plain body storage, trusted URL checks for `content.html`, original HTML persistence, explicit Email detail `body` object, agent UI HTML preference, plain fallback, render-time sanitization, existing-record compatibility, and tests.

**Placeholder scan:** No TBD/TODO/fill-in placeholders remain. Each task names exact files and includes concrete test/code snippets.

**Type consistency:** Backend field name is consistently `body_html`; UI helper exposes `{ plain, html }`; API response body object remains `{ body, body_html }`.
