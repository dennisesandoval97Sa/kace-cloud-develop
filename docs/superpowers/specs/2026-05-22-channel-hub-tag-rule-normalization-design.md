# Channel Hub tag rule normalization design

Date: 2026-05-22

## Goal

Make the Channel Hub create-tag/email-rule REST flow send a valid request body when Workspace rule fields have Channel Hub logical constraints, while keeping REST endpoint bodies declarative and visible in the frontend editor.

## Problem

The current create-tag endpoint body can be configured as a compact dynamic body:

```json
{
    "body": "context.channel_hub_tag"
}
```

At runtime this forwards the whole `channel_hub_tag` object. That is too permissive for Channel Hub email rules because some fields are mutually exclusive, for example `subjectContains` must not be sent together with `subjectEquals`.

The REST endpoint body field only performs context/template replacement. It does not support conditional logic such as `if`, `xor`, priority selection, or omitting empty/conflicting keys. Also, the current frontend JSON editor displays whole-body context references as `JSON Empty`, hiding a real configured value.

## Decisions

- Add a reusable REST Function type named `normalizeChannelHubRule`.
- Use the function as a workflow step before the Channel Hub create-tag endpoint.
- Keep endpoint bodies declarative; do not encode logical rules in the endpoint `body` field.
- Write the normalized request to `context.channel_hub_tag_request`.
- Update the create-tag endpoint body to:

```json
{
    "body": "context.channel_hub_tag_request"
}
```

- When both `*Contains` and `*Equals` have content for the same rule family, `*Contains` wins and `*Equals` is omitted.
- Fix the frontend Body editor so compact context-reference bodies are shown and round-tripped, not displayed as empty JSON.

## Normalization contract

Input path:

```txt
context.channel_hub_tag
```

Output path:

```txt
context.channel_hub_tag_request
```

The `normalizeChannelHubRule` function receives a Channel Hub rule object and returns a cleaned payload ready for the create-tag endpoint.

It must preserve non-empty base fields:

- `connectionId`
- `ruleName`
- `actionRules`
- `webhooks` when present

It must remove optional fields whose values are empty arrays, empty strings, `null`, or `undefined`.

It must apply these conflict priorities:

| Winner | Omitted when winner has content |
| --- | --- |
| `subjectContains` | `subjectEquals` |
| `toContains` | `toEquals` |
| `bodyContains` | `bodyEquals` |
| `ccContains` | `ccEquals` |
| `fromContains` | `fromEquals` |

Example input:

```json
{
    "connectionId": "connection-id",
    "ruleName": "support",
    "subjectContains": ["billing"],
    "subjectEquals": ["Billing exact"],
    "bodyContains": [],
    "bodyEquals": ["urgent"],
    "actionRules": {
        "classifyAs": "support"
    }
}
```

Example output:

```json
{
    "connectionId": "connection-id",
    "ruleName": "support",
    "subjectContains": ["billing"],
    "bodyEquals": ["urgent"],
    "actionRules": {
        "classifyAs": "support"
    }
}
```

## Flow architecture

The create-tag flow should execute in this order:

```txt
Initial context
  └─ channel_hub_tag

Step 1: REST Function
  type: normalizeChannelHubRule
  filter_input: channel_hub_tag
  context_position: channel_hub_tag_request

Step 2: REST Endpoint
  body: { "body": "context.channel_hub_tag_request" }
```

This keeps business/request-normalization logic in a reusable backend function and keeps endpoint configuration focused on transport details.

## Frontend body editor behavior

For `body_type = "json"`, the Body editor must support both JSON object bodies and whole-body context references.

Object body example:

```json
{
    "connectionId": "context.channel_hub_tag.connectionId",
    "ruleName": "context.channel_hub_tag.ruleName"
}
```

Whole-body context reference example:

```txt
context.channel_hub_tag_request
```

When the persisted endpoint body is:

```json
{
    "body": "context.channel_hub_tag_request"
}
```

The edit screen must show `context.channel_hub_tag_request` clearly instead of `JSON Empty`, and saving must preserve the same persisted shape.

A small Body editor mode is acceptable:

```txt
JSON Object | Context reference | Plain text
```

`Plain text` remains mapped to `body_type = "plain_text"`; `Context reference` remains `body_type = "json"` with a string under the `body` wrapper.

## Error behavior

The normalizer should be forgiving for optional rule fields:

- omit empty arrays
- omit empty strings
- omit `null` and `undefined`
- resolve `Contains`/`Equals` conflicts by keeping `Contains`

The normalizer should be strict for required request fields. It should fail before the HTTP endpoint is called when required data is missing, including:

- missing/empty `connectionId`
- missing/empty `ruleName`
- missing/empty `actionRules.classifyAs` for this Workspace tag-registration flow

## Expected code changes

- Add `normalizeChannelHubRule` to the REST Function type enum.
- Implement the function in the REST Function domain executor.
- Expose the new function type in frontend REST Function type options/translations if required by existing UI patterns.
- Add a migration/seed update that:
  - creates or ensures the `normalizeChannelHubRule` REST Function row,
  - inserts the function workflow step before the Channel Hub create-tag endpoint step,
  - updates the create-tag endpoint body to `{ "body": "context.channel_hub_tag_request" }`.
- Update the REST endpoint Body editor and helper parsing/saving logic so whole-body context references display and round-trip correctly.

## Testing

Backend tests:

- `normalizeChannelHubRule` omits empty optional fields.
- `subjectContains` wins over `subjectEquals`.
- `toContains` wins over `toEquals`.
- `bodyContains` wins over `bodyEquals`.
- `ccContains` wins over `ccEquals`.
- `fromContains` wins over `fromEquals`.
- The normalizer preserves `connectionId`, `ruleName`, `actionRules`, and optional `webhooks`.
- The normalizer fails clearly when required base fields are missing.
- Workflow execution stores the normalized output at `context.channel_hub_tag_request` and the endpoint sends that object.

Frontend tests:

- Persisted body `{ "body": "context.channel_hub_tag_request" }` displays as a context reference, not `JSON Empty`.
- Saving a context-reference body preserves `{ "body": "context.channel_hub_tag_request" }`.
- Existing JSON object body editing still works.
- Existing `plain_text` body editing still works.

Migration/seed tests:

- The create-tag endpoint body is updated to `context.channel_hub_tag_request`.
- The normalizer function step is inserted before the create-tag endpoint step.
- The migration is idempotent and does not duplicate workflow steps.

## Out of scope

- Adding a general conditional/DSL language to REST endpoint body fields.
- Changing Channel Hub inbound email routing.
- Changing Workspace rule editing UX beyond what is needed for the create-tag flow.
- Solving all possible Channel Hub rule validation; this design covers the known mutually exclusive `Contains`/`Equals` pairs and required base fields.
