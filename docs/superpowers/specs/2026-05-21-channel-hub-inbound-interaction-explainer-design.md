# Channel Hub Inbound to Interaction Explainer — Design

## Goal
Create a single standalone HTML file with embedded CSS and JavaScript that visually explains the current Channel Hub inbound email flow from webhook receipt through Email and Interaction persistence.

## Deliverable
- File: `channel-hub-inbound-to-interaction-flow.html`
- Format: complete standalone HTML document with embedded `<style>` and `<script>` blocks.
- Runtime dependencies: none; opens directly in a browser.

## Audience
The explainer should work for both technical and semi-technical readers. It should be clear enough for product/support demos while still naming the important code boundaries and persistence records.

## Visual Approach
Use the approved **Hybrid Flow + Architecture** approach:
- Left-side clickable step timeline.
- Main details panel that updates when a step is selected.
- Architecture/module cards for controller, core processor, repositories, and DB writes.
- Success path and rejection/outcome cards.
- Clean documentation-like visual style: dark navy sidebar, light content panels, blue/green/orange semantic accents, rounded cards, readable spacing.

## Flow Content
The page must explain these steps:

1. **Webhook received**
   - Channel Hub sends a POST to `/webhooks/channel-hub`.
   - Payload includes message id, tag, origin, destination recipients, text/html content URLs, and attachments.

2. **Controller validates payload**
   - `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs` parses and validates the payload using `channelHubSchema`.
   - Controller stays thin and delegates to the core processor.

3. **Workspace resolved by tag**
   - `ChannelHubInboundEmailProcessor` reads `payload.tag`.
   - `KnexWorkspacesRepository.findActiveByTag(tag)` finds the active workspace.

4. **Receiving account matched**
   - Processor normalizes `destination.to`, `destination.cc`, and `destination.bcc` recipient emails.
   - `KnexChannelHubAccountRepository.findAllByEmails()` matches recipients against `channel_hub_accounts.email`.
   - Matches are filtered by `workspaces_channel_hub_accounts_relations` through `hasChannelHubAccount()`.
   - Exactly one assigned Channel Hub account must match.

5. **URLs and body/attachments checked**
   - Text body URL is required.
   - Text/html/attachment URLs must be allowed/trusted.
   - Plain text body is downloaded.
   - HTML body and attachments are downloaded when present.

6. **Email and Interaction persisted**
   - The processor creates records atomically for Email, Email Body, Email Attachments, and Interaction.
   - `emails.account_id` is set to the matched Channel Hub account id.
   - `interactions.email_id` links the interaction to the email.
   - `interactions.workspace_id` uses the resolved workspace.

7. **Webhook response returned**
   - Accepted or already-processed results return OK.
   - Non-retryable validation/resolution failures return bad request-style responses.
   - Retryable processing failures return server error-style responses.

## Account Selection Explanation
Include a dedicated section/card explaining multi-account behavior:
- A workspace may have multiple Channel Hub accounts assigned.
- Inbound processing does not choose a workspace account arbitrarily.
- It selects by matching inbound recipient emails to `channel_hub_accounts.email`, then ensuring the matched account is assigned to the workspace.
- If exactly one assigned match exists, that account is used.
- If no assigned match exists, the payload is rejected.
- If more than one assigned match exists, the payload is rejected as `multiple_channel_hub_account_matches`.

## Outcome Cards
Show these outcomes:
- **Accepted**: email and interaction are persisted.
- **Already processed**: duplicate `workspace_id + message_id` resolves to the existing email/interaction result.
- **Non-retryable rejection**: bad input or impossible routing, such as missing tag, no account match, multiple account matches, untrusted URL.
- **Retryable failure**: unexpected processing/database/storage error.

## Interactivity
- Timeline buttons update the detail panel.
- Each step detail shows:
  - plain-language explanation,
  - important data used,
  - relevant module/file,
  - success/failure note where useful.
- Add a small “simulate outcomes” control or tabs that lets users switch between success, no account match, multiple accounts, and duplicate message.
- No external APIs, network calls, or repo runtime dependencies.

## Accessibility and Responsiveness
- Use semantic headings and buttons.
- Keyboard-focusable timeline controls.
- Good contrast between text and backgrounds.
- Responsive layout: two-column desktop, single-column mobile.

## Out of Scope
- No real Channel Hub API calls.
- No live database queries.
- No changes to backend/frontend production code.
- No dependency installation.
- No generated image assets required.

## Verification
- Open the standalone file locally in a browser.
- Confirm each timeline step updates the details panel.
- Confirm outcome simulation/tabs update visible explanation.
- Confirm mobile layout does not overflow.
- Confirm the flow text matches the inspected code behavior.

## Relevant Existing Files
- `apps/apiv1/kace_cloud_api_webhooks/src/controller.mjs` — webhook parsing, validation, delegation.
- `packages/kace_cloud_core/src/channel-hub-inbound-emails/application/ChannelHubInboundEmailProcessor.js` — core inbound orchestration.
- `packages/kace_cloud_core/src/channel-hub-accounts/infrastructure/persistence/KnexChannelHubAccountRepository.js` — matching Channel Hub accounts by recipient email.
- `packages/kace_cloud_core/src/workspaces/infrastructure/persistence/KnexWorkspacesRepository.js` — workspace lookup and workspace/account relation checks.
- `packages/kace_cloud_api_common/src/http_responses/ChannelHubInboundEmailWebhookResponse.js` — conversion of processing result to HTTP response.
