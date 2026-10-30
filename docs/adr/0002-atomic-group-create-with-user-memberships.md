# Atomic Group creation with User-Group Memberships

## Status

Accepted.

## Context

Creating a Group and then adding its selected users through a second HTTP request can leave a Group without the intended memberships. The create endpoint therefore needs one database consistency boundary for the Group, its history, the initial User-Group Memberships, and their history.

The existing `CREATE_GROUP` action hook is a separate concern. Action implementations may perform external I/O, which cannot be rolled back by the Group database transaction.

## Decision

- Validate all selected user ids before writing.
- Persist the Group, Group history, initial User-Group Memberships, and membership history in one database transaction.
- Run `CREATE_GROUP` actions only after the database transaction commits. This avoids holding database locks across external I/O and avoids publishing an external effect for a transaction that may still roll back.
- Do not describe post-create action execution as part of the database atomicity guarantee.

## Consequences

A membership write failure rolls back every database record created for the request. A later `CREATE_GROUP` action failure does not roll back the already committed Group and memberships; the failure remains visible to the caller and operations logs.

If atomic, retryable delivery of post-create actions becomes a product requirement, implement a transactional outbox with idempotent consumers. Moving external action execution inside the database transaction would not provide that guarantee.
