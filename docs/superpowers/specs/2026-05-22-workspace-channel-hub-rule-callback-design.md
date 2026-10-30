# Workspace Channel Hub Rule Callback Design

## Goal

Persist the Channel Hub email-rule id created by the Workspace “Register Tags” flow without adding Workspace-specific side effects to the generic Event Processor.

## Problem

The Channel Hub create-tag REST flow successfully creates the remote email rule and stores the response in workflow context:

```txt
context.channel_hub_tag.response.id
```

However, the workspace is not updated with that rule id. The update-tag flow requires:

```txt
workspace.rules.ruleId
```

The first attempted fix added `WorkspaceChannelHubRuleIdPersister` to the Event Processor. That works as a tactical idea but is not scalable because the Event Processor becomes aware of Workspace-specific business state.

## Decision

Use a Workspace-owned callback endpoint as the final step in the Create Tag REST flow.

Architecture rule:

> REST flows execute integration steps; Workspace API owns workspace state.

The Event Processor should remain generic. The workflow diagram should make persistence visible as an explicit final REST step.

## Non-goals

- Do not introduce a new `workspace_channel_hub_rules` table in this iteration.
- Do not redesign all Workspace/Channel Hub lifecycle state.
- Do not make RestFlow a generic database-writing engine.
- Do not keep Workspace-specific post-processing in the Event Processor.

## API contract

Add a Workspace API endpoint:

```txt
POST /workspaces/{workspaceId}/channel-hub-tags/rule-created
```

Request body:

```json
{
  "channel_hub_account_id": "5bef0eb7-6781-4423-806e-d320cc6ed619",
  "connection_id": "3E3R0BE70304do9a0Z6a9mqmTCK",
  "rule_id": "3E5FX4NM9SGdWZzz9Ad0ZNGHskf",
  "execution_id": "fa42817b-d264-4d3b-94f9-f041cd5332b8"
}
```

`execution_id` is optional for the first implementation. It can be added once the flow execution id is available inside workflow context.

Response:

```json
{
  "message": "Success",
  "data": {
    "workspace_id": "95346f17-4ee8-420d-a0af-16d2ac394dd9",
    "rule_id": "3E5FX4NM9SGdWZzz9Ad0ZNGHskf"
  }
}
```

## Persistence behavior

The callback updates:

```txt
workspaces.rules.ruleId
```

It must preserve all existing rule fields:

```json
{
  "ruleName": "TAGS",
  "subjectContains": ["TAGS", "WORK"],
  "actionRules": {
    "classifyAs": "TAGS"
  },
  "ruleId": "3E5FX4NM9SGdWZzz9Ad0ZNGHskf"
}
```

Idempotency:

- If the existing `rules.ruleId` equals the request `rule_id`, return `200 OK` without changing other fields.
- If the existing `rules.ruleId` is missing or different, overwrite it with the latest `rule_id`.

Validation:

- `workspaceId` must be a valid workspace id.
- `rule_id` must be a non-empty string.
- `connection_id` must be a non-empty string.
- `channel_hub_account_id` must be a non-empty string.
- The `connection_id` must belong to one of the workspace’s assigned `channel_hub_accounts`.
- The `channel_hub_account_id` must belong to the workspace.

## RestFlow changes

Add one final endpoint step to the Create Tag REST flow:

```txt
Workspace - Persist Channel Hub Rule Id
```

Flow order:

```txt
1. Channel Hub auth
2. normalizeChannelHubRule
3. Channel Hub - Create Tag
4. Workspace - Persist Channel Hub Rule Id
```

Callback endpoint URL:

```txt
{workspace_api_base_url}/workspaces/context.workspace.id/channel-hub-tags/rule-created
```

`workspace_api_base_url` is the Workspace API base URL configured in the REST endpoint seed/migration for the target environment.

Callback endpoint body:

```json
{
  "channel_hub_account_id": "context.workspace.channel_hub_accounts[0].id",
  "connection_id": "context.channel_hub_tag.connectionId",
  "rule_id": "context.channel_hub_tag.response.id"
}
```

Callback response context position:

```txt
workspace.channel_hub_tag_rule_created
```

## Security

The callback endpoint must require authentication like other Workspace API endpoints.

The RestFlow callback step should use a proper Workspace API authorization configuration, not an unauthenticated public endpoint. The authorization can use the same internal/service authentication pattern used by other RestFlows that call KACE APIs.

## Error handling

If Channel Hub create-tag succeeds but the callback fails:

- The REST flow result must expose the callback step status and response clearly.
- Workspace `rules.ruleId` should remain unchanged.
- The user/operator can inspect the REST flow execution result and retry the flow or callback.

If the callback receives an invalid payload:

- Return `400` with validation details.

If the workspace does not exist:

- Return `404`.

If the workspace does not include the provided Channel Hub connection/account:

- Return `409 Conflict` because the payload is structurally valid but does not match current workspace state.

## Update Tag interaction

No change is required to the current update-tag execution path for the first version.

After the callback stores `rules.ruleId`, the existing Workspace update behavior can continue:

```txt
Workspace update
  -> WorkspaceTagUpdateFlowQueuer
      -> requires tag_update_flow_id
      -> requires rules.ruleId
      -> queues Channel Hub - Update Tag flow
```

The update-tag flow will use:

```txt
context.channel_hub_tag.ruleId
```

## Cleanup

Remove the tactical Event Processor-specific implementation:

- `apps/apiv1/kace_cloud_api_event_processor/src/WorkspaceChannelHubRuleIdPersister.mjs`
- Event Processor imports and calls to `WorkspaceChannelHubRuleIdPersister`
- Handler tests that expect Workspace-specific persistence in Event Processor

Event Processor should only execute REST flow execution events and mark them completed/failed.

## Database and seed/migration work

No new table is required for this version.

Add or update database migration/seed logic so the standard Channel Hub Create Tag REST flow includes the callback endpoint step after the create-tag endpoint.

The migration/seed test should verify:

- The callback endpoint exists.
- The callback endpoint body maps `rule_id` from `context.channel_hub_tag.response.id`.
- The callback workflow step runs after the Channel Hub create-tag endpoint.
- The migration/seed is idempotent.

## Tests

Workspace API callback tests:

- Stores `rule_id` into `workspace.rules.ruleId`.
- Preserves existing rule fields.
- Is idempotent when the same `rule_id` already exists.
- Overwrites a different `ruleId` with the latest request `rule_id`.
- Rejects missing or empty `rule_id`.
- Rejects unknown workspace id.
- Rejects mismatched Channel Hub connection/account when validation data is available.

RestFlow migration/seed tests:

- Callback endpoint step is inserted after create-tag.
- Callback body uses the expected context references.
- Rollback removes only the callback step/endpoint created by the migration when applicable.

Event Processor tests:

- Confirm there is no Workspace-specific persistence post-processing.

## Deployment

Deploy order:

1. Workspace API — adds the callback endpoint.
2. Database migration/seed — adds the callback endpoint/step to the Create Tag REST flow.
3. Event Processor — only if cleanup removes the tactical persister from the deployed bundle.
4. Frontend — only if the register-tags action needs to change. The current frontend can keep queuing the Create Tag REST flow because the callback is inside the flow.

## Acceptance criteria

- Running Workspace “Register Tags” creates the Channel Hub rule.
- The Create Tag REST flow then calls the Workspace callback.
- `workspaces.rules.ruleId` is populated with the Channel Hub response id.
- Updating the workspace queues the Channel Hub Update Tag REST flow because `rules.ruleId` exists.
- Event Processor contains no Workspace-specific rule-id persistence code.
