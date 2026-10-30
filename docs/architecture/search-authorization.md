# Search Authorization

Date: 2026-04-30

## Purpose

Search authorization prevents authenticated users from broadening `/search` requests beyond the backend-approved scope for their role. The backend treats the client payload as untrusted: every inventoried `/search` handler authorizes the validated search DTO before executing existing searcher or repository logic.

Rate limiting for repeated, broad, or denied search attempts is intentionally a follow-up control and is not part of the current enforcement layer. Audit logging is part of the enforcement layer; see "Audit logging".

## Policy location

Search policies are hardcoded and version-controlled in:

- `packages/kace_cloud_api_common/src/search-authorization/SearchPolicyRegistry.js`

Each policy is keyed by a stable endpoint key such as `clients.search`, `cases.search`, or `reports.search`. `getSearchPolicy(endpointKey)` fails closed if a handler asks for an endpoint key without a registered policy.

A policy controls these fields:

| Field | What it controls |
| --- | --- |
| `baseFilter` | Mandatory filter criteria that normal users must preserve in the submitted query. Missing or changed base filters are denied. |
| `baseRelationships` | Mandatory relationship criteria that normal users must preserve. Missing or changed base relationships are denied. |
| `allowedFilters` | Additional filter fields/operators that normal users may add beyond `baseFilter`. Fields/operators not listed here are denied. |
| `requiredFilterGroups` | One-or-more groups of minimum search criteria where normal users must provide at least one meaningful, non-wildcard value from each group. |
| `allowedRelationships` | Additional relationships that normal users may add beyond `baseRelationships`, matched by relationship shape such as table/type/condition. |
| `allowedCapabilities` | Search features normal users may use, including pagination, order, relationship, select, distinct, group_by, and having. Capabilities not enabled are denied. |
| `allowedCustomQueryFields` | Non-canonical top-level query fields normal users may send. The default is an empty allowlist, so custom top-level fields fail closed unless explicitly allowed. |
| `advancedPermission` | Endpoint-specific permission required to bypass normal-user policy allowlists and submit any valid query for that endpoint. |

Default policies are generated for endpoints that do not need endpoint-specific base scopes. Sensitive endpoints such as clients, cases, users, and boards can define explicit base filters and allowlists.

## Authorization flow

`SearchAuthorizationService` lives in:

- `packages/kace_cloud_api_common/src/search-authorization/SearchAuthorizationService.js`

Handlers should follow this pattern:

1. Validate/build the effective search DTO using the endpoint's existing schema and DTO logic.
2. Call `SearchAuthorizationService.authorize({ endpointKey, user, query })` with the effective DTO.
3. Execute the existing searcher/repository with the authorized DTO returned by the service.
4. Catch `SearchAuthorizationError` and return HTTP `403 Forbidden`; other validation errors keep their existing behavior.

The service does not inject missing filters or rewrite user queries. It authorizes the DTO that will be executed. That keeps the handler behavior explicit: the query that passes authorization is the query sent to the existing search execution path.

Advanced permission checks fail closed. A helper must return strict boolean `true` for the endpoint's `advancedPermission`; truthy non-boolean values, missing helpers, or helper errors are treated as no advanced permission.

## Normal users vs. advanced users

Normal users must satisfy the policy for the endpoint:

- keep every `baseFilter` item;
- keep every `baseRelationships` item;
- use only `allowedFilters` for extra filters;
- satisfy every `requiredFilterGroups` minimum criterion group when the endpoint defines one;
- use only `allowedRelationships` for extra relationships;
- use only enabled `allowedCapabilities`;
- send no custom top-level query fields unless `allowedCustomQueryFields` includes them.

Users with the endpoint-specific `*SearchAdvanced` permission in the `search` permission category may submit any query that is otherwise valid for the endpoint's schema and implementation.

For `clients.search`, normal users must preserve the active-client base filter and also provide at least one client-specific search value such as document number, email, id, person name, surname, or company name. Empty strings and SQL wildcard-only values do not satisfy that minimum criterion.

## Custom top-level query fields

Canonical `SearchSchema` fields are `filter`, `limit`, `offset`, `order`, `relationship`, `select`, `distinct`, `group_by`, and `having`.

Any other top-level query field is denied for normal users by default. This is deliberate because non-`SearchSchema` handlers can use extra fields as hidden scope controls. If a normal-user workflow needs a custom field, the endpoint policy must explicitly allow it with `allowedCustomQueryFields`.

Current examples include:

- `case-session-duration.search`: allows `userId`, `caseId`, `page`, and `pageSize`.
- `reports.search`: allows `name`.

Advanced users are still governed by endpoint validation, but they are not restricted by the normal-user custom-field allowlist.

## Role permissions

Search permissions are a first-class role permission category named `search`.

Each search endpoint has one endpoint-specific advanced permission, for example:

- `ClientsSearchAdvanced`
- `CasesSearchAdvanced`
- `UsersSearchAdvanced`
- `BoardsSearchAdvanced`

The permission definition uses the shape:

```js
{
  role: 'search',
  module_id: '<endpoint module id>',
  name: '<EndpointSearchAdvanced>'
}
```

Role permission data includes `search` alongside the existing categories, and the frontend RoleForm exposes a Search tab/category so operators can grant endpoint-specific advanced search access.

Administrator role defaults grant these advanced search permissions as `true` to reduce breakage for existing administrator workflows. Non-administrator roles should default to no advanced search access unless explicitly granted.

## Audit logging

`SearchAuditLogger` lives in:

- `packages/kace_cloud_api_common/src/search-authorization/SearchAuditLogger.js`

It emits structured `SEARCH_AUDIT` log entries through `Helper.logInfo`, each tagged with `audit: 'search'` and an `auditEvent`:

| Event | When | Emitted by |
| --- | --- | --- |
| `search_authorized` | A query passes authorization, with `mode: 'advanced'` or `mode: 'restricted'` and the user id | `SearchAuthorizationService.authorize` |
| `search_denied` | A query violates the endpoint policy, with the denial `reason` and details | `SearchAuthorizationService` before throwing `SearchAuthorizationError` |
| `search_executed` | A search finishes executing, with `resultCount`, `totalCount`, and `isLargeResultSet` when the count meets the threshold (default 100) | Search handlers after running the searcher (e.g. `clients.search`) |

Submitted filter `value`s are redacted as `[REDACTED]` in audit entries because they can contain PII such as document numbers or emails; only the filter shape (field, operator, type) is logged.

These entries support monitoring for the suspicious patterns called out in the vulnerability report: bypass attempts surface as `search_denied` events, and mass extraction surfaces as `search_executed` events with `isLargeResultSet: true` or high-frequency repetition per `userId`.

## Follow-up controls

The current remediation enforces authorization and audit logging around search execution. Additional controls should be implemented as separate changes:

- Rate limiting or throttling for repeated denied attempts or unusually broad search traffic.
- Operational dashboards/alerts on `SEARCH_AUDIT` events (e.g. CloudWatch metric filters on `auditEvent` and `isLargeResultSet`).

## Adding a new search endpoint checklist

When adding or changing a `/search` endpoint:

1. Choose a stable endpoint key using the existing `<resource>[.<variant>].search` convention.
2. Add a policy in `SearchPolicyRegistry.js` before exposing the endpoint.
3. Define the normal-user base scope with `baseFilter` and/or `baseRelationships`.
4. Add only safe normal-user extensions to `allowedFilters`, `allowedRelationships`, and `allowedCapabilities`.
5. Add `requiredFilterGroups` when preserving a base scope is not enough to prevent broad enumeration.
6. Add `allowedCustomQueryFields` only when the handler intentionally accepts non-canonical top-level fields for normal users.
7. Confirm the generated or explicit `advancedPermission` module/name is correct and appears in the `search` permission catalog.
8. In the handler, validate/build the effective DTO, authorize with `SearchAuthorizationService`, then execute using the authorized DTO.
9. Catch `SearchAuthorizationError` as HTTP `403 Forbidden`.
10. Add/update tests and run `pnpm search-auth:check` so missing policy/enforcement coverage is caught.
11. Document any endpoint-specific deviations in this page or a linked architecture note.
