# GroupForm OneScript Users — Sync on User Interaction Only

**Date:** 2026-07-18  
**Branch:** `bugfix/group-form-onescript-users-on-interaction`  
**Status:** Approved

## Problem

In `GroupForm.jsx`, a `useEffect` watches `listValues` and sends `postMessage` with type `kaceGroupUsers` to the OneScript iframe on every change. That includes changes that are not user-driven:

1. Initial hydration when `relatedUsers` loads existing group members into `listValues`.
2. Internal bootstrap inside `MultiSelectUsers` when it resolves preloaded user IDs into display objects via `setListValuesRef.current(...)`.

OneScript receives user list updates before the admin interacts with the multiselect, causing incorrect or premature sync.

## Goal

Send `kaceGroupUsers` to OneScript **only** when the user interacts with `MultiSelectUsers`:

- Add one user
- Add multiple users
- Remove all users (empty selection `[]`)

Do **not** send on initial data load or internal component bootstrap.

## Non-Goals

- Changing the OneScript plugin consumer side
- Iframe handshake, retry, or message queue when iframe is not ready
- Debouncing or batching selection changes
- Modifying other consumers of `MultiSelectUsers` beyond adding an optional prop

## Chosen Approach (A1)

Add optional `onUserSelectionChange` callback to `MultiSelectUsers`, invoked only from the handler passed to `MultiSelect`. Internal bootstrap effects continue calling `setListValues` directly and do not trigger the callback.

Extract a pure utility `postGroupUsersToOneScript` for testability (TDD, SRP).

## Architecture

```
relatedUsers / bootstrap  →  setListValues (state only, no OneScript)
User action in MultiSelect →  handleUserSelectionChange
                              → setListValues + onUserSelectionChange
                              → GroupForm → postGroupUsersToOneScript → iframe
```

## Component Changes

### `MultiSelectUsers.jsx`

- New optional prop: `onUserSelectionChange?: (users: Array<{ id, label, value? }>) => void`
- `handleUserSelectionChange(next)`:
  - calls `setListValues(next)`
  - calls `onUserSelectionChange?.(next)`
- Pass `handleUserSelectionChange` to `MultiSelect` as `setListValues`
- Bootstrap effects keep using `setListValuesRef.current(...)` unchanged

### `postGroupUsersToOneScript.js`

Pure function:

```javascript
export function postGroupUsersToOneScript(contentWindow, users, targetOrigin) {
  if (!contentWindow) return;
  contentWindow.postMessage({ type: "kaceGroupUsers", payload: users }, targetOrigin);
}
```

Location: `apps/kace-saas/src/utils/postGroupUsersToOneScript.js`

### `GroupForm.jsx`

- Remove `useEffect` on `[listValues]` that posts to OneScript
- Remove `initialUsersLoaded` ref (no longer needed)
- Add `handleGroupUsersSelectionChange`:
  - guard: `hasOneScriptGroups && oneScriptRef.current?.contentWindow`
  - call `postGroupUsersToOneScript(contentWindow, users, ONESCRIPT_KONECTA_CLOUD)`
- Pass `onUserSelectionChange={handleGroupUsersSelectionChange}` to `MultiSelectUsers`

## Behavior Matrix

| Scenario | `listValues` updates | `postMessage` sent |
|----------|----------------------|--------------------|
| Edit group: `relatedUsers` loads | Yes | No |
| `MultiSelectUsers` bootstrap | Yes | No |
| User adds one user | Yes | Yes |
| User adds multiple users | Yes | Yes (final list) |
| User clears all users | Yes (`[]`) | Yes |

## Error Handling

- If `contentWindow` is null/undefined: skip silently (same as current guard behavior)
- No user-visible error; user can interact again once iframe is ready

## Testing Strategy (TDD)

### `postGroupUsersToOneScript.test.js`

- Posts correct message shape with payload
- Does not call `postMessage` when `contentWindow` is null
- Sends empty array payload when users is `[]`

### `MultiSelectUsers` selection callback

- `onUserSelectionChange` invoked when selection handler is called (simulating MultiSelect user change)
- Bootstrap path using `setListValuesRef` does not invoke `onUserSelectionChange`

Test runner: Vitest (existing project convention in `apps/kace-saas`).

## Global Constraints

- No code comments in generated code (workspace rule)
- Minimal diff; backward compatible optional prop on `MultiSelectUsers`
- SOLID: SRP for postMessage utility; open/closed via optional callback
- Branch: `bugfix/group-form-onescript-users-on-interaction`

## Success Criteria

1. Opening group edit form with existing users does not send `kaceGroupUsers` to OneScript
2. Adding/removing users via multiselect sends updated payload
3. Clearing all users sends `[]`
4. All new unit tests pass
5. No regressions in other `MultiSelectUsers` usages (prop is optional)
