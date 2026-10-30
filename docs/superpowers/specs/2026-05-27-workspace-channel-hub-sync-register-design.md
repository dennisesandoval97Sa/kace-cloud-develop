# Workspace Channel Hub Sync Register Design

## Goal

Register a Workspace Channel Hub email rule exactly once, persist the returned Channel Hub rule id on the workspace, and remove the Workspace callback step from the create-tag RESTflow.

This design supersedes `docs/superpowers/specs/2026-05-22-workspace-channel-hub-rule-callback-design.md` for the standard Workspace "Register Tags" path.

## Problem

The current Workspace "Register Tags" UI queues the generic create-tag RESTflow directly through `/ws-hook-rest-flows`. The flow creates a remote Channel Hub email rule, then a callback step calls back into Workspace API to persist the returned rule id.

That direction has two problems:

- The RESTflow diagram now contains Workspace state persistence, which makes the integration flow harder to reason about.
- The UI can run "Register Tags" again after a workspace already has `rules.ruleId`, creating another remote Channel Hub rule for the same workspace.

The Channel Hub create-rule endpoint returns the created rule directly:

```json
{
  "id": "3EJTuLucMyGCOmCcJehd6yT9Ywk",
  "connectionId": "3E3JxxVtXmywYZIvIlyZTKBtaBQ",
  "ruleName": "juanfer",
  "subjectContains": ["super", "juanfer", "goku", "vegueta"],
  "actionRules": {
    "classifyAs": "juanfer"
  },
  "webhooks": []
}
```

The create-tag REST endpoint stores that response at:

```txt
context.channel_hub_tag.response
```

So the created rule id is available at:

```txt
context.channel_hub_tag.response.id
```

## Decision

Move Workspace rule registration into a Workspace-owned synchronous command:

```txt
POST /workspaces/{workspaceId}/channel-hub-tags/register
```

Architecture rule:

```txt
RESTflows execute integration steps.
Workspace API owns Workspace state.
```

The frontend calls the Workspace command. Workspace API loads the workspace, validates that it has not already registered a Channel Hub rule, executes the configured create-tag RESTflow synchronously, extracts `context.channel_hub_tag.response.id`, and persists that id into `workspaces.rules.ruleId`.

The standard create-tag RESTflow no longer calls a Workspace callback endpoint.

## Non-goals

- Do not introduce a new `workspace_channel_hub_rules` table in this iteration.
- Do not redesign update-tag or delete-tag behavior.
- Do not make the frontend extract the Channel Hub rule id and update the workspace.
- Do not keep a callback endpoint or callback step for the standard create-tag path.
- Do not add a force-reregister or repair workflow in this iteration.

## API Contract

### Register Tags

```txt
POST /workspaces/{workspaceId}/channel-hub-tags/register
```

Request body:

```json
{}
```

The endpoint uses the workspace id from the route and builds the RESTflow context from persisted Workspace data. The frontend must not send a full workspace snapshot or `channel_hub_tag` payload.

Success response:

```json
{
  "message": "Success",
  "data": {
    "workspace_id": "95346f17-4ee8-420d-a0af-16d2ac394dd9",
    "rule_id": "3EJTuLucMyGCOmCcJehd6yT9Ywk",
    "connection_id": "3E3JxxVtXmywYZIvIlyZTKBtaBQ"
  }
}
```

If an execution id is available from the synchronous RESTflow execution path, include it:

```json
{
  "data": {
    "workspace_id": "95346f17-4ee8-420d-a0af-16d2ac394dd9",
    "rule_id": "3EJTuLucMyGCOmCcJehd6yT9Ywk",
    "connection_id": "3E3JxxVtXmywYZIvIlyZTKBtaBQ",
    "execution_id": "fa42817b-d264-4d3b-94f9-f041cd5332b8"
  }
}
```

The first implementation may omit `execution_id` if exposing it requires changing the generic RESTflow response shape.

## Register Flow

The endpoint performs these steps:

1. Authenticate the current user and require `WorkspacesUpdate`.
2. Validate `workspaceId`.
3. Load the workspace fresh from the database.
4. Reject if the workspace does not exist.
5. Reject if `workspace.rules.ruleId` is already present.
6. Reject if `tag_creation_flow_id` is missing.
7. Reject if the workspace does not have exactly one usable Channel Hub account with a `channel_hub_connection_id`.
8. Build the create-tag RESTflow initial context server-side.
9. Execute the configured `tag_creation_flow_id` synchronously.
10. Extract `context.channel_hub_tag.response.id`.
11. Persist the extracted id into `workspaces.rules.ruleId`, preserving all existing rule fields.
12. Return the persisted rule id.

The server-side initial context has this shape:

```js
{
  source: "workspaces.register_tags",
  tenant_id,
  kace_api_base_url,
  workspace,
  channel_hub_tag: {
    connectionId,
    ruleName,
    subjectContains,
    subjectEquals,
    toContains,
    toEquals,
    bodyContains,
    bodyEquals,
    ccContains,
    ccEquals,
    fromContains,
    fromEquals,
    actionRules,
    webhooks
  }
}
```

Only non-empty rule arrays should be sent in `channel_hub_tag`, matching the existing Workspace register/update context behavior.

## RESTflow Changes

The standard create-tag RESTflow should be:

```txt
1. Channel Hub auth
2. Channel Hub - Normalize email rule body
3. Channel Hub - Crear Tag (email rule)
```

Remove this callback step from the standard create-tag RESTflow:

```txt
Workspace - Persist Channel Hub Rule Id
```

Remove the Workspace callback route from the Workspace API:

```txt
POST /workspaces/{workspaceId}/channel-hub-tags/rule-created
```

The create-tag endpoint should keep storing the Channel Hub response at:

```txt
channel_hub_tag.response
```

## Persistence Behavior

The register command updates:

```txt
workspaces.rules.ruleId
```

It must preserve all existing rule fields:

```json
{
  "ruleName": "juanfer",
  "subjectContains": ["super", "juanfer", "goku", "vegueta"],
  "actionRules": {
    "classifyAs": "juanfer"
  },
  "ruleId": "3EJTuLucMyGCOmCcJehd6yT9Ywk"
}
```

Duplicate prevention:

- If `rules.ruleId` exists before the RESTflow is executed, return `409 Conflict`.
- Do not run the create-tag RESTflow in that case.
- Do not overwrite an existing `rules.ruleId` in the normal register command.

## Error Handling

Return `404 Not Found` when the workspace does not exist.

Return `409 Conflict` when:

- `rules.ruleId` already exists.
- `tag_creation_flow_id` is missing.
- No usable Channel Hub account is attached to the workspace.
- The attached Channel Hub account is missing `channel_hub_connection_id`.

Return an integration failure when:

- The synchronous RESTflow execution fails.
- The RESTflow completes but does not expose `context.channel_hub_tag.response.id`.

If Channel Hub creates the rule successfully but persisting `workspaces.rules.ruleId` fails, the endpoint must try to remove the remote rule as a best-effort compensation step before returning.

The compensation step uses:

```txt
connectionId = context.channel_hub_tag.response.connectionId
ruleId = context.channel_hub_tag.response.id
```

The first implementation should use the configured Workspace `tag_deletion_flow_id` with a complete `channel_hub_tag` context. If that flow is unavailable or cannot run, the endpoint must log the remote rule details for manual cleanup and return a failure. Skipping cleanup silently is not allowed.

Cleanup failure logs must include:

- `workspace_id`
- `connection_id`
- `rule_id`
- create RESTflow execution id, if available

## Frontend Behavior

The Workspaces row action should show "Register Tags" only when:

```txt
workspace.tag_creation_flow_id exists
and workspace.rules.ruleId does not exist
```

The action calls:

```txt
POST /workspaces/{workspaceId}/channel-hub-tags/register
```

The frontend should pass only the workspace id. It should no longer build `channel_hub_tag` and should no longer call `/ws-hook-rest-flows` for this action.

On success:

- Invalidate the Workspaces query.
- Show the existing success toast.

On `409 Conflict`:

- Show a setup-specific message when possible.
- For duplicate registration, show that the workspace already has a Channel Hub rule.
- Invalidate the Workspaces query so the row action disappears if the local table data is stale.

## Tests

Workspace API tests:

- Registers tags through the new Workspace endpoint.
- Requires `WorkspacesUpdate`.
- Rejects an invalid workspace id.
- Rejects an unknown workspace id.
- Rejects when `rules.ruleId` already exists without running the RESTflow.
- Rejects when `tag_creation_flow_id` is missing.
- Rejects when no usable Channel Hub account or connection id exists.
- Builds the create-tag RESTflow context from persisted workspace data.
- Executes the configured create-tag RESTflow synchronously.
- Extracts `context.channel_hub_tag.response.id`.
- Persists `rules.ruleId` while preserving existing rule fields.
- Returns integration failure when the RESTflow response lacks a rule id.
- Attempts remote cleanup when persistence fails after remote rule creation.
- Removes or rejects the old callback route.

RESTflow migration/seed tests:

- The standard create-tag RESTflow no longer contains `Workspace - Persist Channel Hub Rule Id`.
- The callback endpoint row is removed when owned by the previous migration.
- The create-tag endpoint still stores its response at `channel_hub_tag.response`.
- The migration is idempotent.

Frontend tests:

- Hides "Register Tags" when `rules.ruleId` exists.
- Shows "Register Tags" when `tag_creation_flow_id` exists and `rules.ruleId` is missing.
- Calls the Workspace register endpoint with only the workspace id.
- Does not call `/ws-hook-rest-flows`.
- Handles duplicate/setup `409 Conflict` responses with an error toast and Workspaces query invalidation.

## Deployment

Deploy order:

1. Workspace API with the new synchronous register endpoint and callback route removal.
2. Database migration/seed cleanup that removes the callback step from the standard create-tag RESTflow.
3. Frontend update that calls the Workspace register endpoint and hides the action after `rules.ruleId` exists.

The deployment should confirm that the standard create-tag RESTflow in the editor no longer shows the callback node.

## Acceptance Criteria

- Running Workspace "Register Tags" creates one Channel Hub email rule.
- The response id from `context.channel_hub_tag.response.id` is persisted into `workspaces.rules.ruleId`.
- A second register attempt for the same workspace returns `409 Conflict` and does not call Channel Hub.
- The create-tag RESTflow no longer contains a Workspace callback step.
- The old callback endpoint is removed or no longer routable.
- Updating the workspace continues to queue the Channel Hub update-tag flow because `rules.ruleId` exists.
