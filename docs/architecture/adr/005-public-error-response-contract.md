# ADR-005: Public Error Response Contract

**Status:** Accepted — catalog ownership, `0xCCNNNN` format, frontend mirror, and reuse rule superseded by [ADR-020](020-public-error-code-catalog.md). This ADR still governs the public HTTP error response.

## Context

The WSTG-ERRH-01 report identified that the Custom Lists create flow on `api.testkace.com` exposes backend validation details such as Joi field paths and validation rules. The same risk can appear across other API controllers because many services use the shared `@kace/api-common` response helpers.

KACE Cloud needs client-facing errors that support troubleshooting and frontend behavior without revealing stack traces, database details, validation internals, tenant lookup details, or implementation-specific exception messages.

## Decision

KACE Cloud will use a public error response contract for API failures.

- `@kace/core` owns the canonical public error code registry.
- Public error codes use fixed-width uppercase strings in the format `0xCCNNNN`, where `CC` is the category and `NNNN` is a category-local sequence.
- Existing public error codes are migrated immediately to the fixed-width format; for example, auth codes move from `0x07xx` to `0x0700xx`.
- `@kace/api-common` owns public response serialization for API errors.
- Production responses return a generic message, a public error code, and `metadata.request_id` for support correlation.
- Production responses suppress diagnostic details such as Joi field paths, validation rule text, stack traces, SQL/database messages, tenant lookup details, and internal exception names.
- Whenever a response suppresses those details, `@kace/api-common` writes them to the service log as a single `Response::suppressedErrorDetail` entry carrying `request_id`, the public error code, the HTTP status, the route, the original message, the exception name and stack, and the validation breakdown. Suppressing detail must never mean losing it: this entry is the only surviving record of the real cause, and the request id is what ties it back to what the user saw.
- Outside production, whether a response may also carry those details is decided by the same debug chain `Helper` uses for logging, so a single deploy-time switch drives both: `process.env.APPS_DEBUG` wins, then the deprecated `process.env.APPS_DEBUG_OVERRIDE`, then the per-tenant `apps_debug` attribute. Env values `'true'`/`'1'` enable and `'false'`/`'0'` disable; anything else (including `''` or unset) falls through to the next level.
- Debug never unlocks response detail in production. When `NODE_ENV` or `APPS_ENVIRONMENT` names a production runtime — and when neither is declared at all — the response stays generic however the debug chain resolves.
- `apps/kace-saas` keeps a frontend mirror of public error codes for translations and UI behavior, with drift protection against the canonical `@kace/core` registry.
- HTTP status remains separate from the public error code.
- Public error codes are opaque to users; frontend code may translate exact codes but should not infer behavior from numeric ranges except as a fallback.
- Public error codes are never reused after deletion.

The block below is the 2026-06-17 snapshot. Current values live in `@kace/error-codes` and [ADR-020](020-public-error-code-catalog.md).

The initial public error code set was:

```javascript
export const GENERAL_INTERNAL_ERROR = '0x010001';

export const VALIDATION_ERROR = '0x030001';
export const CASE_BULK_TRANSITION_MIXED_CURRENT_TRANSITION = '0x030002';
export const CASE_TRANSITION_NOT_ALLOWED = '0x030003';
export const CASE_TRANSITION_CONDITIONS_NOT_MET = '0x030004';
export const CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE = '0x030005';
export const BOARD_REQUIRES_ACTIVE_GROUP = '0x030006';
export const BOARD_EXPORT_NO_RECORDS = '0x030007';
export const AUXILIARY_RECORD_HAS_MAIN_ENTITY_DEPENDENCY = '0x030008';
export const CLASSIFICATION_GROUP_RELATION_NOT_FOUND = '0x030009';
export const BOARD_BULK_ACTIONS_INCOMPATIBLE = '0x03000A';

export const DATABASE_ERROR = '0x040001';

export const BAD_REQUEST_ERROR = '0x050001';
export const NOT_FOUND_ERROR = '0x050004';
export const METHOD_NOT_ALLOWED_ERROR = '0x050005';
export const REQUEST_TIMEOUT_ERROR = '0x050008';
export const CONFLICT_ERROR = '0x050009';

export const AUTH_FINGERPRINT_MISMATCH = '0x070001';
export const AUTH_GET_TOKEN_CLAIMS = '0x070002';
export const AUTH_USER_NOT_FOUND = '0x070003';
export const AUTH_USER_INACTIVE = '0x070004';
export const AUTH_SESSION_KEY_MISMATCH = '0x070005';
export const AUTH_NOT_USER_AUTHENTICATED = '0x070006';
export const AUTH_SESSION_ACTIVE_ON_ANOTHER_DEVICE = '0x070007';
export const AUTH_SESSION_COOKIE_STALE = '0x070008';

export const AUTHORIZATION_ERROR = '0x080001';

export const TENANT_CONTEXT_ERROR = '0x0F0001';
```

## Consequences

- The WSTG-ERRH-01 class of information disclosure is handled at the shared API response boundary instead of one controller at a time.
- Custom Lists remains the regression proof because it is the finding evidence, but the shared contract applies to all APIs using `@kace/api-common`.
- Frontend field-level UX must rely on frontend validation, not backend validation internals.
- Support workflows use `metadata.request_id` and public error code to correlate user-visible failures with internal logs.
- Existing clients that consume `errors` arrays from production API validation failures need migration to code-based handling.
- Existing clients that parse short auth codes need migration to fixed-width auth codes.
- Debug detail must not be enabled for production tenants; `APPS_DEBUG` is the deploy-time switch that vetoes a tenant's `apps_debug` flag outside production.
- Diagnosing a production failure means reading `Response::suppressedErrorDetail` in CloudWatch for the reported `request_id`, not reproducing it with debug on.

## Migration Guidance

The initial implementation should be delivered in one pull request because backend response serialization and frontend error interpretation change together. The work should be split into small reviewable sections:

- `@kace/core`: migrate and add public error codes.
- `@kace/api-common`: add central public error serialization and a production-safe debug gate.
- `withTenantContext`: return the shared public error response instead of raw tenant errors.
- `apps/kace-saas`: add the public error code mirror, code-based translation fallback, and remove dependency on backend validation details for generic mutation toasts.
- Tests: cover the response contract, frontend mirror drift, and the Custom Lists WSTG-ERRH-01 regression.

## Alternatives Considered

### Keep detailed validation errors in production

This preserves richer frontend field-level feedback from backend responses, but it directly conflicts with the report findings because field paths and validation rules disclose backend implementation details.

### Patch only the Custom Lists controller

This would address the reported example but leave the same shared response behavior available across other APIs. It would also make client error handling inconsistent.

### Import backend constants directly in the frontend

Direct imports risk bundling backend-only code and can be stale because `apps/kace-saas` depends on a released `@kace/core` package. A verified frontend mirror keeps the UI decoupled while preventing drift.
