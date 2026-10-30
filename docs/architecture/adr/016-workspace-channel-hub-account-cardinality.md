# ADR-016: Workspace Channel Hub Account Cardinality

**Status:** ⛔ Superseded by [ADR-017](017-workspace-multiple-channel-hub-accounts.md)

**Date:** 2026-06-24

## Context

A Workspace can route inbound Channel Hub activity through a registered Channel Hub Account. Allowing multiple Channel Hub Accounts on one Workspace makes inbound routing ambiguous and creates a mismatch with the Workspace UI, where agents expect one Channel Hub identity to represent the Workspace.

The domain glossary now states that a Workspace can be linked to at most one Channel Hub Account. That rule needs an explicit decision record so client-side behavior and API validation do not drift.

## Decision

A Workspace can be linked to zero or one Channel Hub Account.

This is enforced in two places:

- The Workspace API schemas reject create and update payloads whose `channel_hub_accounts` array has more than one item.
- The Workspaces frontend truncates Channel Hub Account selection to the latest selected item in `MultiSelectChannelHubAccounts`.

## Consequences

- Workspace routing through Channel Hub has one clear account boundary.
- The frontend cannot submit multiple Channel Hub Accounts through the standard Workspace form.
- API clients that bypass the frontend receive validation failures instead of persisting invalid cardinality.
- Existing data should be audited before rollout if production may already contain Workspaces linked to more than one Channel Hub Account.

## Alternatives Considered

- Allow multiple Channel Hub Accounts per Workspace and make routing choose by priority. Rejected because the product rule is one account per Workspace and priority would add avoidable ambiguity.
- Enforce only in the frontend. Rejected because scripts, imports, and direct API clients could still persist invalid data.

## Related ADRs

- [ADR-004: Channel Hub Inbound Email Boundary](004-channel-hub-inbound-email-boundary.md)
