Status: completed
Labels: completed, reviewed
Type: Issue

# HTML Email Body storage and safe rendering

## Parent

`.scratch/channel-hub-inbound-email-workspace-integration/PRD.md`

## What to build

Extend Inbound Channel Hub Email processing and Email detail rendering to support HTML Email Body content. Channel Hub HTML body URLs should be downloaded from trusted domains, stored as original HTML in a nullable HTML Email Body field, returned in an explicit Email Body response object, and rendered safely in the agent UI with plain-text fallback.

This slice makes formatted customer email content durable and readable without sanitizing away original content at ingest time.

## Acceptance criteria

- [x] Email Body storage includes a backward-compatible nullable HTML Email Body field.
- [x] Existing plain Email Body content remains supported and backward-compatible.
- [x] Channel Hub `content.html` URLs are checked against trusted/allowed domains before download.
- [x] Downloaded HTML content is stored as original HTML, not as the presigned URL.
- [x] Downloaded plain text continues to be stored separately from HTML.
- [x] The Email detail API returns an explicit body object containing plain and HTML body content.
- [x] The agent UI prefers HTML Email Body for display when present.
- [x] The agent UI falls back to plain Email Body when HTML is absent.
- [x] HTML rendering is sanitized at render time.
- [x] Existing Email records without HTML body still render correctly.
- [x] Tests cover HTML body download/storage, plain-text fallback, response shape, and safe rendering behavior.

## Blocked by

- `.scratch/channel-hub-inbound-email-workspace-integration/issues/01-plain-text-bcc-inbound-channel-hub-email.md`

## Implementation notes

- Added nullable `emails_body.body_html` via additive migration `20260514122000_channel_hub_inbound_email_issue_03_html_body.js`.
- Extended Email Body domain, persistence, creator/updater, and Email detail responses to include original HTML body content.
- Extended Channel Hub inbound processing to validate/download optional `content.html`, store downloaded HTML separately from plain text, and keep duplicate replay idempotency before body URL validation/downloads.
- Made the Channel Hub body downloader body-kind aware so HTML download failures return HTML-specific codes such as `untrusted_html_body_url` and `html_body_too_large`.
- Added agent UI body normalization, DOMPurify render/print sanitization, and plain-text fallback for legacy string bodies and body objects without HTML.

## Verification

- PASS: `pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js tests/emails/EmailsBodyUnitTest.test.js tests/emails/EmailsUnitTest.test.js tests/emails/EmailsIntegration.test.js --coverage=false` — 4 suites, 67 tests.
- PASS: `pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand` — 1 suite, 16 tests.
- PASS: `pnpm --filter kace-sass test src/pages/Agent/components/Interactions/emails/emailBodyContent.spec.js src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx` — 2 files, 5 tests.
- PASS: SQLite migration smoke — `up()` reported `true` for `body_html`, `down()` reported `false`.

## Review

- Spec compliance review: APPROVED, no findings.
- Code quality review: CHANGES_REQUIRED initially for duplicate replay ordering and HTML-specific downloader error codes.
- Code quality re-review after fixes: APPROVED, no blocking findings remain.
