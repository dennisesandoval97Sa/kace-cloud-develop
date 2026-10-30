# ADR-018: Hide the System Inbox Workspace from Frontend Choices

**Status:** Accepted

**Date:** 2026-07-30

## Context

KACE Cloud retains one Workspace as the operational fallback for inbound and outbound
email processing. Users should not select or manage that Workspace through ordinary
frontend workspace lists. Its historical display description is `INBOX`, but
descriptions and tags are mutable business data and are not reliable system identity.

The workspace search APIs also serve administrative and integration clients. Hiding a
row in the frontend is therefore a presentation boundary, not deletion or an API
authorization boundary.

## Decision

The System Inbox Workspace is identified only by canonical ID
`dbcc5b5a-61bb-4b5a-95d0-9f6222749e54`. Code must not infer system status from a
description, translated label, tag, icon, or capitalization.

Backend email processing retains the Workspace and its fallback behavior. Frontend
workspace queries that power visible role-specific choices supply an explicit
`id neq <canonical-id>` filter. Interaction searches that must prevent System Inbox
records from appearing supply
`(workspace_id neq <canonical-id> OR workspace_id is null)`, retaining legacy
workspace-less records while excluding only the canonical ID. Search authorization
allows only those narrow `neq` and `null` additions; it does not inject them
server-side.

Direct-route behavior is role-specific:

- An administrative `/workspaces/update/<canonical-id>` route returns the generic
  not-found state without fetching the entity or confirming its name or existence.
- An agent workspace-ID deep link naming the canonical ID silently normalizes to
  All Workspaces. The aggregate interaction search still supplies
  `workspace_id neq <canonical-id>`, so normalization does not expose System Inbox
  interactions.

These frontend route rules do not turn the canonical ID into a blanket backend read or
write prohibition.

The API residual boundary is explicit: general workspace API clients can still receive
or address the System Inbox Workspace when they omit the frontend exclusion and hold
the existing permissions. Backend controllers, the historical seed migration, and
operational repository lookup remain unchanged.

## Consequences

- The canonical ID is shared through dependency-light backend and frontend helpers.
- Every frontend workspace-query surface must opt into the appropriate exclusion;
  missing a surface can expose the retained row.
- Saved filters, cache entries, URL restoration, or labels cannot redefine which
  Workspace is the System Inbox Workspace.
- Frontend concealment is not a security control. A future requirement to forbid API
  access needs a separate backend authorization decision.
- Backend email fallback behavior and historical data remain compatible.

## Alternatives Considered

- Match `description = INBOX` or `tag = inbox`. Rejected because both are mutable and
  can collide with ordinary Workspaces.
- Delete or deactivate the Workspace. Rejected because email processing depends on its
  operational fallback.
- Inject exclusions into all backend searches. Rejected because it would silently
  change administrative and integration API behavior beyond the frontend requirement.

## Related ADRs

- [ADR-004: Channel Hub Inbound Email Boundary](004-channel-hub-inbound-email-boundary.md)
- [ADR-017: Workspace Supports Multiple Channel Hub Accounts](017-workspace-multiple-channel-hub-accounts.md)
