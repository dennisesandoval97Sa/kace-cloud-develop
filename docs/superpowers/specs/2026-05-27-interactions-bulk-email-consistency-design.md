# Interactions Bulk Email Consistency Design

## Context

Bulk interaction actions currently update only the `interactions` table. This leaves linked email data inconsistent in two cases:

- Moving an interaction changes `interactions.workspace_id`, but the linked `emails.workspace_id` remains in the original workspace.
- Deleting an interaction soft-deletes the interaction, but the linked email content remains visible through email-centric reads.

Inbound Channel Hub email processing creates one `Email` and one `Interaction` with the same workspace, and the interaction references the email via `interactions.email_id`. Bulk actions should preserve that relationship when the interaction is moved or deleted.

## Goals

- Keep interaction and email workspace data consistent after bulk move.
- Soft-delete the complete linked email aggregate after bulk delete.
- Preserve current bulk API payloads and frontend behavior.
- Keep bulk operations all-or-nothing inside the existing transaction.
- Avoid changing bulk close behavior.

## Non-goals

- No new bulk API routes or payload fields.
- No database triggers.
- No partial-success bulk operations.
- No email changes when closing interactions.
- No hard deletion of email, email body, or email attachment rows.

## Decisions

- Use the existing interaction bulk application services and `KnexInteractionRepository` transaction boundary.
- Add focused repository helpers for linked email updates instead of introducing a separate injected email repository for this small consistency fix.
- Treat missing linked email rows as non-fatal so legacy or non-email interactions can still be moved or deleted.
- Soft-delete the full linked email aggregate on interaction delete:
  - `emails`
  - `emails_body`
  - `emails_attachments`

## Behavior

### Bulk move

When `POST /interactions-bulk/move` succeeds:

1. Validate and lock selected interactions as today.
2. Filter to interactions whose `workspace_id` actually changes.
3. Update those interactions with the destination `workspace_id`, `updated_at`, and `updated_by`.
4. For the moved interactions that have `email_id`, update matching non-deleted `emails` rows with:
   - `workspace_id` = destination workspace
   - `updated_at` = same timestamp used for the interaction update
   - `updated_by` = same user used for the interaction update
5. Save interaction history as today.

Interactions already in the destination workspace remain unchanged, and their linked emails are not touched.

### Bulk delete

When `POST /interactions-bulk/delete` succeeds:

1. Validate motive and lock selected interactions as today.
2. Soft-delete selected interactions with `deleted_at`, `deleted_by`, and `delete_observation`.
3. For selected interactions that have `email_id`, soft-delete matching non-deleted rows in:
   - `emails`
   - `emails_body`
   - `emails_attachments`
4. Use the same `deleted_at` and `deleted_by` values across the interaction and email aggregate.
5. Save interaction history as today.

### Bulk close

`POST /interactions-bulk/close` remains unchanged. It updates only interaction close fields and history. It must not update or delete linked email rows.

## Architecture

### Application services

`InteractionBulkMover` remains responsible for move validation and orchestration. After `bulkMove(...)`, it calls a repository helper for linked email workspace sync using the already-filtered `interactionsToMove` list.

`InteractionBulkDeleter` remains responsible for delete validation and orchestration. After `bulkDelete(...)`, it calls a repository helper to soft-delete linked email aggregate rows for the selected interactions.

`InteractionBulkCloser` has no email dependency and no behavior change.

### Repository helpers

Extend `KnexInteractionRepository` with email-focused helpers executed inside the existing transaction:

- `bulkMoveLinkedEmails(interactions, values, { trx })`
  - Extract non-empty `email_id` values from the provided interactions.
  - De-duplicate email IDs.
  - Update non-deleted `emails` rows where `id in emailIds`.
  - Set `workspace_id`, `updated_at`, and `updated_by`.

- `bulkSoftDeleteLinkedEmailAggregate(interactions, values, { trx })`
  - Extract non-empty `email_id` values from the provided interactions.
  - De-duplicate email IDs.
  - Update non-deleted rows in `emails`, `emails_body`, and `emails_attachments`.
  - Set `deleted_at` and `deleted_by`.

These helpers should return safely without issuing updates when no email IDs are present.

## Transaction and error handling

- Move and delete email updates run in the same transaction as the interaction updates.
- Existing validation failures still abort the full operation before writes.
- If an email update/delete query fails, the transaction rolls back the interaction update too.
- If no linked email row exists for an `email_id`, the operation still succeeds because the email-side update affects zero rows.
- The helpers should ignore already-deleted email aggregate rows by using `whereNull('deleted_at')`.

## Testing

### Unit tests

Add coverage in interaction bulk service tests:

- Bulk move calls the linked-email workspace sync helper only for interactions that actually moved.
- Bulk move does not call the email sync helper when the move is rejected as a no-op.
- Bulk delete calls the linked-email aggregate soft-delete helper with the same `deleted_at` and `deleted_by` values used for interactions.
- Bulk close has no email helper calls.
- Interactions without `email_id` do not fail move or delete.

### Integration or E2E tests

Where practical, add backend coverage that persists an interaction linked to an email and verifies:

- After bulk move, `interactions.workspace_id` and `emails.workspace_id` both equal the destination workspace.
- After bulk delete, linked rows in `emails`, `emails_body`, and `emails_attachments` have `deleted_at` and `deleted_by` set.
- After bulk close, linked email rows remain unchanged.

## Risks and mitigations

- **Risk:** Interaction repository gains knowledge of email tables.
  - **Mitigation:** Keep the helpers narrow, private to the bulk consistency use case, and avoid broader email repository responsibilities.

- **Risk:** Legacy interactions may have missing or null `email_id` values.
  - **Mitigation:** Helpers no-op when no email IDs are available and do not require matching email rows.

- **Risk:** Deleting email content might surprise users if they expect email history to remain visible after deleting an interaction.
  - **Mitigation:** Product decision is explicit: bulk delete soft-deletes the full linked email aggregate, matching existing `EmailDeleter` semantics.
