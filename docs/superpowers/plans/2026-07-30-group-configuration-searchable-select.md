# GroupConfiguration Searchable Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En `GroupConfiguration`, listar grupos A→Z, filtrarlos con el buscador del Select Formik compartido, y mostrar el check del item seleccionado sin solaparse con el label.

**Architecture:** Composición pura reutilizando `mapRawItemsToOptions` + `sortOptionsAlphabetically` + `filterOptionsByLabel`. La página mantiene `searchTerm` y pasa `options` filtradas al Select Formik (`name="idGroup"`, `onSearchChange`). No se modifica el Select compartido ni se reimplementa sort/filter.

**Tech Stack:** React 18, Formik, Vitest, Select Formik (`…/Select/Select.jsx`), helpers en `selectByProviderOptions.js`.

## Global Constraints

- Scope: solo `GroupConfiguration` + módulo de composición local + su test. **No** tocar Select Radix base, Select Formik, ni `selectByProviderOptions.js` (solo importar).
- Búsqueda: cliente-only sobre `userInformation.groups` (lista ya cargada).
- Orden/filtro: helpers existentes (localeCompare + `sensitivity: "base"`; substring case-insensitive).
- Testids: aceptar los del Select compartido (no preservar `group_configuration_select_*`).
- TDD RED → GREEN por tarea. Código mínimo. Sin comentarios nuevos salvo que el archivo ya los use.
- Rama: `feat/group-configuration-searchable-select`.
- Tras cada `git commit`, verificar `git log -1 --format='%B'` y eliminar trailer `Co-authored-by: Cursor` / `Made-with: Cursor` con `commit-tree` si aparece.

**Spec de referencia:** `docs/superpowers/specs/2026-07-30-group-configuration-searchable-select-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `apps/kace-saas/src/pages/GroupConfiguration/groupSelectOptions.js` | Composición pura: map → sort → filter (sin reimplementar lógica) |
| `apps/kace-saas/src/pages/GroupConfiguration/groupSelectOptions.test.js` | Tests TDD de la composición |
| `apps/kace-saas/src/pages/GroupConfiguration/GroupConfiguration.jsx` | Wiring: `searchTerm`, Select Formik, quitar Select Radix/`p-2`/`bg-red-400`/Label manual |

---

### Task 1: `buildGroupSelectOptions` (TDD)

**Files:**
- Create: `apps/kace-saas/src/pages/GroupConfiguration/groupSelectOptions.js`
- Create: `apps/kace-saas/src/pages/GroupConfiguration/groupSelectOptions.test.js`

**Interfaces:**
- Consumes: `mapRawItemsToOptions`, `sortOptionsAlphabetically`, `filterOptionsByLabel` from `@/components/ui-shared/src/components/selectByProvider/selectByProviderOptions`
- Produces: `buildGroupSelectOptions(groups, searchTerm = "") => { value: string|number, label: string }[]`

- [ ] **Step 1: Write the failing tests**

Create `groupSelectOptions.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import { buildGroupSelectOptions } from "./groupSelectOptions";

const groups = [
    { id: "2", nombre: "Zebra" },
    { id: "1", nombre: "Alpha" },
    { id: "3", nombre: "beta" },
];

describe("buildGroupSelectOptions", () => {
    it("maps id/nombre and sorts alphabetically by label", () => {
        expect(buildGroupSelectOptions(groups)).toEqual([
            { value: "1", label: "Alpha" },
            { value: "3", label: "beta" },
            { value: "2", label: "Zebra" },
        ]);
    });

    it("filters by case-insensitive substring on label", () => {
        expect(buildGroupSelectOptions(groups, "BE")).toEqual([{ value: "3", label: "beta" }]);
    });

    it("returns full sorted list when search is blank or whitespace", () => {
        expect(buildGroupSelectOptions(groups, "   ")).toEqual([
            { value: "1", label: "Alpha" },
            { value: "3", label: "beta" },
            { value: "2", label: "Zebra" },
        ]);
    });

    it("returns empty array for empty or non-array groups", () => {
        expect(buildGroupSelectOptions([])).toEqual([]);
        expect(buildGroupSelectOptions(null)).toEqual([]);
        expect(buildGroupSelectOptions(undefined)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/GroupConfiguration/groupSelectOptions.test.js
```

Expected: FAIL — `buildGroupSelectOptions` is not defined / cannot resolve module.

- [ ] **Step 3: Write minimal implementation**

Create `groupSelectOptions.js`:

```javascript
import {
    filterOptionsByLabel,
    mapRawItemsToOptions,
    sortOptionsAlphabetically,
} from "@/components/ui-shared/src/components/selectByProvider/selectByProviderOptions";

export const buildGroupSelectOptions = (groups, searchTerm = "") =>
    filterOptionsByLabel(
        sortOptionsAlphabetically(mapRawItemsToOptions(Array.isArray(groups) ? groups : [])),
        searchTerm,
    );
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/GroupConfiguration/groupSelectOptions.test.js
```

Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/pages/GroupConfiguration/groupSelectOptions.js \
  apps/kace-saas/src/pages/GroupConfiguration/groupSelectOptions.test.js
git commit -m "$(cat <<'EOF'
feat(group-configuration): add sorted filterable group select options

EOF
)"
git log -1 --format='%B'
```

If Cursor trailer appears, rewrite with `commit-tree` (workspace rule) and re-verify.

---

### Task 2: Wire Formik Select into `GroupConfiguration`

**Files:**
- Modify: `apps/kace-saas/src/pages/GroupConfiguration/GroupConfiguration.jsx`
- Create: `apps/kace-saas/src/pages/GroupConfiguration/GroupConfiguration.select.test.jsx`

**Interfaces:**
- Consumes: `buildGroupSelectOptions(groups, searchTerm)` from Task 1; Formik Select from `@/components/ui-shared/src/components/Select/Select`
- Produces: UI with searchable alphabetical group options; submit flow unchanged

- [ ] **Step 1: Write the failing wiring test**

Create `GroupConfiguration.select.test.jsx`. Mock the Formik Select to capture props; stub heavy deps so the multi-group Formik UI renders:

```jsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const selectPropsSpy = vi.fn();

vi.mock("@/components/ui-shared/src/components/Select/Select", () => ({
    Select: (props) => {
        selectPropsSpy(props);
        return <div data-testid="mocked-formik-select" data-name={props.name} />;
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("react-redux", () => ({
    useDispatch: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: () => ({ data: [], isLoading: false }),
    useQueries: () => [],
    useQueryClient: () => ({ setQueryData: vi.fn() }),
}));

vi.mock("../../cognito-auth/AuthContext", () => ({
    useAuth: () => ({ logout: vi.fn() }),
}));

vi.mock("../../utils/main", () => ({
    GENERAL_SETUP_SERVICE: "/general-setup",
    TYPE_APPLICATION: { AGENT: "agent", ADMIN: "admin" },
    apiService: { post: vi.fn() },
    joiFormikAdapter: () => undefined,
}));

vi.mock("../../utils/URL", () => ({
    GROUP_SERVICE: "/groups",
    USER_SERVICE: "/users",
}));

vi.mock("../../services/genericView", () => ({
    genericView: vi.fn(),
}));

vi.mock("../../utils/groupSyncChannel", () => ({
    broadcastGroupChanged: vi.fn(),
}));

vi.mock("../../components/core/LoaderPage/LoginLoaderPage", () => ({
    default: () => <div>loading</div>,
}));

vi.mock("../../components/core/ErrorPage/GeneralErrorPage", () => ({
    GeneralErrorPage: () => <div>error</div>,
}));

vi.mock("@kace/ui-shared", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        Button: ({ children, ...props }) => <button {...props}>{children}</button>,
        Card: ({ children, ...props }) => <div {...props}>{children}</div>,
        CardHeader: ({ children }) => <div>{children}</div>,
        CardTitle: ({ children, ...props }) => <h2 {...props}>{children}</h2>,
        CardDescription: ({ children, ...props }) => <p {...props}>{children}</p>,
        CardContent: ({ children, ...props }) => <div {...props}>{children}</div>,
        CardFooter: ({ children, ...props }) => <div {...props}>{children}</div>,
    };
});

import GroupConfiguration from "./GroupConfiguration";

describe("GroupConfiguration select wiring", () => {
    beforeEach(() => {
        selectPropsSpy.mockClear();
        localStorage.removeItem("userGroupId");
    });

    it("passes alphabetically sorted options to Formik Select with search enabled", () => {
        const userInformation = {
            user: {},
            groups: [
                { id: "2", nombre: "Zebra" },
                { id: "1", nombre: "Alpha" },
            ],
        };

        render(<GroupConfiguration userInformation={userInformation} />);

        expect(screen.getByTestId("mocked-formik-select")).toBeTruthy();
        expect(selectPropsSpy).toHaveBeenCalled();
        const props = selectPropsSpy.mock.calls.at(-1)[0];
        expect(props.name).toBe("idGroup");
        expect(props.label).toBe("Grupos");
        expect(props.placeholder).toBe("Selecciona tu grupo de trabajo");
        expect(typeof props.onSearchChange).toBe("function");
        expect(props.options).toEqual([
            { value: "1", label: "Alpha" },
            { value: "2", label: "Zebra" },
        ]);
    });

    it("filters options when onSearchChange emits a term", () => {
        const userInformation = {
            user: {},
            groups: [
                { id: "2", nombre: "Zebra" },
                { id: "1", nombre: "Alpha" },
            ],
        };

        render(<GroupConfiguration userInformation={userInformation} />);
        const props = selectPropsSpy.mock.calls.at(-1)[0];
        props.onSearchChange("zep");

        const latest = selectPropsSpy.mock.calls.at(-1)[0];
        expect(latest.options).toEqual([{ value: "2", label: "Zebra" }]);
    });
});
```

Note: the second test relies on re-render after `onSearchChange` → `setSearchTerm`. If the spy captures props only on render, calling `onSearchChange` then asserting `selectPropsSpy.mock.calls.at(-1)` after React re-render is correct — wrap the call in `act` if needed:

```javascript
import { act } from "@testing-library/react";
// ...
act(() => {
    props.onSearchChange("zep");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/GroupConfiguration/GroupConfiguration.select.test.jsx
```

Expected: FAIL — still uses Radix Select / no Formik Select props / mock not found in tree.

- [ ] **Step 3: Implement wiring in `GroupConfiguration.jsx`**

1. Add imports:

```javascript
import { useCallback, useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui-shared/src/components/Select/Select";
import { buildGroupSelectOptions } from "./groupSelectOptions";
```

2. Remove unused Radix Select / Label imports from `@kace/ui-shared` (keep Button, Card*).

3. Inside the component (before early returns is fine for hooks; `searchTerm` must be declared unconditionally at top level):

```javascript
const [searchTerm, setSearchTerm] = useState("");
const groupOptions = useMemo(
    () => buildGroupSelectOptions(userInformation.groups, searchTerm),
    [userInformation.groups, searchTerm],
);
```

4. Replace the Label + Radix Select block inside Formik with:

```jsx
<Select
    name="idGroup"
    id="group_configuration"
    label="Grupos"
    placeholder="Selecciona tu grupo de trabajo"
    options={groupOptions}
    onSearchChange={setSearchTerm}
/>
```

5. Simplify Formik children: no need for `setFieldValue` from render props if unused — use `{() => ( ... )}` or keep destructure only if still needed.

6. Do **not** pass `className="p-2"` or `bg-red-400`. Do not reintroduce manual `SelectItem`s.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/kace-saas && pnpm exec vitest run src/pages/GroupConfiguration/groupSelectOptions.test.js src/pages/GroupConfiguration/GroupConfiguration.select.test.jsx
```

Expected: PASS.

If the filter test fails because Formik Select mock does not re-render the parent when calling `onSearchChange`, fix the test to use `act` and re-query the latest spy call (do not weaken the assertion to skip filtering).

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/pages/GroupConfiguration/GroupConfiguration.jsx \
  apps/kace-saas/src/pages/GroupConfiguration/GroupConfiguration.select.test.jsx
git commit -m "$(cat <<'EOF'
feat(group-configuration): wire searchable alphabetical Formik Select

EOF
)"
git log -1 --format='%B'
```

Strip Cursor trailer with `commit-tree` if present.

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| Orden A→Z por nombre | Task 1 + Task 2 |
| Buscador cliente (`onSearchChange`) | Task 2 |
| Check visible (sin `p-2`) | Task 2 (Select Formik sin className override) |
| Reusar helpers existentes | Task 1 |
| Migrar a Select Formik | Task 2 |
| Testids del Select compartido | Task 2 (aceptado) |
| Submit / auto-one-group / localStorage intactos | Task 2 (no tocar esos caminos) |
| No modificar Select compartido / helpers | Global constraint |

## Self-review notes

- No placeholders TBD/TODO.
- `buildGroupSelectOptions` is composition-only (spec “sin nuevos helpers” = no reimplement sort/filter).
- Sort expectation with `sensitivity: "base"` treats `Alpha` before `beta` before `Zebra` in typical en/es locales; if CI locale differs, assert via sorted labels from the same helpers in the test setup rather than hardcoding — prefer the hardcoded list above first; only adjust if vitest fails on locale.
