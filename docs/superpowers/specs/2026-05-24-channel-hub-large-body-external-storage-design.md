# Channel Hub large body external storage design

Date: 2026-05-24

## Goal

Accept inbound Channel Hub emails whose text or HTML body is larger than the current 1 MiB inline body limit, without pushing full large bodies through the webhook result, database inline fields, list APIs, or initial frontend render.

Large bodies must be stored durably in tenant S3 storage and loaded lazily by the frontend only when the user opens or explicitly loads the full message body.

## Problem

The `/channel-hub` webhook currently rejects a valid Channel Hub payload when the downloaded `content.text` body exceeds `MAX_PLAIN_TEXT_BODY_BYTES = 1024 * 1024`.

Observed production/TST result:

```json
{
    "status": "non_retryable",
    "code": "text_body_too_large",
    "message": "Plain-text body exceeds 1048576 bytes.",
    "accepted": false
}
```

The payload that failed had both body fields pointing at the same signed CloudFront HTML document:

```txt
content.text = .../message_body.html?...signed...
content.html = .../message_body.html?...signed...
```

The PDF attachment was not the cause. Processing failed while downloading/validating the message body before attachment processing.

Current behavior is too strict because a large but valid email thread, signature, or HTML body can exceed 1 MiB. However, simply raising the inline limit is not the right fix because it can move the failure to downstream systems, make detail APIs slow, and force the frontend to render very large HTML immediately.

## Current implementation facts

- `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js`
  - exports `MAX_PLAIN_TEXT_BODY_BYTES = 1024 * 1024`;
  - downloads `payload.content.text` before persisting Email/EmailBody/Interaction;
  - returns `text_body_too_large` if the downloaded text body is larger than that limit;
  - downloads `payload.content.html` separately when present;
  - persists the full body in `emails_body.body` and `emails_body.body_html`.
- `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundTextBodyDownloader.js`
  - enforces the same max byte limit while reading the response body;
  - already has separate text and HTML error code prefixes.
- `packages/kace_cloud_database/migrations/20251216141230_table_emails_body.js`
  - stores `emails_body.body` as inline text;
  - later migrations/tests add/use `emails_body.body_html`.
- `packages/kace_cloud_core/src/emails/application/EmailResponse.js`
  - currently returns the body inline under `data.body.body` and `data.body.body_html`.
- `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.jsx`
  - renders `email.body.body_html` after DOMPurify sanitization when present;
  - otherwise renders `email.body.body` as plain text.

## Decisions

- Keep the existing inline path for small bodies.
- Treat 1 MiB as the maximum **inline API/database body size**, not the maximum valid email body size.
- Introduce a larger configurable external body limit for abuse protection.
  - Recommended default: `CHANNEL_HUB_EXTERNAL_BODY_MAX_BYTES = 10 * 1024 * 1024`.
  - Bodies larger than this external limit are still rejected as non-retryable.
- Store bodies larger than the inline limit in S3 under a tenant bucket using a dedicated email-body storage abstraction.
- Store only a bounded preview and metadata in `emails_body` for external bodies.
- Never include full external bodies in `GET /emails/{id}`, search, Interaction email detail bootstrap data, logs, or webhook responses.
- The frontend loads the full external body lazily through an authorized KACE API route.
- Keep raw S3 object keys out of normal API responses.
- Preserve backward compatibility for existing inline rows:
  - if storage metadata is missing/null, treat `body` and `body_html` as the full inline content.
- Download/deduplicate identical body URLs:
  - if `content.text` and `content.html` are the same URL, do not fetch the same object twice;
  - if the same downloaded bytes are reused for both text and HTML metadata, store once and point both parts at the same durable object where safe.
- If Channel Hub sends HTML at `content.text`, do not reject just because the "text" body is HTML.
  - Keep a text preview generated from the HTML for `emails_body.body`.
  - Preserve the HTML as the preferred full-render body.
- Clean up uploaded body objects if later persistence fails, the same way attachment cleanup is already handled.

## Body size policy

```txt
INLINE_EMAIL_BODY_MAX_BYTES = 1 MiB
EXTERNAL_EMAIL_BODY_MAX_BYTES = 10 MiB by default, configurable per environment
BODY_PREVIEW_MAX_CHARS = 8 KiB text preview by default
```

Behavior:

| Body size | Storage | Webhook result |
| --- | --- | --- |
| `<= INLINE_EMAIL_BODY_MAX_BYTES` | inline in `emails_body.body` / `body_html` | accepted |
| `> INLINE_EMAIL_BODY_MAX_BYTES` and `<= EXTERNAL_EMAIL_BODY_MAX_BYTES` | full body in S3, preview+metadata in DB | accepted |
| `> EXTERNAL_EMAIL_BODY_MAX_BYTES` | not persisted | non-retryable `text_body_too_large` or `html_body_too_large` |

The existing `text_body_too_large` and `html_body_too_large` codes should be kept for bodies that exceed the external maximum. The message must mention the external maximum, not the 1 MiB inline threshold.

## Data model

Add metadata columns to `emails_body` rather than replacing the existing columns.

Existing columns keep their meaning for old rows and small new rows:

- `body`: full plain text for inline rows; bounded text preview for external rows.
- `body_html`: full HTML for inline rows; `null` or bounded/sanitized preview for external rows.

New columns:

```txt
body_text_storage_mode       nullable string: null|'inline'|'external'
body_text_s3_key             nullable string
body_text_size_bytes         nullable integer
body_text_content_type       nullable string
body_text_sha256             nullable string
body_text_preview_truncated  boolean default false

body_html_storage_mode       nullable string: null|'inline'|'external'
body_html_s3_key             nullable string
body_html_size_bytes         nullable integer
body_html_content_type       nullable string
body_html_sha256             nullable string
body_html_preview_truncated  boolean default false
```

Interpretation:

- `null` storage mode means legacy inline row.
- `inline` means the corresponding existing `body`/`body_html` column contains the full content.
- `external` means the existing `body`/`body_html` column is only a preview/placeholder and the full body lives in S3.
- `*_s3_key` is only used server-side.
- API responses should convert `*_s3_key` into an authorized `bodyUrl` route or omit it entirely.

## S3 key policy

Store full external bodies using deterministic, non-user-controlled prefixes:

```txt
email-bodies/{emailId}/text-{bodyPartId}.txt
email-bodies/{emailId}/html-{bodyPartId}.html
```

Requirements:

- Use sanitized/generated object names only.
- Preserve content type metadata.
- Store SHA-256 for observability/deduplication.
- Do not use the original Channel Hub signed URL path as an S3 key.
- Do not include sender, subject, recipient, or tenant names in the S3 key.

## Webhook processing flow

1. Validate the Channel Hub payload as today.
2. Resolve `connectionId + tag` routing as today.
3. Check duplicate replay before downloading changed body/attachment URLs.
4. Validate `content.text`, `content.html`, and final redirect URLs against Allowed Connections as today.
5. Download body parts with an external-size-aware downloader.
6. If `content.text` and `content.html` are the same URL, fetch once and reuse the result.
7. For each body part:
   - if the body is `<= INLINE_EMAIL_BODY_MAX_BYTES`, keep the full content inline;
   - if the body is larger, upload the full content to S3 and store preview+metadata.
8. If HTML is available, run the existing inline image embedder before deciding inline vs external storage for the stored HTML body.
9. Persist Email, EmailBody metadata, Attachments, and Interaction atomically.
10. If persistence fails after uploading body or attachment objects, delete uploaded body/attachment S3 objects before returning retryable failure.

## API contract

`GET /emails/{id}` keeps returning message metadata and a `body` object, but full large bodies are not returned inline.

### Small inline body response

```json
{
    "data": {
        "id": "email-id",
        "subject": "hola luigi",
        "body": {
            "id": "body-id",
            "email_id": "email-id",
            "body": "Hola Luigi...",
            "body_html": "<p>Hola Luigi...</p>",
            "text": {
                "mode": "inline",
                "size_bytes": 13,
                "preview_truncated": false,
                "bodyUrl": null
            },
            "html": {
                "mode": "inline",
                "size_bytes": 20,
                "preview_truncated": false,
                "bodyUrl": null
            }
        }
    }
}
```

### Large external body response

```json
{
    "data": {
        "id": "email-id",
        "subject": "hola luigi",
        "body": {
            "id": "body-id",
            "email_id": "email-id",
            "body": "Hola Luigi... [preview]",
            "body_html": null,
            "text": {
                "mode": "external",
                "size_bytes": 1842300,
                "content_type": "text/html; charset=utf-8",
                "preview_truncated": true,
                "bodyUrl": "/emails/email-id/body?part=text"
            },
            "html": {
                "mode": "external",
                "size_bytes": 1842300,
                "content_type": "text/html; charset=utf-8",
                "preview_truncated": true,
                "bodyUrl": "/emails/email-id/body?part=html"
            }
        }
    }
}
```

The `bodyUrl` must be a KACE API route, not a raw S3 URL. The route validates the logged-in user, tenant context, and normal `EmailsRead` permission before returning the body.

## Body read endpoint

Add an authorized body-read route for the Emails API:

```http
GET /emails/{id}/body?part=text
GET /emails/{id}/body?part=html
```

Response options:

- Preferred: stream/return the raw body with the correct `Content-Type`.
- Acceptable first implementation: return JSON with `{ data: { content, content_type } }` if frontend code expects JSON and API Gateway payload limits are respected.

Authorization requirements:

- Same authentication as `GET /emails/{id}`.
- Same `EmailsRead` permission.
- Tenant isolation must be enforced by tenant DB context.
- The route must only return bodies for non-deleted emails visible in the current tenant.

API Gateway/controller requirements:

- Add `/{id}/body` GET support in `packages/kace_cloud_aws_infra/src/KApiStack.ts` or the Emails stack.
- Add a matching branch in `packages/kace_cloud_api_common/src/controllers/BaseController.js` or a safe Emails-specific routing path.
- Implement `Controller.actionReadBody()` in `apps/apiv1/kace_cloud_api_emails/src/controller.mjs`.

## Frontend behavior

The user experience should remain normal for small emails and become lazy-loaded for large emails.

### Small body

No visible change:

```txt
Subject: hola luigi
From: brayan16j@gmail.com
To: brayan.granada@konecta.com

[HTML or plain body renders normally]
```

### Large body

Initial detail render:

```txt
Subject: hola luigi
From: brayan16j@gmail.com
To: brayan.granada@konecta.com

[Preview]
Hola Luigi...

This message body is large.
[Load full body]
```

After the user loads the full body:

```txt
[Full body renders normally]
```

Frontend rules:

- Continue preferring HTML over plain text when both are available.
- If `body.html.mode === "external"`, show the text preview plus a `Load full body` button.
- Fetch `body.html.bodyUrl` when the user opens/clicks to load the full HTML body.
- If HTML is unavailable, use `body.text.bodyUrl`.
- Keep DOMPurify sanitization for HTML before rendering.
- Prefer a sandboxed iframe for full external HTML if feasible.
- Do not call the external body route in email lists.
- Printing should load the full body first or clearly print only the preview.

## Error behavior

- Body URL missing still returns `missing_text_body_url`.
- Untrusted original or final URLs still return `untrusted_text_body_url` / `untrusted_html_body_url`.
- Download timeouts/fetch failures remain retryable.
- Bodies over the external maximum return non-retryable:
  - `text_body_too_large`
  - `html_body_too_large`
- S3 upload failures are retryable and must leave no DB rows.
- DB failures after body upload are retryable and must delete uploaded body objects.
- Duplicate webhook replay must return `already_processed` without redownloading the body.

## Code changes expected

- Add database migration in `packages/kace_cloud_database/migrations/` for the `emails_body` metadata columns.
- Update migration tests in `packages/kace_cloud_database/tests/migrations/`.
- Add `EmailBodyStoragePort` and `S3EmailBodyStorage` near the existing email attachment storage abstractions:
  - likely under `packages/kace_cloud_core/src/emails/domain/ports/`;
  - likely under `packages/kace_cloud_core/src/emails/infrastructure/persistence/`.
- Update `ChannelHubInboundTextBodyDownloader` or introduce a body-part downloader that can read up to `CHANNEL_HUB_EXTERNAL_BODY_MAX_BYTES`.
- Update `ChannelHubInboundEmailProcessor`:
  - externalize large text/HTML bodies instead of rejecting at 1 MiB;
  - deduplicate same text/html body URL downloads;
  - generate text previews for external bodies;
  - cleanup uploaded body keys on later failure.
- Update `ChannelHubInboundEmailProcessorFactory` to inject the body storage dependency.
- Update `EmailBody` domain object, repository, and response classes to carry storage metadata.
- Add an `EmailBodyReader`/`EmailBodyContentFinder` application service that resolves inline vs S3 content.
- Update Emails API route/controller/CDK support for `GET /emails/{id}/body?part=...`.
- Update Swagger docs under `apps/kace_cloud_swagger/src/emails/emails.yaml`.
- Update frontend:
  - `apps/kace-saas/src/pages/Agent/components/Interactions/emails/emailBodyContent.js`
  - `apps/kace-saas/src/pages/Agent/components/Interactions/emails/EmailDetail.jsx`
  - add a small hook/service for lazy body fetching.

## Tests expected

Backend/core:

- Existing small text body still persists inline and returns accepted.
- Existing small HTML body still persists inline and returns accepted.
- Text body of `INLINE_EMAIL_BODY_MAX_BYTES + 1` is accepted and stored externally.
- HTML body of `INLINE_EMAIL_BODY_MAX_BYTES + 1` is accepted and stored externally.
- Body over `CHANNEL_HUB_EXTERNAL_BODY_MAX_BYTES` returns `text_body_too_large` or `html_body_too_large`.
- When `content.text === content.html`, the body is downloaded once.
- When Channel Hub sends HTML at `content.text`, a plain-text preview is stored and full HTML remains available.
- External body S3 object is deleted if DB persistence fails.
- External body S3 object is not deleted after a successful transaction.
- Duplicate replay returns `already_processed` without redownloading or reuploading body content.
- `EmailResponse` includes metadata and preview but not the full external body.
- Body reader returns inline content for legacy/small rows.
- Body reader returns S3 content for external rows.
- Body reader rejects unknown `part` values.

API:

- `GET /emails/{id}` returns body metadata and preview for external bodies.
- `GET /emails/{id}/body?part=html` requires authentication and `EmailsRead`.
- `GET /emails/{id}/body?part=html` returns 404/403 for unauthorized or wrong-tenant access.
- `GET /emails/{id}/body?part=html` returns the correct content type.
- API responses do not expose raw S3 keys.

Frontend:

- Inline body renders as it does today.
- External body detail shows preview and load control.
- Clicking `Load full body` fetches `bodyUrl` and renders sanitized HTML.
- If external HTML fails to load, the preview remains visible and an error state is shown.
- Email list/search does not fetch external body URLs.
- Print flow handles external bodies intentionally.

## Observability

Add structured logs around body storage decisions:

```txt
ChannelHubWebhook::bodyStorageDecision
messageId
messageIdOperator
connectionId
tag
text.mode
text.sizeBytes
html.mode
html.sizeBytes
deduplicatedBodyDownload
```

Do not log body content, signed Channel Hub URLs, S3 keys, or signed S3 URLs.

## Migration/backward compatibility

- Existing `emails_body` rows remain valid.
- New metadata columns must be nullable or have safe defaults.
- Old rows with null storage metadata are treated as inline.
- Frontend must support both the old body shape and the new metadata shape during rollout.
- Deploy order:
  1. database migration;
  2. backend code that can read old and new rows;
  3. frontend lazy-loading support;
  4. webhook processor external storage behavior.

## Out of scope

- Changing Channel Hub registration or tag/rule routing.
- Changing attachment storage or scanner behavior.
- Removing HTML sanitization.
- Loading full external bodies in list/search endpoints.
- Full MIME/raw-message archival beyond the text/html body parts.
- Retention/lifecycle policy changes for old email bodies.
- Solving emails larger than the configured external maximum.
