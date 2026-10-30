# ADR-004: Channel Hub Inbound Email Boundary

**Status:** ✅ Accepted

## Context

Channel Hub integration has two distinct responsibilities: managing registered Channel Hub email identities and ingesting inbound customer email events. Without an explicit boundary, future code could put inbound email processing in `api_channel_hub`, duplicate it in `/interactions/webhook`, or hide it inside generic email creation logic.

## Decision

Channel Hub inbound email processing will be handled by the public API-key webhook path `/webhooks/channel-hub`, whose controller stays thin and delegates to a dedicated `@kace/core` inbound email use case. `api_channel_hub` remains scoped to Channel Hub account CRUD/registration, and `/interactions/webhook` should be deprecated or delegate to the same core use case during any transition.

## Consequences

- Inbound processing has one canonical boundary and one core orchestration path.
- The dedicated core use case owns cross-aggregate behavior across Email, Email Body, Email Attachment, Interaction, Channel Hub Account, and Workspace validation.
- Generic Email creation must not resolve the receiving account from the sender; new agent email records use Channel Hub Account ownership.
- Existing interaction webhook behavior must not diverge from the Channel Hub webhook during transition.
- New and updated Channel Hub registrations must point to `/webhooks/channel-hub`; `/interactions/webhook` remains a temporary compatibility adapter until production traffic and Channel Hub configuration are migrated.
