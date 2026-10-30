Status: completed
Labels: completed, reviewed
Type: Issue

# Idempotent replay and retryable failure responses

## Parent

`.scratch/channel-hub-inbound-email-workspace-integration/PRD.md`

## What to build

Make Inbound Channel Hub Email processing idempotent by External Message ID and make webhook responses reflect retryability. Duplicate deliveries should be treated as successful replays with no duplicate Email or Interaction records. Non-retryable validation/configuration failures should return 4xx. Transient processing failures should return 5xx and leave no partial database records.

This slice turns the plain-text tracer bullet into an operationally safe webhook path that Channel Hub can retry without duplicating work.

## Acceptance criteria

- [ ] External Message ID storage supports uniqueness for inbound Channel Hub Emails.
- [ ] A repeated webhook delivery with the same External Message ID returns success.
- [ ] A repeated webhook delivery does not create a second Email.
- [ ] A repeated webhook delivery does not create a second Interaction.
- [ ] The duplicate replay response clearly indicates the message was already processed when that information is available.
- [ ] Invalid payload and missing Workspace Reference map to non-retryable 4xx responses.
- [ ] Invalid/inactive Workspace, missing or ambiguous Mail Account, Workspace/Mail Account mismatch, and untrusted URL map to non-retryable 4xx responses.
- [ ] Body download failure maps to a retryable 5xx response.
- [ ] Database failure during atomic persistence maps to a retryable 5xx response.
- [ ] Retryable failures leave no partial Email, Email Body, Email Attachment, or Interaction records.
- [ ] Processor tests cover duplicate replay, 4xx failure categories, 5xx failure categories, and rollback/no-partial-record behavior.
- [ ] Webhook adapter tests cover result-to-HTTP response mapping.

## Blocked by

- `.scratch/channel-hub-inbound-email-workspace-integration/issues/01-plain-text-bcc-inbound-channel-hub-email.md`

## Implementation review

- Implemented with TDD.
- Targeted verification passed:
  - `pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false` — 30/30 passing.
  - `pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand` — 14/14 passing.
  - `pnpm --filter @kace/core tests tests/emails/EmailsUnitTest.test.js --coverage=false` — 9/9 passing.
- Issue 02 migration sqlite smoke passed, including duplicate-email and duplicate-interaction preflight failure paths.
- Spec-compliance review passed with no findings.
- Code-quality review findings were fixed and final re-review approved proceeding to Issue 03.
