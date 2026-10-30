# ADR-021: Channel Hub Owns Workspace Processing Order

**Status:** ✅ Accepted

**Date:** 2026-07-21

## Context

A Channel Hub Account can have one mail rule per linked Workspace. When more than one
rule matches an inbound message, Channel Hub evaluates those rules by its live,
contiguous priority sequence and emits the winning Workspace Reference to KACE.

KACE administrators need to see and change that order from the Channel Hub Account edit
page. A Channel Hub rule exposes a classification value, while the page must show the
current human-readable Workspace description. Persisting a second priority copy or using
either of those mutable strings as identity would make the integration drift-prone.

## Decision

Channel Hub is the only source of truth for mail-rule priority. KACE reads the current
sequence through the RestFlow implementing `getMailRuleByConnection` and changes it
through the RestFlow implementing `updateMailRuleByConnection`.

KACE relates a remote rule to a Workspace through the stable bridge introduced by
ADR-017:

`mailRule.id -> workspaces_channel_hub_accounts_relations.channel_hub_rule_id -> workspace`

- `workspace.description` is the display label.
- `workspace.tag` is the expected Channel Hub classification and is validated for drift.
- `mailRule.ruleName` is not Workspace identity.
- Rule priority is never persisted in KACE.

The KACE priority module accepts a desired Workspace order, resolves remote rule ids
internally, and records a durable reorder operation. Reorder operations are serialized per
Channel Hub Account in a FIFO queue, apply Channel Hub updates sequentially outside the API
request timeout, and reconcile against the refreshed live order after every update. They
reject stale revisions, concurrent commands, and incomplete or inconsistent local/remote
mappings instead of guessing from mutable names or tags.

Before validating a new command against the live Channel Hub revision, the request path
checks for an active durable operation and atomically reserves the per-account operation
lock. A failed validation marks that reservation failed without publishing it. A concurrent
request returns HTTP 409 with only the active operation's id and status plus `Retry-After`
guidance. The client follows that
KACE-local operation status endpoint with exponential backoff (one, two, and four seconds,
then capped at five seconds) and adopts its terminal result. It does not repeatedly read the
live Channel Hub priority list while a valid operation receipt is available. A legacy or
malformed conflict without a receipt may perform one live fallback read; a failed status
follow-up is surfaced for explicit retry instead of automatically falling back upstream.

## Consequences

- Renaming a Workspace does not require a Channel Hub update for the priority view.
- Changing a Workspace tag can temporarily disable reordering until the existing tag
  update flow converges and the remote classification matches again.
- Priority reads require live Channel Hub availability; there is no stale local fallback.
- Priority writes are resumable, idempotent reconciliation operations. A worker retry
  refreshes the actual Channel Hub order and continues toward the recorded target instead
  of restarting from the submitted revision.
- Concurrent editors converge from the durable operation result without multiplying live
  Channel Hub reads; polling traffic stays on the KACE operation-status boundary.
- The inbound email processor remains independent of priority numbers. It receives the
  winning Workspace Reference selected by Channel Hub and performs the existing
  `(Channel Hub Account, Workspace Reference)` routing.

## Alternatives Considered

- Persist priority on the Workspace/account relation. Rejected because Channel Hub
  renumbers rules and the local copy would become stale.
- Match rules by `actionRules.classifyAs`. Rejected as the primary identity because tags
  are mutable; the classification remains a consistency check.
- Match rules by `ruleName` or Workspace description. Rejected because both are display
  text and can change independently.
- Patch every rule in parallel. Rejected because each priority update resequences the
  same connection and parallel writes race.

## Related ADRs

- [ADR-017: Workspace Supports Multiple Channel Hub Accounts](017-workspace-multiple-channel-hub-accounts.md)
- [ADR-004: Channel Hub Inbound Email Boundary](004-channel-hub-inbound-email-boundary.md)
