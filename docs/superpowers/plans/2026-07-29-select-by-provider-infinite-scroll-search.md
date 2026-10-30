# SelectByProvider Infinite Scroll + Search + Alpha Order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a `SelectByProvider` capacidades opt-in de scroll infinito acumulativo, búsqueda híbrida y orden alfabético híbrido, con hidratación del valor precargado, y activarlas en los tres selects de `ClassificationsForm`.

**Architecture:** Helpers puros para seed/dedupe/sort/filter; hook `useSelectByProviderQuery` (vía `useGenericSearchQuery` / `genericSearchService`) para remoto con `ilike` + `order` + paginación acumulada + seed-by-id; `Select` ui-shared gana UI opt-in; `SelectByProvider` mantiene el path legacy cuando las flags están en `false`.

**Tech Stack:** React 18, Formik, TanStack Query, Vitest, Testing Library, `genericSearchService` / `useGenericSearchQuery`, ui-shared Select.

## Global Constraints

- Opt-in: `enableSearch`, `enableInfiniteScroll`, `enableAlphabeticalOrder` default `false` → UX actual.
- Sin migrar a Select v2; sin cambios de API backend.
- Solo activar flags en `ClassificationsForm` (flujos, ANS, grupo).
- Seed: si hay valor Formik y no está en la 1ª página, resolver por `id eq` una vez y unir a options.
- Fallo de fetch: conservar options; no añadir toast nuevo en `SelectByProvider`.
- TDD RED → GREEN → refactor; código mínimo; sin comentarios de relleno.
- Rama: `feature/select-by-provider-infinite-scroll-search`.
- Tras cada `git commit`, verificar `git log -1 --format='%B'` y eliminar trailer `Co-authored-by: Cursor` con `commit-tree` si aparece.

**Spec de referencia:** `docs/superpowers/specs/2026-07-29-select-by-provider-infinite-scroll-search-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `apps/kace-saas/src/components/ui-shared/src/components/selectByProvider/selectByProviderOptions.js` | Helpers puros: field resolve, map, merge seed, sort, filter local, hasNextPage |
| `.../selectByProvider/selectByProviderOptions.test.js` | Tests vitest de helpers |
| `apps/kace-saas/src/hooks/useSelectByProviderQuery.js` | Hook remoto/local: accumulate, search, order, seed-by-id |
| `apps/kace-saas/src/hooks/useSelectByProviderQuery.test.js` | Tests del hook (mock `useGenericSearchQuery`) |
| `apps/kace-saas/src/components/ui-shared/src/components/Select/Select.jsx` | UI opt-in: search input + `fetchNextPage` |
| `apps/kace-saas/src/components/ui-shared/src/components/Select/Select.search.test.jsx` | Tests UI opt-in mínimos |
| `apps/kace-saas/src/components/ui-shared/src/components/SelectByProvider.jsx` | Dual path: legacy vs hook+flags |
| `apps/kace-saas/src/components/ui-shared/src/components/SelectByProvider.test.jsx` | Contratos opt-in / legacy |
| `apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.jsx` | Activar flags en 3 selects |
| `apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.test.jsx` | Assert flags en mocks de SelectByProvider |

---

### Task 1: Helpers puros (TDD)

**Files:**
- Create: `apps/kace-saas/src/components/ui-shared/src/components/selectByProvider/selectByProviderOptions.test.js`
- Create: `apps/kace-saas/src/components/ui-shared/src/components/selectByProvider/selectByProviderOptions.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `resolveFieldName(labelFrom, explicitField) → string | null`
  - `mapRawItemsToOptions(items, { valueFrom, labelFrom }) → { value, label }[]`
  - `mergeSeedIntoOptions(options, seedOption) → { value, label }[]`
  - `sortOptionsAlphabetically(options) → { value, label }[]`
  - `filterOptionsByLabel(options, query) → { value, label }[]`
  - `computeHasNextPage({ accumulatedCount, pageSize, total, lastPageCount }) → boolean`

- [ ] **Step 1: Write failing tests**

```javascript
import { describe, expect, it } from "vitest";
import {
    computeHasNextPage,
    filterOptionsByLabel,
    mapRawItemsToOptions,
    mergeSeedIntoOptions,
    resolveFieldName,
    sortOptionsAlphabetically,
} from "./selectByProviderOptions";

describe("resolveFieldName", () => {
    it("prefers explicitField", () => {
        expect(resolveFieldName("nombre", "codigo")).toBe("codigo");
    });

    it("uses string labelFrom when no explicit field", () => {
        expect(resolveFieldName("nombre", undefined)).toBe("nombre");
    });

    it("uses first entry when labelFrom is an array", () => {
        expect(resolveFieldName(["nombre", "codigo"], undefined)).toBe("nombre");
    });
});

describe("mapRawItemsToOptions", () => {
    it("maps id/nombre to value/label", () => {
        expect(
            mapRawItemsToOptions([{ id: "1", nombre: "Zeta" }], { valueFrom: "id", labelFrom: "nombre" }),
        ).toEqual([{ value: "1", label: "Zeta" }]);
    });

    it("joins array labelFrom with spaces", () => {
        expect(
            mapRawItemsToOptions([{ id: "1", a: "Foo", b: "Bar" }], { valueFrom: "id", labelFrom: ["a", "b"] }),
        ).toEqual([{ value: "1", label: "Foo Bar" }]);
    });
});

describe("mergeSeedIntoOptions", () => {
    it("prepends seed when missing from page options", () => {
        expect(
            mergeSeedIntoOptions(
                [{ value: "2", label: "B" }],
                { value: "1", label: "A" },
            ),
        ).toEqual([
            { value: "1", label: "A" },
            { value: "2", label: "B" },
        ]);
    });

    it("dedupes seed already present (keeps page label)", () => {
        expect(
            mergeSeedIntoOptions(
                [{ value: "1", label: "From page" }],
                { value: "1", label: "From seed" },
            ),
        ).toEqual([{ value: "1", label: "From page" }]);
    });

    it("returns options unchanged when seed is null", () => {
        const options = [{ value: "1", label: "A" }];
        expect(mergeSeedIntoOptions(options, null)).toEqual(options);
    });
});

describe("sortOptionsAlphabetically", () => {
    it("sorts by label ascending with localeCompare", () => {
        expect(
            sortOptionsAlphabetically([
                { value: "2", label: "zeta" },
                { value: "1", label: "Alfa" },
            ]),
        ).toEqual([
            { value: "1", label: "Alfa" },
            { value: "2", label: "zeta" },
        ]);
    });
});

describe("filterOptionsByLabel", () => {
    it("filters case-insensitively by substring", () => {
        expect(
            filterOptionsByLabel(
                [
                    { value: "1", label: "Flujo Norte" },
                    { value: "2", label: "Sur" },
                ],
                "norte",
            ),
        ).toEqual([{ value: "1", label: "Flujo Norte" }]);
    });

    it("returns all options when query is blank", () => {
        const options = [{ value: "1", label: "A" }];
        expect(filterOptionsByLabel(options, "  ")).toEqual(options);
    });
});

describe("computeHasNextPage", () => {
    it("uses total when provided", () => {
        expect(computeHasNextPage({ accumulatedCount: 20, pageSize: 20, total: 45, lastPageCount: 20 })).toBe(true);
        expect(computeHasNextPage({ accumulatedCount: 45, pageSize: 20, total: 45, lastPageCount: 5 })).toBe(false);
    });

    it("falls back to full last page when total missing", () => {
        expect(computeHasNextPage({ accumulatedCount: 20, pageSize: 20, total: null, lastPageCount: 20 })).toBe(true);
        expect(computeHasNextPage({ accumulatedCount: 15, pageSize: 20, total: null, lastPageCount: 15 })).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/selectByProvider/selectByProviderOptions.test.js
```

Expected: FAIL (module missing / exports missing).

- [ ] **Step 3: Minimal implementation**

```javascript
const extracValue = (data, keyFrom) => {
    const fromArray = String(keyFrom).split(".");
    return fromArray.reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : null), data);
};

const getLabelFromItem = (item, labelFrom) => {
    if (Array.isArray(labelFrom)) {
        return labelFrom
            .map((key) => extracValue(item, key))
            .filter((value) => typeof value === "string" && value.trim() !== "")
            .join(" ");
    }
    const res = extracValue(item, labelFrom);
    return typeof res === "string" ? res : "";
};

export const resolveFieldName = (labelFrom, explicitField) => {
    if (typeof explicitField === "string" && explicitField.trim() !== "") {
        return explicitField;
    }
    if (typeof labelFrom === "string" && labelFrom.trim() !== "") {
        return labelFrom;
    }
    if (Array.isArray(labelFrom) && typeof labelFrom[0] === "string") {
        return labelFrom[0];
    }
    return null;
};

export const mapRawItemsToOptions = (items, { valueFrom = "id", labelFrom = "nombre" } = {}) => {
    if (!Array.isArray(items)) return [];
    return items
        .map((item) => {
            if (item instanceof Object) {
                return {
                    value: item[valueFrom],
                    label: getLabelFromItem(item, labelFrom),
                };
            }
            if (typeof item === "string") {
                return { label: item, value: item };
            }
            return null;
        })
        .filter(Boolean);
};

export const mergeSeedIntoOptions = (options, seedOption) => {
    if (!seedOption || seedOption.value === undefined || seedOption.value === null || seedOption.value === "") {
        return options;
    }
    const seedValue = String(seedOption.value);
    if (options.some((opt) => String(opt.value) === seedValue)) {
        return options;
    }
    return [seedOption, ...options];
};

export const sortOptionsAlphabetically = (options) =>
    [...options].sort((a, b) => String(a.label ?? "").localeCompare(String(b.label ?? ""), undefined, { sensitivity: "base" }));

export const filterOptionsByLabel = (options, query) => {
    const normalized = String(query ?? "").trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((opt) => String(opt.label ?? "").toLowerCase().includes(normalized));
};

export const computeHasNextPage = ({ accumulatedCount, pageSize, total, lastPageCount }) => {
    if (typeof total === "number" && Number.isFinite(total)) {
        return accumulatedCount < total;
    }
    return lastPageCount >= pageSize;
};
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/selectByProvider/selectByProviderOptions.test.js
```

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/selectByProvider/selectByProviderOptions.js \
  apps/kace-saas/src/components/ui-shared/src/components/selectByProvider/selectByProviderOptions.test.js
git commit -m "$(cat <<'EOF'
feat(select): add SelectByProvider option helpers

EOF
)"
git log -1 --format='%B'
```

---

### Task 2: Hook RED — contract tests

**Files:**
- Create: `apps/kace-saas/src/hooks/useSelectByProviderQuery.test.js`

**Interfaces (implement in Task 3):**
- Consumes: `useGenericSearchQuery`, helpers from Task 1
- Produces: `useSelectByProviderQuery(params) → { options, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, setSearchTerm, isSearching }`

Params shape:

```javascript
{
  name, url, filters = [], queryLimit = 20,
  valueFrom = "id", labelFrom = "nombre",
  searchField, orderField,
  enableSearch = false, enableInfiniteScroll = false, enableAlphabeticalOrder = false,
  dataOptions = null, processData = (d) => d,
  selectedValue, initialValue = {},
}
```

- [ ] **Step 1: Write failing hook tests**

```javascript
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useGenericSearchQueryMock = vi.fn();

vi.mock("./useGenericSearchQuery", () => ({
    default: (args) => useGenericSearchQueryMock(args),
}));

import useSelectByProviderQuery from "./useSelectByProviderQuery";

const pageOne = {
    data: [
        { id: "2", nombre: "Beta" },
        { id: "3", nombre: "Gamma" },
    ],
    total: 4,
    count: 2,
};

describe("useSelectByProviderQuery", () => {
    beforeEach(() => {
        useGenericSearchQueryMock.mockReset();
        useGenericSearchQueryMock.mockImplementation(({ keyQuery, enabled }) => {
            if (enabled === false) {
                return { data: undefined, isLoading: false, isFetching: false, isError: false };
            }
            if (String(keyQuery).includes("seed")) {
                return {
                    data: { data: [{ id: "99", nombre: "Seeded Flow" }], total: 1, count: 1 },
                    isLoading: false,
                    isFetching: false,
                    isError: false,
                };
            }
            return { data: pageOne, isLoading: false, isFetching: false, isError: false };
        });
    });

    it("maps remote page to options and requests alphabetical order when enabled", () => {
        const { result } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableAlphabeticalOrder: true,
                enableInfiniteScroll: true,
                labelFrom: "nombre",
                queryLimit: 2,
            }),
        );

        const listCall = useGenericSearchQueryMock.mock.calls
            .map(([args]) => args)
            .find((args) => args.keyQuery === "select-by-provider:flujo_id");

        expect(listCall.order).toEqual({ field: "nombre", direction: "asc" });
        expect(listCall.pagination).toEqual({ limit: 2, offset: 0 });
        expect(result.current.options.map((o) => o.value)).toEqual(["2", "3"]);
    });

    it("appends next page on fetchNextPage when infinite scroll enabled", async () => {
        let page = 0;
        useGenericSearchQueryMock.mockImplementation(({ keyQuery, pagination }) => {
            if (String(keyQuery).includes("seed")) {
                return { data: undefined, isLoading: false, isFetching: false, isError: false };
            }
            page = pagination?.offset === 0 ? 0 : 1;
            const data =
                page === 0
                    ? pageOne
                    : { data: [{ id: "4", nombre: "Delta" }], total: 4, count: 1 };
            return { data, isLoading: false, isFetching: false, isError: false };
        });

        const { result, rerender } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableInfiniteScroll: true,
                queryLimit: 2,
            }),
        );

        expect(result.current.hasNextPage).toBe(true);

        act(() => {
            result.current.fetchNextPage();
        });
        rerender();

        await waitFor(() => {
            expect(result.current.options.map((o) => o.value)).toEqual(["2", "3", "4"]);
        });
    });

    it("adds ilike filter and resets accumulation when search term changes", () => {
        const { result, rerender } = renderHook(
            ({ term }) => {
                const api = useSelectByProviderQuery({
                    name: "flujo_id",
                    url: "/flows",
                    enableSearch: true,
                    enableInfiniteScroll: true,
                    searchField: "nombre",
                });
                // expose setter then apply term via effect-like act in test
                return api;
            },
            { initialProps: { term: "" } },
        );

        act(() => {
            result.current.setSearchTerm("nor");
        });
        rerender({ term: "nor" });

        const listCall = useGenericSearchQueryMock.mock.calls
            .map(([args]) => args)
            .filter((args) => args.keyQuery === "select-by-provider:flujo_id")
            .at(-1);

        expect(listCall.filter).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "nombre", operator: "ilike", value: "nor", type: "AND" }),
            ]),
        );
        expect(listCall.pagination.offset).toBe(0);
    });

    it("merges seed-by-id option when selectedValue missing from first page", () => {
        const { result } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableInfiniteScroll: true,
                selectedValue: "99",
                queryLimit: 2,
            }),
        );

        const seedCall = useGenericSearchQueryMock.mock.calls
            .map(([args]) => args)
            .find((args) => String(args.keyQuery).includes("seed"));

        expect(seedCall.enabled).toBe(true);
        expect(seedCall.filter).toEqual(
            expect.arrayContaining([expect.objectContaining({ field: "id", operator: "eq", value: "99" })]),
        );
        expect(result.current.options.some((o) => String(o.value) === "99" && o.label === "Seeded Flow")).toBe(true);
    });

    it("sorts and filters dataOptions locally when provided", () => {
        useGenericSearchQueryMock.mockImplementation(() => ({
            data: undefined,
            isLoading: false,
            isFetching: false,
            isError: false,
        }));

        const { result } = renderHook(() =>
            useSelectByProviderQuery({
                name: "local",
                url: "",
                dataOptions: [
                    { id: "2", nombre: "Zeta" },
                    { id: "1", nombre: "Alfa" },
                ],
                enableAlphabeticalOrder: true,
                enableSearch: true,
            }),
        );

        expect(result.current.options.map((o) => o.label)).toEqual(["Alfa", "Zeta"]);

        act(() => {
            result.current.setSearchTerm("al");
        });

        expect(result.current.options.map((o) => o.label)).toEqual(["Alfa"]);
    });

    it("uses initialValue as seed without remote seed fetch when label present", () => {
        const { result } = renderHook(() =>
            useSelectByProviderQuery({
                name: "flujo_id",
                url: "/flows",
                enableInfiniteScroll: true,
                selectedValue: "77",
                initialValue: { id: "77", nombre: "Preloaded" },
                queryLimit: 2,
            }),
        );

        const seedCall = useGenericSearchQueryMock.mock.calls
            .map(([args]) => args)
            .find((args) => String(args.keyQuery).includes("seed"));

        expect(seedCall?.enabled).toBe(false);
        expect(result.current.options[0]).toEqual({ value: "77", label: "Preloaded" });
    });
});
```

Note: if the “search term” test is awkward with the inline pattern, simplify to call `setSearchTerm` then assert the latest mock call — keep assertions above.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/kace-saas && pnpm exec vitest run src/hooks/useSelectByProviderQuery.test.js
```

Expected: FAIL (module missing).

- [ ] **Step 3: Commit RED tests only**

```bash
git add apps/kace-saas/src/hooks/useSelectByProviderQuery.test.js
git commit -m "$(cat <<'EOF'
test(select): RED contract for useSelectByProviderQuery

EOF
)"
git log -1 --format='%B'
```

---

### Task 3: Hook GREEN — implement `useSelectByProviderQuery`

**Files:**
- Create: `apps/kace-saas/src/hooks/useSelectByProviderQuery.js`
- Modify: `apps/kace-saas/src/hooks/useSelectByProviderQuery.test.js` (only if mock wiring needs tiny fix; do not weaken assertions)

**Interfaces:**
- Consumes: Task 1 helpers; `useGenericSearchQuery` from `./useGenericSearchQuery`
- Produces: API documented in Task 2

- [ ] **Step 1: Implement hook (minimal)**

Rules to encode:

1. `searchUrl = url` already ends with `/search`? If `url` comes without suffix from SelectByProvider (`FLOW_SERVICE`), append `/search` only if missing.
2. List query key: `select-by-provider:${name}`; include filters + search + page in queryKey via the args passed to `useGenericSearchQuery`.
3. Base `filters` from caller preserved; if `enableSearch` and `searchTerm` non-empty, append `{ field: resolveFieldName(labelFrom, searchField), operator: "ilike", value: searchTerm, type: "AND" }`.
4. If `enableAlphabeticalOrder` and remote: `order: { field: resolveFieldName(labelFrom, orderField), direction: "asc" }`; else `order: null` (service default) — for Classifications we pass the flag so order applies.
5. Accumulate pages in state when `enableInfiniteScroll`; on searchTerm change reset `page` to 0 and clear accumulated options before applying new page.
6. Without `enableInfiniteScroll`: only page 0, replace options (no append).
7. Seed:
   - If `initialValue` has matching id + label → `mapRawItemsToOptions([initialValue], …)` as seedOption.
   - Else if `selectedValue` set and not in accumulated options → enable seed query with filter `id eq selectedValue`, map first row to seedOption.
8. Final options: `mergeSeedIntoOptions(mappedPages, seedOption)`; if `dataOptions`, skip remote list, map/sort/filter locally.
9. `fetchNextPage`: `setPage((p) => p + 1)` only if `hasNextPage && !isFetching`.
10. `setSearchTerm`: update term (debounce optional inside Select UI; hook can accept immediate term — Select will debounce before calling).

Skeleton:

```javascript
import { useEffect, useMemo, useState } from "react";
import useGenericSearchQuery from "./useGenericSearchQuery";
import {
    computeHasNextPage,
    filterOptionsByLabel,
    mapRawItemsToOptions,
    mergeSeedIntoOptions,
    resolveFieldName,
    sortOptionsAlphabetically,
} from "../components/ui-shared/src/components/selectByProvider/selectByProviderOptions";

const toSearchUrl = (url) => {
    if (!url) return "";
    return url.endsWith("/search") ? url : `${url}/search`;
};

const useSelectByProviderQuery = ({
    name,
    url,
    filters = [],
    queryLimit = 20,
    valueFrom = "id",
    labelFrom = "nombre",
    searchField,
    orderField,
    enableSearch = false,
    enableInfiniteScroll = false,
    enableAlphabeticalOrder = false,
    dataOptions = null,
    processData = (data) => data,
    selectedValue,
    initialValue = {},
}) => {
    const [page, setPage] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [accumulated, setAccumulated] = useState([]);

    const fieldForSearch = resolveFieldName(labelFrom, searchField);
    const fieldForOrder = resolveFieldName(labelFrom, orderField);

    const remoteFilters = useMemo(() => {
        const next = [...filters];
        if (enableSearch && searchTerm.trim() && fieldForSearch) {
            next.push({ field: fieldForSearch, operator: "ilike", value: searchTerm.trim(), type: "AND" });
        }
        return next;
    }, [filters, enableSearch, searchTerm, fieldForSearch]);

    const order = enableAlphabeticalOrder && fieldForOrder
        ? { field: fieldForOrder, direction: "asc" }
        : null;

    const isLocal = Array.isArray(dataOptions);

    const listQuery = useGenericSearchQuery({
        keyQuery: `select-by-provider:${name}`,
        url: toSearchUrl(url),
        filter: remoteFilters,
        pagination: { limit: queryLimit, offset: page * queryLimit },
        order,
        enabled: !isLocal && !!url,
        select: (data) => processData(data),
    });

    // reset accumulation when search changes
    useEffect(() => {
        setPage(0);
        setAccumulated([]);
    }, [searchTerm, remoteFilters /* careful: prefer searchTerm + serialized filters */]);

    useEffect(() => {
        const rows = listQuery.data?.data;
        if (!Array.isArray(rows)) return;
        const mapped = mapRawItemsToOptions(rows, { valueFrom, labelFrom });
        setAccumulated((prev) => {
            if (!enableInfiniteScroll || page === 0) return mapped;
            const seen = new Set(prev.map((o) => String(o.value)));
            return [...prev, ...mapped.filter((o) => !seen.has(String(o.value)))];
        });
    }, [listQuery.data, page, enableInfiniteScroll, valueFrom, labelFrom]);

    const seedFromInitial = useMemo(() => {
        if (!initialValue || !Object.values(initialValue).some(Boolean)) return null;
        const mapped = mapRawItemsToOptions([initialValue], { valueFrom, labelFrom })[0];
        if (!mapped?.value) return null;
        if (selectedValue != null && String(mapped.value) !== String(selectedValue)) return null;
        return mapped.label ? mapped : mapped;
    }, [initialValue, valueFrom, labelFrom, selectedValue]);

    const needsSeedFetch =
        !isLocal &&
        selectedValue != null &&
        selectedValue !== "" &&
        !seedFromInitial?.label &&
        !accumulated.some((o) => String(o.value) === String(selectedValue));

    const seedQuery = useGenericSearchQuery({
        keyQuery: `select-by-provider:${name}:seed`,
        url: toSearchUrl(url),
        filter: [{ field: valueFrom, operator: "eq", value: selectedValue, type: "AND" }],
        pagination: { limit: 1, offset: 0 },
        enabled: needsSeedFetch,
    });

    const seedOption = useMemo(() => {
        if (seedFromInitial?.label) return seedFromInitial;
        if (seedFromInitial && !needsSeedFetch) return seedFromInitial;
        const row = seedQuery.data?.data?.[0];
        if (!row) return seedFromInitial;
        return mapRawItemsToOptions([row], { valueFrom, labelFrom })[0] ?? null;
    }, [seedFromInitial, seedQuery.data, needsSeedFetch, valueFrom, labelFrom]);

    const options = useMemo(() => {
        if (isLocal) {
            let local = mapRawItemsToOptions(dataOptions, { valueFrom, labelFrom });
            if (enableAlphabeticalOrder) local = sortOptionsAlphabetically(local);
            if (enableSearch) local = filterOptionsByLabel(local, searchTerm);
            return mergeSeedIntoOptions(local, seedFromInitial);
        }
        const merged = mergeSeedIntoOptions(accumulated, seedOption);
        return merged;
    }, [
        isLocal,
        dataOptions,
        accumulated,
        seedOption,
        seedFromInitial,
        enableAlphabeticalOrder,
        enableSearch,
        searchTerm,
        valueFrom,
        labelFrom,
    ]);

    const lastPageCount = Array.isArray(listQuery.data?.data) ? listQuery.data.data.length : 0;
    const total = typeof listQuery.data?.total === "number" ? listQuery.data.total : null;
    const hasNextPage =
        enableInfiniteScroll &&
        computeHasNextPage({
            accumulatedCount: accumulated.length,
            pageSize: queryLimit,
            total,
            lastPageCount,
        });

    const fetchNextPage = () => {
        if (!hasNextPage || listQuery.isFetching) return;
        setPage((p) => p + 1);
    };

    return {
        options,
        isLoading: !isLocal && listQuery.isLoading && page === 0,
        isFetchingNextPage: !isLocal && listQuery.isFetching && page > 0,
        hasNextPage,
        fetchNextPage,
        setSearchTerm,
        isSearching: enableSearch && listQuery.isFetching && searchTerm.trim() !== "",
    };
};

export default useSelectByProviderQuery;
```

Tighten the reset/`useEffect` deps during implementation so tests pass without loops. Prefer resetting on `searchTerm` only + `JSON.stringify(filters)` if needed.

- [ ] **Step 2: Run — expect PASS**

```bash
cd apps/kace-saas && pnpm exec vitest run src/hooks/useSelectByProviderQuery.test.js
```

- [ ] **Step 3: Commit**

```bash
git add apps/kace-saas/src/hooks/useSelectByProviderQuery.js apps/kace-saas/src/hooks/useSelectByProviderQuery.test.js
git commit -m "$(cat <<'EOF'
feat(select): implement useSelectByProviderQuery

EOF
)"
git log -1 --format='%B'
```

---

### Task 4: Select UI opt-in (search + fetchNextPage)

**Files:**
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/Select/Select.jsx`
- Create: `apps/kace-saas/src/components/ui-shared/src/components/Select/Select.search.test.jsx`

**Interfaces:**
- Consumes: existing Select props
- Produces (new optional props):
  - `onSearchChange?: (term: string) => void` — show search input; debounce 300ms then call
  - `fetchNextPage?: () => void`
  - `hasNextPage?: boolean`
  - `isFetchingNextPage?: boolean`
  - When `fetchNextPage` provided, use it on scroll bottom instead of `setPage(p => p + 1)`
  - When neither search nor fetchNextPage: UI identical to today

- [ ] **Step 1: Write failing UI tests**

Mock heavy radix pieces as needed (follow patterns in nearby Select tests if any; otherwise mock `@kace/ui-shared` Select primitives lightly and assert DOM):

```javascript
import { fireEvent, render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("formik", () => ({
    useField: () => [{ value: "", name: "flujo_id" }, { touched: false, error: undefined }, { setValue: vi.fn(), setTouched: vi.fn() }],
}));

vi.mock("@kace/ui-shared", () => ({
    Select: ({ children, ...props }) => <div data-testid="radix-select" {...props}>{children}</div>,
    SelectContent: ({ children, ...props }) => (
        <div data-testid="select-content" {...props}>{children}</div>
    ),
    SelectGroup: ({ children }) => <div>{children}</div>,
    SelectItem: ({ children, value }) => <div data-testid={`item-${value}`}>{children}</div>,
    SelectLabel: ({ children }) => <div>{children}</div>,
    SelectTrigger: ({ children, ...props }) => <button type="button" {...props}>{children}</button>,
    SelectValue: () => <span />,
    Label: ({ children }) => <label>{children}</label>,
    GeneralLoader: () => <div>loading</div>,
}));

vi.mock("../InputErrors", () => ({ InputErrors: () => null }));

import { Select } from "./Select";

describe("Select opt-in search and infinite scroll", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not render search input without onSearchChange", () => {
        render(<Select name="flujo_id" options={[{ value: "1", label: "A" }]} />);
        expect(screen.queryByPlaceholderText("Buscar...")).toBeNull();
    });

    it("debounces onSearchChange", () => {
        const onSearchChange = vi.fn();
        render(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "A" }]}
                onSearchChange={onSearchChange}
            />,
        );
        fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "nor" } });
        expect(onSearchChange).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(onSearchChange).toHaveBeenCalledWith("nor");
    });

    it("calls fetchNextPage on scroll when hasNextPage", () => {
        const fetchNextPage = vi.fn();
        render(
            <Select
                name="flujo_id"
                options={[{ value: "1", label: "A" }]}
                fetchNextPage={fetchNextPage}
                hasNextPage
            />,
        );
        const content = screen.getByTestId("select-content");
        Object.defineProperty(content, "scrollTop", { value: 100, configurable: true });
        Object.defineProperty(content, "scrollHeight", { value: 120, configurable: true });
        Object.defineProperty(content, "clientHeight", { value: 20, configurable: true });
        fireEvent.scroll(content);
        expect(fetchNextPage).toHaveBeenCalled();
    });
});
```

Adjust mock if `SelectContent` ref/`onScroll` wiring differs — keep the three behaviors.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/Select/Select.search.test.jsx
```

- [ ] **Step 3: Implement Select changes**

In `Select.jsx`:

- Add props: `onSearchChange`, `fetchNextPage`, `hasNextPage = false`, `isFetchingNextPage = false`.
- Local `searchInput` state; `useEffect` debounce 300ms → `onSearchChange?.(term)`.
- Render search row above options only if `typeof onSearchChange === "function"`.
- In `handleScroll`: if `fetchNextPage` then call it when near bottom and `hasNextPage && !isFetchingNextPage`; else keep existing `setPage` behavior.
- Show small loader at bottom when `isFetchingNextPage`.

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/Select/Select.search.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/Select/Select.jsx \
  apps/kace-saas/src/components/ui-shared/src/components/Select/Select.search.test.jsx
git commit -m "$(cat <<'EOF'
feat(select): opt-in search and fetchNextPage on Select

EOF
)"
git log -1 --format='%B'
```

---

### Task 5: Wire `SelectByProvider` (legacy + enhanced)

**Files:**
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/SelectByProvider.jsx`
- Create: `apps/kace-saas/src/components/ui-shared/src/components/SelectByProvider.test.jsx`

**Interfaces:**
- Consumes: Task 3 hook, Task 4 Select props, Formik `values[name]`
- Produces: props `enableSearch`, `enableInfiniteScroll`, `enableAlphabeticalOrder`, `searchField`, `orderField` (defaults false/undefined)

- [ ] **Step 1: Failing tests**

```javascript
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

const hookState = {
    options: [{ value: "1", label: "Alpha" }],
    isLoading: false,
    isFetchingNextPage: false,
    hasNextPage: true,
    fetchNextPage: vi.fn(),
    setSearchTerm: vi.fn(),
    isSearching: false,
};

vi.mock("../../../../hooks/useSelectByProviderQuery", () => ({
    default: vi.fn(() => hookState),
}));

vi.mock("formik", () => ({
    useFormikContext: () => ({
        values: { flujo_id: "1" },
        setFieldValue: vi.fn(),
        setFieldTouched: vi.fn(),
    }),
}));

vi.mock("./Select/Select", () => ({
    Select: (props) => (
        <div
            data-testid="select-mock"
            data-has-fetch={String(typeof props.fetchNextPage === "function")}
            data-has-search={String(typeof props.onSearchChange === "function")}
            data-options={JSON.stringify(props.options)}
        />
    ),
}));

vi.mock("@kace/ui-shared", () => ({
    KField: ({ children }) => <div>{children}</div>,
}));

import useSelectByProviderQuery from "../../../../hooks/useSelectByProviderQuery";
import { SelectByProvider } from "./SelectByProvider";

describe("SelectByProvider opt-in", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("does not call enhanced hook when flags are off", () => {
        render(<SelectByProvider name="flujo_id" url="/flows" />);
        expect(useSelectByProviderQuery).not.toHaveBeenCalled();
    });

    it("uses hook and passes search/scroll props when flags on", () => {
        render(
            <SelectByProvider
                name="flujo_id"
                url="/flows"
                enableSearch
                enableInfiniteScroll
                enableAlphabeticalOrder
            />,
        );
        expect(useSelectByProviderQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "flujo_id",
                enableSearch: true,
                enableInfiniteScroll: true,
                enableAlphabeticalOrder: true,
                selectedValue: "1",
            }),
        );
        const el = screen.getByTestId("select-mock");
        expect(el.dataset.hasFetch).toBe("true");
        expect(el.dataset.hasSearch).toBe("true");
        expect(el.dataset.options).toContain("Alpha");
    });
});
```

Fix relative mock path to match real location of the hook from this file (`apps/kace-saas/src/hooks/useSelectByProviderQuery.js` → from ui-shared component use `@/hooks/useSelectByProviderQuery` or the relative path you choose in the implementation; keep import and mock identical).

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/SelectByProvider.test.jsx
```

- [ ] **Step 3: Implement dual path in SelectByProvider**

```javascript
const enhanced = enableSearch || enableInfiniteScroll || enableAlphabeticalOrder;

const selectedValue = values[name];
const query = useSelectByProviderQuery({
    name,
    url,
    filters,
    queryLimit,
    valueFrom,
    labelFrom,
    searchField,
    orderField,
    enableSearch,
    enableInfiniteScroll,
    enableAlphabeticalOrder,
    dataOptions,
    processData,
    selectedValue,
    initialValue,
});

// Rules of hooks: always call the hook, but pass enabled:false internally when !enhanced
// OR split into SelectByProviderEnhanced child component to avoid conditional hooks.
```

**Prefer:** extract `SelectByProviderEnhanced` in the same file (or tiny sibling) that always calls the hook; parent renders Enhanced vs Legacy. Avoid conditional hook calls.

Legacy branch: keep current `useQuery` + `genericSearch` + `setPage` + `handlerOptions` replace behavior unchanged.

Enhanced branch: pass to Select:

```javascript
options={query.options}
isLoading={query.isLoading}
fetchNextPage={enableInfiniteScroll ? query.fetchNextPage : undefined}
hasNextPage={enableInfiniteScroll ? query.hasNextPage : false}
isFetchingNextPage={query.isFetchingNextPage}
onSearchChange={enableSearch ? query.setSearchTerm : undefined}
```

Do not pass legacy `setPage` in enhanced mode.

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/SelectByProvider.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/SelectByProvider.jsx \
  apps/kace-saas/src/components/ui-shared/src/components/SelectByProvider.test.jsx
git commit -m "$(cat <<'EOF'
feat(select): wire SelectByProvider opt-in query UX

EOF
)"
git log -1 --format='%B'
```

---

### Task 6: Enable flags in `ClassificationsForm`

**Files:**
- Modify: `apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.jsx`
- Modify: `apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.test.jsx`

**Interfaces:**
- Consumes: SelectByProvider new props
- Produces: three selects with `enableSearch`, `enableInfiniteScroll`, `enableAlphabeticalOrder` true; `selectedValue` comes from Formik via provider (ids in `data`)

- [ ] **Step 1: Update form test mock to capture props**

Replace the null mock with a spy mock:

```javascript
const selectByProviderCalls = [];

vi.mock("@kace/ui-shared", () => ({
    InputForm: () => null,
    KField: ({ children }) => children,
    SelectByProvider: (props) => {
        selectByProviderCalls.push(props);
        return <div data-testid={`sbp-${props.name}`} />;
    },
}));
```

Add test:

```javascript
it("enables search, infinite scroll, and alphabetical order on flow, ans, and group selects", async () => {
    selectByProviderCalls.length = 0;
    render(
        <ClassificationsForm
            dataHandler={vi.fn()}
            data={{ ...CLASSIFICATION, default_group_id: "44444444-4444-4444-8444-444444444444" }}
            dataTemplates={[]}
            templateOptions={[]}
        />,
    );

    await waitFor(() => {
        expect(selectByProviderCalls.map((c) => c.name).sort()).toEqual([
            "ans_id",
            "default_group_id",
            "flujo_id",
        ]);
    });

    for (const call of selectByProviderCalls) {
        expect(call.enableSearch).toBe(true);
        expect(call.enableInfiniteScroll).toBe(true);
        expect(call.enableAlphabeticalOrder).toBe(true);
    }
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/Classifications/components/ClassificationsForm.test.jsx
```

- [ ] **Step 3: Wire props on the three SelectByProvider instances**

```jsx
<SelectByProvider
    name="flujo_id"
    url={`${FLOW_SERVICE}`}
    valueFrom="id"
    labelFrom="nombre"
    staleTime={0}
    enableSearch
    enableInfiniteScroll
    enableAlphabeticalOrder
    filters={[/* existing status filter */]}
    id="clasifications_select"
    data-testid="clasifications_select"
/>
```

Same three flags on `ans_id` and `default_group_id` (no need for `initialValue` if seed-by-id uses Formik value).

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/kace-saas && pnpm exec vitest run \
  src/pages/Classifications/components/ClassificationsForm.test.jsx \
  src/components/ui-shared/src/components/SelectByProvider.test.jsx \
  src/hooks/useSelectByProviderQuery.test.js \
  src/components/ui-shared/src/components/selectByProvider/selectByProviderOptions.test.js \
  src/components/ui-shared/src/components/Select/Select.search.test.jsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.jsx \
  apps/kace-saas/src/pages/Classifications/components/ClassificationsForm.test.jsx
git commit -m "$(cat <<'EOF'
feat(classifications): enable SelectByProvider search scroll order

EOF
)"
git log -1 --format='%B'
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Opt-in flags default off | 5 |
| Infinite scroll accumulates | 3, 5 |
| Hybrid search remote/local | 3 |
| Hybrid alpha order remote/local | 1, 3 |
| Seed / precargado visible sin scrollear | 1, 3 |
| Seed-by-id when only UUID | 3 |
| Select UI search + scroll opt-in | 4 |
| ClassificationsForm 3 selects | 6 |
| No Select v2 / no API change | all |
| No new toast | 3, 5 |
| TDD | 1–6 |

## Self-review notes

- No TBD placeholders in tasks; hook skeleton may need dep-array tightening during GREEN — assertions stay fixed.
- `useGenericSearchQuery` does not build filters from `searchById`; seed uses explicit `eq` filter (aligned with spec).
- Dual path via `SelectByProviderEnhanced` avoids conditional hooks.
- `genericSearch` legacy path untouched for non-flag consumers.
