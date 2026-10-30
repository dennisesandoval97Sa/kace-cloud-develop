# Channel Hub inbound tag routing design

Date: 2026-05-20

## Goal

Route inbound Channel Hub emails to the correct Workspace using the real Channel Hub payload field:

```json
{
    "tag": "rg"
}
```

The value is the Workspace tag/classification text configured in KACE, not a Workspace id and not a Channel Hub rule id.

## Problem

The current branch resolves the Workspace from `payload.tags` and treats that value as a Workspace id. Real Channel Hub messages send a singular `tag` field, for example `"rg"`. With the current code, valid inbound emails fail because `payload.tags` is missing and the Workspace cannot be resolved.

## Decisions

- Use only `payload.tag` for inbound Workspace routing.
- Do not support legacy `payload.tags`.
- Resolve the Workspace by active `workspaces.tag`.
- Use the resolved `workspace.id` for Email and Interaction persistence.
- Keep existing recipient-based Mail Account matching.
- Keep existing validation that the matched Mail Account is assigned to the resolved Workspace.
- Defer Workspace tag uniqueness enforcement to a later task.
- Do not automate Channel Hub create/update/delete tag REST flows; those flows are manually configured.

## Inbound data flow

1. Webhook receives Channel Hub payload.
2. Payload schema validates the required Channel Hub fields, including `tag`.
3. Inbound processor reads `payload.tag`.
4. Processor finds one active Workspace with `workspaces.tag = payload.tag`.
5. If no active Workspace is found, processing returns a non-retryable routing error.
6. Processor resolves the receiving Mail Account from `destination.to`, `destination.cc`, and `destination.bcc`.
7. Processor verifies the matched Mail Account belongs to the resolved Workspace.
8. Processor continues existing Email, Email Body, Attachment, and Interaction creation using `workspace.id`.

## Error behavior

- Missing or empty `tag` returns a non-retryable error.
- Unknown or inactive Workspace tag returns a non-retryable error.
- `payload.tags` is ignored and should not make a request valid.
- Duplicate active Workspace tags are out of scope for this change. Until uniqueness is implemented, repository behavior should be deterministic or the processor should fail safely if multiple active matches are detected.

## Code changes expected

- Update the Channel Hub webhook payload schema to require singular `tag`.
- Update `ChannelHubInboundEmailProcessor` to resolve by `payload.tag`.
- Add a Workspace repository lookup by active tag.
- Update tests that currently send `tags` as Workspace id.
- Add tests proving:
  - `tag` routes to the Workspace with that tag.
  - missing/empty `tag` is rejected.
  - `tags` without `tag` is rejected.
  - unmatched tag is rejected.
  - resolved Workspace id is used for Email and Interaction persistence.
  - Mail Account assignment validation still uses the resolved Workspace.

## Out of scope

- Workspace tag uniqueness validation or DB index.
- Channel Hub tag REST endpoint seeds/migrations.
- Workspace UI fields for tag REST flows.
- Storing Channel Hub rule ids on Workspaces.
- Any legacy fallback from `tags` to Workspace id.
