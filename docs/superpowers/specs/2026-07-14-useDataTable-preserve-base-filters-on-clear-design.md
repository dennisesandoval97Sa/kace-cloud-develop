# useDataTable: Preserve Base Filters on Clear

## Context

In the admin `/interactions` page (`apps/kace-saas/src/pages/Interactions/`), the workspace context is passed to the data table as a `tableFilters` prop that contains a `workspace_id` filter. When the agent selects a workspace tab, clicks **Update** to apply a column filter (e.g. status), then clicks **Clear filters** and applies a new column filter, the `workspace_id` filter disappears from the request payload and the search is no longer scoped to the selected workspace.

Reproduction (from `InteractionsDataTable.jsx:454-493` and `useDataTable.jsx:284-291`):

1. Agent selects the `COL CTU CORREOS` workspace tab. `selectedWorkspace` becomes the workspace id. `tableFilters` evaluates to `[{ field: "workspace_id", operator: "eq", value: "<id>", type: "AND" }]`. The effect at `useDataTable.jsx:169-173` syncs `baseFilters` to that array. The first `POST /interactions/search` request includes `workspace_id`.
2. Agent clicks **Update** with `status = Closed`. `handleApplyFilters` (`useDataTable.jsx:258-282`) sets `userFilters` to the status filter. `baseFilters` is untouched. The next request includes `workspace_id` AND `status`.
3. Agent clicks **Clear filters**. `handleClearFilters` (`useDataTable.jsx:284-291`) executes `setBaseFilters([])` and `setUserFilters([])`. `baseFilters` is now empty even though `tableFilters` still contains `workspace_id`.
4. Agent clicks **Update** with another filter. `handleApplyFilters` populates `userFilters`, but `baseFilters` stays empty. The request now contains only the user filter — `workspace_id` is gone.

The expected behavior is that "Clear filters" only clears the column filters the agent applied (`userFilters`), not the navigation/workspace context (`baseFilters`).

## Decisions

- The fix lives in the `useDataTable` hook (`apps/kace-saas/src/hooks/useDataTable.jsx`). `baseFilters` is treated as derived state that always reflects `urlFilter || tableFilters`, never something user actions should mutate directly.
- `handleClearFilters` only resets `userFilters`, `currentFiltersValues`, `selectedFilter`, `pageIndex`, and `pageSize`. It does not touch `baseFilters`.
- The `baseFilters` synchronization effect at `useDataTable.jsx:169-173` is the single source of truth that re-derives `baseFilters` when `urlFilter` or `tableFilters` change. No new effect is needed.
- The `isActive` flag is simplified to `userFilters.length > 0`. The previous positional comparison against `tableFilters` was fragile and incorrectly reported the filter bar as "active" when only `urlFilter` was set with an empty `tableFilters`.
- No consumer of `useDataTable` (e.g. `InteractionsDataTable`, `CasesTableComponent`) is modified. They continue to pass context filters via the `tableFilters` prop and rely on the hook to merge them with `userFilters` in `combinedFilters`.

## Code Changes

### `apps/kace-saas/src/hooks/useDataTable.jsx`

#### `handleClearFilters` (lines 284-291)

Remove `setBaseFilters([])` so the workspace context survives a clear.

Before:

```js
const handleClearFilters = useCallback(() => {
    setBaseFilters([]);
    setUserFilters([]);
    setPageIndex(0);
    setCurrentFiltersValues({});
    setselectedFilter("");
    setPageSize(DEFAULT_PAGE_SIZE);
}, []);
```

After:

```js
const handleClearFilters = useCallback(() => {
    setUserFilters([]);
    setPageIndex(0);
    setCurrentFiltersValues({});
    setselectedFilter("");
    setPageSize(DEFAULT_PAGE_SIZE);
}, []);
```

The dependency array stays empty: the callback no longer references `baseFilters`, only setters and constants. `setPageSize(DEFAULT_PAGE_SIZE)` is preserved because the existing intent of clear is to also reset pagination.

#### `isActive` flag (lines 468-474)

Replace the positional comparison with a direct check on `userFilters`.

Before:

```js
isActive:
    combinedFilters.length > 0 &&
    (!tableFilters ||
        combinedFilters.some(
            (filter, idx) =>
                !tableFilters[idx] || JSON.stringify(filter) !== JSON.stringify(tableFilters[idx]),
        )),
```

After:

```js
isActive: userFilters.length > 0,
```

The flag now means exactly what its name says: the filter bar is active when the agent has applied column filters. The previous implementation conflated "has any filter" with "has user-applied filter" and produced false positives when `urlFilter` was set with empty `tableFilters`.

## Tests

New file: `apps/kace-saas/src/hooks/useDataTable.clearFilters.spec.jsx`.

The hook returns a `filters` object (containing `onClear`, `onApply`, `isActive`, etc.) and a `query` object. The spec uses a minimal React test wrapper component that calls `useDataTable` with a controlled `tableFilters` prop and exposes the latest `filters` and `query` values through its rendered output or a ref. The actual assertions are on the array of filters passed to `genericSearchService`, which is captured by spying on the `queryFn` of the mocked `@tanstack/react-query`'s `useQuery`. Mocks required: `useLocation` (returns a fixed `state?.filter`), `useUserInformation`, `useDataTableColumns`, `useSchemaFields`, `useFilterTableHandler`, and `useQuery`. The spec uses `@testing-library/react`'s `render` + `act` for triggering effects and the existing `vitest` patterns from `apps/kace-saas/src/hooks/`. No new test framework is introduced.

The wrapper component shape (illustrative, not literal):

```jsx
let latestFilters;
let latestApi;

const Harness = ({ tableFilters }) => {
    const result = useDataTable({ dataTableConfig, tableFilters, /* other required config */ });
    latestFilters = result.filters;
    latestApi = result;
    return null;
};
```

Test cases:

1. **`handleClearFilters` preserves `tableFilters`-derived `baseFilters`**
   - Given `tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }]`.
   - When the wrapper has rendered and the sync effect at `useDataTable.jsx:169-173` has populated `baseFilters`, the test calls `latestFilters.onClear()` inside `act()`.
   - Then the last `queryFn` invocation still has the `workspace_id = ws-1` entry in its `filters` argument.

2. **`handleClearFilters` preserves `urlFilter`-derived `baseFilters`**
   - Given `useLocation` is mocked to return `{ state: { filter: [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }] } }`, and the wrapper receives `tableFilters = null`.
   - When `latestFilters.onClear()` is called.
   - Then the last `queryFn` invocation still has the `workspace_id = ws-1` entry in its `filters` argument.

3. **`handleClearFilters` + `handleApplyFilters` composes `baseFilters` and `userFilters`**
   - Given `tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }]`, after sync.
   - When the test calls, in order: `latestFilters.onApply({ status: { field: "status", operator: "eq", value: "closed", type: "AND" } })`, then `latestFilters.onClear()`, then `latestFilters.onApply({ status: { field: "status", operator: "eq", value: "open", type: "AND" } })`.
   - Then the last `queryFn` invocation has both `workspace_id = ws-1` and `status = open` in its `filters` argument.

4. **`isActive` reflects `userFilters` only**
   - Given `tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }]`, after sync, assert `latestFilters.isActive === false`.
   - When `latestFilters.onApply({ status: { field: "status", operator: "eq", value: "open", type: "AND" } })` runs, assert `latestFilters.isActive === true`.
   - When `latestFilters.onClear()` runs, assert `latestFilters.isActive === false`.

5. **Effect re-derives `baseFilters` on `tableFilters` change**
   - Given the wrapper is initially rendered with `tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-A", type: "AND" }]`, after sync.
   - When the parent re-renders with `tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-B", type: "AND" }]` (the harness must rerender with new props).
   - Then the last `queryFn` invocation has `workspace_id = ws-B`, not `ws-A`.

Tests 1–3 cover the reported bug directly. Tests 4–5 lock in the new contract so a future refactor does not regress it.

## Out of Scope

- Changing the UX of the **Clear filters** button (label, confirmation dialog, position). The fix is purely behavioral.
- Removing the positional comparison elsewhere in the hook. Only the `isActive` site is changed.
- Auditing other call sites of `useDataTable` to confirm none of them assume Clear filters clears the navigation context. Per the call sites reviewed (`InteractionsDataTable.jsx`, `CasesTableComponent.jsx`, and the shared `DataTable` consumers), none depend on Clear wiping `tableFilters`; if a regression is found post-merge, it will be addressed in a follow-up.
- URL persistence of filter state. The current behavior reads `location.state?.filter` for the navigation context; that is not changed.
