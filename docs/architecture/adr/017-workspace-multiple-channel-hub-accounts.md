# ADR-017: Workspace Supports Multiple Channel Hub Accounts

**Status:** ✅ Accepted

**Date:** 2026-07-01

**Supersedes:** [ADR-016: Workspace Channel Hub Account Cardinality](016-workspace-channel-hub-account-cardinality.md)

## Context

ADR-016 limited a Workspace to zero or one Channel Hub Account, arguing that multiple
accounts made inbound routing ambiguous. That concern no longer holds: inbound routing
resolves the Workspace by the pair `(channel_hub_account_id, tag)` via
`findActiveByChannelHubAccountIdAndTag`, not by tag alone, so each account routes
unambiguously even when several accounts share a Workspace.

The product decision (2026-06-30) is that one Workspace must be able to receive email
through N Channel Hub Accounts, each with its own inbox rule in Channel Hub.

## Decision

A Workspace can be linked to zero or more Channel Hub Accounts, with no upper bound.

Each `(workspace, account)` relation row owns its Channel Hub rule:

- `workspaces_channel_hub_accounts_relations.channel_hub_rule_id` stores the rule id
  returned by Channel Hub for that account. `NULL` means "linked but not yet registered".
- Rule criteria (`subjectContains`, `actionRules`, …) remain in `workspaces.rules` at the
  Workspace level: the same criteria apply to every account, only the connection differs.
- Rule `priority` is NOT persisted in kace. Channel Hub owns and renumbers priorities;
  the stable `channel_hub_rule_id` is the only bridge kace needs.

The persisted account set is the source of truth. Channel Hub side effects
(create/update/delete of rules) converge toward it and are retryable per account:
a partial registration failure leaves the failed accounts pending (`NULL` rule id)
without rolling back the successful ones.

## Consequences

- The one-account-per-workspace unique index, the repository assertion, the
  `Joi.array().max(1)` schema constraint, and the frontend `enforceSingle` truncation
  are removed.
- Updating a Workspace's accounts requires an added/removed/retained diff computed
  BEFORE persisting relations, since the repository replaces relation rows wholesale;
  retained accounts must keep their `channel_hub_rule_id`.
- Update/delete tag flows are enqueued once per account relation instead of once per
  Workspace.
- The same `(account, tag)` pair mapping to two Workspaces remains invalid and must be
  validated on save.
- A future module may edit rule priorities from kace by reading them live from Channel
  Hub; the per-relation `channel_hub_rule_id` is the mapping it will rely on.

## Alternatives Considered

- Keep the single-account limit (ADR-016). Rejected by product: Workspaces need to
  aggregate inbound email from several accounts.
- Store rule ids as a map inside the `workspaces.rules` JSON blob. Rejected: mixing the
  shared criteria with per-account rule ids in one blob is fragile; the relation row is
  the natural owner and keeps queries and deletes per account trivial.
- Persist rule priority per relation. Rejected: Channel Hub renumbers priorities on any
  rule change, so a persisted copy would be permanently stale and serves no use case in
  this scope.

## Related ADRs

- [ADR-016: Workspace Channel Hub Account Cardinality](016-workspace-channel-hub-account-cardinality.md) (superseded)
- [ADR-004: Channel Hub Inbound Email Boundary](004-channel-hub-inbound-email-boundary.md)
