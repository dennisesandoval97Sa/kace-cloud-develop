# Channel Hub recipient priority routing design

Date: 2026-05-21

## Goal

Resolve inbound Channel Hub emails to the correct Workspace and Channel Hub account when recipient emails in `destination.to`, `destination.bcc`, and `destination.cc` match more than one configured Channel Hub account.

## Problem

Channel Hub inbound payloads can include multiple recipients across `to`, `bcc`, and `cc`. The account that received the message is expected to appear in `to` or `bcc`, but the processor must still search all recipient fields because real payloads can vary.

Today, inbound processing finds all Channel Hub account matches across all recipient fields, filters them by the Workspace resolved from `payload.tag`, and rejects the payload if more than one assigned account matches. That is safe, but it does not reflect the desired priority when multiple Channel Hub accounts appear in different recipient fields.

## Decisions

- Continue resolving the initial Workspace from `payload.tag`.
- Continue normalizing and searching recipient emails from all three fields: `destination.to`, `destination.bcc`, and `destination.cc`.
- Select account/workspace candidates by recipient field priority: `to` first, then `bcc`, then `cc`.
- Lower-priority fields must not override a match found in a higher-priority field.
- If the winning field has exactly one assigned Channel Hub account candidate, use that account for Email persistence and use its Workspace for Interaction assignment.
- If the winning field has multiple possible Workspace/account candidates, reject the webhook as non-retryable.
- The rejection code should be `ambiguous_channel_hub_workspace`.
- The rejection `message` must contain all ambiguity diagnostics; do not add a new `details` field.
- The ambiguity `message` must state that this indicates a bad KACE configuration that must be reviewed.
- The ambiguity `message` must include each ambiguous candidate's Workspace id, Workspace name when available, Channel Hub account id, Channel Hub connection id, account email, and recipient field.

## Recipient priority rule

Evaluate candidates in this order:

1. `destination.to`
2. `destination.bcc`
3. `destination.cc`

For each field:

1. Normalize that field's recipient emails.
2. Match those emails to `channel_hub_accounts.email`.
3. Keep only accounts assigned to the relevant Workspace through `workspaces_channel_hub_accounts_relations`.
4. If there are no candidates, continue to the next field.
5. If there is one candidate, use it.
6. If there is more than one candidate, reject as ambiguous and include only those candidates in the `message`.

Example:

```txt
TO:  workspace A
BCC: workspace B
CC:  workspace C

Result: workspace A / account A
```

Example:

```txt
TO:  workspace A, workspace B
BCC: workspace C

Result: non-retryable ambiguous_channel_hub_workspace.
The message lists workspace A and workspace B only, because TO is the winning ambiguous field.
```

Example:

```txt
TO:  no match
BCC: workspace B
CC:  workspace C

Result: workspace B / account B
```

## Ambiguous webhook response message

The response shape stays compatible with the existing `ChannelHubInboundEmailProcessingResult.nonRetryable(code, message)` contract. All candidate information goes inside `message`.

Recommended message format:

```txt
Multiple Channel Hub workspace candidates matched recipients in TO. This indicates a KACE misconfiguration and must be reviewed. Candidates: [workspaceId=workspace-a-id, workspaceName=Workspace A, accountId=account-a-id, connectionId=conn_123, email=support-a@company.com, recipientField=to], [workspaceId=workspace-b-id, workspaceName=Workspace B, accountId=account-b-id, connectionId=conn_456, email=support-b@company.com, recipientField=to].
```

Recommended result:

```json
{
    "status": "non_retryable",
    "code": "ambiguous_channel_hub_workspace",
    "message": "Multiple Channel Hub workspace candidates matched recipients in TO. This indicates a KACE misconfiguration and must be reviewed. Candidates: [workspaceId=workspace-a-id, workspaceName=Workspace A, accountId=account-a-id, connectionId=conn_123, email=support-a@company.com, recipientField=to], [workspaceId=workspace-b-id, workspaceName=Workspace B, accountId=account-b-id, connectionId=conn_456, email=support-b@company.com, recipientField=to]."
}
```

## Data flow

1. Webhook receives a Channel Hub payload.
2. Processor resolves the Workspace tag from `payload.tag`.
3. Processor normalizes recipient lists from `destination.to`, `destination.bcc`, and `destination.cc`.
4. Processor builds account candidates grouped by recipient field.
5. Processor evaluates candidates using `to > bcc > cc` priority.
6. Processor either selects one Channel Hub account or returns an ambiguity error.
7. If one account is selected, processing continues with existing body URL checks, downloads, Email persistence, and Interaction persistence.
8. `emails.account_id` is set to the selected Channel Hub account id.
9. `interactions.workspace_id` is set to the selected/resolved Workspace id.

## Error behavior

- No recipient emails still returns `channel_hub_account_match_not_found`.
- No Channel Hub account matches any recipient still returns `channel_hub_account_match_not_found`.
- Recipient matches that are not assigned to the resolved Workspace still return `channel_hub_account_not_assigned_to_workspace`.
- Multiple candidates in the winning priority field return `ambiguous_channel_hub_workspace`.
- Ambiguity is non-retryable because retrying the same payload will not fix KACE configuration.
- Ambiguity messages must be actionable for operators and include the KACE misconfiguration notice.

## Code changes expected

- Update `ChannelHubInboundEmailProcessor` account selection logic to evaluate matches by recipient field priority instead of treating all recipient fields as one unordered set.
- Add a small helper for formatting ambiguity candidates into a single `message` string.
- Preserve the existing `ChannelHubInboundEmailProcessingResult` shape.
- Add or update tests covering:
  - `to` match wins over `bcc` and `cc` matches.
  - `bcc` match wins when `to` has no match.
  - `cc` match is used only when `to` and `bcc` have no match.
  - multiple candidates in `to` return `ambiguous_channel_hub_workspace`.
  - ambiguous `message` includes KACE misconfiguration text.
  - ambiguous `message` includes workspace id, workspace name when available, account id, connection id, email, and recipient field for each candidate.
  - lower-priority candidates are not listed when a higher-priority field is ambiguous.

## Out of scope

- Adding a new top-level `details` object to webhook responses.
- Changing Channel Hub payload validation beyond recipient matching needs.
- Adding a Workspace primary/default Channel Hub account setting.
- Changing Channel Hub tag routing semantics.
- Changing body URL, attachment URL, inline image, or allowed connection behavior.
