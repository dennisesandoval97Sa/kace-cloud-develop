# Flow + Transition Single-Endpoint Aggregation

## Frontend POSTs flow; backend owns transitions

Date: 2026-06-30
Status: Approved
Branch: `fix/flows-transitions-payload-without-id`

---

## 1. Problem

Saving or updating a flow in `apps/kace-saas/src/pages/Flows` currently triggers **two** independent API calls:

1. `POST /flows` (or `PUT /flows/:id`) with the full flow payload.
2. `POST /transitions` (batch create) and `POST /transitions/:id` (per-edge update) for every edge in `json_flujo.edges`.

The frontend orchestrates this from `useFlowActions.handleFlow` (`apps/kace-saas/src/pages/Flows/hooks/useFlowActions.js:138-184`) by first calling `handleTransition` for every edge to resolve a `kace_transition` UUID, then calling `syncTransitions` after the flow mutation.

The root cause of the most recent bug (`fix(flows): stop sending id in transitions API payload`, commit `8203e78e7`) is structural: the frontend generates UUIDs for transitions and ships them to the backend. Joi validation rejects payloads with client-generated `id` fields, so the workaround is to skip the id. This still leaves two endpoints in the critical path and the frontend acting as the orchestrator of a relationship that belongs to the backend.

Secondary issues:

- `TransitionSchema.js` (`apps/kace-saas/src/schemas/TransitionSchema.js`) duplicates backend Joi rules on the frontend, with no enforcement value: a frontend schema does not protect a backend.
- `kace_transition` and `transition_existed` flags on edges are an implementation leak: they exist only because the frontend is doing the diff between client and server state.
- `PUT /flows/:id` is exercised by the existing `genericHandleSendInformation` URL logic. Per product decision, the flow save/update surface must be `POST` only.

### Why this matters

- **SOLID**: the frontend violates SRP (it owns flow persistence and transition orchestration) and DIP (it depends on the concrete shape of `transiciones` rows).
- **DDD**: a `Flow` is a domain aggregate that owns a collection of `Transition`. Today the aggregate boundary is split between two services and two HTTP endpoints, with the aggregate root in the browser.
- **Retrocompatibilidad**: thousands of transitions already exist and are referenced by cases via `transicion_id` (`apps/kace-saas/src/pages/Cases/components/AdminCase/components/AdminCaseStates/hooks/useAdminCaseStates.js:41-99`). The aggregate must never delete transitions that cases still point to.
- **Reuse of transitions**: `useAdminCaseStates` reads the `transiciones` table for the active flow, picks a transition matching the current state, and assigns its `id` as the case's `transicion_id`. `CloneCase` (`apps/kace-saas/src/pages/Cases/components/ModalActions/components/CloneCase/CloneCase.jsx:58`) and `ReOpenCase` (`apps/kace-saas/src/pages/Cases/components/ModalActions/components/ReOpenCase/ReOpenCase.jsx:53`) read `edge.kace_transition` directly from the flow response. These consumers must keep working.

---

## 2. Solution

### 2.1 Aggregate boundary

`Flow` is the aggregate root. `Transition` is an entity inside the aggregate, identified by the business key `(flujo_id, estado_actual_id, siguiente_estado_id)`. The aggregate is persisted atomically by one HTTP call from the frontend.

### 2.2 HTTP contract

| Action | Method | URL | Body | Response |
|---|---|---|---|---|
| Create | `POST` | `/flows` | flow fields, no `id` | `201 Created` with flow including server-generated `id` |
| Update | `POST` | `/flows/:id` | flow fields, no `id` | `200 OK` with updated flow |

`PUT /flows/:id` is removed from the controller. If traffic arrives, the backend returns `405 Method Not Allowed`.

The body **never** carries the flow's `id`, transition `ids`, or `kace_transition` markers. Every identity in the response is server-generated.

### 2.3 Backend orchestration

The flow controller delegates the full create/update to a new application service `FlowWithTransitionsApplicationService` that owns the aggregate. The service:

1. Validates the payload with the updated Joi schema.
2. Persists the flow row (`FlowCreator` / `FlowUpdater`).
3. For every edge in `payload.json_flujo.edges`:
   - Compute `(estado_actual_id, siguiente_estado_id)` from `(edge.source, edge.target)` with the special case `source === "0"` → `estado_actual_id = null`.
   - Map the edge fields to transition fields: `ans_id = edge.ans_id ?? null`, `rule_id = edge.rule_id ?? null`, `is_visible = edge.data?.is_visible ?? true`. Both `ans_id` and `rule_id` are **always passed** in the create and update payloads. A `null` value means "no ANS / no rule assigned" and overwrites the previous value (this is what the `handlerClear` fix in `29dcb2cb1` enables).
   - Look up an existing transition by `(flujo_id, estado_actual_id, siguiente_estado_id)`. Order by `created_at DESC`, limit 1.
   - **Found** → `TransitionUpdater.execute({ ans_id, rule_id, is_visible }, id)`. Preserve `id`, `status`, `created_at`, `created_by`. Refresh `updated_at`, `updated_by` from the request context. The new `ans_id` and `rule_id` overwrite the previous values, including overwriting a non-null value with `null` (clear-ANS / clear-rule UX).
   - **Not found** → `TransitionCreator.execute({ flujo_id, estado_actual_id, siguiente_estado_id, ans_id, rule_id, is_visible, status: 1 })` with server-generated `id`.
4. Commits the whole flow + transition batch in one Knex transaction.

**Hard rule**: the service never deletes transitions. Transitions absent from the new `json_flujo.edges` are left untouched and remain available for cases that already reference them.

### 2.4 Read-side enrichment (no contract change for consumers)

`GET /flows/:id` and the search endpoint continue to return `json_flujo.edges`. The `FlowFinder` enriches each edge with `kace_transition` (the id of its matching transition) so `CloneCase` and `ReOpenCase` keep reading it from the response.

The enrichment is a server-side query in the read path. The write path does not depend on it.

### 2.5 Frontend surface

`apps/kace-saas/src/pages/Flows/hooks/useFlowActions.handleFlow` calls `genericHandleSendInformation` with `options: { serverGeneratedId: true, isCreate: <bool> }`. The `isCreate` flag is derived from the presence of a route id: `id` from `useParams()` falsy → `isCreate: true`; `id` present → `isCreate: false`. With this option, `genericHandleSendInformation` (in `apps/kace-saas/src/services/genericHandleSendInformation.js:15-17`) picks the collection URL `POST /flows` for creates and the explicit `POST /flows/:id` for updates, never `PUT`. The body contains only flow fields, no `id`, no transition ids, no `kace_transition`, no `transition_existed`.

The hook no longer:

- Calls `handleTransition` per edge.
- Calls `/transitions` or `/transitions/:id`.
- Generates UUIDs for transitions.

Files removed from the frontend:

- `apps/kace-saas/src/pages/Flows/helpers.js` — deleted. The functions `extractTransitions`, `setTransitions`, `syncTransitions`, `handleTransition`, `getTransition`, `buildTransitionsCreatePayload`, `buildUpdateTransitionPayload`, `buildTransitionStateFromEdge`, `formatDataBeforePost` (the local copy) are deleted. Payload formatting is delegated to `genericHandleSendInformation` + `formatDataBeforePost` from `apps/kace-saas/src/services/genericHandleSendInformation.js`, which already supports the `serverGeneratedId` option.
- `apps/kace-saas/src/pages/Flows/helpers.spec.js` — deleted (no remaining units to test in this file).
- `apps/kace-saas/src/schemas/TransitionSchema.js` — deleted. The frontend never sends a transitions payload, so a client-side schema has no value.

### 2.6 Branch cleanup

- `git revert 8203e78e7` (drops the workaround commit that "stopped sending id in transitions").
- `git checkout -- apps/kace-saas/src/pages/Flows/helpers.js apps/kace-saas/src/pages/Flows/helpers.spec.js apps/kace-saas/src/schemas/TransitionSchema.js` (drops the uncommitted edits that belong to the reverted commit).
- `29dcb2cb1` (the `handlerClear` bug fix in `FlowDiagram.jsx`) stays as-is. The new design preserves it untouched.

---

## 3. SOLID mapping

| Principle | Where it shows up |
|---|---|
| Single Responsibility | `useFlowActions` orchestrates the form. `genericHandleSendInformation` formats the body. `FlowWithTransitionsApplicationService` owns the aggregate. `FlowController` owns HTTP, nothing more. |
| Open/Closed | New read-side enrichment behavior in `FlowFinder` is additive; existing readers see the same shape. |
| Liskov | The `Transition` entity exposes `toJson()` with the same shape after upsert as after create. The case-side consumers see no difference. |
| Interface Segregation | The application service exposes two narrow methods, `executeCreate(payload)` and `executeUpdate(id, payload)`. It does not expose a "do everything" method. |
| Dependency Inversion | `FlowWithTransitionsApplicationService` depends on `FlowRepository` and `TransitionRepository` interfaces (already in `@kace/core/src/flow` and `@kace/core/src/transition`). The Knex implementations stay in the infrastructure layer. The controller depends on the application service, not on the repository. |

---

## 4. DDD mapping

| Concept | Implementation |
|---|---|
| Aggregate | `Flow` (root) + collection of `Transition` (entities). |
| Identity of `Transition` | Business key `(flujo_id, estado_actual_id, siguiente_estado_id)`. Surrogate `id` is server-generated. |
| Value Object | `EdgePayload` (input from the frontend, mapped to entity fields). Stateless, validated by Joi. |
| Domain Service | `FlowWithTransitionsApplicationService` lives in `packages/core/src/flow/`. |
| Repository | `KnexFlowRepository` (existing) and `KnexTransitionsRepository` (existing). New `findByFlowAndTriplet(flujoId, estadoActualId, siguienteEstadoId)` method on `KnexTransitionsRepository`. |
| Application boundary | The Knex transaction wraps flow + transitions, enforcing aggregate consistency. |

---

## 5. Files and modules affected

### Backend
- `apps/apiv1/kace_cloud_api_flow/src/controller.mjs` — `actionCreate` and a new `actionUpdateViaPost` (or `actionUpdate` repurposed) delegate to the new service. `PUT /flows/:id` is removed.
- `apps/apiv1/kace_cloud_api_flow/src/schemas.mjs` — `createSchema` and `updateSchema` accept the flow payload, including a nested `json_flujo.edges` shape. Each edge is validated with a sub-schema: `source` (string or `"0"`), `target` (uuid), `ans_id` (uuid or null), `rule_id` (uuid or null), `data?.is_visible` (boolean, default `true`). The validation mirrors `apps/apiv1/kace_cloud_api_transitions/src/schemas.mjs:14-15, 32-33` so the edge contract is consistent across endpoints.
- `apps/apiv1/kace_cloud_api_flow/src/handler.mjs` — register the new `POST /flows/:id` route and remove `PUT /flows/:id` from the routing table.
- `apps/apiv1/kace_cloud_api_flow/test/` — new e2e tests for the aggregated create/update, idempotency of repeated saves, no-deletion invariant.
- `packages/core/src/flow/FlowWithTransitionsApplicationService.mjs` (new).
- `packages/core/src/flow/FlowFinder.mjs` (or equivalent) — enrich edges with `kace_transition` on read.
- `packages/core/src/transition/KnexTransitionsRepository.mjs` — add `findByFlowAndTriplet`.
- `packages/core/src/transition/TransitionUpdater.mjs` — make sure the `status`, `created_*`, `updated_*` fields are managed correctly during an upsert that finds an existing row.

### Frontend
- `apps/kace-saas/src/pages/Flows/hooks/useFlowActions.js` — drop transitions orchestration; pass `serverGeneratedId: true` to `genericHandleSendInformation`.
- `apps/kace-saas/src/pages/Flows/helpers.js` — deleted or reduced to a single payload utility.
- `apps/kace-saas/src/pages/Flows/helpers.spec.js` — updated.
- `apps/kace-saas/src/schemas/TransitionSchema.js` — deleted.
- `apps/kace-saas/src/components/ui-shared/src/components/flowDiagram/FlowDiagram.jsx` — preserved as-is (the `handlerClear` fix from `29dcb2cb1`).

### Documentation
- `docs/superpowers/specs/2026-06-30-flow-transition-aggregation-design.md` — this file.

---

## 6. Testing strategy (TDD)

### Backend (test-first)

1. **`FlowWithTransitionsApplicationService`**
   - `executeCreate` persists the flow, creates a transition per edge with server-generated `id`, never deletes, runs inside a transaction (test asserts transaction is committed on success, rolled back on error).
   - `executeUpdate` with a flow that already has 3 transitions and a new payload of 2 edges that match 2 of the 3 by tripleta: updates the 2 existing, leaves the third untouched.
   - `executeUpdate` with a new edge that has no matching transition: creates it.
   - `executeUpdate` with an edge whose tripleta matches an existing transition: the new payload's `ans_id`, `rule_id`, `is_visible` overwrite; the existing `id`, `status`, `created_*` are preserved.
2. **`KnexTransitionsRepository.findByFlowAndTriplet`**
   - Returns the most recent transition by `created_at DESC` for a given tripleta.
   - Returns `null` when no match.
3. **`POST /flows` e2e**
   - 201 Created; response includes flow with server-generated `id`; the GET that follows shows the transitions with `kace_transition` populated.
   - Body without `id` is accepted; body with `id` is rejected (`400`).
4. **`POST /flows/:id` e2e**
   - 200 OK; transitions are upserted; pre-existing transitions not in the new edges are still in the table.
5. **`PUT /flows/:id` is gone**
   - Request returns `405 Method Not Allowed`.

### Frontend (test-first)

1. **`useFlowActions.handleFlow`**
   - With a stub of `useGeneralMutation`, the hook calls the mutation with a body that contains no `id`, no `kace_transition`, no `transition_existed`, no `Transition`-related keys. It does not call `apiService.post` against `TRANSITION_SERVICE`.
   - The hook does not call `handleTransition` (the deleted function). It also does not await any `/transitions` request.
2. **`FlowsForm` integration**
   - Submitting the form with new and modified edges triggers exactly one `POST /flows` or `POST /flows/:id`; the test asserts that any `/transitions*` URL is never hit.
3. **`FlowDiagram` regression**
   - The `handlerClear` fix (clearing ANS and rule in the edge config modal) still works. The test mounts the component, opens the modal, clicks the X on the ANS select, confirms the selection is cleared before re-confirming the edge.

### Migration safety
- Manual verification: take a snapshot of the `transiciones` table before the deploy; run a save on a flow that has 5 transitions, removing one edge and adding a new one; after the save, the table has 5 rows (1 updated, 1 created) and the case-side screens that reference the removed edge's id (if any) still work.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Historical duplicate rows in `transiciones` for the same tripleta. | `findByFlowAndTriplet` returns the most recent; duplicates are not touched. Out of scope to dedupe. |
| Performance: N queries per save for N edges. | Single transaction; out-of-scope to optimize further. Add composite index `(flujo_id, estado_actual_id, siguiente_estado_id)` in a follow-up PR. |
| Permissions: a user with `FlowsCreate` but not `TransitionsCreate` could fail. | The application service uses the same controller-level permission gate (`administrador`, `flows`, `FlowsCreate` / `FlowsUpdate`). The transition writes are privileged through the flow write, not a separate `TransitionsCreate` check. The role `administrador` already grants both. |
| Read-side enrichment cost on `GET /flows/:id` for flows with many edges. | One additional query per read (`SELECT * FROM transiciones WHERE flujo_id = ?`); bounded by the number of edges in `json_flujo`. Out of scope to optimize further. |
| `PUT /flows/:id` still receives traffic from a third party. | Backend returns `405` and logs a warning. Removed in a follow-up PR. |

---

## 8. Out of scope

- Composite index on `transiciones (flujo_id, estado_actual_id, siguiente_estado_id)`.
- Cleanup of historical duplicate transitions.
- Removing the `PUT /flows/:id` route entirely (handled by deprecation, then removal in a follow-up).
- Generalizing the aggregate pattern to other resources.
- Bulk edge update API (the single-edge per-save round-trip is sufficient).
