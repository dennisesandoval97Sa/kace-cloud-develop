# Interactions Bulk Operations Design

## Context

The interactions table already supports row selection and exposes a bulk actions dropdown, but the actions are currently UI-only. The requested behavior is to make these operations work for selected interactions:

- Move interactions to another workspace.
- Close interactions with a required motive.
- Delete interactions with a required motive.

The implementation should follow the existing `cases-bulk` backend/frontend pattern, use reusable dialog primitives, and keep bulk operations all-or-nothing.

## Decisions

- Add real bulk endpoints instead of looping over single-interaction routes in the frontend.
- Run each bulk operation transactionally: if one selected interaction fails validation, no selected interaction changes.
- Use active literal options from `interactions -> closed_observation` for both close and delete motives.
- Persist the selected motive on the interaction record so it is visible in current state and captured in `history_interactions`.
- Use existing permissions where possible:
  - Move: `InteractionsBulkMove`
  - Close: `InteractionsBulkClose`
  - Delete: `InteractionsDelete`

## API Shape

Add an `interactions-bulk` API with three POST endpoints:

- `POST /interactions-bulk/move`
- `POST /interactions-bulk/close`
- `POST /interactions-bulk/delete`

Payloads:

```json
{
  "interaction_ids": ["uuid"],
  "workspace_id": "uuid"
}
```

```json
{
  "interaction_ids": ["uuid"],
  "motive": "Spam"
}
```

Responses should follow the existing `cases-bulk` style: `200` on success, validation failures for invalid payloads, `403` for missing permissions, `404` or validation failure for missing referenced records, and `500` for unexpected errors.

## Backend Design

Create a new API package or stack matching the `apps/apiv1/kace_cloud_api_cases_bulk` structure:

- CDK stack path: `interactions-bulk`
- Handler routes requests to `BulkMoveController`, `BulkCloseController`, and `BulkDeleteController`
- Joi schemas validate the endpoint payloads
- Core application services perform validation and repository updates

Core services:

- `InteractionBulkMover`
  - Validates selected interactions exist and are not deleted.
  - Validates destination workspace exists, is active, and is not deleted.
  - Rejects a move when every selected interaction is already in the destination workspace.
  - Updates `workspace_id`, `updated_at`, and `updated_by`.

- `InteractionBulkCloser`
  - Validates selected interactions exist, are not deleted, and are not already closed.
  - Validates `motive` is an active option under `interactions -> closed_observation`.
  - Updates `is_closed = true`, `in_review = false`, `closed_at`, `closed_by`, `updated_at`, `updated_by`, and `closed_observation`.

- `InteractionBulkDeleter`
  - Validates selected interactions exist and are not already deleted.
  - Validates `motive` is an active option under `interactions -> closed_observation`.
  - Updates `deleted_at`, `deleted_by`, and `delete_observation`.

Repository support:

- Add transaction support for interaction bulk operations, mirroring the case repository pattern.
- Add bulk update methods that update only validated IDs.
- Save history for changed interactions so audit behavior remains consistent with single interaction updates/deletes.

Database changes:

- Add nullable text columns to `interactions`:
  - `closed_observation`
  - `delete_observation`
- Add matching columns to the domain aggregate, response DTOs, schemas, and swagger docs.

## Frontend Design

Keep the existing `DataTableBulkActions` dropdown, but wire each action to modal state in the interactions feature.

Add interaction-specific bulk modals modeled on the existing board case bulk modals:

- `InteractionsBulkMoveModal`
  - Shows the selected count.
  - Loads active workspaces.
  - Lets the user select a destination workspace.
  - Disables confirm until a valid workspace is selected.

- `InteractionsBulkCloseModal`
  - Shows the selected count.
  - Loads motive options from `interactions -> closed_observation`.
  - Requires a motive selection.
  - Confirms with the bulk close endpoint.

- `InteractionsBulkDeleteModal`
  - Shows the selected count.
  - Loads motive options from `interactions -> closed_observation`.
  - Requires a motive selection.
  - Uses destructive button styling.
  - Confirms with the bulk delete endpoint.

Use a small reusable modal shell only for shared interaction-bulk layout: title, selected count text, close button, footer alignment, pending state, and confirm/cancel buttons. The form fields stay operation-specific.

After any successful bulk operation:

- Invalidate the interactions query.
- Clear selected interactions.
- Close the modal.
- Show a success toast.

On failure:

- Keep the modal open.
- Show a translated error toast.
- Leave selection intact so the user can retry or clear it.

## Literal Motive Source

The close and delete modals must not use free text. They must resolve active literal options from the existing hierarchy:

- Model: `interactions`
- Field: `closed_observation`
- Options: the active child rows under that field, such as `Cerrado sin gestión`, `Duplicado`, `Spam`, and `Finalizado Exitoso`.

The frontend should submit the selected option value. The backend should validate that value against the active literal options before applying the bulk operation.

## Validation Rules

- `interaction_ids` is required, contains valid UUIDs, and has 1 to 500 items.
- Duplicate IDs are de-duplicated before validation and update.
- All selected interactions must exist and not be soft-deleted.
- Move requires an active destination workspace.
- Move rejects a no-op request where all selected interactions already belong to the destination workspace.
- Close rejects already closed interactions.
- Delete rejects already deleted interactions.
- Close and delete require a motive that exists in the active `interactions -> closed_observation` literal options.
- Any validation failure aborts the full operation.

## Testing

Backend tests:

- Unit tests for bulk validation and de-duplication.
- Core service tests for move, close, and delete success paths.
- Transaction/all-or-nothing tests for one invalid selected interaction.
- Permission tests for each endpoint.
- Literal validation tests for missing, inactive, or unknown motives.
- E2E tests for the three new endpoints.

Frontend tests:

- Selecting rows enables the existing dropdown.
- Each dropdown item opens the expected modal.
- Move modal lists workspaces and submits selected workspace ID.
- Close/delete modals list `closed_observation` literal options and require a motive.
- Successful mutation invalidates interactions, clears selection, and closes the modal.
- Failed mutation keeps the modal open and leaves selection intact.

## Out Of Scope

- Bulk assign and bulk unassign interactions.
- Changing the literal management UI.
- Supporting partial-success bulk operations.
- Creating a separate delete motive literal field.
