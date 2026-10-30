Status: completed
Labels: completed, reviewed
Type: Issue

# Durable scanned Email Attachments with Attachment Filename

## Parent

`.scratch/channel-hub-inbound-email-workspace-integration/PRD.md`

## What to build

Extend Inbound Channel Hub Email processing to support Email Attachments. Attachment URLs from Channel Hub should be validated as trusted, downloaded, uploaded to KACE-controlled S3 storage, scanned with the existing file scanner, and persisted as durable Email Attachment records with URL, size, and Attachment Filename. The agent UI should display and download attachments by filename.

This slice replaces temporary provider attachment URLs with safe durable KACE references that agents can use.

## Acceptance criteria

- [x] Email Attachment storage includes a backward-compatible nullable Attachment Filename field.
- [x] Existing Email Attachment URL and size fields remain supported.
- [x] New Channel Hub Email Attachments always persist an Attachment Filename when a filename can be derived.
- [x] Attachment URL hosts are checked against trusted/allowed domains before download.
- [x] Attachment content is downloaded from the provider URL.
- [x] Attachment content is uploaded to KACE-controlled S3 storage.
- [x] Uploaded attachments are scanned before any attachment row is persisted.
- [x] Attachment rows store the durable KACE storage reference, not the temporary Channel Hub presigned URL.
- [x] Scanner rejection maps to a retryable processing failure and does not expose the attachment to agents.
- [x] Attachment download or upload failure maps to a retryable processing failure.
- [x] Retryable attachment failures leave no partial Email, Email Body, Email Attachment, or Interaction records.
- [x] The Email detail API returns attachments with filename, URL, and size.
- [x] The agent UI displays Attachment Filename for each attachment.
- [x] Attachment ZIP/download behavior uses Attachment Filename.
- [x] Tests cover successful durable attachment persistence, scanner rejection, download/upload failure, and UI filename behavior.

## Blocked by

- `.scratch/channel-hub-inbound-email-workspace-integration/issues/01-plain-text-bcc-inbound-channel-hub-email.md`
- `.scratch/channel-hub-inbound-email-workspace-integration/issues/02-idempotent-replay-and-retryable-failure-responses.md`

## Implementation notes

- Added nullable `emails_attachments.filename` with domain, repository, response, and API schema support while preserving legacy `name` aliases.
- Extended canonical Channel Hub inbound processing to validate trusted attachment URLs, download provider attachments, upload each attachment to tenant-aware KACE S3 storage, scan uploaded S3 objects, and persist durable Email Attachment rows only after scan success.
- Centralized attachment filename canonicalization for backend payload/download/URL fallback and frontend display, individual download, and ZIP entry names.
- Added S3 upload cleanup on scanner rejection, scanner throw, later attachment failure, and DB transaction failure to avoid retry-amplified orphan S3 objects.
- Made `S3AttachmentStorage` resolve bucket, region, and credentials from `TenantContext` so upload URLs, delete cleanup, and scanner bucket configuration stay aligned.

## Verification

- PASS: `pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js tests/emails/S3AttachmentStorageUnitTest.test.js --coverage=false` — 2 suites, 49 tests.
- PASS: `pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js tests/emails/EmailsAttachmentUnitTest.test.js tests/emails/EmailsUnitTest.test.js tests/emails/EmailsIntegration.test.js tests/emails/S3AttachmentStorageUnitTest.test.js --coverage=false` — 5 suites, 82 tests.
- PASS: `pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand` — 1 suite, 18 tests.
- PASS: `pnpm --filter kace-sass test src/pages/Agent/components/Interactions/emails/attachmentDisplayName.spec.js src/pages/Agent/components/Interactions/emails/EmailDetail.spec.jsx src/pages/Agent/components/Interactions/utils/downloadAttachment.spec.js src/pages/Agent/components/Interactions/utils/downloadAttachmentsZip.spec.js` — 4 files, 11 tests.
- PASS: SQLite migration smoke — `up()` reported `true` for `filename`, `down()` reported `false`.
- PASS: `git diff --check` for Issue 04 touched paths.

## Review

- Spec compliance review: APPROVED, no findings.
- Code quality review: CHANGES_REQUIRED initially for unsafe attachment filenames, missing S3 cleanup on failures, and upload/scan bucket config mismatch.
- Code quality re-review after fixes: APPROVED, no Critical or Important findings remain.
