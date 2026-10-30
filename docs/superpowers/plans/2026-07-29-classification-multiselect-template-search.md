# Classification MultiSelectTemplate Infinite Scroll + Dual Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a `MultiSelectTemplate` scroll infinito, precarga de relaciones como chips, búsqueda local+API, ocultar el botón de búsqueda, y persistir desasociaciones de IDs actuables — sin tocar el select de flujo.

**Architecture:** Hook `useClassificationTemplateSelect` orquesta paginación/búsqueda contra `TEMPLATES_SERVICE/search` y expone el contrato de `@kace/ui-shared` `MultiSelect`. El handler deja de dump-ear todas las plantillas; seed de labels por `operator: "in"`. `availableTemplateIds = seed ∪ selected` para el diff de relaciones.

**Tech Stack:** React 18, Vitest, React Query (`useGenericSearchQuery`), `@kace/ui-shared` MultiSelect, `genericSearch` / `genericSearchService`.

## Global Constraints

- Scope: solo plantillas en Classifications (`MultiSelectTemplate` + hook + form/handler/helpers mínimos). **No** tocar `flujo_id` / `SelectByProvider` / `ClassificationFlowSelect`.
- UI base: `@kace/ui-shared` `MultiSelect` con `hideSearchButton={true}`. **No** migrar a MultiSelect V2.
- **No** clear-all explícito (botón X).
- Búsqueda: local vía filtrado cmdk del MultiSelect sobre `data` mergeado; API con debounce ~300 ms (el debounce propio de MultiSelect cuando `followInput={false}`).
- `data` del MultiSelect = `uniqueById(accumulated ∪ apiHits)`; chips seleccionados se mantienen fuera del listado si hace falta para UX de selección (mismo patrón que Workspaces: incluir selected faltantes al inicio de `data` solo si el MultiSelect lo necesita para checks — preferir no inyectar selected en opciones si no hace falta; chips viven en `listValues`).
- Persistencia removes: `availableTemplateIds = unique(seedIds ∪ selectedIds)`. Persistidos nunca en seed ni selected se preservan.
- TDD RED → GREEN por tarea. Código mínimo. Sin comentarios en código generado salvo que el archivo ya los use.
- Rama: `feature/classification-multiselect-template-infinite-scroll-search`.
- Tras cada `git commit`, verificar `git log -1 --format='%B'` y eliminar trailer `Co-authored-by: Cursor` con `commit-tree` si aparece.

**Spec de referencia:** `docs/superpowers/specs/2026-07-29-classification-multiselect-template-search-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `Classifications/helpers/templateRelations.js` | Diff + `buildAvailableTemplateIds(seedIds, selectedTemplates)` |
| `Classifications/helpers/templateRelations.test.js` | Tests del available set y diff |
| `Classifications/hooks/useClassificationTemplateSelect.js` | Browse/search/página/merge para plantillas |
| `Classifications/hooks/useClassificationTemplateSelect.test.js` | Tests del hook |
| `Classifications/components/MultiSelectTemplate.jsx` | Wiring hook → ui-shared MultiSelect |
| `Classifications/components/MultiSelectTemplate.test.jsx` | Tests de wiring (`hideSearchButton`, props) |
| `Classifications/components/ClassificationsForm.jsx` | Chips iniciales desde `templateSeed` + `dataTemplates` |
| `Classifications/components/ClassificationsForm.test.jsx` | Ajuste mínimo al prop seed |
| `Classifications/ClassificationsUpdateHandler.jsx` | Seed por `in`; available ampliado; sin dump `limit: null` |
| `Classifications/ClassificationsUpdateHandler.test.jsx` | Ajustes mocks/expectativas |
| `Classifications/ClassificationsUpdateHandler.integration.test.jsx` | Expect seed `in` en lugar de dump total |

---

### Task 1: `buildAvailableTemplateIds` + tests de diff (TDD)

**Files:**
- Modify: `apps/kace-saas/src/pages/Classifications/helpers/templateRelations.js`
- Modify: `apps/kace-saas/src/pages/Classifications/helpers/templateRelations.test.js`

**Interfaces:**
- Produces: `buildAvailableTemplateIds(seedIds?: string[], selectedTemplates?: { id: string }[]) => string[]`
- Consumes: existing `getTemplateRelationChanges({ persistedTemplateIds, selectedTemplates, availableTemplateIds })`

- [ ] **Step 1: Write the failing tests**

Replace/extend `templateRelations.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import { buildAvailableTemplateIds, getTemplateRelationChanges } from "./templateRelations";

describe("buildAvailableTemplateIds", () => {
    it("unions seed ids with selected ids without duplicates", () => {
        expect(
            buildAvailableTemplateIds(["seed-a", "seed-b"], [{ id: "seed-b" }, { id: "selected-c" }]),
        ).toEqual(["seed-a", "seed-b", "selected-c"]);
    });

    it("ignores selected entries without id", () => {
        expect(buildAvailableTemplateIds(["seed-a"], [{ id: "" }, {}])).toEqual(["seed-a"]);
    });
});

describe("getTemplateRelationChanges", () => {
    it("preserves relations to templates that are unavailable in the selector", () => {
        const changes = getTemplateRelationChanges({
            persistedTemplateIds: ["available-a", "unavailable-b"],
            selectedTemplates: [{ id: "available-a" }],
            availableTemplateIds: ["available-a"],
        });

        expect(changes).toEqual({
            templateIdsToAdd: [],
            templateIdsToRemove: [],
        });
    });

    it("removes a preloaded seed id when the user deselects it", () => {
        const availableTemplateIds = buildAvailableTemplateIds(["seed-a", "seed-b"], [{ id: "seed-a" }]);
        const changes = getTemplateRelationChanges({
            persistedTemplateIds: ["seed-a", "seed-b"],
            selectedTemplates: [{ id: "seed-a" }],
            availableTemplateIds,
        });

        expect(changes).toEqual({
            templateIdsToAdd: [],
            templateIdsToRemove: ["seed-b"],
        });
    });

    it("adds newly selected templates not in persisted", () => {
        const availableTemplateIds = buildAvailableTemplateIds(["seed-a"], [
            { id: "seed-a" },
            { id: "new-c" },
        ]);
        const changes = getTemplateRelationChanges({
            persistedTemplateIds: ["seed-a"],
            selectedTemplates: [{ id: "seed-a" }, { id: "new-c" }],
            availableTemplateIds,
        });

        expect(changes).toEqual({
            templateIdsToAdd: ["new-c"],
            templateIdsToRemove: [],
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/helpers/templateRelations.test.js`

Expected: FAIL — `buildAvailableTemplateIds` is not exported / not defined.

- [ ] **Step 3: Write minimal implementation**

In `templateRelations.js` add:

```javascript
export const buildAvailableTemplateIds = (seedIds = [], selectedTemplates = []) => [
    ...new Set([
        ...seedIds.filter(Boolean),
        ...selectedTemplates.map(({ id }) => id).filter(Boolean),
    ]),
];
```

Keep `getTemplateRelationChanges` and `toTemplateRelationPayload` unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/helpers/templateRelations.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/pages/Classifications/helpers/templateRelations.js \
  apps/kace-saas/src/pages/Classifications/helpers/templateRelations.test.js
git commit -m "$(cat <<'EOF'
feat(classifications): build available template ids from seed and selection

EOF
)"
git log -1 --format='%B'
# If Co-authored-by: Cursor appears, strip with commit-tree per repo rule
```

---

### Task 2: `useClassificationTemplateSelect` — failing tests (TDD RED)

**Files:**
- Create: `apps/kace-saas/src/pages/Classifications/hooks/useClassificationTemplateSelect.test.js`

**Interfaces (implement in Task 3):**
- `useClassificationTemplateSelect({ pageSize?: number })` returns:
  - `data: { id: string, label: string, value: string }[]`
  - `isLoading: boolean`
  - `isLoadingMore: boolean`
  - `hasMore: boolean`
  - `searchQuery: { input: string, filter: string }`
  - `setSearchQuery: (payload: { input?: string, filter?: string }) => void`
  - `setPage: (page: number) => void`
  - `followInput: false`
  - `hideSearchButton: true`
- Browse filter always includes `{ field: "status", operator: "eq", value: 1, type: "AND" }`
- Search adds `{ field: "descripcion", operator: "ilike", value: query, type: "AND" }`
- URL: `/templates/search` (via `TEMPLATES_SERVICE` from `@/utils/URL` or `@kace/utils` — match handler import style: `@kace/utils` already used in handler)
- Page size default: `20`
- Accumulate pages without duplicate ids; on new search (page 1 + non-empty filter) replace search hits into merge set per implementation in Task 3
- `data = uniqueById(browseAccumulated ∪ searchHits)` as `{ id, label: descripcion, value: descripcion }`

- [ ] **Step 1: Write the failing tests**

Create `useClassificationTemplateSelect.test.js`:

```javascript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClassificationTemplateSelect } from "./useClassificationTemplateSelect";

const searchMock = vi.fn();

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: ({ filter, pagination, enabled }) => {
        const key = JSON.stringify({ filter, pagination, enabled });
        const result = searchMock(filter, pagination, enabled);
        return {
            data: result,
            isFetching: false,
            isLoading: false,
            refetch: vi.fn(),
        };
    },
}));

vi.mock("@kace/utils", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, TEMPLATES_SERVICE: "/templates" };
});

const wrapper = ({ children }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        {children}
    </QueryClientProvider>
);

describe("useClassificationTemplateSelect", () => {
    beforeEach(() => {
        searchMock.mockReset();
        searchMock.mockImplementation((filter, pagination) => {
            const offset = pagination?.offset ?? 0;
            if (offset === 0) {
                return {
                    rows: [
                        { id: "t1", descripcion: "Alpha" },
                        { id: "t2", descripcion: "Beta" },
                    ],
                    total: 3,
                };
            }
            return {
                rows: [{ id: "t3", descripcion: "Gamma" }],
                total: 3,
            };
        });
    });

    it("exposes hideSearchButton true and followInput false for ui-shared MultiSelect", () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        expect(result.current.hideSearchButton).toBe(true);
        expect(result.current.followInput).toBe(false);
    });

    it("loads first page mapped to id/label/value and reports hasMore", async () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });

        await waitFor(() => {
            expect(result.current.data.map((row) => row.id)).toEqual(["t1", "t2"]);
        });
        expect(result.current.data[0]).toEqual({ id: "t1", label: "Alpha", value: "Alpha" });
        expect(result.current.hasMore).toBe(true);
    });

    it("accumulates next page without duplicates when setPage increases", async () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });

        await waitFor(() => expect(result.current.data).toHaveLength(2));

        act(() => {
            result.current.setPage(2);
        });

        await waitFor(() => {
            expect(result.current.data.map((row) => row.id)).toEqual(["t1", "t2", "t3"]);
        });
        expect(result.current.hasMore).toBe(false);
    });

    it("merges API search hits by id when filter is set", async () => {
        searchMock.mockImplementation((filter) => {
            const hasSearch = filter?.some((f) => f.field === "descripcion");
            if (hasSearch) {
                return {
                    rows: [
                        { id: "t9", descripcion: "Remote Match" },
                        { id: "t1", descripcion: "Alpha" },
                    ],
                    total: 2,
                };
            }
            return {
                rows: [
                    { id: "t1", descripcion: "Alpha" },
                    { id: "t2", descripcion: "Beta" },
                ],
                total: 2,
            };
        });

        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        await waitFor(() => expect(result.current.data).toHaveLength(2));

        act(() => {
            result.current.setSearchQuery({ input: "match", filter: "match" });
        });

        await waitFor(() => {
            const ids = result.current.data.map((row) => row.id);
            expect(ids).toContain("t9");
            expect(ids).toContain("t1");
            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    it("clears remote search and returns to browse when filter is emptied", async () => {
        const { result } = renderHook(() => useClassificationTemplateSelect({ pageSize: 2 }), { wrapper });
        await waitFor(() => expect(result.current.data).toHaveLength(2));

        act(() => {
            result.current.setSearchQuery({ input: "x", filter: "x" });
        });
        act(() => {
            result.current.setSearchQuery({ input: "", filter: "" });
        });

        await waitFor(() => {
            expect(result.current.data.map((row) => row.id)).toEqual(["t1", "t2"]);
        });
    });
});
```

Note: if mocking `useGenericSearchQuery` proves brittle because the hook needs live queryKey reactivity, prefer mocking `@/services/genericSearchService` instead and use the real `useGenericSearchQuery` — keep the same assertions. Adjust the mock strategy in Step 1 if the first run shows the mock never updates on `setPage`/`setSearchQuery`; do **not** weaken assertions.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/hooks/useClassificationTemplateSelect.test.js`

Expected: FAIL — module/hook not found.

- [ ] **Step 3: Commit failing tests**

```bash
git add apps/kace-saas/src/pages/Classifications/hooks/useClassificationTemplateSelect.test.js
git commit -m "$(cat <<'EOF'
test(classifications): add failing tests for template select hook

EOF
)"
git log -1 --format='%B'
```

---

### Task 3: Implement `useClassificationTemplateSelect` (TDD GREEN)

**Files:**
- Create: `apps/kace-saas/src/pages/Classifications/hooks/useClassificationTemplateSelect.js`

**Interfaces:**
- Consumes: `useGenericSearchQuery` from `@/hooks/useGenericSearchQuery`, `TEMPLATES_SERVICE`
- Produces: contract from Task 2

- [ ] **Step 1: Write minimal implementation**

Create `useClassificationTemplateSelect.js` following the page-based pattern of `apps/kace-saas/src/pages/Workspaces/hooks/useSearchableMultiSelect.js`, specialized:

```javascript
import { useCallback, useEffect, useMemo, useState } from "react";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { TEMPLATES_SERVICE } from "@kace/utils";

const DEFAULT_PAGE_SIZE = 20;
const STATUS_ACTIVE_FILTER = { field: "status", operator: "eq", value: 1, type: "AND" };

const toOption = (row) => ({
    id: row.id,
    label: row.descripcion,
    value: row.descripcion,
});

const uniqueById = (items) => {
    const seen = new Set();
    return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
};

const processSearchResult = (data) => {
    const rows = Array.isArray(data?.data) ? data.data : [];
    const rawTotal =
        typeof data?.metadata?.count === "object" ? data.metadata.count?.count : data?.metadata?.count;
    const parsedTotal = Number(rawTotal);
    return {
        rows,
        total: Number.isFinite(parsedTotal) ? parsedTotal : null,
    };
};

export const useClassificationTemplateSelect = ({ pageSize = DEFAULT_PAGE_SIZE } = {}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchFilter, setSearchFilter] = useState("");
    const [browseItems, setBrowseItems] = useState([]);
    const [searchItems, setSearchItems] = useState([]);

    const filters = useMemo(() => {
        const next = [STATUS_ACTIVE_FILTER];
        if (searchFilter.trim()) {
            next.push({
                field: "descripcion",
                operator: "ilike",
                value: searchFilter.trim(),
                type: "AND",
            });
        }
        return next;
    }, [searchFilter]);

    const pagination = useMemo(
        () => ({
            limit: pageSize,
            offset: (currentPage - 1) * pageSize,
        }),
        [currentPage, pageSize],
    );

    const { data: searchResult, isFetching } = useGenericSearchQuery({
        url: `${TEMPLATES_SERVICE}/search`,
        keyQuery: "classificationTemplateSelect",
        filter: filters,
        pagination,
        select: processSearchResult,
        staleTime: 0,
        gcTime: 0,
    });

    useEffect(() => {
        if (!searchResult || isFetching) return;
        const mapped = (searchResult.rows ?? []).map(toOption);

        if (searchFilter.trim()) {
            if (currentPage === 1) {
                setSearchItems(mapped);
            } else {
                setSearchItems((prev) => uniqueById([...prev, ...mapped]));
            }
            return;
        }

        setSearchItems([]);
        if (currentPage === 1) {
            setBrowseItems(mapped);
        } else {
            setBrowseItems((prev) => uniqueById([...prev, ...mapped]));
        }
    }, [currentPage, isFetching, searchFilter, searchResult]);

    const setSearchQuery = useCallback((payload = {}) => {
        const nextFilter = payload.filter ?? "";
        setSearchFilter((prev) => {
            if (prev === nextFilter) return prev;
            setCurrentPage(1);
            return nextFilter;
        });
    }, []);

    const setPage = useCallback((page) => {
        setCurrentPage(page);
    }, []);

    const data = useMemo(() => uniqueById([...browseItems, ...searchItems]), [browseItems, searchItems]);

    const currentRowsLength = searchResult?.rows?.length ?? 0;
    const totalRows = searchResult?.total;
    const hasMore =
        totalRows !== null && totalRows !== undefined
            ? currentPage * pageSize < totalRows
            : currentRowsLength === pageSize;

    return {
        data,
        isLoading: isFetching && currentPage === 1,
        isLoadingMore: isFetching && currentPage > 1,
        hasMore,
        searchQuery: { input: searchFilter, filter: searchFilter },
        setSearchQuery,
        setPage,
        followInput: false,
        hideSearchButton: true,
    };
};
```

Tune the mock/`processSearchResult` shape so tests pass (align with real `genericSearchService` response if integration differs). If tests mock the hook layer, keep production code on real `useGenericSearchQuery`.

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/hooks/useClassificationTemplateSelect.test.js`

Expected: PASS. Fix mock or hook until green without deleting assertions.

- [ ] **Step 3: Commit**

```bash
git add apps/kace-saas/src/pages/Classifications/hooks/useClassificationTemplateSelect.js \
  apps/kace-saas/src/pages/Classifications/hooks/useClassificationTemplateSelect.test.js
git commit -m "$(cat <<'EOF'
feat(classifications): add useClassificationTemplateSelect hook

EOF
)"
git log -1 --format='%B'
```

---

### Task 4: `MultiSelectTemplate` wiring (TDD)

**Files:**
- Modify: `apps/kace-saas/src/pages/Classifications/components/MultiSelectTemplate.jsx`
- Create: `apps/kace-saas/src/pages/Classifications/components/MultiSelectTemplate.test.jsx`

**Interfaces:**
- Consumes: `useClassificationTemplateSelect`, `@kace/ui-shared` `MultiSelect`
- Props stay: `listValues`, `setListValues` (drop unused `options` prop if form no longer needs to pass browse options; keep optional `options` only if seed still flows through form differently — prefer **remove** `options` once form uses seed only for initial chips)

- [ ] **Step 1: Write failing tests**

```javascript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MultiSelectTemplate } from "./MultiSelectTemplate";

const hookState = {
    data: [{ id: "t1", label: "Alpha", value: "Alpha" }],
    isLoading: false,
    isLoadingMore: false,
    hasMore: true,
    searchQuery: { input: "", filter: "" },
    setSearchQuery: vi.fn(),
    setPage: vi.fn(),
    followInput: false,
    hideSearchButton: true,
};

vi.mock("../hooks/useClassificationTemplateSelect", () => ({
    useClassificationTemplateSelect: () => hookState,
}));

vi.mock("@kace/ui-shared", () => ({
    MultiSelect: (props) => (
        <div
            data-testid="ui-shared-multiselect"
            data-hide-search-button={String(props.hideSearchButton)}
            data-follow-input={String(props.followInput)}
            data-has-more={String(props.hasMore)}
            data-options={JSON.stringify(props.data)}
        />
    ),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

describe("MultiSelectTemplate", () => {
    it("hides the search button and wires hook pagination/search props", () => {
        render(<MultiSelectTemplate listValues={[]} setListValues={vi.fn()} />);

        const node = screen.getByTestId("ui-shared-multiselect");
        expect(node).toHaveAttribute("data-hide-search-button", "true");
        expect(node).toHaveAttribute("data-follow-input", "false");
        expect(node).toHaveAttribute("data-has-more", "true");
        expect(node).toHaveAttribute("data-options", JSON.stringify(hookState.data));
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/components/MultiSelectTemplate.test.jsx`

Expected: FAIL (props not wired / `hideSearchButton` missing).

- [ ] **Step 3: Implement `MultiSelectTemplate`**

```javascript
import { MultiSelect } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { useClassificationTemplateSelect } from "../hooks/useClassificationTemplateSelect";

export const MultiSelectTemplate = ({ listValues, setListValues }) => {
    const { t } = useTranslation();
    const {
        data,
        isLoading,
        isLoadingMore,
        hasMore,
        searchQuery,
        setSearchQuery,
        setPage,
        followInput,
        hideSearchButton,
    } = useClassificationTemplateSelect();

    return (
        <MultiSelect
            data={data}
            textSearch={t("classification.form.textSearchTemplates")}
            listValues={listValues}
            setListValues={setListValues}
            nameTesting="templates"
            id="multi_select_template"
            data-testid="multi_select_template"
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setPage={setPage}
            followInput={followInput}
            hideSearchButton={hideSearchButton}
        />
    );
};

MultiSelectTemplate.propTypes = {
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
};
```

- [ ] **Step 4: Run tests — PASS**

Run: `cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/components/MultiSelectTemplate.test.jsx`

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/pages/Classifications/components/MultiSelectTemplate.jsx \
  apps/kace-saas/src/pages/Classifications/components/MultiSelectTemplate.test.jsx
git commit -m "$(cat <<'EOF'
feat(classifications): wire MultiSelectTemplate to searchable infinite select

EOF
)"
git log -1 --format='%B'
```

---

### Task 5: Form precarga chips desde `templateSeed`

**Files:**
- Modify: `apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.jsx`
- Modify: `apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.test.jsx`

**Interfaces:**
- Props: rename `templateOptions` → `templateSeed` (array of `{ id, descripcion }`)
- `getInitialTemplates(dataTemplates, templateSeed)` builds chips only from seed rows (IDs resolved); persisted IDs missing from seed produce no chip

- [ ] **Step 1: Update failing/adjusting form tests**

In `ClassificationsForm.test.jsx`, replace `templateOptions` with `templateSeed` everywhere. Keep the deselect persistence UI test:

```javascript
dataTemplates: [TEMPLATE_A.id],
templateSeed: [TEMPLATE_A],
```

Assert selected chips still initialize from seed.

- [ ] **Step 2: Run form tests — expect FAIL on prop/name if not updated yet**

Run: `cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/components/ClassificationsForm.test.jsx`

- [ ] **Step 3: Update form**

```javascript
const getInitialTemplates = (templateIds = [], templateSeed = []) => {
    const selectedIds = new Set(templateIds);
    return templateSeed
        .filter(({ id }) => selectedIds.has(id))
        .map(({ id, descripcion }) => ({
            id,
            label: descripcion,
            value: descripcion,
        }));
};

const ClassificationsForm = ({
    dataHandler,
    data = {},
    isSending = false,
    dataTemplates,
    templateSeed = [],
}) => {
    const [templates, setTemplates] = useState(() => getInitialTemplates(dataTemplates, templateSeed));
    // ...
    <MultiSelectTemplate listValues={templates} setListValues={setTemplates} />
};

ClassificationsForm.propTypes = {
    // ...
    dataTemplates: PropTypes.array,
    templateSeed: PropTypes.array,
};
```

Remove `options` prop from `MultiSelectTemplate` call.

- [ ] **Step 4: Run form tests — PASS**

Run: `cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/components/ClassificationsForm.test.jsx`

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.jsx \
  apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.test.jsx
git commit -m "$(cat <<'EOF'
feat(classifications): preload template chips from relation seed

EOF
)"
git log -1 --format='%B'
```

---

### Task 6: Handler seed + available ids (sin dump total)

**Files:**
- Modify: `apps/kace-saas/src/pages/Classifications/ClassificationsUpdateHandler.jsx`
- Modify: `apps/kace-saas/src/pages/Classifications/ClassificationsUpdateHandler.test.jsx`
- Modify: `apps/kace-saas/src/pages/Classifications/ClassificationsUpdateHandler.integration.test.jsx`

**Interfaces:**
- Snapshot: `{ routeKey, revision, classification, persistedTemplateIds, templateSeed }`
- Seed query: when `id` and relations fresh, `genericSearch` / `useQuery` on `${TEMPLATES_SERVICE}/search` with filters:
  - `{ field: "id", operator: "in", value: persistedIds.join(","), type: "AND" }`
  - Prefer also `status eq 1` only if that matches product need; **spec:** seed resolves labels for persisted IDs (activo preferido). Use:
    - `id in persistedIds` **without** requiring status if inactive should stay unavailable — **do include** `status eq 1` so inactive persisted stay unresolved → no chip → preserved. Matches spec.
- Mount gate: classification (+ relations if edit) + seed query success when `persistedTemplateIds.length > 0`; if no persisted ids, seed = `[]` and skip seed wait.
- `reconcileTemplateRelations`: `availableTemplateIds = buildAvailableTemplateIds(seedIds, selectedTemplates)`
- Pass `templateSeed={formSnapshot.templateSeed}` to form

- [ ] **Step 1: Update integration test expectations (RED)**

Change test `"loads every persisted relation and every active template"` to expect:

1. Relations search (unchanged).
2. Templates search with `id` `in` of persisted ids (+ `status eq 1`), **not** `{ limit: null, offset: null }` dump of all actives.

Example expectation:

```javascript
expect(genericSearch).toHaveBeenCalledWith(
    "/templates/search",
    expect.arrayContaining([
        expect.objectContaining({ field: "id", operator: "in" }),
        expect.objectContaining({ field: "status", operator: "eq", value: 1 }),
    ]),
    expect.any(Object),
);
```

Update `renderHandler` cache key if seed query key changes (e.g. `["templatesClassificationSeed", id, persistedKey]`). Update any test that waits on the old `templatesClassifications` full dump before mount.

Add/adjust a case: deselecting a seeded template results in delete payload including that id (via mocked form submit with `selectedTemplates` without that id).

- [ ] **Step 2: Run integration tests — expect FAIL**

Run: `cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/ClassificationsUpdateHandler.integration.test.jsx`

- [ ] **Step 3: Implement handler changes**

Sketch:

```javascript
import { buildAvailableTemplateIds, getTemplateRelationChanges, toTemplateRelationPayload } from "./helpers/templateRelations";

// Remove activeTemplates dump query (limit: null).

const persistedTemplateIds = templateRelations?.data?.map((item) => item.template_id) ?? [];
const persistedKey = persistedTemplateIds.slice().sort().join(",");

const {
    data: templateSeedResult,
    isFetchedAfterMount: isSeedFetchedAfterMount,
    isRefetchError: isSeedRefetchError,
    isSuccess: isSeedSuccess,
} = useQuery({
    queryKey: ["templatesClassificationSeed", id, persistedKey],
    queryFn: async () =>
        genericSearch(
            `${TEMPLATES_SERVICE}/search`,
            [
                { field: "status", operator: "eq", value: 1, type: "AND" },
                { field: "id", operator: "in", value: persistedKey, type: "AND" },
            ],
            { limit: persistedTemplateIds.length || 1, offset: 0 },
        ),
    enabled: !!id && areTemplateRelationsFresh && persistedTemplateIds.length > 0,
    staleTime: 0,
    refetchOnMount: "always",
});

const isSeedFresh =
    persistedTemplateIds.length === 0 ||
    isSuccessfulMountFetch(isSeedFetchedAfterMount, isSeedSuccess, isSeedRefetchError);

const hasFreshFormData =
    (!id && true) ||
    (isClassificationFresh && areTemplateRelationsFresh && isSeedFresh);
// create path: no id → only need empty snapshot without template dumps
```

For **create** (`!id`): set snapshot immediately without waiting on templates dump:

```javascript
hasFreshFormData = id
  ? isClassificationFresh && areTemplateRelationsFresh && isSeedFresh
  : true; // or a one-shot mount flag — create currently waited on activeTemplates; replace with immediate snapshot
```

On create, today the code still waited for `areActiveTemplatesFresh`. After change, create mounts with `persistedTemplateIds: []`, `templateSeed: []` without a templates query.

```javascript
setFormSnapshot({
    routeKey,
    revision: 0,
    classification: data ?? INITIAL_DATA_CLASSIFICATION,
    persistedTemplateIds: id ? persistedTemplateIds : [],
    templateSeed: id ? (templateSeedResult?.data ?? []) : [],
});
```

Reconcile:

```javascript
const availableTemplateIds = buildAvailableTemplateIds(
    (formSnapshot?.templateSeed ?? []).map(({ id }) => id),
    selectedTemplates,
);
```

Form:

```javascript
templateSeed={formSnapshot.templateSeed}
```

- [ ] **Step 4: Fix unit/integration tests until green**

Run:

```bash
cd apps/kace-saas && pnpm exec vitest run \
  src/pages/Classifications/ClassificationsUpdateHandler.test.jsx \
  src/pages/Classifications/ClassificationsUpdateHandler.integration.test.jsx \
  src/pages/Classifications/components/ClassificationsForm.test.jsx \
  src/pages/Classifications/helpers/templateRelations.test.js \
  src/pages/Classifications/hooks/useClassificationTemplateSelect.test.js \
  src/pages/Classifications/components/MultiSelectTemplate.test.jsx
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/pages/Classifications/ClassificationsUpdateHandler.jsx \
  apps/kace-saas/src/pages/Classifications/ClassificationsUpdateHandler.test.jsx \
  apps/kace-saas/src/pages/Classifications/ClassificationsUpdateHandler.integration.test.jsx
git commit -m "$(cat <<'EOF'
feat(classifications): seed template labels by relation ids for reconcile

EOF
)"
git log -1 --format='%B'
```

---

### Task 7: Verification final

**Files:** none new — verify only

- [ ] **Step 1: Run full Classifications-related suite**

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications
```

Expected: PASS

- [ ] **Step 2: Manual checklist (document in commit message if anything blocked)**

- [ ] Edit classification with >1 page of templates: associated chips visible without scrolling
- [ ] Scroll loads more; search filters local + remote; no purple search button
- [ ] Deselect seeded chip → save → relation deleted
- [ ] Inactive/unavailable persisted relation (not in seed) remains after save
- [ ] Flow select unchanged

- [ ] **Step 3: Commit only if verification fixed files; otherwise stop**

If only docs/checklist notes: no empty commit.

---

## Spec coverage self-check

| Spec requirement | Task |
|---|---|
| Scroll infinito | 2–4 (hook `setPage`/`hasMore` + MultiSelect wiring) |
| Precarga chips relaciones | 5–6 |
| Limpiar de a una + select-all cargado | 4 (MultiSelect nativo) + 1/6 persist |
| Persist remove actuables; preserve unavailable | 1 + 6 |
| Búsqueda local + API merge | 2–3 (`uniqueById(browse ∪ search)`; cmdk local) |
| Quitar botón buscar | 3–4 (`hideSearchButton`) |
| Sin tocar flujo | Global constraint / Task 7 checklist |
| TDD | Tasks 1–6 RED→GREEN |
| Sin dump `limit: null` | 6 |

## Placeholder / consistency scan

- Hook name: `useClassificationTemplateSelect` everywhere.
- Prop: `templateSeed` (not `templateOptions`) from Task 5 onward.
- Available ids helper: `buildAvailableTemplateIds`.
- MultiSelect props: `data`, `listValues`, `setListValues`, `setSearchQuery`, `setPage`, `hasMore`, `isLoadingMore`, `hideSearchButton`, `followInput: false`.
