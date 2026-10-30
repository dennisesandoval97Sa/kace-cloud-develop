Status: ready-for-agent
Labels: ready-for-agent
Type: PRD
Created: 2026-05-14

# PRD: Channel Hub Inbound Email Workspace Integration

## Problem Statement

Channel Hub inbound email processing is not working reliably with Workspaces, especially when the receiving Mail Account is hidden in BCC. Channel Hub sends body content and attachments as temporary CloudFront/S3 presigned URLs, but KACE Cloud needs durable Email, Email Body, Email Attachment, and Interaction records that agents can open, render, and act on inside the correct Workspace.

Today, inbound processing is split across the wrong API boundary, mixes business logic into API controllers, resolves the receiving Mail Account from the sender instead of recipients, stores temporary provider URLs, lacks a durable HTML Email Body field, does not persist a direct Interaction-to-Email link, and has weak webhook tests that do not protect the important failure modes.

## Solution

Build a dedicated Channel Hub inbound email workflow in the core domain/application layer. The public Channel Hub webhook will remain a thin API-key protected adapter and delegate to this core workflow. The workflow will validate the Workspace Reference, resolve exactly one receiving Mail Account from normalized recipients including BCC, download trusted body URLs, upload and scan attachments into KACE S3, persist durable Email records with plain and HTML Email Body content, create a linked Interaction in the target Workspace, and handle retries idempotently by External Message ID.

The Channel Hub account-management API remains responsible only for Channel Hub Account CRUD and registration. The existing interactions webhook should no longer be a separate Channel Hub ingestion path; during transition it should delegate to the same core workflow or be deprecated.

## User Stories

1. As an agent, I want inbound Channel Hub emails to appear as Interactions in the correct Workspace, so that I can work customer messages from the right queue.
2. As an agent, I want emails sent to a Mail Account through BCC to create Interactions, so that hidden-copy routing works like visible recipients.
3. As an agent, I want to open the source Email from an Interaction, so that I can read the complete customer message.
4. As an agent, I want the Email body to render as HTML when available, so that I can read formatted messages accurately.
5. As an agent, I want the Email detail view to fall back to plain text when HTML is unavailable, so that every message remains readable.
6. As an agent, I want Email Attachments to have meaningful filenames, so that I can identify files before opening or downloading them.
7. As an agent, I want Email Attachments to download from KACE-controlled storage, so that attachment access does not depend on expired provider URLs.
8. As an agent, I want attachment downloads to use the retained Attachment Filename, so that ZIP downloads and individual downloads are understandable.
9. As an agent, I want the Email detail view to show recipients consistently, so that I can understand who received the message.
10. As an agent, I want Interactions created from inbound email to show the sender, subject, received time, and priority, so that I can triage work quickly.
11. As an operations user, I want Channel Hub retries to be idempotent, so that duplicate webhook deliveries do not create duplicate Emails or Interactions.
12. As an operations user, I want duplicate webhook deliveries to return success, so that Channel Hub stops retrying already-processed messages.
13. As an operations user, I want invalid Channel Hub payloads to fail clearly, so that configuration or payload problems can be fixed instead of retried forever.
14. As an operations user, I want transient infrastructure failures to return retryable errors, so that Channel Hub can retry when downloads, storage, scanning, or database writes fail.
15. As an operations user, I want no partial Email or Interaction records when processing fails, so that agents do not see incomplete work.
16. As a security reviewer, I want inbound body and attachment downloads restricted to trusted domains, so that webhook payloads cannot trigger arbitrary outbound fetches.
17. As a security reviewer, I want inbound attachments scanned before they are exposed to agents, so that Channel Hub does not bypass existing file safety controls.
18. As a security reviewer, I want original HTML stored but sanitized at render time, so that KACE preserves message fidelity while preventing unsafe rendering.
19. As a Workspace administrator, I want inbound messages to validate that the Workspace exists and is active, so that messages cannot be routed into inactive or invalid Workspaces.
20. As a Workspace administrator, I want inbound messages to validate that the receiving Mail Account belongs to the Workspace, so that messages cannot be misrouted across Workspace boundaries.
21. As a Workspace administrator, I want Channel Hub `tags` to be treated as a Workspace Reference, so that Channel Hub routing aligns with the configured Workspace ID.
22. As a system integrator, I want the Channel Hub webhook to accept unknown extra fields, so that Channel Hub contract additions do not break ingestion.
23. As a system integrator, I want the Channel Hub webhook to require only the fields KACE needs, so that minimal valid payloads can still be processed.
24. As a developer, I want Channel Hub inbound email processing outside API controllers, so that business logic is testable and reusable.
25. As a developer, I want Channel Hub inbound email processing separate from Channel Hub Account management, so that account registration and message ingestion do not become coupled.
26. As a developer, I want a dedicated processor with a stable interface, so that the workflow can be tested without API Gateway or frontend code.
27. As a developer, I want recipient normalization centralized, so that `to`, `cc`, and `bcc` are stored consistently and matched case-insensitively.
28. As a developer, I want mailbox resolution to reject zero or ambiguous matches, so that the system never guesses which Mail Account received a message.
29. As a developer, I want a reusable Email persistence service, so that provider-specific ingestion can prepare durable content and then save Email records through a simple interface.
30. As a developer, I want Email and Interaction writes to be atomic, so that cross-aggregate persistence is consistent.
31. As a developer, I want the Email schema changes to be backward-compatible, so that existing email records and tests keep working.
32. As a developer, I want the existing interactions webhook to delegate or be deprecated, so that there is only one Channel Hub ingestion behavior.
33. As a QA engineer, I want tests for BCC happy path processing, so that the hidden-copy regression is covered.
34. As a QA engineer, I want tests for idempotency, so that retries do not duplicate work.
35. As a QA engineer, I want tests for validation and retryable failure categories, so that HTTP response behavior stays intentional.
36. As a QA engineer, I want tests for trusted URL enforcement, so that webhook payloads cannot fetch arbitrary content.
37. As a QA engineer, I want tests for attachment upload, scan, and persistence behavior, so that attachments are durable and safe.
38. As a product owner, I want a clear implementation boundary documented in an ADR, so that future changes do not reintroduce duplicated webhook logic.

## Implementation Decisions

- Create a dedicated Channel Hub inbound email processor in the core package. This is the deep module for the feature: it exposes a simple processing interface and encapsulates payload validation, routing validation, Mail Account resolution, content retrieval, attachment preparation, idempotency, and cross-aggregate persistence.
- Add a Channel Hub inbound email mapper to normalize the provider payload into KACE concepts: Workspace Reference, External Message ID, sender, normalized recipients, body URLs, attachment URLs, and Interaction fields.
- Keep the public Channel Hub webhook controller thin. It validates the minimal webhook schema, invokes the core processor, and maps processor results to HTTP responses.
- Keep the Channel Hub account-management API scoped to Channel Hub Account CRUD and registration only. It must not own inbound email business logic.
- Deprecate the interactions webhook as a Channel Hub ingestion path. If compatibility is needed, it should delegate to the same core processor rather than duplicating behavior.
- Use direct imports from the API controller to the new core processor initially. A barrel export can be added later if reuse expands.
- Treat `tags` in the Channel Hub payload as the Workspace Reference containing the Workspace ID. It is not the human-configurable Workspace tag.
- Validate that the referenced Workspace exists and is active before downloading body or attachment content.
- Resolve the receiving Mail Account from all normalized recipients across `to`, `cc`, and `bcc`, using case-insensitive email comparison against Mail Account email identity.
- Reject webhook processing when zero Mail Accounts match or when more than one distinct Mail Account matches. The system should not guess.
- Validate that the matched Mail Account belongs to the referenced Workspace before any external downloads.
- Normalize recipients into arrays of objects with email and nullable display name. Store normalized recipient objects in Email recipient fields.
- Use `messageIdOperator` when present, otherwise `messageId`, as the External Message ID.
- Store the External Message ID in the Email message identity field and use it for idempotency.
- Widen and uniquely index the Email message identity storage as needed so provider message IDs are safe and duplicate detection is enforced.
- Return success for idempotent duplicate deliveries. Do not create a second Email or Interaction.
- Download Channel Hub body URLs before persistence. Store downloaded plain-text content as the Email Body plain field and downloaded HTML content as HTML Email Body.
- Add nullable HTML Email Body storage. Existing Email Body plain text remains available and backward-compatible.
- Store original downloaded HTML content. Sanitize only in the UI at render time.
- Restrict body and attachment downloads to trusted configured domains, such as Channel Hub CloudFront/S3 hosts in the existing allowed-connections mechanism.
- Download every Channel Hub attachment, upload it to KACE-controlled S3 storage, scan it with the existing S3 file scanner, and persist only the durable KACE storage reference.
- Do not persist temporary Channel Hub presigned URLs as Email Attachment URLs.
- Add nullable Attachment Filename storage. New Channel Hub attachments should always set a filename; existing rows remain valid.
- Keep Email Attachment URL and size fields backward-compatible.
- Add a direct Email reference to Interaction records created from inbound Channel Hub emails.
- Map inbound email Interactions with stable defaults: email channel, sender as client identifier, External Message ID as external identifier, subject as description, Workspace Reference as Workspace ID, and saved Email ID as the source Email link.
- Use the existing Kace Bot system user for audit fields on unauthenticated webhook-created records.
- Use one atomic database write phase for Email, Email Body, Email Attachments, and Interaction. Either all related database records are committed, or none are.
- Perform validation before external downloads to avoid unnecessary outbound requests and S3 writes.
- Treat invalid payload, missing Workspace Reference, invalid/inactive Workspace, missing or ambiguous Mail Account, Mail Account/Workspace mismatch, and untrusted URL as non-retryable 4xx failures.
- Treat transient body/attachment download failures, S3 upload failures, scanner service failures, and database failures as retryable 5xx failures.
- Align the Email detail API response shape around an explicit body object and plural attachments array. The frontend should prefer HTML body, fall back to plain text, and use the Attachment Filename for display/download.
- Keep API response compatibility where useful by temporarily exposing a display name alias derived from Attachment Filename if the frontend still expects it.
- Preserve the architectural boundary recorded in ADR-004: inbound processing is canonical at the Channel Hub webhook and delegated to core.

## Testing Decisions

- Tests should verify externally observable behavior: processor result categories, created database records, idempotency, response mapping, and durable storage/scanning calls. They should not assert private helper implementation details.
- The primary unit/integration target is the dedicated Channel Hub inbound email processor because it is the deep module that encapsulates most behavior.
- Test the happy path where the receiving Mail Account appears only in BCC. The expected behavior is one Email, one Email Body with plain and HTML content, durable Email Attachment records with filenames, and one Interaction linked to the Email in the referenced Workspace.
- Test recipient normalization from string and object-like inputs across `to`, `cc`, and `bcc`.
- Test case-insensitive Mail Account matching.
- Test zero Mail Account match as a non-retryable validation/configuration failure.
- Test multiple distinct Mail Account matches as a non-retryable validation/configuration failure.
- Test missing Workspace Reference as a non-retryable validation failure.
- Test invalid or inactive Workspace as a non-retryable validation/configuration failure.
- Test Mail Account not assigned to the Workspace as a non-retryable validation/configuration failure.
- Test untrusted body URL and untrusted attachment URL as non-retryable security failures.
- Test idempotent replay by sending the same External Message ID twice and asserting the second run returns already processed without creating duplicate Email or Interaction records.
- Test body URL download: plain text is stored as plain Email Body and HTML is stored as HTML Email Body.
- Test attachment handling: provider URL is downloaded, uploaded to KACE S3, scanned, and persisted with the KACE storage reference and Attachment Filename.
- Test attachment scanner rejection as a retryable processing failure with no database records committed.
- Test download failure as a retryable processing failure with no database records committed.
- Test S3 upload failure as a retryable processing failure with no database records committed.
- Test database failure during the atomic write as a retryable processing failure with no partial Email, Email Body, Email Attachment, or Interaction records.
- Test public webhook response mapping: duplicate replay returns 200, non-retryable validation/configuration failures return 4xx, and retryable processing failures return 5xx.
- Update or replace existing status-only webhook tests because they are too weak to protect the feature.
- Use existing Email, Workspace, Mail Account, and Interaction test fixtures as prior art, but prefer focused processor tests over broad end-to-end tests where external services would require heavy mocking.
- Frontend tests should cover rendering the explicit Email detail shape: HTML body fallback behavior, sanitized rendering boundary, plural attachments, and filename display/download behavior.

## Out of Scope

- Changing Channel Hub Account CRUD or registration behavior except where it is necessary to preserve the inbound boundary.
- Implementing lookup by human-configurable Workspace tag. The current decision is to use `tags` as the Workspace Reference containing the Workspace ID.
- Supporting multiple receiving Mail Accounts for a single inbound Channel Hub email. Ambiguous matches are rejected.
- Creating resumable partial-ingestion status fields. Failures roll back database writes and rely on retry behavior.
- Backfilling filenames or HTML bodies for historical Email records.
- Adding a full issue-tracker setup or changing repository-wide agent configuration.
- Replacing the existing S3 file scanner.
- Building a new attachment authorization model beyond storing durable KACE S3 references and preserving current access patterns.
- Sanitizing HTML at ingest time. Sanitization belongs at rendering.
- Refactoring all generic Email CRUD behavior unless needed to introduce the reusable lower-level Email persistence service.

## Further Notes

- The repository currently has a Bitbucket remote and no configured engineering-skills issue tracker metadata. This PRD is therefore published using the local markdown issue-tracker convention under `.scratch`.
- The domain glossary defines Channel Hub, Channel Hub Account, Inbound Channel Hub Email, External Message ID, Email, Email Body, HTML Email Body, Email Attachment, Attachment Filename, Interaction, Workspace, and Workspace Reference. Implementation should use those terms consistently.
- ADR-004 records the boundary decision for Channel Hub inbound email processing.
- Current code has a known bug where Email creation resolves the Mail Account from the sender. The inbound processor must resolve the receiving Mail Account from recipients instead.
- Current code has a known bug where attachment processing may save the temporary provider URL rather than the durable uploaded attachment reference. The new workflow must persist only durable KACE storage references.
- Current frontend code expects some fields that the backend does not currently return. The API and UI should be aligned as part of this feature.
