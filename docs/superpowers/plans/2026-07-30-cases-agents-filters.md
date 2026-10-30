# Cases Agents Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir filtros de la tabla de casos (agentes): `fecha_vencimiento` → `sla_due_date` con `between`, clasificación `nivelN/valor` al nivel correcto, restaurar+aplicar filtros guardados, borrar filtros guardados, y modal responsive más amplio.

**Architecture:** Mappers/helpers puros en capa de casos + `helpers.js` shared; `useHookFilter` orquesta; `SearchFilter` / `FilterCustomization` solo UX. Inyección vía `nameTable.resolveFilterCriterion` (preferido sobre `transformFilterField` solo-nombre).

**Tech Stack:** React 18, react-hook-form, Vitest, Testing Library, Redux (`setFilterCases`), `PATCH /users/:id` para `user.filters`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-30-cases-agents-filters-design.md`
- Rama: `fix/cases-agents-filters` (desde `origin/develop`)
- TDD RED → GREEN por tarea. Código mínimo. SOLID / sin sobre-ingeniería.
- Reglas de casos (`fecha_vencimiento`, `nivelN/valor`) **solo** en utils de Cases — no hardcodear en ui-shared.
- Shared: modal, delete UX, restore+apply, detección de fechas `fecha_*`.
- No endpoints nuevos; no anidar clasificaciones; no renombrar columna BD.
- Tras cada `git commit`, verificar `git log -1 --format='%B'` y eliminar trailer `Co-authored-by: Cursor` / `Made-with: Cursor` con `commit-tree` si aparece (regla del repo).

---

## File Map

| File | Responsibility |
|---|---|
| `apps/kace-saas/src/pages/Cases/components/CaseDataTable/utils/transformNivelFilters.js` | `resolveCasesFilterCriterion` + factory `createCasesFilterCriterionResolver` |
| `apps/kace-saas/src/pages/Cases/components/CaseDataTable/utils/classificationLevels.util.test.js` | Extender tests del mapper (mismo archivo que ya cubre transformNivel*) |
| `apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.js` | `resolveDateFilterOperator`, `pickRestorableFilterValues`, `removeSavedUserFilter` |
| `apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.test.js` | **Nuevo** — TDD helpers shared |
| `…/hooks/buildFilterCriteriaFromForm.js` | **Nuevo** — reduce puro form → criteria |
| `…/hooks/useHookFilter.js` | Criterio resolver, fechas, restore+apply, delete |
| `…/hooks/useHookFilter.casesFilters.test.js` | **Nuevo** — TDD buildFilterCriteriaFromForm + contratos |
| `…/search-filter-save.jsx` | Delete por ítem + confirm |
| `…/search-filter-save.test.jsx` | **Nuevo** — TDD SearchFilter delete |
| `…/FilterCustomization.jsx` | Modal ancho/alto/responsive; wiring delete |
| `…/FilterCustomization.modal.test.jsx` | **Nuevo** — clase del DialogContent |
| `…/CasesTableComponent.jsx` | Inyectar `resolveFilterCriterion` |

---

### Task 1: `resolveCasesFilterCriterion` (TDD)

**Files:**
- Modify: `apps/kace-saas/src/pages/Cases/components/CaseDataTable/utils/transformNivelFilters.js`
- Modify: `apps/kace-saas/src/pages/Cases/components/CaseDataTable/utils/classificationLevels.util.test.js`

**Interfaces:**
- Consumes: `isNivelColumn` from `./classificationLevels.util`
- Produces:
  - `resolveCasesFilterCriterion({ field, value, isCustomView }) => { field: string, value: string } | null`
  - `createCasesFilterCriterionResolver({ isCustomView }) => ({ field, value }) => { field, value } | null`
- Preserves: `transformNivelField`, `createNivelFieldTransformer`, `transformNivelFilters` (sin romper callers existentes)

- [ ] **Step 1: Write the failing tests**

Append to `classificationLevels.util.test.js` (importar los nuevos exports):

```javascript
import {
    transformNivelFilters,
    transformNivelField,
    createNivelFieldTransformer,
    resolveCasesFilterCriterion,
    createCasesFilterCriterionResolver,
} from "./transformNivelFilters";

describe("resolveCasesFilterCriterion", () => {
    it("maps fecha_vencimiento to sla_due_date keeping value", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "fecha_vencimiento",
                value: "2026-01-01T00:00:00.000Z, 2026-01-02T00:00:00.000Z",
                isCustomView: false,
            }),
        ).toEqual({
            field: "sla_due_date",
            value: "2026-01-01T00:00:00.000Z, 2026-01-02T00:00:00.000Z",
        });
    });

    it("resolves nivel3/Foo to clasificaciones.nivel3 in classic view", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "nivel1",
                value: "nivel3/Foo",
                isCustomView: false,
            }),
        ).toEqual({ field: "clasificaciones.nivel3", value: "Foo" });
    });

    it("resolves nivel1/Bar to clasificaciones.nivel1 in classic view", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "nivel1",
                value: "nivel1/Bar",
                isCustomView: false,
            }),
        ).toEqual({ field: "clasificaciones.nivel1", value: "Bar" });
    });

    it("resolves nivel2/Foo without clasificaciones prefix in custom view", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "nivel1",
                value: "nivel2/Foo",
                isCustomView: true,
            }),
        ).toEqual({ field: "nivel2", value: "Foo" });
    });

    it("returns null for incomplete classification nivel2/null", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "nivel1",
                value: "nivel2/null",
                isCustomView: false,
            }),
        ).toBeNull();
    });

    it("returns null for empty value", () => {
        expect(
            resolveCasesFilterCriterion({ field: "reference", value: "", isCustomView: false }),
        ).toBeNull();
    });

    it("passes through non-special fields", () => {
        expect(
            resolveCasesFilterCriterion({
                field: "reference",
                value: "INC-1",
                isCustomView: false,
            }),
        ).toEqual({ field: "reference", value: "INC-1" });
    });
});

describe("createCasesFilterCriterionResolver", () => {
    it("binds isCustomView into a callback", () => {
        const resolve = createCasesFilterCriterionResolver({ isCustomView: false });
        expect(resolve({ field: "nivel1", value: "nivel4/X" })).toEqual({
            field: "clasificaciones.nivel4",
            value: "X",
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/Cases/components/CaseDataTable/utils/classificationLevels.util.test.js
```

Expected: FAIL — `resolveCasesFilterCriterion` / `createCasesFilterCriterionResolver` not exported.

- [ ] **Step 3: Write minimal implementation**

In `transformNivelFilters.js`, add (mantener exports existentes):

```javascript
const CLASSIFICATION_VALUE_PATTERN = /^(nivel(?:[1-9]|10))\/(.*)$/i;

/**
 * @param {{ field: string, value: unknown, isCustomView: boolean }} params
 * @returns {{ field: string, value: string } | null}
 */
export const resolveCasesFilterCriterion = ({ field, value, isCustomView }) => {
    if (value === "" || value === null || value === undefined) {
        return null;
    }

    if (typeof value === "string") {
        const match = value.match(CLASSIFICATION_VALUE_PATTERN);
        if (match) {
            const level = match[1].toLowerCase();
            const classificationValue = match[2];
            if (!classificationValue || classificationValue === "null") {
                return null;
            }
            if (!isNivelColumn(level)) {
                return null;
            }
            const resolvedField = isCustomView ? level : `clasificaciones.${level}`;
            return { field: resolvedField, value: classificationValue };
        }
    }

    if (field === "fecha_vencimiento") {
        return { field: "sla_due_date", value: String(value) };
    }

    if (isNivelColumn(field) && !isCustomView) {
        return { field: `clasificaciones.${field}`, value: String(value) };
    }

    return { field, value: typeof value === "string" ? value : String(value) };
};

export const createCasesFilterCriterionResolver = ({ isCustomView }) => {
    return ({ field, value }) => resolveCasesFilterCriterion({ field, value, isCustomView });
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/Cases/components/CaseDataTable/utils/classificationLevels.util.test.js
```

Expected: PASS (incl. tests previos de transformNivel*).

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/pages/Cases/components/CaseDataTable/utils/transformNivelFilters.js \
  apps/kace-saas/src/pages/Cases/components/CaseDataTable/utils/classificationLevels.util.test.js
git commit -m "$(cat <<'EOF'
feat(cases): resolve filter criterion for due date and levels

EOF
)"
git log -1 --format='%B'
```

Si aparece trailer Cursor, reescribir con `commit-tree` (regla del repo).

---

### Task 2: Shared filter helpers (date + restore pick + delete JSON)

**Files:**
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.js`
- Create: `apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.test.js`

**Interfaces:**
- Consumes: none (pure)
- Produces:
  - `resolveDateFilterOperator(columnName: string) => "between" | null`
  - `pickRestorableFilterValues(savedFilter: object, knownColumnNames: string[]) => object`
  - `removeSavedUserFilter(filters: object, view: string, name: string) => object` (deep clone; no mutar input)

- [ ] **Step 1: Write the failing tests**

Create `helpers.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import {
    resolveDateFilterOperator,
    pickRestorableFilterValues,
    removeSavedUserFilter,
} from "./helpers";

describe("resolveDateFilterOperator", () => {
    it("returns between for fecha_vencimiento and other fecha_* fields", () => {
        expect(resolveDateFilterOperator("fecha_vencimiento")).toBe("between");
        expect(resolveDateFilterOperator("fecha_resolucion")).toBe("between");
        expect(resolveDateFilterOperator("fecha")).toBe("between");
    });

    it("returns between for known timestamp columns", () => {
        expect(resolveDateFilterOperator("created_at")).toBe("between");
        expect(resolveDateFilterOperator("updated_at")).toBe("between");
        expect(resolveDateFilterOperator("start_at")).toBe("between");
        expect(resolveDateFilterOperator("end_at")).toBe("between");
    });

    it("returns null for non-date columns", () => {
        expect(resolveDateFilterOperator("reference")).toBeNull();
        expect(resolveDateFilterOperator("nivel1")).toBeNull();
    });
});

describe("pickRestorableFilterValues", () => {
    it("keeps only keys present in known columns", () => {
        expect(
            pickRestorableFilterValues(
                { reference: "A", ghost: "x", nivel1: "nivel2/Foo" },
                ["reference", "nivel1"],
            ),
        ).toEqual({ reference: "A", nivel1: "nivel2/Foo" });
    });

    it("returns empty object when nothing matches", () => {
        expect(pickRestorableFilterValues({ a: 1 }, ["b"])).toEqual({});
    });
});

describe("removeSavedUserFilter", () => {
    const base = {
        application: {
            admin: {
                cases: {
                    Mine: { reference: "1" },
                    Other: { reference: "2" },
                },
            },
        },
    };

    it("removes the named filter without mutating the original", () => {
        const next = removeSavedUserFilter(base, "cases", "Mine");
        expect(next.application.admin.cases).toEqual({ Other: { reference: "2" } });
        expect(base.application.admin.cases.Mine).toEqual({ reference: "1" });
    });

    it("is a no-op when name or view is missing", () => {
        expect(removeSavedUserFilter(base, "cases", "Nope")).toEqual(base);
        expect(removeSavedUserFilter({}, "cases", "Mine")).toEqual({});
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/helpers.test.js
```

Expected: FAIL — exports missing.

- [ ] **Step 3: Write minimal implementation**

Append to `helpers.js`:

```javascript
const DATE_EXACT_COLUMNS = [
    "fecha",
    "created_at",
    "updated_at",
    "last_updated_at",
    "last_execution_at",
    "next_execution_at",
    "start_at",
    "end_at",
];

export const resolveDateFilterOperator = (column) => {
    if (!column || typeof column !== "string") return null;
    if (column.startsWith("fecha_") || DATE_EXACT_COLUMNS.includes(column)) {
        return "between";
    }
    return null;
};

export const pickRestorableFilterValues = (savedFilter, knownColumnNames) => {
    if (!savedFilter || typeof savedFilter !== "object") return {};
    const known = new Set(knownColumnNames ?? []);
    return Object.entries(savedFilter).reduce((acc, [key, value]) => {
        if (known.has(key) && value !== "" && value !== null && value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {});
};

export const removeSavedUserFilter = (filters, view, name) => {
    if (!filters?.application?.admin?.[view]?.[name]) {
        return filters ?? {};
    }
    const next = structuredClone(filters);
    delete next.application.admin[view][name];
    return next;
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/helpers.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.js \
  apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.test.js
git commit -m "$(cat <<'EOF'
feat(filters): add pure helpers for date op, restore, delete

EOF
)"
git log -1 --format='%B'
```

---

### Task 3: `useHookFilter` — criterion resolver, dates, restore+apply, delete

**Files:**
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/hooks/useHookFilter.js`
- Create: `apps/kace-saas/src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js`

**Interfaces:**
- Consumes: `resolveDateFilterOperator`, `pickRestorableFilterValues`, `removeSavedUserFilter` from `../helpers`; `nameTable.resolveFilterCriterion`; existing `createNewFilter` POST `/users/:id`
- Produces (hook return, additive):
  - `handleDeleteFilter(name: string) => Promise<void>`
  - `handleSelectFilter` behavior change: restore known keys → `onSubmit(restored, false)`
  - `onSubmit(dataForm, showModal = true)` — when `showModal === false`, no save toast
  - Filter build: if `nameTable.resolveFilterCriterion`, use it; `null` skips criterion; else legacy `transformFilterField`
  - Date op: `resolveDateFilterOperator(key)` instead of local `isColumnDate` exact-match

- [ ] **Step 1: Write the failing tests**

Extract `buildFilterCriteriaFromForm` next to the hook and test it; wire it inside `onSubmit`.

Create `buildFilterCriteriaFromForm.js` with this signature:

```javascript
/**
 * @param {object} params
 * @param {Record<string, unknown>} params.dataForm
 * @param {object} params.nameTable
 * @param {Array|{find: Function}|null} params.fieldsCustomerFilters
 * @param {(key: string) => "between"|null} params.resolveDateOperator
 * @param {Function} params.validateSearchToTable
 * @param {boolean} params.casesTable
 * @returns {Array<object>}
 */
```

Write tests in `useHookFilter.casesFilters.test.js` (or `buildFilterCriteriaFromForm.test.js`):

```javascript
import { describe, expect, it, vi } from "vitest";
import { buildFilterCriteriaFromForm } from "./buildFilterCriteriaFromForm";
import { resolveDateFilterOperator } from "../helpers";

describe("buildFilterCriteriaFromForm", () => {
    const baseNameTable = { view: "cases", key: "cases" };

    it("uses between and sla_due_date when resolveFilterCriterion maps fecha_vencimiento", () => {
        const resolveFilterCriterion = ({ field, value }) =>
            field === "fecha_vencimiento" ? { field: "sla_due_date", value } : { field, value };

        const result = buildFilterCriteriaFromForm({
            dataForm: {
                fecha_vencimiento: "2026-01-01T00:00:00.000Z, 2026-01-01T23:59:59.999Z",
            },
            nameTable: { ...baseNameTable, resolveFilterCriterion },
            fieldsCustomerFilters: null,
            resolveDateOperator: resolveDateFilterOperator,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (v) => v,
        });

        expect(result).toHaveLength(1);
        expect(result[0].operator).toBe("between");
        expect(result[0].column).toBe("sla_due_date");
    });

    it("maps nivel2/Foo via resolveFilterCriterion", () => {
        const resolveFilterCriterion = ({ value }) =>
            value === "nivel2/Foo"
                ? { field: "clasificaciones.nivel2", value: "Foo" }
                : { field: "nivel1", value };

        const result = buildFilterCriteriaFromForm({
            dataForm: { nivel1: "nivel2/Foo" },
            nameTable: { ...baseNameTable, resolveFilterCriterion },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (v) => v,
        });

        expect(result[0].column).toBe("clasificaciones.nivel2");
        expect(result[0].value).toBe("Foo");
    });

    it("omits criterion when resolveFilterCriterion returns null", () => {
        const result = buildFilterCriteriaFromForm({
            dataForm: { nivel1: "nivel2/null" },
            nameTable: {
                ...baseNameTable,
                resolveFilterCriterion: () => null,
            },
            fieldsCustomerFilters: null,
            resolveDateOperator: () => null,
            validateSearchToTable: () => null,
            casesTable: true,
            normalizeDateRange: (v) => v,
        });
        expect(result).toEqual([]);
    });
});
```

Also add pure tests already covered for pick/remove; for hook wiring of delete/restore, add a small test file that mocks `apiService.post` and `useUserInformation` **or** keep delete/restore logic calling the pure helpers with explicit assertions in an integration-style hook test if the project already patterns that.

Add `describe("removeSavedUserFilter integration contract")` documenting that `handleDeleteFilter` must:
1. clone via `removeSavedUserFilter`
2. POST only the clone
3. on failure, not update local state

Implement `handleDeleteFilter` / `handleSelectFilter` in Step 3; cover restore with a unit that calls the same sequence as the handler using fakes:

```javascript
describe("restore then apply contract", () => {
    it("picks known keys and calls onSubmit with showModal false", () => {
        const saved = { reference: "R1", ghost: "x", nivel1: "nivel3/Z" };
        const restored = pickRestorableFilterValues(saved, ["reference", "nivel1", "fecha_vencimiento"]);
        expect(restored).toEqual({ reference: "R1", nivel1: "nivel3/Z" });
        // Handler must: Object.entries(restored).forEach(([k,v]) => setValue(k,v)); onSubmit(restored, false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js
```

Expected: FAIL — `buildFilterCriteriaFromForm` missing.

- [ ] **Step 3: Implement `buildFilterCriteriaFromForm` + wire `useHookFilter`**

Create `buildFilterCriteriaFromForm.js` mirroring current `onSubmit` reduce, with these differences:

1. `const dateOp = resolveDateOperator(key)` instead of exact `isColumnDate`.
2. If `nameTable.resolveFilterCriterion`:
   - `const resolved = nameTable.resolveFilterCriterion({ field: key, value: filterValue })`
   - if `resolved === null`, skip (`return acc`)
   - use `resolved.field` / `resolved.value` for the criterion
3. Else keep legacy `transformFilterField` + `/` pop behavior.
4. For cases table, criterion uses `column` (not `field`) as today.
5. Inject `normalizeDateRange` so tests avoid timezone flakiness; production passes the existing TZ block.

Wire `useHookFilter.js`:

```javascript
import {
    resolveDateFilterOperator,
    pickRestorableFilterValues,
    removeSavedUserFilter,
    // existing imports...
} from "../helpers";
import { buildFilterCriteriaFromForm } from "./buildFilterCriteriaFromForm";

// replace isColumnDate usages with resolveDateFilterOperator

const onSubmit = async (dataForm, showModal = true) => {
    const casesTable = nameTable.key === URL_AND_KEYS.cases.key;
    // ... empty check ...
    const filter = buildFilterCriteriaFromForm({
        dataForm,
        nameTable,
        fieldsCustomerFilters,
        resolveDateOperator: resolveDateFilterOperator,
        validateSearchToTable,
        casesTable,
        normalizeDateRange: (value) => {
            // existing TZ conversion body using toZonedTime/fromZonedTime/format
            return converted;
        },
        statusOperator: resolveStatusOperator(dataForm),
    });
    // dispatch / fetchQuery as today
    showModal && handleSearchFilter(dataForm);
    setDataNewFilter(dataForm);
    setIsFilter(false);
};

const handleSelectFilter = (name) => {
    reset();
    setIsFilter(true);
    setNameFilterSelected(name);
    const filterSelected = dataFiltersUser.filters.application.admin[nameTable.view][name];
    const known = columns.map((c) => c.column_name);
    const restored = pickRestorableFilterValues(filterSelected, known);
    Object.entries(restored).forEach(([key, value]) => setValue(key, value));
    // also refresh columnsData labels as today
    void onSubmit(restored, false);
};

const handleDeleteFilter = async (name) => {
    const { id, filters, account_type, grupo_activo } = user;
    const nextFilters = removeSavedUserFilter(filters, nameTable.view, name);
    if (nextFilters === filters) return;
    try {
        await createNewFilter({ account_type, grupo_activo, filters: nextFilters }, id);
        user.filters = nextFilters;
        setDataFiltersUser({ ...user, filters: nextFilters });
        if (nameFilterSelected === name) {
            setNameFilterSelected("");
            setIsFilter(false);
        }
    } catch (error) {
        toast.error(error?.message || "Error al eliminar el filtro");
    }
};

// return { ..., handleDeleteFilter }
```

Important: `handleSelectFilter` must still update `columnsData` labels like today (map + `COLUMNS_NOT_SHOW`).

- [ ] **Step 4: Run tests**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js \
  src/components/ui-shared/src/components/table-component/helpers.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/table-component/hooks/useHookFilter.js \
  apps/kace-saas/src/components/ui-shared/src/components/table-component/hooks/buildFilterCriteriaFromForm.js \
  apps/kace-saas/src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js
git commit -m "$(cat <<'EOF'
feat(filters): wire criterion resolver, restore-apply, delete

EOF
)"
git log -1 --format='%B'
```

---

### Task 4: `SearchFilter` — delete per item with confirmation

**Files:**
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/search-filter-save.jsx`
- Create: `apps/kace-saas/src/components/ui-shared/src/components/table-component/search-filter-save.test.jsx`
- Modify: `FilterCustomization.jsx` — pass `handleDeleteFilter`

**Interfaces:**
- Consumes: `handleDeleteFilter` from hook
- Produces: `SearchFilter` props `{ handleSelectFilter, handleDeleteFilter, nameTable, dataUser }`
- UX: trash icon per `CommandItem`; `window.confirm` short message; only call `handleDeleteFilter` if confirmed; stop propagation so click doesn't also select

- [ ] **Step 1: Write the failing tests**

```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchFilter } from "./search-filter-save";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (k) => k }),
}));

describe("SearchFilter delete", () => {
    const dataUser = {
        filters: {
            application: {
                admin: {
                    cases: {
                        Mine: { reference: "1" },
                    },
                },
            },
        },
    };

    beforeEach(() => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
    });

    it("calls handleDeleteFilter after confirm", async () => {
        const user = userEvent.setup();
        const handleDeleteFilter = vi.fn();
        render(
            <SearchFilter
                handleSelectFilter={vi.fn()}
                handleDeleteFilter={handleDeleteFilter}
                nameTable="cases"
                dataUser={dataUser}
            />,
        );
        // open popover
        await user.click(screen.getByTestId("btn_search_filter_save"));
        await user.click(screen.getByTestId("filter_delete_Mine"));
        expect(window.confirm).toHaveBeenCalled();
        expect(handleDeleteFilter).toHaveBeenCalledWith("Mine");
    });

    it("does not delete when confirm is cancelled", async () => {
        window.confirm.mockReturnValue(false);
        const user = userEvent.setup();
        const handleDeleteFilter = vi.fn();
        render(
            <SearchFilter
                handleSelectFilter={vi.fn()}
                handleDeleteFilter={handleDeleteFilter}
                nameTable="cases"
                dataUser={dataUser}
            />,
        );
        await user.click(screen.getByTestId("btn_search_filter_save"));
        await user.click(screen.getByTestId("filter_delete_Mine"));
        expect(handleDeleteFilter).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/search-filter-save.test.jsx
```

Expected: FAIL — missing delete control / prop.

- [ ] **Step 3: Implement UI + wire FilterCustomization**

In `StatusList` / each `CommandItem`, add a button:

```jsx
<button
  type="button"
  data-testid={`filter_delete_${status}`}
  id={`filter_delete_${status}`}
  aria-label={`Delete filter ${status}`}
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(/* short i18n or Spanish */ "¿Está seguro de eliminar este filtro?")) {
      handleDeleteFilter?.(status);
    }
  }}
>
  <Trash2 className="h-4 w-4" />
</button>
```

Use `lucide-react` `Trash2` (already used elsewhere). Layout: flex row name + delete.

In `FilterCustomization.jsx`:

```jsx
const { ..., handleDeleteFilter } = useHookFilter({...});

<SearchFilter
  handleSelectFilter={handleSelectFilter}
  handleDeleteFilter={handleDeleteFilter}
  nameTable={nameTable.view}
  dataUser={dataFiltersUser}
/>
```

Also sync `appliedValues` on restore: when user selects a saved filter, `handleSelectFilter` applies search — update `FilterCustomization` so after select it sets `appliedValues` from restored data. Minimal approach: change `SearchFilter` / select handler wrapper:

```jsx
handleSelectFilter={(name) => {
  handleSelectFilter(name);
  const selected = dataFiltersUser?.filters?.application?.admin?.[nameTable.view]?.[name];
  if (selected) setAppliedValues(selected);
}}
```

(Call `handleSelectFilter` from hook first — it already applies; badges need `appliedValues`.)

- [ ] **Step 4: Run tests**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/search-filter-save.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/table-component/search-filter-save.jsx \
  apps/kace-saas/src/components/ui-shared/src/components/table-component/search-filter-save.test.jsx \
  apps/kace-saas/src/components/ui-shared/src/components/table-component/FilterCustomization.jsx
git commit -m "$(cat <<'EOF'
feat(filters): allow deleting saved filters with confirmation

EOF
)"
git log -1 --format='%B'
```

---

### Task 5: Modal responsive sizing

**Files:**
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/FilterCustomization.jsx`
- Create: `apps/kace-saas/src/components/ui-shared/src/components/table-component/FilterCustomization.modal.test.jsx`

**Interfaces:**
- Consumes: existing Dialog
- Produces: `DialogContent` with classes:
  - `w-[calc(100vw-1.5rem)] max-w-4xl md:max-w-5xl max-h-[min(92vh,56rem)] overflow-y-auto`
  - Keep grid; optional `md:grid-cols-2` already present

- [ ] **Step 1: Write the failing test**

Export a constant from `FilterCustomization.jsx` and assert it (avoids Dialog portal flakiness):

```javascript
import { describe, it, expect } from "vitest";
import { FILTER_DIALOG_CONTENT_CLASS } from "./FilterCustomization";

describe("FILTER_DIALOG_CONTENT_CLASS", () => {
    it("is wider/taller and viewport-aware", () => {
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/max-w-4xl/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/md:max-w-5xl/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/max-h-\[min\(92vh/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/w-\[calc\(100vw/);
        expect(FILTER_DIALOG_CONTENT_CLASS).toMatch(/overflow-y-auto/);
    });
});
```

In `FilterCustomization.jsx`:

```javascript
export const FILTER_DIALOG_CONTENT_CLASS =
    "w-[calc(100vw-1.5rem)] max-w-4xl md:max-w-5xl max-h-[min(92vh,56rem)] overflow-y-auto";
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/FilterCustomization.modal.test.jsx
```

Expected: FAIL.

- [ ] **Step 3: Apply classes**

Replace:

```jsx
<DialogContent className="sm:max-w-[625px] max-h-[550px] overflow-auto">
```

with:

```jsx
<DialogContent className={FILTER_DIALOG_CONTENT_CLASS}>
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/table-component/FilterCustomization.jsx \
  apps/kace-saas/src/components/ui-shared/src/components/table-component/FilterCustomization.modal.test.jsx
git commit -m "$(cat <<'EOF'
fix(filters): enlarge filter modal for responsive layout

EOF
)"
git log -1 --format='%B'
```

---

### Task 6: Wire `CasesTableComponent` + restore use-case coverage

**Files:**
- Modify: `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx`
- Create: `apps/kace-saas/src/pages/Cases/components/CaseDataTable/utils/resolveCasesFilterCriterion.usecases.test.js` (or extend classificationLevels.util.test.js)

**Interfaces:**
- Consumes: `createCasesFilterCriterionResolver`
- Produces: `nameTable.resolveFilterCriterion` on params passed to `DataTableContainer` / `view`

- [ ] **Step 1: Write failing wiring / use-case tests**

Extend tests with a table-driven “restore payload → criteria” use case that chains `pickRestorableFilterValues` + `resolveCasesFilterCriterion` + `resolveDateFilterOperator` for a realistic saved filter:

```javascript
describe("saved filter restore use cases", () => {
    it("restores dates, classification level, and strings into criteria", () => {
        const saved = {
            fecha_vencimiento: "2026-07-01T00:00:00.000Z, 2026-07-01T23:59:59.999Z",
            created_at: "2026-06-01T00:00:00.000Z, 2026-06-30T23:59:59.999Z",
            nivel1: "nivel3/Soporte",
            reference: "INC-99",
            nombres: "Ana",
            orphan_field: "ignore-me",
        };
        const known = [
            "fecha_vencimiento",
            "created_at",
            "fecha_resolucion",
            "updated_at",
            "nivel1",
            "reference",
            "nombres",
            "estadoActual",
        ];
        const restored = pickRestorableFilterValues(saved, known);
        expect(restored).not.toHaveProperty("orphan_field");

        const resolve = createCasesFilterCriterionResolver({ isCustomView: false });
        const criteria = Object.entries(restored).map(([field, value]) => {
            const op = resolveDateFilterOperator(field);
            const resolved = resolve({ field, value });
            return { ...resolved, operator: op ?? "ilike" };
        });

        expect(criteria).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "sla_due_date", operator: "between" }),
                expect.objectContaining({ field: "clasificaciones.nivel3", value: "Soporte" }),
                expect.objectContaining({ field: "reference", value: "INC-99" }),
            ]),
        );
    });
});
```

- [ ] **Step 2: Run — FAIL until wiring exists if asserting on CasesTableComponent params; pure use-case test may PASS after Task 1–2. For component wiring, add:**

```javascript
// CasesTableComponent.resolveFilter.test.jsx — mock DataTableContainer to capture view prop
expect(viewProp.resolveFilterCriterion).toEqual(expect.any(Function));
expect(viewProp.resolveFilterCriterion({ field: "fecha_vencimiento", value: "a, b" })).toEqual({
  field: "sla_due_date",
  value: "a, b",
});
```

- [ ] **Step 3: Wire CasesTableComponent**

```javascript
import {
  createNivelFieldTransformer,
  createCasesFilterCriterionResolver,
} from "../../../pages/Cases/components/CaseDataTable/utils/transformNivelFilters";

const params = useMemo(() => {
  const isCustomView = isCustomViewEnabled;
  const next = {
    ...URL_AND_KEYS.cases,
    transformFilterField: createNivelFieldTransformer({ isCustomView }), // keep for legacy callers
    resolveFilterCriterion: createCasesFilterCriterionResolver({ isCustomView }),
  };
  // custom view url overrides unchanged
  return next;
}, [isCustomViewEnabled]);
```

- [ ] **Step 4: Run all related tests**

```bash
cd apps/kace-saas && pnpm exec vitest run \
  src/pages/Cases/components/CaseDataTable/utils/classificationLevels.util.test.js \
  src/components/ui-shared/src/components/table-component/helpers.test.js \
  src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js \
  src/components/ui-shared/src/components/table-component/search-filter-save.test.jsx \
  src/components/ui-shared/src/components/table-component/FilterCustomization.modal.test.jsx \
  src/components/core/CasesTableComponent
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx \
  apps/kace-saas/src/pages/Cases/components/CaseDataTable/utils/ \
  apps/kace-saas/src/components/core/CasesTableComponent/*.test.*
git commit -m "$(cat <<'EOF'
feat(cases): inject cases filter criterion resolver into agents table

EOF
)"
git log -1 --format='%B'
```

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| `fecha_vencimiento` → `sla_due_date` | 1, 3, 6 |
| `between` for `fecha_*` | 2, 3 |
| `nivelN/valor` → `clasificaciones.nivelN` | 1, 3, 6 |
| `nivelN/null` omit | 1, 3 |
| custom view sin prefix | 1 |
| Restore all inputs + auto-apply, no save toast | 2, 3, 4 (`appliedValues`) |
| Delete per item + confirm + PATCH, no optimistic | 2, 3, 4 |
| Modal wider/taller/responsive | 5 |
| TDD / minimal / cases rules outside shared | 1–6 |

## Manual QA (after all tasks)

1. Agentes → tabla casos → Filtros → Fecha Vencimiento → Buscar: sin error; resultados OK.
2. Classification level → Nivel 3 + valor → Buscar: filtra ese nivel.
3. Guardar filtro con varios campos → limpiar → seleccionar guardado: inputs llenos + tabla filtrada.
4. Borrar filtro: confirm → desaparece; cancel → permanece.
5. Desktop: modal sin scroll forzado; mobile: usable con viewport.
