# ADR-020: Public Error Code Catalog

**Status:** Accepted

**Date:** 2026-08-13

**Supersedes:** ADR-005 clauses on catalog ownership, code format, frontend mirror, and reuse. ADR-005 still governs the public HTTP error response (generic message, `metadata.request_id`, suppression, debug gate).

## Context

ADR-005 placed the canonical registry in `@kace/core` as uppercase `0xCCNNNN` hex, with a frontend mirror in `apps/kace-saas` and the rule that public codes are never reused after deletion.

That registry was duplicated and used hex letters plus HTTP gaps. Moving it to a shared workspace package (`@kace/error-codes`) removes the mirror. Closing those gaps by renumbering from `0001` would assign already-published values to new meanings. During independent Lambda and frontend deploys that produces a successful i18n lookup of the wrong message, including UI branches such as group delete.

## Decision

- `@kace/error-codes` owns the canonical public error code catalog. Consumers import that package. `@kace/core` does not re-export it.
- Canonical form is `0x` plus six decimal digits (`/^0x\d{6}$/`). The `0x` is a published prefix, not hex encoding. `x` is lowercase. Letters in the six digits are invalid.
- `apps/kace-saas` does not keep a code mirror. Locales stay keyed by constant name. `getPublicErrorCodeI18nKey(code, namespace)` requires an explicit namespace; the package does not embed `app.errors.public`.
- Public error codes are never reused after deletion or remapping. A published decimal value keeps its meaning.
- Codes that were published with hex letters receive the next unused decimal suffix in their category. Files `0x0C0001` becomes `0x120001`. Tenant `0x0F0001` becomes `0x150001`.
- HTTP keeps its historical values (`0x050001`, `0x050004`, `0x050005`, `0x050008`, `0x050009`). Gaps `0002`, `0003`, `0006`, and `0007` stay unpublished.
- Hex-letter shapes (`0x03000A`, `0x0C0001`, …) are not aliases. They do not normalize.

### Remap of hex-letter codes (2026-08-13)

| Name | Retired | Current |
|------|---------|---------|
| `BOARD_BULK_ACTIONS_INCOMPATIBLE` | `0x03000A` | `0x030029` |
| `RESOURCE_ALREADY_EXISTS` | `0x03000B` | `0x030030` |
| `INTERACTION_EMAIL_ALREADY_LINKED` | `0x03000C` | `0x030031` |
| `CASE_DESCRIPTION_EDIT_LOCKED` | `0x03000D` | `0x030032` |
| `CHANNEL_HUB_REGISTRATION_FLOW_INVALID` | `0x03000E` | `0x030033` |
| `WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED` | `0x03000F` | `0x030034` |
| `LITERAL_NAME_ALREADY_EXISTS` | `0x03001A` | `0x030035` |
| `LITERAL_TYPE_NOT_FOUND` | `0x03001B` | `0x030036` |
| `APPOINTMENT_TIME_SLOT_INVALID_TIME_RANGE` | `0x03001C` | `0x030037` |
| `APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT` | `0x03001D` | `0x030038` |
| `APPOINTMENT_TIME_SLOT_AGENDA_NOT_FOUND` | `0x03001E` | `0x030039` |
| `APPOINTMENT_TIME_SLOT_NOT_FOUND` | `0x03001F` | `0x030040` |
| `HELP_ATTACHMENT_FILENAME_REJECTED` | `0x0C0001` | `0x120001` |
| `TENANT_CONTEXT_ERROR` | `0x0F0001` | `0x150001` |

Already-decimal codes keep their published values, including `BROKER_ADAPTER_VHOST_REQUIRED` = `0x030010` through `BROKER_MAPPER_VALIDATION_FAILED` = `0x030028`, and all HTTP codes above.

The workspace-priority feature extends the catalog with validation codes `0x030044`–`0x030046`,
Channel Hub integration codes `0x060001`–`0x060003`, and queue code `0x110001`.
The configurable reopen window publishes `0x030047`–`0x030052`.
Case stale codes for client, classification and group continue at `0x030053`–`0x030055`.
The next new validation code is `0x030056`. The next new HTTP code is `0x050010`.

## Consequences

- A stale frontend bundle that still maps `0x030010` to broker-adapter copy keeps matching the backend.
- Retired hex-letter values fall through to the generic frontend message instead of a wrong specific one.
- HTTP gaps remain. New HTTP codes continue after `0x050009`.
- Support and QA read `@kace/error-codes` and this ADR, not the snapshot block in ADR-005.

## Alternatives Considered

### Recycle published values to close gaps

Consecutive `0001`…`N` per category is easier to scan. It reuses 21 published values with new meanings and silently mistranslates during deploy skew. Rejected.

### Coordinated deploy runbook without changing values

Would keep the recycling catalog and require locking 18 APIs plus CloudFront invalidation. Rejected in favor of not reusing values.

### Import `@kace/core` from the frontend

ADR-005 rejected this because it risked bundling backend code and drifting from a released core package. A zero-dependency workspace catalog removes both objections without a second mirror.

## Related ADRs

- [ADR-005](005-public-error-response-contract.md) — public error response contract
