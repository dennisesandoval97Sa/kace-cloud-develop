Status: completed
Labels: completed, reviewed
Type: Issue

# Converge legacy interactions webhook on canonical Channel Hub processor

## Parent

`.scratch/channel-hub-inbound-email-workspace-integration/PRD.md`

## What to build

Remove duplicate Channel Hub ingestion behavior from the interactions webhook path. The canonical inbound path is the public Channel Hub webhook delegating to the dedicated core processor. If the interactions webhook must remain during transition, it should delegate to the same processor and return the same result categories rather than maintaining separate business logic.

This slice preserves ADR-004 by ensuring there is one Channel Hub inbound email processing behavior.

## Acceptance criteria

- [x] The interactions webhook no longer contains independent Channel Hub Email + Interaction business logic.
- [x] If the interactions webhook remains available, it delegates to the same core processor as the public Channel Hub webhook.
- [x] Result categories and HTTP response behavior are consistent between both webhook adapters while both exist.
- [x] Existing non-webhook Interaction CRUD behavior remains unchanged.
- [x] Channel Hub account-management behavior remains unchanged.
- [x] Status-only webhook tests are replaced or tightened so they verify meaningful behavior.
- [x] Tests prove the legacy path cannot diverge from canonical Channel Hub inbound processing.
- [x] Documentation or comments clearly identify the canonical inbound path and any transition behavior.

## Blocked by

- `.scratch/channel-hub-inbound-email-workspace-integration/issues/01-plain-text-bcc-inbound-channel-hub-email.md`
- `.scratch/channel-hub-inbound-email-workspace-integration/issues/02-idempotent-replay-and-retryable-failure-responses.md`

## Implementation notes

- Extracted the Channel Hub inbound webhook Joi schema to `@kace/api-common` and re-exported it from the public webhook app.
- Extracted the processor-result-to-HTTP mapper to `@kace/api-common` so public `/channel-hub` and legacy `/interactions/webhook` share accepted, non-retryable, and retryable response categories.
- Added `buildChannelHubInboundEmailProcessor` in core to share repository/downloader/storage/scanner wiring between adapters.
- Converted `ControllerWebhook` into a legacy transition adapter that preserves the existing permission check, validates the canonical Channel Hub payload, delegates to the shared core processor, and contains no EmailCreator/InteractionCreator/WebhookMapper business flow.
- Added lifecycle-managed processor resource cleanup for the public webhook and reused the BaseController-managed DB connection for the legacy route.
- Tightened legacy interactions webhook E2E assertions from status-only checks to canonical Channel Hub payload/schema/processor-category assertions.

## Verification

- PASS: `pnpm --filter @kace/api-interactions test -- --runTestsByPath apps/apiv1/kace_cloud_api_interactions/test/ControllerWebhook.test.mjs --runInBand` — 1 suite, 7 tests.
- PASS: `pnpm --filter @kace/api-webhooks test -- --runTestsByPath apps/apiv1/kace_cloud_api_webhooks/test/channelHubWebhook.test.mjs --runInBand` — 1 suite, 19 tests.
- PASS: `pnpm --filter @kace/core tests tests/channel-hub-inbound-emails/ChannelHubInboundEmailProcessor.test.js --coverage=false` — 1 suite, 47 tests.
- PASS: `node --check apps/apiv1/kace_cloud_api_interactions/test/InteractionE2E.test.mjs`.
- PASS: `git diff --check` for Issue 05 touched paths.

## Review

- Spec compliance review: CHANGES_REQUIRED initially because old interactions webhook E2E tests remained status-only; fixed by tightening those assertions. Re-review: APPROVED.
- Code quality review: CHANGES_REQUIRED initially because the public `/channel-hub` default factory opened a Knex connection without a destroy path; fixed with lifecycle-managed processor resources and `finally` cleanup. Re-review: APPROVED, no Critical or Important findings.
