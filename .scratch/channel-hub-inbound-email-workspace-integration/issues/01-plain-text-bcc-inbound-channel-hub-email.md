Status: completed
Labels: completed, reviewed
Type: Issue

# Plain-text BCC Inbound Channel Hub Email tracer bullet

## Parent

`.scratch/channel-hub-inbound-email-workspace-integration/PRD.md`

## What to build

Build the smallest complete Inbound Channel Hub Email path for a plain-text message whose receiving Mail Account appears only in BCC. The public Channel Hub webhook should accept a minimal valid payload, delegate to a dedicated core processor, validate the Workspace Reference and receiving Mail Account, download a trusted plain-text Email Body URL, and atomically create the Email, Email Body, and linked Interaction.

This slice intentionally excludes HTML Email Body storage and Email Attachments. It should establish the core processor boundary, recipient normalization, BCC Mail Account resolution, Workspace validation, Interaction-to-Email linking, and Kace Bot audit behavior.

## Acceptance criteria

- [ ] A minimal Channel Hub webhook payload with `tags` as Workspace Reference, sender, External Message ID, BCC recipient, and plain-text body URL is accepted.
- [ ] The public webhook controller remains thin and delegates inbound processing to a dedicated core processor.
- [ ] The Channel Hub account-management API is not used for inbound email business logic.
- [ ] Recipients from `to`, `cc`, and `bcc` are normalized into recipient objects.
- [ ] The receiving Mail Account is matched case-insensitively from recipients, including BCC.
- [ ] Processing fails with a non-retryable validation/configuration result when the Workspace does not exist or is inactive.
- [ ] Processing fails with a non-retryable validation/configuration result when no Mail Account matches or multiple distinct Mail Accounts match.
- [ ] Processing fails with a non-retryable validation/configuration result when the matched Mail Account is not assigned to the Workspace.
- [ ] Plain-text body URL host is checked against trusted/allowed domains before download.
- [ ] The downloaded plain-text body is stored as the Email Body plain content, not as the presigned URL.
- [ ] The Email stores the sender, normalized recipients, Workspace Reference, receiving Mail Account, received timestamp, and External Message ID.
- [ ] The Email can safely store provider External Message IDs that are not UUIDs.
- [ ] The Interaction is created in the referenced Workspace and directly references the saved Email.
- [ ] The Interaction uses stable email defaults for channel, client identifier, external identifier, description, conversation, received time, and priority.
- [ ] Email, Email Body, and Interaction database writes are atomic.
- [ ] Audit fields for webhook-created records use the Kace Bot system user.
- [ ] Tests cover the BCC happy path and the non-retryable validation/configuration cases above.

## Blocked by

None - can start immediately

## Implementation review

- Implemented with TDD.
- Targeted verification passed:
  - `pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false` — 19/19 passing.
  - `pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand` — 10/10 passing.
  - `pnpm --filter @kace/core tests tests/emails/EmailsUnitTest.test.js --coverage=false` — 9/9 passing.
- Spec-compliance review passed with no findings.
- Code-quality review findings were fixed and final re-review approved proceeding to Issue 02.
