# useDataTable Preserve Base Filters on Clear — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bug where `workspace_id` (and any `tableFilters`-derived context) is dropped from the search payload after the user clicks **Clear filters** and re-applies another filter, in `apps/kace-saas/src/hooks/useDataTable.jsx`.

**Architecture:** The hook must keep `baseFilters` derived from `urlFilter || tableFilters` only. The user's "Clear filters" action resets `userFilters`, never `baseFilters`. The `isActive` flag is simplified from a positional JSON comparison to a direct check on `userFilters.length`.

**Tech Stack:** React 18, `@tanstack/react-query` v5, `vitest`, `@testing-library/react` (`renderHook` + `act` + `waitFor`), `react-router-dom` (`MemoryRouter`).

**Spec:** `docs/superpowers/specs/2026-07-14-useDataTable-preserve-base-filters-on-clear-design.md`

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/kace-saas/src/hooks/useDataTable.jsx` | Modify | The single shared data table hook. Touches `handleClearFilters` and the `isActive` flag. |
| `apps/kace-saas/src/hooks/useDataTable.clearFilters.spec.jsx` | Create | New unit test file for the hook covering the 5 scenarios in the spec's "Tests" section. |

No other files are modified. Consumers (`InteractionsDataTable.jsx`, `CasesTableComponent.jsx`, etc.) keep passing context filters via the `tableFilters` prop as before.

---

## Task 1: Add failing tests for the preserved-base-filters contract

**Files:**
- Create: `apps/kace-saas/src/hooks/useDataTable.clearFilters.spec.jsx`

- [ ] **Step 1.1: Create the test file with all 5 scenarios**

Create `apps/kace-saas/src/hooks/useDataTable.clearFilters.spec.jsx` with the following content. The harness mocks every external dependency the hook uses (React Query, react-table, react-i18next, sonner, schema columns, user info, the filter handler, and the search service) and exposes a `renderDataTableHook({ tableFilters, urlFilter })` helper that wraps `renderHook` in a real `QueryClientProvider` + `MemoryRouter` so the sync effects and React Query refetches run as in production.

```jsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useDataTable from "./useDataTable";
import { genericSearchService } from "@/services/genericSearchService";

vi.mock("@/services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

vi.mock("@/hooks/useDataTableColumns", () => ({
    useDataTableColumns: () => ({ columns: [], processedColumns: [] }),
}));

vi.mock("./useFilterTableHandler", () => ({
    useFilterTableHandler: () => ({
        promptConfirmation: vi.fn(),
        createNewFilter: vi.fn(),
    }),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => [] }),
}));

vi.mock("@/hooks/useUserInformation", () => ({
    default: () => ({ user: { filters: { application: { admin: {} } } } }),
}));

vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn(), promise: vi.fn() },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (k) => k }),
}));

vi.mock("@tanstack/react-table", () => ({
    useReactTable: () => ({
        getHeaderGroups: () => [],
        getRowModel: () => ({ rows: [] }),
        getAllLeafColumns: () => [],
        getColumn: () => null,
    }),
    getCoreRowModel: vi.fn(),
    flexRender: vi.fn(),
}));

const dataTableConfig = {
    key: "interactions-test",
    url: "/interactions",
    view: "interactions-view",
    entity: "interactions",
    order: { field: "receipt_at", direction: "desc" },
};

const renderDataTableHook = ({ tableFilters = null, urlFilter = null } = {}) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    const initialEntries = urlFilter
        ? [{ pathname: "/interactions", state: { filter: urlFilter } }]
        : ["/interactions"];
    const wrapper = ({ children }) =>
        createElement(
            QueryClientProvider,
            { client: queryClient },
            createElement(MemoryRouter, { initialEntries }, children)
        );

    return renderHook(
        ({ tableFilters }) => useDataTable({ dataTableConfig, tableFilters }),
        { wrapper, initialProps: { tableFilters } }
    );
};

const expectFiltersToContainWorkspace = (filters, value) => {
    expect(filters).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "workspace_id", value })])
    );
};

beforeEach(() => {
    vi.clearAllMocks();
    genericSearchService.mockResolvedValue({ data: [], total: { count: 0 } });
});

describe("useDataTable — clear filters preserves base filters", () => {
    it("preserves tableFilters-derived baseFilters when clearing", async () => {
        const tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expectFiltersToContainWorkspace(genericSearchService.mock.calls.at(-1)[1], "ws-1");

        act(() => result.current.filters.onClear());

        await waitFor(() => {
            expectFiltersToContainWorkspace(genericSearchService.mock.calls.at(-1)[1], "ws-1");
        });
    });

    it("preserves urlFilter-derived baseFilters when clearing", async () => {
        const urlFilter = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters: null, urlFilter });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expectFiltersToContainWorkspace(genericSearchService.mock.calls.at(-1)[1], "ws-1");

        act(() => result.current.filters.onClear());

        await waitFor(() => {
            expectFiltersToContainWorkspace(genericSearchService.mock.calls.at(-1)[1], "ws-1");
        });
    });

    it("composes baseFilters and userFilters across a clear+apply cycle", async () => {
        const tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());

        act(() =>
            result.current.filters.onApply({
                status: { field: "status", operator: "eq", value: "closed", type: "AND" },
            })
        );
        act(() => result.current.filters.onClear());
        act(() =>
            result.current.filters.onApply({
                status: { field: "status", operator: "eq", value: "open", type: "AND" },
            })
        );

        await waitFor(() => {
            const lastFilters = genericSearchService.mock.calls.at(-1)[1];
            expect(lastFilters).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: "workspace_id", value: "ws-1" }),
                    expect.objectContaining({ field: "status", value: "open" }),
                ])
            );
        });
    });

    it("isActive reflects userFilters only, not baseFilters", async () => {
        const tableFilters = [{ field: "workspace_id", operator: "eq", value: "ws-1", type: "AND" }];
        const { result } = renderDataTableHook({ tableFilters });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expect(result.current.filters.isActive).toBe(false);

        act(() =>
            result.current.filters.onApply({
                status: { field: "status", operator: "eq", value: "open", type: "AND" },
            })
        );
        expect(result.current.filters.isActive).toBe(true);

        act(() => result.current.filters.onClear());
        expect(result.current.filters.isActive).toBe(false);
    });

    it("re-derives baseFilters when the tableFilters prop changes", async () => {
        const { result, rerender } = renderDataTableHook({
            tableFilters: [{ field: "workspace_id", operator: "eq", value: "ws-A", type: "AND" }],
        });

        await waitFor(() => expect(genericSearchService).toHaveBeenCalled());
        expectFiltersToContainWorkspace(genericSearchService.mock.calls.at(-1)[1], "ws-A");

        rerender({
            tableFilters: [{ field: "workspace_id", operator: "eq", value: "ws-B", type: "AND" }],
        });

        await waitFor(() => {
            const lastFilters = genericSearchService.mock.calls.at(-1)[1];
            expectFiltersToContainWorkspace(lastFilters, "ws-B");
            expect(lastFilters).not.toEqual(
                expect.arrayContaining([expect.objectContaining({ value: "ws-A" })])
            );
        });
    });
});
```

- [ ] **Step 1.2: Run the tests and verify the expected failures**

Run from `apps/kace-saas/`:

```bash
pnpm vitest run src/hooks/useDataTable.clearFilters.spec.jsx
```

Expected: tests 1, 2, 3, and 4 fail because the current `handleClearFilters` resets `baseFilters` and the current `isActive` uses the positional comparison. Test 5 passes (it guards a sync effect that is unchanged by this fix).

- [ ] **Step 1.3: Commit**

```bash
git add apps/kace-saas/src/hooks/useDataTable.clearFilters.spec.jsx
git commit -m "test(useDataTable): add failing tests for clear-filters base preservation"
```

---

## Task 2: Fix `handleClearFilters` and simplify `isActive` in the hook

**Files:**
- Modify: `apps/kace-saas/src/hooks/useDataTable.jsx:284-291` (`handleClearFilters`)
- Modify: `apps/kace-saas/src/hooks/useDataTable.jsx:468-474` (`isActive` in the returned `filters` object)

- [ ] **Step 2.1: Remove `setBaseFilters([])` from `handleClearFilters`**

In `apps/kace-saas/src/hooks/useDataTable.jsx`, replace the `handleClearFilters` callback (currently lines 284-291):

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

The dependency array stays empty: the callback now references only setters and constants.

- [ ] **Step 2.2: Simplify the `isActive` flag**

In the same file, in the returned object, locate the `isActive` field (currently lines 468-474) and replace it.

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

`combinedFilters` is still used elsewhere in the hook (the `queryKey` at `useDataTable.jsx:139`), so the `useMemo` that computes it stays as is.

- [ ] **Step 2.3: Run the tests and verify they all pass**

Run from `apps/kace-saas/`:

```bash
pnpm vitest run src/hooks/useDataTable.clearFilters.spec.jsx
```

Expected: all 5 tests pass.

- [ ] **Step 2.4: Commit**

```bash
git add apps/kace-saas/src/hooks/useDataTable.jsx
git commit -m "fix(useDataTable): preserve baseFilters on clear and simplify isActive"
```

---

## Task 3: Verify no regressions in the wider app and lint passes

**Files:** none modified unless failures surface.

- [ ] **Step 3.1: Run the full `kace-saas` unit test suite**

From `apps/kace-saas/`:

```bash
pnpm vitest run
```

Expected: all tests pass. Pay special attention to `src/pages/Interactions/components/InteractionsDataTable.spec.jsx` and any `Cases` data-table spec, since those are the heaviest consumers of `useDataTable`. If any test relies on the old `isActive` semantics (treating the bar as active because of `urlFilter` alone), flag it to the user before changing it.

- [ ] **Step 3.2: Lint the changed files**

From the repo root:

```bash
pnpm --filter kace-saas exec eslint apps/kace-saas/src/hooks/useDataTable.jsx apps/kace-saas/src/hooks/useDataTable.clearFilters.spec.jsx
```

Expected: no errors. Fix any reported style issue before continuing.

- [ ] **Step 3.3: Typecheck the workspace**

From the repo root:

```bash
pnpm --filter kace-saas run typecheck
```

If the script does not exist, ask the user for the right command and run it. Expected: no type errors.

- [ ] **Step 3.4: Manual smoke check (optional, recommended)**

If a dev server is available (`pnpm --filter kace-saas dev`):

1. Open `/interactions` and select the `COL CTU CORREOS` workspace tab.
2. Open DevTools Network and apply a `Status = Closed` filter via **Update**. Confirm the request payload includes `workspace_id` AND `status = closed`.
3. Click **Clear filters**, then **Update** with `Status = Open`. Confirm the request payload still includes `workspace_id` AND `status = open`.
4. Switch to `All workspaces`, repeat steps 2–3, confirm the workspace filter is absent on every request (no `tableFilters` → no `workspace_id`).

If no dev server is available, skip this step and document the limitation in the PR description.
