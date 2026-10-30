# Associate Case modal for `/agent` Interactions

Date: 2026-06-01
Branch: `feature/associate-case-modal`
Target base: `feature/interactions26`

## Summary

Add a scalable **Associate Case** flow to the `/agent` Interaction detail UI. The flow lets the current reviewing agent link the selected Interaction to one existing open Case for the currently selected Client. It replaces the existing non-scalable side-panel selector with a reusable modal that uses server-side paginated search and a dedicated linked-Cases read endpoint.

## Goals

- Add **Associate Case** next to **Create Case** in the Interaction detail header.
- Reuse the same association modal from the header and the client side panel.
- Search only open Cases for the currently selected Client.
- Scale to thousands of Cases through paginated, server-side search.
- Exclude or disable Cases already linked to the Interaction.
- Show a compact **Linked Cases** list in the client side panel after association.
- Keep associating existing Cases independent from Case creation permission.

## Non-goals

- Do not enforce selected-Client ownership in the backend in this slice. This is a known follow-up.
- Do not implement bulk Case association. The UI associates one Case per confirmation.
- Do not change the existing association search response shape (`/interaction-cases/search` in the frontend URL constants, under the Interactions API base path in deployed routing), because it is used for Case → Interactions reads.

## Domain rules

- Association uses the currently selected **Client**; it does not infer a Client from the Interaction sender email.
- If no Client is selected, clicking **Associate Case** opens the client panel and shows guidance to select or create a Client first.
- Association is available only while the Interaction is open and under review by the current agent.
- The same Interaction and Case can be linked at most once.
- Subcases are eligible because they are Case records; display them with a Subcase label when `parent_id` exists.

## UX design

### Header action

Place **Associate Case** as a link-style action next to **Create Case** in `InteractionDetail.jsx`. It should use the same review/current-agent/open-Interaction gate as **Create Case**, but not the same permission:

- **Create Case** still requires `CasesCreate`.
- **Associate Case** requires the Interaction association capability already used by the backend create association flow (`agente/interactions/InteractionsCreate`) plus the current-reviewer/open-Interaction gate.

### Modal behavior

Use a focused modal/search dialog:

- Opens with the first page of open Cases for the selected Client, newest first.
- Page size should be small, e.g. 20.
- Search refines results using debounced server-side filters.
- Search fields: Case `reference`, classification levels (`nivel1` through `nivel10`), and responsible name/login.
- Display fields: reference, classification summary, current state, responsible, created date, and Subcase badge when `parent_id` exists.
- One Case can be selected and confirmed per modal submission.
- Already-linked Cases are excluded or disabled.

### Empty state

When no eligible open Cases exist for the selected Client:

- Show “No open Cases found for this Client.”
- If the agent has `CasesCreate`, show a **Create Case** shortcut.
- The Create Case shortcut must preserve the source `interaction_id` so the new Case can be linked back to the Interaction.

### Success behavior

After successful association:

1. Close the modal.
2. Show a success toast.
3. Refresh linked Case IDs/summaries.
4. Open the client side panel when the association was initiated from the header, so the agent can see the compact Linked Cases list.

### Linked Cases list

Add a compact **Linked Cases** list in the client side panel under Customer Data/actions.

- Use the dedicated linked-Cases response summaries.
- Each item should expose a **View Case** action using the existing agent Case open helper.
- Replace/supersede the old singular `interaction.caseId` shortcut because the domain allows multiple linked Cases.

## Backend/API design

### Existing association create

Keep using the existing association create route that accepts:

```json
{
  "interaction_id": "...",
  "caso_id": "..."
}
```

This slice will not add `cliente_id` ownership validation. Frontend filtering prevents normal wrong-client selection; backend validation remains a follow-up.

### New linked-Cases read endpoint

Add a narrow read endpoint for one Interaction, separate from the existing association search endpoint, because that search currently returns Interactions rather than pivot Case IDs. The deployed route should live under the Interactions API association path.

The endpoint should return both linked IDs and minimal display summaries:

```json
{
  "case_ids": ["case-1", "case-2"],
  "items": [
    {
      "id": "case-1",
      "reference": 1234,
      "estadoActual": "Open",
      "created_at": "2026-06-01T12:00:00.000Z",
      "parent_id": null,
      "nivel1": "Support",
      "nivel2": "SFTP",
      "responsible_name": "Agent Name"
    }
  ]
}
```

Implementation can use existing `KnexAssociateInteractionToCasoRepo.findByInteractionId(interactionId)` to get linked IDs and a Case repository summary lookup for the minimal Case data.

## Frontend architecture

Suggested units:

- `AssociateInteractionCaseModal`
  - Owns search term, selected Case, page, confirm state.
  - Accepts `interactionId`, `clientId`, `open`, `onOpenChange`, `onAssociated`, and `canCreateCase`.
- `useInteractionCaseSearch`
  - Calls Case search with selected Client, open-only filter, search filters, pagination.
  - Excludes/marks already-linked IDs.
- `useLinkedInteractionCases`
  - Calls the new linked-Cases endpoint.
  - Returns `caseIds`, `items`, loading/error states, and `refetch`.
- `LinkedInteractionCasesList`
  - Compact side-panel list with View Case actions.
- Existing side-panel association components should be refactored to use the modal instead of the non-scalable `SelectByUrl` selector.

## Data flow

1. Agent opens/selects an Interaction.
2. Linked Cases query loads for the Interaction.
3. Agent clicks **Associate Case**.
4. If no selected Client exists, open the client panel and show guidance.
5. If a Client exists, open modal.
6. Modal loads first page of eligible open Cases for that Client.
7. Agent searches/selects one Case.
8. Confirm posts `{ interaction_id, caso_id }`.
9. On success, modal closes, linked Cases query refreshes, toast appears, and side panel opens if needed.

## Error handling

- Search failure: keep modal open and show a recoverable error state with retry.
- Association validation/permission failure: keep modal open and show translated error/toast.
- Duplicate race: if backend no-ops because another process already linked it, treat as success or refresh linked Cases and show already-linked feedback.
- Missing Client: do not open modal; open client panel and show guidance.

## Testing plan

### Frontend

- Header shows **Associate Case** only for open Interactions under review by the current agent with Interaction association permission.
- Header action opens client panel and hint when no selected Client exists.
- Header action opens modal when selected Client exists.
- Modal sends Case search filters for selected Client, open Cases, search term, and pagination.
- Modal excludes/disables already-linked Case IDs.
- Modal posts one selected Case association.
- Success closes modal, shows toast, refreshes linked Cases, and opens client side panel when launched from header.
- Side-panel **Associate with Cases** uses the same modal.
- Empty state shows Create Case shortcut only with `CasesCreate` permission.
- Linked Cases list renders multiple Cases and View Case actions.

### Backend

- Dedicated linked-Cases endpoint returns `case_ids` for one Interaction.
- Endpoint returns minimal Case summaries for linked Cases.
- Endpoint enforces appropriate Interaction read/association permissions.
- Existing association search behavior remains unchanged.

## Follow-ups

- Add backend validation that the associated Case belongs to the selected Client, likely by sending `cliente_id` and checking Case ownership before creating the association.
- Consider a dedicated permission for associating Cases if product policy diverges from `InteractionsCreate`.
