# Interaction Review Claim/Release Design

## Context

The interactions detail modal in the admin `/interactions` page has a visible `Gestionar` button, but the button is currently not wired to review ownership behavior. The interaction domain already has review state fields:

- `in_review`
- `start_review_at`
- `start_review_by`

Existing update logic stamps `start_review_at` and `start_review_by` when `in_review` is set to `true`, but it does not reliably clear those fields when releasing an interaction. The generic frontend payload cleaner also removes `null` values, so release semantics should not depend on the UI sending nullable fields through the generic update route.

The feature should treat review management as an operational lock: `Gestionar` claims an interaction for the logged-in user, and `Liberar` releases that claim.

## Decisions

- Use dedicated review endpoints instead of overloading the generic interaction update endpoint.
- Keep the existing database fields; no new columns are required.
- Enforce claim/release permissions in the backend. Frontend state is only a UI convenience.
- A release can be performed by the same reviewing agent or by an admin/supervisor capability.
- If an admin/supervisor releases another agent's interaction, release only clears the review fields. It does not automatically claim the interaction for the admin/supervisor.
- The admin modal and the agent interaction flow must use the same backend semantics.
- If a non-privileged user sees an interaction reviewed by another user, the button should show `En revision` disabled instead of exposing a disabled `Liberar` action.

## API Shape

Add two review command endpoints under interactions:

- `POST /interactions/:id/review/claim`
- `POST /interactions/:id/review/release`

Both endpoints use the authenticated user from the request context and do not accept `start_review_by` or `start_review_at` from the client.

Responses:

- `200` with the updated interaction on success or idempotent no-op.
- `400` for invalid interaction ids.
- `403` when the user cannot release an interaction owned by another reviewer.
- `404` when the interaction does not exist or is deleted.
- `409` when claim is attempted on an interaction already reviewed by another user.
- `500` for unexpected errors.

## Backend Design

Create explicit application services in the interactions core layer:

- `InteractionReviewClaimer`
- `InteractionReviewReleaser`

`InteractionReviewClaimer`:

- Loads the interaction by id.
- Rejects deleted or missing interactions.
- Rejects closed interactions.
- If the interaction is not in review, sets:
  - `in_review = true`
  - `start_review_at = now`
  - `start_review_by = currentUser.id`
  - `updated_at = now`
  - `updated_by = currentUser.id`
- If the interaction is already reviewed by the same user, returns success without changing ownership.
- If the interaction is reviewed by another user, returns `409 Conflict`.
- Saves interaction history for real state changes.

`InteractionReviewReleaser`:

- Loads the interaction by id.
- Rejects deleted or missing interactions.
- If the interaction is not in review, returns success without changing state.
- Allows release when `start_review_by` matches `currentUser.id`.
- Allows release when the current user has an admin/supervisor release capability.
- Rejects release with `403` when another user owns the review and the current user lacks the release capability.
- Clears:
  - `in_review = false`
  - `start_review_at = null`
  - `start_review_by = null`
  - `updated_at = now`
  - `updated_by = currentUser.id`
- Saves interaction history for real state changes.
- Allows cleanup even if an already closed interaction still has stale review fields, because release is a lock cleanup operation.

Concurrency:

- Claim should be implemented transactionally.
- Use row locking when the database client supports it; use a conditional update fallback for test clients that do not support row locks.
- The second concurrent claimant should receive `409 Conflict` after the first successful claim.
- Release should also read and update in one transaction so permission checks are based on the same row version being changed.

Permissions:

- Claim should require the existing interaction update/manage permission.
- Release should require either ownership of the review or an admin/supervisor capability.
- The admin/supervisor check should use the existing permission system where possible, not hard-coded role text.

## Frontend Design

Create a reusable review action hook, for example `useInteractionReviewActions(interaction)`, and use it from both:

- Admin interactions detail modal.
- Agent interactions detail flow.

The hook should expose:

- `claimReview()`
- `releaseReview()`
- pending state
- derived button state

Button states:

- Not in review: show `Gestionar`, enabled, calls claim.
- In review by current user: show `Liberar`, enabled, calls release.
- In review by another user and current user can release: show `Liberar`, enabled, calls release.
- In review by another user and current user cannot release: show `En revision`, disabled.

Tooltip text:

- If reviewer display data is available cheaply, show `En revision por <agent>`.
- Otherwise show `En revision por otro agente`.

Mutation behavior:

- On success, invalidate interactions queries and refresh the current modal/list data.
- Keep the modal open after claim/release unless the surrounding component already closes after mutations for consistency.
- On `409`, show a toast like `La interaccion ya esta en revision por otro agente.`
- On `403`, show a toast like `No tienes permiso para liberar esta interaccion.`
- Other errors should use the existing translated error helper.

Naming cleanup:

- Avoid keeping a frontend function named `release` for the action that currently puts an interaction into review.
- Use explicit names: `claimReview`, `releaseReview`, and `closeInteraction`.

## Data Flow

Claim flow:

1. User clicks `Gestionar`.
2. Frontend posts to `POST /interactions/:id/review/claim`.
3. Backend verifies permission, state, and concurrency.
4. Backend stamps reviewer fields from the authenticated user.
5. Frontend invalidates interaction queries and renders `Liberar` or `En revision` based on the refreshed row.

Release flow:

1. User clicks `Liberar`.
2. Frontend posts to `POST /interactions/:id/review/release`.
3. Backend verifies owner/admin release rules.
4. Backend clears review fields.
5. Frontend invalidates interaction queries and renders `Gestionar`.

## Testing

Backend tests:

- Claim free interaction assigns current user and review timestamp.
- Claim by the same user is idempotent.
- Claim by another user on an already reviewed interaction returns `409`.
- Claim on a closed interaction is rejected.
- Release by the owning reviewer clears review fields.
- Release by admin/supervisor clears review fields owned by another reviewer.
- Release by a non-owner without admin/supervisor capability returns `403`.
- Release on a free interaction is idempotent.
- Release on a closed interaction with stale review fields can clean up the lock.
- Concurrent claims result in exactly one successful claim and one conflict.
- History is saved for claim and release state changes.

Frontend tests:

- Admin modal renders `Gestionar` for free interactions and calls claim endpoint.
- Admin modal renders `Liberar` for interactions reviewed by current user and calls release endpoint.
- Admin modal renders `Liberar` for another user's review when current user has release capability.
- Admin modal renders disabled `En revision` for another user's review when current user cannot release.
- Agent interaction flow uses the same claim/release semantics.
- `409` conflict shows the already-reviewed toast.
- `403` release denial shows the permission toast.
- Successful mutations invalidate interaction queries.

## Out Of Scope

- New database columns for reviewer display names.
- Automatic admin/supervisor takeover in one click.
- A separate `Reasignar a mi` action.
- Bulk claim or bulk release.
- Changing the generic interaction update endpoint behavior beyond what is needed to stop using it for review locks.
