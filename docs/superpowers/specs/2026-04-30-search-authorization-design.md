# Search Authorization Enforcement Design

Date: 2026-04-30
Status: Approved design, pending implementation plan

## Problem

Security testing found that authenticated users can manipulate `/search` API payloads, remove intended filters, and retrieve data outside the intended scope. The vulnerable pattern is that the frontend sends `SearchSchema` criteria and backend endpoints often validate the payload shape and broad read permission, but then execute the client-provided filters directly.

This change addresses the authorization bypass across every `/search` endpoint in the API microservices.

## Goals

- Enforce a hardcoded backend search policy for every `/search` endpoint.
- Prevent non-advanced users from removing, changing, or bypassing each endpoint's mandatory base query.
- Allow each endpoint to define safe extra filters and safe extra relationships for normal users.
- Add endpoint-level advanced search permissions in Role Details.
- Preserve administrator workflows by granting advanced search permissions to administrator roles by default.
- Cover all existing `actionSearch` handlers in one rollout.

## Non-goals for Phase 1

- Rate limiting search endpoints.
- Full audit logging for suspicious search patterns.
- Admin-configurable base queries.
- Field-level dynamic advanced permissions.
- Replacing the existing `SearchSchema`, `Criteria`, searchers, or repositories.

Audit logging and rate limiting remain explicit follow-up changes after authorization enforcement lands.

## Architecture

Use a shared authorization layer that every `/search` handler calls before invoking existing searcher/repository logic.

### Shared components

#### SearchAuthorizationService

A shared service validates a submitted search query against an endpoint policy and current user.

Responsibilities:

1. Resolve endpoint policy by endpoint key.
2. Check whether the user has the endpoint's advanced search permission.
3. If advanced permission is granted, allow any existing `SearchSchema`-valid query.
4. If advanced permission is not granted:
   - verify submitted filters include and preserve the hardcoded base filter;
   - verify submitted relationships include and preserve hardcoded base relationships;
   - verify additional filters are allowlisted for the endpoint;
   - verify additional relationships are allowlisted for the endpoint;
   - verify extra query capabilities are allowed by endpoint policy.
5. Return the original submitted query if authorized, or throw/return an authorization failure if not.

The service does not build or inject the effective query. The client continues to submit the full query, and the backend compares that query against the policy before execution.

#### Search policy registry

Each `/search` endpoint has a hardcoded policy, version-controlled in backend code.

Policy shape:

```js
{
  endpointKey: 'clients.search',
  advancedPermission: {
    role: 'search',
    module_id: 'clients',
    name: 'ClientsSearchAdvanced'
  },
  baseFilter: [
    // mandatory filter criteria expected in the submitted request
  ],
  baseRelationships: [
    // mandatory relationship criteria expected in the submitted request
  ],
  allowedFilters: [
    { field: 'documento', operators: ['eq', 'like', 'ilike'] },
    { field: 'nombres', operators: ['like', 'ilike'] }
  ],
  allowedRelationships: [
    // allowed extra relationships beyond baseRelationships
  ],
  allowedCapabilities: {
    order: true,
    pagination: true,
    select: false,
    distinct: false,
    group_by: false,
    having: false
  },
  allowedCustomQueryFields: []
}
```

The exact base filters and allowlists are defined per endpoint during implementation.

## Authorization behavior

### Advanced users

If the user has the endpoint advanced permission, the request is allowed after the current `SearchSchema` validation succeeds. The user may send any valid filters, relationships, ordering, pagination, select, distinct, group_by, and having supported by the endpoint's existing schema and implementation.

### Normal users

If the user does not have the endpoint advanced permission, the submitted query must satisfy all policy checks:

- It includes the endpoint's required `baseFilter` without removing or contradicting it.
- It includes the endpoint's required `baseRelationships` without removing or contradicting them.
- Any extra filter uses a field/operator allowed by `allowedFilters`.
- Any extra relationship matches `allowedRelationships` by table, type, and condition.
- Query capabilities such as `select`, `distinct`, `group_by`, and `having` are rejected unless explicitly enabled by the endpoint policy.
- Custom top-level query fields outside the canonical search schema are rejected unless explicitly listed in `allowedCustomQueryFields`.

Authorized normal-user requests execute exactly as submitted. Unauthorized requests are rejected and do not reach existing searchers/repositories.

### Custom top-level fields

Normal users fail closed on non-canonical top-level fields. Endpoints that intentionally accept fields outside `SearchSchema` must explicitly allow them with `allowedCustomQueryFields`; this is currently needed for non-`SearchSchema` handlers such as `case-session-duration.search` and `reports.search`.

## Role permissions UI and data model

Add a new Role Details tab named **Search permissions** beside the existing Agent, Administrator, and Auxiliaries permission tabs.

The tab lists endpoint-level advanced search permissions, one checkbox per `/search` endpoint. Examples:

- `ClientsSearchAdvanced`
- `CasesSearchAdvanced`
- `UsersSearchAdvanced`
- `BoardsSearchAdvanced`

Role JSON gains a separate `search` category:

```js
{
  agente: [...],
  administrador: [...],
  auxiliaries: [...],
  search: [
    {
      module_id: 'clients',
      name: 'ClientsSearchAdvanced',
      description: 'Use advanced search filters on clients search',
      granted: true
    }
  ]
}
```

Defaults:

- Administrator roles default these permissions to `true` to reduce breaking changes.
- Non-administrator roles default these permissions to `false`.

Validation must be updated so `search` is a first-class permission category accepted by role schemas, permission value objects, merge logic, and the role form.

## Error handling

For non-advanced users with disallowed queries:

- Return HTTP `403 Forbidden`.
- Use a generic user-facing message, for example: `Search query is not allowed for this role.`
- Log internal details such as endpoint key and denial reason for developer diagnostics without exposing sensitive scope details to the caller.

Existing validation errors from `SearchSchema` remain validation failures.

## Migration plan constraints

Implementation must cover all existing `/search` handlers in one rollout.

Required migration steps:

1. Inventory all `actionSearch` handlers and `/search` route variants.
2. Assign a stable endpoint key to each search endpoint.
3. Define a policy for every endpoint before enabling enforcement.
4. Add the shared enforcement call before each endpoint invokes its searcher/repository.
5. Add the new `search` permission category and endpoint advanced permissions to the canonical permissions list.
6. Update Role Details UI to display and save search permissions.
7. Ensure administrator role defaults grant advanced search permissions.

No search handler should ship without a policy and enforcement path.

## Testing strategy

### Unit tests

Add tests for the shared authorization service:

- advanced permission allows any `SearchSchema`-valid query;
- missing base filter rejects normal user;
- modified/contradictory base filter rejects normal user;
- disallowed extra filter field rejects normal user;
- disallowed extra filter operator rejects normal user;
- missing base relationship rejects normal user;
- disallowed extra relationship rejects normal user;
- allowed base query plus allowlisted filters/relationships passes;
- disabled capabilities like `select`, `distinct`, `group_by`, `having` reject unless policy enables them.

### Integration tests

Add representative endpoint tests for sensitive searches, at minimum clients/cases/users/boards if available in the test harness:

- normal user cannot remove or change base query;
- normal user can use allowed filters/relationships;
- normal user is rejected for disallowed filters/relationships;
- administrator/advanced user can use custom valid queries.

### Inventory/coverage tests

Add a test or script that fails if an `actionSearch` handler or `/search` route does not have a corresponding search authorization policy/enforcement marker.

## Open implementation details

These are implementation details to decide during planning, not design blockers:

- Exact file location for `SearchAuthorizationService` and policy registry (`@kace/api-common` vs `@kace/core/src/shared`).
- Exact endpoint key naming convention.
- Exact base filters, base relationships, allowed filters, and allowed relationships for each endpoint.
- Exact compatibility mechanism for updating existing role records with new `search` permissions.

## Approved decisions

- Use a global advanced search permission per endpoint, not field-level advanced permissions.
- Hardcode base queries in backend code, not in the UI.
- Users with endpoint advanced permission may send any valid `SearchSchema` query.
- Normal users use hardcoded base query plus endpoint allowlists for extra filters and relationships.
- Use a shared service and policy registry called by every search handler.
- Cover all existing search handlers in one rollout.
- Default advanced search permissions to `true` for administrator roles to reduce breakage.
- Defer audit logging and rate limiting to follow-up changes.
