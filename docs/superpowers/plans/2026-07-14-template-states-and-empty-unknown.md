# Template States & Empty Unknown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `estados` (states) entity to the email template field picker so authors can insert `{{estados.X}}` / `{{estados_actual.X}}` / `{{estados_siguiente.X}}` in subject and body, expose a search box and alphabetical sort in the model/field dropdowns, and stop emitting the literal `{{Unknown}}` string for unresolved body/subject placeholders (especially auxiliaries).

**Architecture:** Two parallel surfaces — the template render context (backend `buildEmailTemplateContext` + frontend `buildFrontendTemplateContext`) gains three new aliases sourced from the case's `estado_actual` / `estado_siguiente` (via a new `stateFinder` + `transitionFinder` on the backend, direct `caseData` read on the frontend). The render resolver drops `{{Unknown}}` for body/subject/aux and returns the empty string. The Editor dropdown (`DropdownMenuModel` + `DropdownSubMenu`) gets a new shared `DropdownSearch` input and alphabetical `localeCompare` sort applied to both the top-level model list and each per-model field list.

**Tech Stack:** React + Radix UI (`@kace/ui-shared`), `react-i18next`, `vitest` + `@testing-library/react` (kace-saas), `vitest` (onescript plugin), `jest` (kace_cloud_core), Tailwind classes.

---

## File Structure

**Backend — `packages/kace_cloud_core`:**
- `src/shared/domain/services/emailTemplating/emailTemplatesUtils.js` — modify (`buildEmailTemplateContext`, `aliasContext`, `replaceTemplateVariables`)
- `src/actions/domain/types/SendEmail.js` — modify (constructor + `execute` to wire finders)
- `tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js` — create (pure unit, no DB)

**Frontend — `apps/kace-saas` (the editor dropdown):**
- `src/components/core/Editor/constants.js` — modify (add `states` entry)
- `src/components/core/Editor/constants.test.js` — create (verify entry shape)
- `src/components/core/Editor/Dropdown/DropdownSearch.jsx` — create (shared controlled search input)
- `src/components/core/Editor/Dropdown/DropdownSearch.test.jsx` — create
- `src/components/core/Editor/Dropdown/DropdownSubMenu.jsx` — modify (search + sort)
- `src/components/core/Editor/Dropdown/DropdownSubMenu.test.jsx` — create
- `src/components/core/Editor/Dropdown/DropdownMenuModel.jsx` — modify (search + sort)
- `src/components/core/Editor/Dropdown/DropdownMenuModel.test.jsx` — create
- `src/locale/en.json` — modify (add `app.title.states`, `app.dropdown.*`)
- `src/locale/es.json` — modify (add `app.title.states`, `app.dropdown.*`)

**Frontend — `apps/onescript_plugin_kace` (the email-form templating):**
- `src/plugins/kace/components/email-form/EmailTemplatesUtils.js` — modify (`buildFrontendTemplateContext`, `replaceTemplateVariables`)
- `src/plugins/kace/components/email-form/EmailTemplatesUtils.test.js` — modify (extend existing `describe` blocks)

---

## Task 1: Backend — `{{Unknown}}` → `''` for body/subject placeholders

**Files:**
- Create: `packages/kace_cloud_core/tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js`
- Modify: `packages/kace_cloud_core/src/shared/domain/services/emailTemplating/emailTemplatesUtils.js:144`

- [ ] **Step 1: Create the test directory and a failing test file**

Create `packages/kace_cloud_core/tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js`:

```js
import { describe, it, expect } from '@jest/globals';
import { replaceTemplateVariables } from '../../../../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js';

describe('replaceTemplateVariables', () => {
    it('returns "" for an unresolved body/subject placeholder', () => {
        const context = { cases: { id: 'c-1' } };
        const result = replaceTemplateVariables('Hello {{caso.campo_inexistente}} world', context);
        expect(result).toBe('Hello  world');
    });

    it('returns the literal {{key}} for an unresolved email placeholder', () => {
        const context = { usuarios: { id: 'u-1' } };
        const result = replaceTemplateVariables('{{responsable.email}}', context, true);
        expect(result).toBe('{{responsable.email}}');
    });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:
```bash
cd packages/kace_cloud_core && pnpm tests -- tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js
```

Expected: the first test FAILS with `Expected: "Hello  world"` vs `Received: "Hello {{Unknown}} world"`. The second test PASSES (the email path is unchanged).

- [ ] **Step 3: Update `replaceTemplateVariables` to return `''` for body**

Edit `packages/kace_cloud_core/src/shared/domain/services/emailTemplating/emailTemplatesUtils.js` line 144. The current line is:

```js
return forEmail ? `{{${key}}}` : '{{Unknown}}';
```

Change it to:

```js
return forEmail ? `{{${key}}}` : '';
```

- [ ] **Step 4: Re-run the test to verify it passes**

Run:
```bash
cd packages/kace_cloud_core && pnpm tests -- tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_core/src/shared/domain/services/emailTemplating/emailTemplatesUtils.js packages/kace_cloud_core/tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js
git commit -m "fix(templates): drop {{Unknown}} for unresolved body/subject placeholders

renderEmailsOrFail still throws on unresolved email placeholders, so the
recipient-validation safety net is preserved."
```

---

## Task 2: Backend — `buildEmailTemplateContext` populates `estados` aliases

**Files:**
- Modify: `packages/kace_cloud_core/tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js` (extend the existing `describe`)
- Modify: `packages/kace_cloud_core/src/shared/domain/services/emailTemplating/emailTemplatesUtils.js:19-74, 126-134`

- [ ] **Step 1: Append three failing tests for the state aliases**

Append these tests inside the `describe('replaceTemplateVariables', ...)` block, after a new top-level `describe('buildEmailTemplateContext', ...)`. Replace the file's current contents with:

```js
import { describe, it, expect } from '@jest/globals';
import { replaceTemplateVariables, buildEmailTemplateContext } from '../../../../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js';

const noopFinder = { execute: async () => null };

const makeState = (data) => ({ toJson: () => ({ data }) });

const makeStateFinder = (byId) => ({
    execute: async (id) => makeState(byId[id] ?? {}),
});

const makeTransitionFinder = (byId) => ({
    execute: async (id) => byId[id] ?? null,
});

const makeCaseStub = (overrides = {}) => ({
    id: { value: 'case-1' },
    cliente_id: { value: 'client-1' },
    responsable_id: { value: 'user-1' },
    clasificacion_id: { value: null },
    transicion_id: { value: 'trans-1' },
    toJson: () => ({ id: 'case-1', descripcion: 'Test case' }),
    ...overrides,
});

describe('replaceTemplateVariables', () => {
    it('returns "" for an unresolved body/subject placeholder', () => {
        const context = { cases: { id: 'c-1' } };
        const result = replaceTemplateVariables('Hello {{caso.campo_inexistente}} world', context);
        expect(result).toBe('Hello  world');
    });

    it('returns the literal {{key}} for an unresolved email placeholder', () => {
        const context = { usuarios: { id: 'u-1' } };
        const result = replaceTemplateVariables('{{responsable.email}}', context, true);
        expect(result).toBe('{{responsable.email}}');
    });
});

describe('buildEmailTemplateContext', () => {
    it('populates estados, estados_actual, estados_siguiente from the case transition', async () => {
        const transitionFinder = makeTransitionFinder({
            'trans-1': { estado_actual_id: 'a-1', siguiente_estado_id: 's-1' },
        });
        const stateFinder = makeStateFinder({
            'a-1': { nombre: 'En revisión', color: '#aaa' },
            's-1': { nombre: 'Resuelto', color: '#0f0' },
        });

        const context = await buildEmailTemplateContext({
            entity: makeCaseStub(),
            clientFinder: noopFinder,
            userFinder: noopFinder,
            classificationFinder: noopFinder,
            auxCasesFinder: noopFinder,
            auxClientsFinder: noopFinder,
            stateFinder,
            transitionFinder,
        });

        expect(context.estados_actual).toEqual({ nombre: 'En revisión', color: '#aaa' });
        expect(context.estados_siguiente).toEqual({ nombre: 'Resuelto', color: '#0f0' });
        expect(context.estados).toEqual({ nombre: 'Resuelto', color: '#0f0' });
    });

    it('returns empty objects for state aliases when transicion_id is null', async () => {
        const context = await buildEmailTemplateContext({
            entity: makeCaseStub({ transicion_id: { value: null } }),
            clientFinder: noopFinder,
            userFinder: noopFinder,
            classificationFinder: noopFinder,
            auxCasesFinder: noopFinder,
            auxClientsFinder: noopFinder,
            stateFinder: makeStateFinder({}),
            transitionFinder: makeTransitionFinder({}),
        });

        expect(context.estados).toEqual({});
        expect(context.estados_actual).toEqual({});
        expect(context.estados_siguiente).toEqual({});
        expect(replaceTemplateVariables('Hi {{estados.nombre}}', context)).toBe('Hi ');
    });

    it('returns empty objects when stateFinder/transitionFinder are not provided', async () => {
        const context = await buildEmailTemplateContext({
            entity: makeCaseStub(),
            clientFinder: noopFinder,
            userFinder: noopFinder,
            classificationFinder: noopFinder,
            auxCasesFinder: noopFinder,
            auxClientsFinder: noopFinder,
        });

        expect(context.estados).toEqual({});
        expect(context.estados_actual).toEqual({});
        expect(context.estados_siguiente).toEqual({});
    });
});
```

- [ ] **Step 2: Run the new tests to verify the three new ones fail**

Run:
```bash
cd packages/kace_cloud_core && pnpm tests -- tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js
```

Expected: the three new tests under `describe('buildEmailTemplateContext', ...)` FAIL with `context.estados` being `undefined`. The two `replaceTemplateVariables` tests from Task 1 still pass.

- [ ] **Step 3: Add the two new finders and state loading to `buildEmailTemplateContext`**

Edit `packages/kace_cloud_core/src/shared/domain/services/emailTemplating/emailTemplatesUtils.js`. Replace the `buildEmailTemplateContext` function (lines 19–74) with:

```js
export async function buildEmailTemplateContext({
    entity,
    clientFinder,
    userFinder,
    classificationFinder,
    auxCasesFinder,
    auxClientsFinder,
    stateFinder = null,
    transitionFinder = null,
}) {
    const jsonEntity = entity.toJson();

    let clients = {};
    let usuarios = {};
    let clasificaciones = {};
    let aux_cases = {};
    let aux_clients = {};
    let estados_actual = {};
    let estados_siguiente = {};

    try {
        if (entity.cliente_id?.value) {
            const found = await clientFinder.execute(entity.cliente_id.value);
            clients = found?.toJson?.().data ?? {};
        }

        if (entity.responsable_id?.value || !(entity instanceof Case)) {
            const found = await userFinder.execute(entity.responsable_id.value);
            usuarios = found?.toJson?.() ?? {};
        }

        if (entity.clasificacion_id?.value) {
            const found = await classificationFinder.execute(entity.clasificacion_id.value);
            clasificaciones = found?.toJson?.().data ?? {};
        }

        if (auxCasesFinder && entity.id?.value) {
            const found = await auxCasesFinder.execute(entity.id.value);
            const rawData = found?.toJson?.().data?.data ?? {};
            aux_cases = rawData;
        }

        if (auxClientsFinder && entity.cliente_id?.value) {
            const found = await auxClientsFinder.execute(entity.cliente_id.value);
            aux_clients = found?.toJson?.().data?.data ?? {};
        }

        if (stateFinder && transitionFinder && entity.transicion_id?.value) {
            const transition = await transitionFinder.execute(entity.transicion_id.value);
            if (transition) {
                const actualId = transition.estado_actual_id?.value ?? transition.estado_actual_id;
                const siguienteId =
                    transition.siguiente_estado_id?.value ?? transition.siguiente_estado_id;
                if (actualId) {
                    const found = await stateFinder.execute(actualId);
                    estados_actual = found?.toJson?.().data ?? {};
                }
                if (siguienteId) {
                    const found = await stateFinder.execute(siguienteId);
                    estados_siguiente = found?.toJson?.().data ?? {};
                }
            }
        }
    } catch (error) {
        Helper.logError(`Partial error while building the template context:`, { error: error.message });
    }

    return {
        cases: entity instanceof Case ? jsonEntity : undefined,
        jsonEntity,
        clients,
        usuarios,
        clasificaciones,
        aux_cases,
        aux_clients,
        estados_actual,
        estados_siguiente,
        estados: estados_siguiente,
    };
}
```

- [ ] **Step 4: Add the three new aliases to `aliasContext` in `replaceTemplateVariables`**

Edit the `aliasContext` literal (line 126). Replace:

```js
const aliasContext = {
    ...originalContext,
    caso: originalContext.cases,
    cliente: originalContext.clients,
    responsable: originalContext.usuarios,
    clasificacion: originalContext.clasificaciones,
    aux_casos: originalContext.aux_cases,
    aux_clientes: originalContext.aux_clients,
};
```

with:

```js
const aliasContext = {
    ...originalContext,
    caso: originalContext.cases,
    cliente: originalContext.clients,
    responsable: originalContext.usuarios,
    clasificacion: originalContext.clasificaciones,
    aux_casos: originalContext.aux_cases,
    aux_clientes: originalContext.aux_clients,
    estados: originalContext.estados,
    estados_actual: originalContext.estados_actual,
    estados_siguiente: originalContext.estados_siguiente,
};
```

- [ ] **Step 5: Re-run the test to verify all cases pass**

Run:
```bash
cd packages/kace_cloud_core && pnpm tests -- tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/kace_cloud_core/src/shared/domain/services/emailTemplating/emailTemplatesUtils.js packages/kace_cloud_core/tests/shared/domain/services/emailTemplating/emailTemplatesUtils.test.js
git commit -m "feat(templates): expose {{estados.X}} aliases from case transition

estados defaults to estado_siguiente, with explicit estados_actual and
estados_siguiente aliases. stateFinder/transitionFinder are optional and
default to null so existing callers (with no state repository) keep working."
```

---

## Task 3: Frontend (kace-saas) — i18n keys for `app.title.states`

**Files:**
- Modify: `apps/kace-saas/src/locale/en.json` (around line 1029)
- Modify: `apps/kace-saas/src/locale/es.json` (around line 1080)

- [ ] **Step 1: Add the `states` key to `en.json`**

Edit `apps/kace-saas/src/locale/en.json`. In the `app.title` object (alphabetical block around line 1029), find the line:

```json
        "classifications": "Classifications",
```

Add immediately after it (preserving indentation, 8 spaces inside the `title` object):

```json
        "states": "States",
```

- [ ] **Step 2: Add the `states` key to `es.json`**

Edit `apps/kace-saas/src/locale/es.json`. Find:

```json
        "classifications": "Clasificaciones",
```

Add immediately after it:

```json
        "states": "Estados",
```

- [ ] **Step 3: Verify the JSON is valid**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('apps/kace-saas/src/locale/en.json','utf8')); console.log('en.json OK')"
node -e "JSON.parse(require('fs').readFileSync('apps/kace-saas/src/locale/es.json','utf8')); console.log('es.json OK')"
```

Expected: both print `OK` with no error.

- [ ] **Step 4: Commit**

```bash
git add apps/kace-saas/src/locale/en.json apps/kace-saas/src/locale/es.json
git commit -m "feat(i18n): add app.title.states label for template fields dropdown"
```

---

## Task 4: Frontend (kace-saas) — Add `states` entry to `DEFAULT_FIELDS_OPTIONS`

**Files:**
- Modify: `apps/kace-saas/src/components/core/Editor/constants.js`
- Create: `apps/kace-saas/src/components/core/Editor/constants.test.js`

- [ ] **Step 1: Write a failing test for the new entry**

Create `apps/kace-saas/src/components/core/Editor/constants.test.js`:

```js
import { describe, it, expect } from "vitest";
import { DEFAULT_FIELDS_OPTIONS } from "./constants";

describe("DEFAULT_FIELDS_OPTIONS", () => {
    it("contains the states entry between classifications and aux_cases", () => {
        const statesIndex = DEFAULT_FIELDS_OPTIONS.findIndex((o) => o.text === "states");
        const classificationsIndex = DEFAULT_FIELDS_OPTIONS.findIndex((o) => o.text === "classifications");
        const auxCasesIndex = DEFAULT_FIELDS_OPTIONS.findIndex((o) => o.text === "aux_cases");

        expect(statesIndex).toBeGreaterThan(classificationsIndex);
        expect(statesIndex).toBeLessThan(auxCasesIndex);

        const states = DEFAULT_FIELDS_OPTIONS[statesIndex];
        expect(states).toEqual({ text: "states", schema: "estados", url: "estados" });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/kace-saas && pnpm vitest run src/components/core/Editor/constants.test.js
```

Expected: FAIL with `Expected: true, Received: false` (the `findIndex` returns `-1` because `states` does not yet exist).

- [ ] **Step 3: Add the `states` entry to `DEFAULT_FIELDS_OPTIONS`**

Edit `apps/kace-saas/src/components/core/Editor/constants.js`. Insert the new entry between `classifications` and `aux_cases`:

```js
export const DEFAULT_FIELDS_OPTIONS = [
    {
        text: "cases",
        schema: "cases",
        url: "cases",
    },
    {
        text: "clients",
        schema: "clients",
        url: "clients",
    },
    {
        text: "users",
        schema: "usuarios",
        url: "usuarios",
    },
    {
        text: "classifications",
        schema: "clasificaciones",
        url: "clasificaciones",
    },
    {
        text: "states",
        schema: "estados",
        url: "estados",
    },
    {
        text: "aux_cases",
        schema: "aux_cases",
        url: "aux_cases",
    },
    {
        text: "aux_clients",
        schema: "aux_clients",
        url: "aux_clients",
    },
];
```

- [ ] **Step 4: Re-run the test to verify it passes**

Run:
```bash
cd apps/kace-saas && pnpm vitest run src/components/core/Editor/constants.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/core/Editor/constants.js apps/kace-saas/src/components/core/Editor/constants.test.js
git commit -m "feat(editor): add states to DEFAULT_FIELDS_OPTIONS for template fields"
```

---

## Task 5: Frontend (kace-saas) — i18n keys for `app.dropdown.*`

**Files:**
- Modify: `apps/kace-saas/src/locale/en.json`
- Modify: `apps/kace-saas/src/locale/es.json`

- [ ] **Step 1: Add the `dropdown` block to `en.json`**

Edit `apps/kace-saas/src/locale/en.json`. Find a safe spot at the top level (next to other `app.*` namespaces; the alphabetical position is between `app.cytology` / `app.date` and the first other existing top-level key — search for `"dropdown":` first to avoid duplicates). If `app.dropdown` does not exist, add at the end of the top-level `app` object (right before its closing `}`):

```json
    "dropdown": {
        "searchPlaceholder": "Search…",
        "searchAriaLabel": "Search fields",
        "noResults": "No matching fields"
    },
```

(Indentation is 4 spaces inside `app`, 8 spaces inside `dropdown`.)

- [ ] **Step 2: Add the same block to `es.json`**

Edit `apps/kace-saas/src/locale/es.json`. Same location as Step 1:

```json
    "dropdown": {
        "searchPlaceholder": "Buscar…",
        "searchAriaLabel": "Buscar campos",
        "noResults": "No se encontraron campos"
    },
```

- [ ] **Step 3: Verify both files are valid JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('apps/kace-saas/src/locale/en.json','utf8')); console.log('en.json OK')"
node -e "JSON.parse(require('fs').readFileSync('apps/kace-saas/src/locale/es.json','utf8')); console.log('es.json OK')"
```

Expected: both print `OK` with no error.

- [ ] **Step 4: Commit**

```bash
git add apps/kace-saas/src/locale/en.json apps/kace-saas/src/locale/es.json
git commit -m "feat(i18n): add app.dropdown.* keys for template fields search"
```

---

## Task 6: Frontend (kace-saas) — `DropdownSearch` shared component

**Files:**
- Create: `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSearch.jsx`
- Create: `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSearch.test.jsx`

- [ ] **Step 1: Write failing tests for the component**

Create `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSearch.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DropdownSearch } from "./DropdownSearch";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

describe("DropdownSearch", () => {
    it("renders a controlled <input type=\"search\"> with the given value and placeholder", () => {
        render(<DropdownSearch value="abc" onChange={() => {}} placeholder="Find" />);
        const input = screen.getByRole("searchbox");
        expect(input).toBeInTheDocument();
        expect(input.value).toBe("abc");
        expect(input.placeholder).toBe("Find");
        expect(input.getAttribute("aria-label")).toBe("app.dropdown.searchAriaLabel");
    });

    it("calls onChange with the new value on each keystroke", () => {
        const onChange = vi.fn();
        render(<DropdownSearch value="" onChange={onChange} />);
        const input = screen.getByRole("searchbox");
        fireEvent.change(input, { target: { value: "x" } });
        fireEvent.change(input, { target: { value: "xy" } });
        expect(onChange).toHaveBeenNthCalledWith(1, "x");
        expect(onChange).toHaveBeenNthCalledWith(2, "xy");
    });

    it("stops Escape from bubbling to a parent keydown handler (Radix guard)", () => {
        const parentKeyDown = vi.fn();
        render(
            <div onKeyDown={parentKeyDown}>
                <DropdownSearch value="" onChange={() => {}} />
            </div>
        );
        const input = screen.getByRole("searchbox");

        fireEvent.keyDown(input, { key: "Escape" });
        fireEvent.keyDown(input, { key: "Enter" });
        fireEvent.keyDown(input, { key: "a" });

        expect(parentKeyDown).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd apps/kace-saas && pnpm vitest run src/components/core/Editor/Dropdown/DropdownSearch.test.jsx
```

Expected: FAIL with `Cannot find module './DropdownSearch'`.

- [ ] **Step 3: Implement `DropdownSearch`**

Create `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSearch.jsx`:

```jsx
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

export const DropdownSearch = ({ value, onChange, placeholder }) => {
    const { t } = useTranslation();
    return (
        <div className="px-2 py-1 border-b">
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder={placeholder ?? t("app.dropdown.searchPlaceholder")}
                aria-label={t("app.dropdown.searchAriaLabel")}
                className="w-full px-2 py-1 text-sm rounded border focus:outline-none focus:ring-1"
            />
        </div>
    );
};

DropdownSearch.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    placeholder: PropTypes.string,
};
```

- [ ] **Step 4: Re-run the tests to verify they pass**

Run:
```bash
cd apps/kace-saas && pnpm vitest run src/components/core/Editor/Dropdown/DropdownSearch.test.jsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSearch.jsx apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSearch.test.jsx
git commit -m "feat(editor): add DropdownSearch shared controlled input for fields picker"
```

---

## Task 7: Frontend (kace-saas) — `DropdownSubMenu` search + alphabetical sort

**Files:**
- Modify: `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSubMenu.jsx`
- Create: `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSubMenu.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSubMenu.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropdownSubMenu } from "./DropdownSubMenu";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, fallback) => fallback ?? key }),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: ({ queryFn }) => {
        const url = (queryFn.toString().match(/schema-fields\/(\w+)/) || [])[1];
        const fixtures = {
            cases: [
                { column_name: "updated_at" },
                { column_name: "canal_id" },
                { column_name: "sla_remaining_days" },
                { column_name: "sla_elapsed_time" },
                { column_name: "descripción" },
                { column_name: "estado_actual" },
            ],
        };
        return { data: fixtures[url] ?? [] };
    },
}));

vi.mock("@/hooks/useAuxiliariesOptions", () => ({
    default: () => ({ auxiliariesRules: [] }),
}));

describe("DropdownSubMenu — sort and search", () => {
    const openSubMenu = async () => {
        render(
            <DropdownSubMenu text="cases" schema="cases" url="cases" handleSelectChange={() => {}} />
        );
        const trigger = screen.getByTestId("subMenuTrigger_cases");
        await userEvent.click(trigger);
    };

    it("renders options sorted alphabetically by column_name (case- and accent-insensitive)", async () => {
        await openSubMenu();
        const items = await screen.findAllByTestId(/^subMenuOption_cases_/);
        const labels = items.map((el) => el.textContent);
        expect(labels).toEqual([
            "canal_id",
            "descripción",
            "estado_actual",
            "sla_elapsed_time",
            "sla_remaining_days",
            "updated_at",
        ]);
    });

    it("filters options by substring, case-insensitive", async () => {
        await openSubMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "SLA");
        const items = await screen.findAllByTestId(/^subMenuOption_cases_/);
        const labels = items.map((el) => el.textContent);
        expect(labels).toEqual(["sla_elapsed_time", "sla_remaining_days"]);
    });

    it("matches across accents when filtering", async () => {
        await openSubMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "descrip");
        const items = await screen.findAllByTestId(/^subMenuOption_cases_/);
        const labels = items.map((el) => el.textContent);
        expect(labels).toEqual(["descripción"]);
    });

    it("shows the no-results message when no option matches", async () => {
        await openSubMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "zzzzz");
        expect(screen.getByText("app.dropdown.noResults")).toBeInTheDocument();
        expect(screen.queryAllByTestId(/^subMenuOption_cases_/)).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd apps/kace-saas && pnpm vitest run src/components/core/Editor/Dropdown/DropdownSubMenu.test.jsx
```

Expected: all 4 tests FAIL (the new sort/filter behavior is not implemented yet — the existing code uses the original API order and has no search input).

- [ ] **Step 3: Update `DropdownSubMenu` to add search + sort + empty state**

Replace `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSubMenu.jsx` with:

```jsx
import {
    DropdownMenuItem,
    DropdownMenuSubContent,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
} from "@kace/ui-shared";
import { useQuery } from "@tanstack/react-query";
import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import { genericView } from "../../../../services/genericView";
import { ScrollArea } from "@/components/ui-shared";
import { useTranslation } from "react-i18next";
import useAuxiliariesOptions from "@/hooks/useAuxiliariesOptions";
import { formatTestId } from "../../../../utils/src/helpers";
import { DropdownSearch } from "./DropdownSearch";

export const DropdownSubMenu = ({ text = "", schema = "", url = "", handleSelectChange }) => {
    const { t } = useTranslation();
    const isAux = url?.startsWith("aux_");
    const { auxiliariesRules } = useAuxiliariesOptions(false);
    const [query, setQuery] = useState("");

    const {
        data: baseData = [],
    } = useQuery({
        queryKey: ["listEditor", text, url],
        queryFn: () => genericView(`schema-fields/${url}`),
        enabled: !isAux,
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 60,
    });

    const auxData = useMemo(() => {
        if (!isAux) return [];
        const entry = auxiliariesRules?.find((r) => r.dataOrigin === schema);
        return entry?.options?.map((o) => ({ column_name: o.value })) ?? [];
    }, [isAux, auxiliariesRules, schema]);

    const rows = isAux ? auxData : baseData;

    const options = useMemo(
        () =>
            (rows ?? []).map((field) => ({
                label: field.column_name,
                value: field.column_name,
            })),
        [rows],
    );

    const visibleOptions = useMemo(() => {
        const sorted = [...options].sort((a, b) =>
            a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
        );
        const q = query.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [options, query]);

    return (
        <DropdownMenuSub>
            <DropdownMenuSubTrigger
                id={formatTestId("subMenuTrigger", `${text}`)}
                data-testid={formatTestId("subMenuTrigger", `${text}`)}
            >
                <span>{t(`app.title.${text}`, text)}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
                <DropdownMenuSubContent
                    className="h-96 min-w-60 overflow-x-hidden"
                    data-testid={formatTestId("subMenuContent", `${text}`)}
                    id={formatTestId("subMenuContent", `${text}`)}
                >
                    <DropdownSearch value={query} onChange={setQuery} />
                    <ScrollArea className="w-full h-full">
                        {visibleOptions.length === 0 ? (
                            <div
                                className="px-3 py-4 text-sm text-muted-foreground"
                                data-testid={formatTestId("subMenuEmpty", `${text}`)}
                            >
                                {t("app.dropdown.noResults")}
                            </div>
                        ) : (
                            visibleOptions.map((option) => (
                                <DropdownMenuItem
                                    key={option.value}
                                    onClick={() => {
                                        handleSelectChange(`${schema.toLowerCase()}.${option.value}`);
                                    }}
                                    id={formatTestId("subMenuOption", `${text}_${option.value}`)}
                                    data-testid={formatTestId("subMenuOption", `${text}_${option.value}`)}
                                >
                                    <span>{option.label}</span>
                                </DropdownMenuItem>
                            ))
                        )}
                    </ScrollArea>
                </DropdownMenuSubContent>
            </DropdownMenuPortal>
        </DropdownMenuSub>
    );
};

DropdownSubMenu.propTypes = {
    text: PropTypes.string.isRequired,
    schema: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    handleSelectChange: PropTypes.func.isRequired,
};
```

- [ ] **Step 4: Re-run the tests to verify they pass**

Run:
```bash
cd apps/kace-saas && pnpm vitest run src/components/core/Editor/Dropdown/DropdownSubMenu.test.jsx
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSubMenu.jsx apps/kace-saas/src/components/core/Editor/Dropdown/DropdownSubMenu.test.jsx
git commit -m "feat(editor): add search and alphabetical sort to DropdownSubMenu"
```

---

## Task 8: Frontend (kace-saas) — `DropdownMenuModel` search + alphabetical sort

**Files:**
- Modify: `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownMenuModel.jsx`
- Create: `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownMenuModel.test.jsx`

- [ ] **Step 1: Write failing tests**

Create `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownMenuModel.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DropdownMenuModel } from "./DropdownMenuModel";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, fallback) => fallback ?? key }),
}));

describe("DropdownMenuModel — top-level sort and search", () => {
    const openMenu = async () => {
        render(<DropdownMenuModel handleSelectChange={() => {}} />);
        const trigger = screen.getByTestId("dropdown_menu_model_fields");
        await userEvent.click(trigger);
    };

    it("renders models sorted alphabetically by text", async () => {
        await openMenu();
        const triggers = await screen.findAllByTestId(/^subMenuTrigger_/);
        const labels = triggers.map((el) => within(el).getByText(/.*/).textContent);
        expect(labels).toEqual([
            "aux_cases",
            "aux_clients",
            "cases",
            "classifications",
            "clients",
            "states",
            "users",
        ]);
    });

    it("filters models by substring, case-insensitive", async () => {
        await openMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "clie");
        const triggers = await screen.findAllByTestId(/^subMenuTrigger_/);
        const labels = triggers.map((el) => within(el).getByText(/.*/).textContent);
        expect(labels).toEqual(["aux_clients", "clients"]);
    });

    it("shows the no-results message when no model matches", async () => {
        await openMenu();
        const input = await screen.findByRole("searchbox");
        await userEvent.type(input, "zzzzz");
        expect(screen.getByText("app.dropdown.noResults")).toBeInTheDocument();
        expect(screen.queryAllByTestId(/^subMenuTrigger_/)).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
cd apps/kace-saas && pnpm vitest run src/components/core/Editor/Dropdown/DropdownMenuModel.test.jsx
```

Expected: all 3 tests FAIL (the menu currently has no search and no sort).

- [ ] **Step 3: Update `DropdownMenuModel` to add search + sort**

Replace `apps/kace-saas/src/components/core/Editor/Dropdown/DropdownMenuModel.jsx` with:

```jsx
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Button,
} from "@kace/ui-shared";
import { DropdownSubMenu } from "./DropdownSubMenu";
import { PropTypes } from "prop-types";
import { DEFAULT_FIELDS_OPTIONS } from "../constants";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { DropdownSearch } from "./DropdownSearch";

export const DropdownMenuModel = ({ handleSelectChange }) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");

    const visibleModels = useMemo(() => {
        const sorted = [...DEFAULT_FIELDS_OPTIONS].sort((a, b) =>
            a.text.localeCompare(b.text, undefined, { sensitivity: "base" }),
        );
        const q = query.trim().toLowerCase();
        if (!q) return sorted;
        return sorted.filter((m) => m.text.toLowerCase().includes(q));
    }, [query]);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    id="dropdown_menu_model_fields"
                    data-testid="dropdown_menu_model_fields"
                >
                    {t("app.button.fields")}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                className="w-56"
                id="dropdown_menu_model_content"
                data-testid="dropdown_menu_model_content"
            >
                <DropdownMenuLabel
                    id="dropdown_menu_model_field"
                    data-testid="dropdown_menu_model_field"
                >
                    {t("app.text.modelFields")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownSearch value={query} onChange={setQuery} />
                <DropdownMenuGroup
                    id="dropdown_menu_model_group"
                    data-testid="dropdown_menu_model_group"
                >
                    {visibleModels.length === 0 ? (
                        <div
                            className="px-3 py-2 text-sm text-muted-foreground"
                            data-testid="dropdown_menu_model_empty"
                        >
                            {t("app.dropdown.noResults")}
                        </div>
                    ) : (
                        visibleModels.map(({ text, schema, url }) => (
                            <DropdownSubMenu
                                key={text}
                                text={text}
                                schema={schema}
                                url={url}
                                handleSelectChange={handleSelectChange}
                            />
                        ))
                    )}
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

DropdownMenuModel.propTypes = {
    handleSelectChange: PropTypes.func.isRequired,
};
```

- [ ] **Step 4: Re-run the tests to verify they pass**

Run:
```bash
cd apps/kace-saas && pnpm vitest run src/components/core/Editor/Dropdown/DropdownMenuModel.test.jsx
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/core/Editor/Dropdown/DropdownMenuModel.jsx apps/kace-saas/src/components/core/Editor/Dropdown/DropdownMenuModel.test.jsx
git commit -m "feat(editor): add search and alphabetical sort to DropdownMenuModel"
```

---

## Task 9: Frontend (onescript plugin) — `buildFrontendTemplateContext` state aliases

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.js:23-58`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.test.js`

- [ ] **Step 1: Inspect the existing test to find the right describe block to extend**

Read `apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.test.js` and locate the `describe('buildFrontendTemplateContext', ...)` block. Confirm the test mocks `storeService.get('cases')` with a `case_data` object and asserts properties of the returned context. Two new tests are appended in the next step.

- [ ] **Step 2: Append two failing tests**

Append the following inside the existing `describe('buildFrontendTemplateContext', ...)` block:

```js
    it('exposes estados, estados_actual, estados_siguiente from caseData', () => {
        storeService.get = vi.fn(() => ({
            case_data: {
                estado_actual: { nombre: 'En revisión' },
                estado_siguiente: { nombre: 'Resuelto' },
            },
        }));

        const ctx = buildFrontendTemplateContext();
        expect(ctx.estados_actual).toEqual({ nombre: 'En revisión' });
        expect(ctx.estados_siguiente).toEqual({ nombre: 'Resuelto' });
        expect(ctx.estados).toEqual({ nombre: 'Resuelto' });
    });

    it('returns empty objects when estado_actual and estado_siguiente are absent', () => {
        storeService.get = vi.fn(() => ({ case_data: {} }));

        const ctx = buildFrontendTemplateContext();
        expect(ctx.estados_actual).toEqual({});
        expect(ctx.estados_siguiente).toEqual({});
        expect(ctx.estados).toEqual({});
        expect(replaceTemplateVariables('Hi {{estados.nombre}}', ctx)).toBe('Hi ');
    });
```

(Adjust the indentation to match the surrounding `it` calls. The two tests assume `storeService` is the existing mocked import. If the existing tests use a different mocking pattern, adapt the `storeService.get = vi.fn(...)` assignment to whatever the test already uses — most likely the same import at the top of the file. Read the file once to confirm.)

- [ ] **Step 3: Run the tests to verify they fail**

Run:
```bash
cd apps/onescript_plugin_kace && pnpm test -- EmailTemplatesUtils.test.js
```

Expected: the two new tests FAIL with `Cannot read properties of undefined (reading 'nombre')` (because `ctx.estados_actual` / `ctx.estados` are currently `undefined`).

- [ ] **Step 4: Add the state aliases to `buildFrontendTemplateContext`**

Edit `apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.js`. In `buildFrontendTemplateContext` (around lines 23–58), modify the `return` block to add the three new aliases. After the existing line:

```js
  const auxRaw = caseData.aux_case?.data ?? {};
  const aux_cases = {
    ...auxRaw,
    ...Object.values(auxRaw).reduce(
      (acc, val) =>
        typeof val === 'object' && val !== null ? { ...acc, ...val } : acc,
      {}
    ),
  };

  const aux_clients = {};
```

Add:

```js
  const estadoActual = caseData.estado_actual ?? {};
  const estadoSiguiente = caseData.estado_siguiente ?? {};
```

Then replace the entire `return { ... }` block with:

```js
  return {
    cases,
    clients,
    usuarios: responsable,
    clasificaciones,
    aux_cases,
    aux_clients,
    estados: estadoSiguiente,
    estados_actual: estadoActual,
    estados_siguiente: estadoSiguiente,
    caso: cases,
    cliente: clients,
    responsable,
    clasificacion: clasificaciones,
    aux_casos: aux_cases,
    aux_clientes: aux_clients,
  };
```

- [ ] **Step 5: Re-run the tests to verify they pass**

Run:
```bash
cd apps/onescript_plugin_kace && pnpm test -- EmailTemplatesUtils.test.js
```

Expected: the two new tests PASS, and the existing tests in the file still PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.js apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.test.js
git commit -m "feat(email-form): expose estados aliases in frontend template context"
```

---

## Task 10: Frontend (onescript plugin) — `replaceTemplateVariables` returns `''` for unresolved body placeholders

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.js:68-83`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.test.js`

- [ ] **Step 1: Append a failing test**

Append inside the existing `describe('replaceTemplateVariables', ...)` block:

```js
    it('returns "" for an unresolved body/subject placeholder (was {{key}})', () => {
        const ctx = { cases: { id: 'c-1' } };
        expect(replaceTemplateVariables('X {{caso.campo_inexistente}} Y', ctx)).toBe('X  Y');
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/onescript_plugin_kace && pnpm test -- EmailTemplatesUtils.test.js
```

Expected: the new test FAILS with `Expected: "X  Y", Received: "X {{caso.campo_inexistente}} Y"` (current behavior keeps the literal placeholder).

- [ ] **Step 3: Update `replaceTemplateVariables` to return `''`**

Edit `apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.js`. In the `replaceTemplateVariables` function (lines 68–83), the current body is:

```js
  return templateString.replace(VAR_REGEX, (original, key) => {
    const keys = key.split('.');
    let value = ctx;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined || value === null) {
        return original;
      }
    }
    return typeof value === 'object' ? original : String(value);
  });
```

Change it to:

```js
  return templateString.replace(VAR_REGEX, (original, key) => {
    const keys = key.split('.');
    let value = ctx;
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined || value === null) {
        return '';
      }
    }
    return typeof value === 'object' ? original : String(value);
  });
```

Note: the frontend's `replaceTemplateVariables` does not have a `forEmail` parameter — the original placeholder is currently returned for *all* callers. This change makes the body/subject resolution empty (consistent with the backend) for the only caller path that uses the result for body/subject rendering. The recipient-validation flow happens at form-submit time, not in this render path, so the change is safe.

- [ ] **Step 4: Re-run the tests to verify they pass**

Run:
```bash
cd apps/onescript_plugin_kace && pnpm test -- EmailTemplatesUtils.test.js
```

Expected: the new test PASSES, and the existing tests still PASS (none of them rely on the literal-placeholder return for body/subject — the only existing `replaceTemplateVariables` tests assert the resolved value).

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.js apps/onescript_plugin_kace/src/plugins/kace/components/email-form/EmailTemplatesUtils.test.js
git commit -m "fix(email-form): return empty string for unresolved body/subject placeholders"
```

---

## Task 11: Backend — `SendEmail` wires `stateFinder` and `transitionFinder`

**Files:**
- Modify: `packages/kace_cloud_core/src/actions/domain/types/SendEmail.js`

- [ ] **Step 1: Add the imports**

Edit `packages/kace_cloud_core/src/actions/domain/types/SendEmail.js`. At the top of the file (after the existing imports from `./emailTemplatesUtils.js`, around line 13), add:

```js
import { StateFinder } from '../../../state/application/find/StateFinder.js';
import { TransitionsFinder } from '../../../transition/domain/TransitionsFinder.js';
```

- [ ] **Step 2: Extend the constructor**

Edit the `constructor` signature (line 32) and body. Replace the existing signature:

```js
    constructor(
        templatesRepository,
        mailAccountRepository,
        clientRepository,
        userRepository,
        classificationRepository,
        auxCasesRepository,
        auxClientsRepository,
        secretRepository,
        caseAttachmentRepository = null,
        caseAttachmentReader = new S3CaseAttachmentReader(),
        emailService = new EmailService(secretRepository),
        eventLogger = new EventLogger(templatesRepository)
    ) {
```

with:

```js
    constructor(
        templatesRepository,
        mailAccountRepository,
        clientRepository,
        userRepository,
        classificationRepository,
        auxCasesRepository,
        auxClientsRepository,
        secretRepository,
        stateRepository = null,
        transitionRepository = null,
        caseAttachmentRepository = null,
        caseAttachmentReader = new S3CaseAttachmentReader(),
        emailService = new EmailService(secretRepository),
        eventLogger = new EventLogger(templatesRepository)
    ) {
```

Then in the body, after the existing `this.auxClientsFinder = ...` line (line 52), add:

```js
        this.stateFinder = stateRepository ? new StateFinder(stateRepository) : null;
        this.transitionFinder = transitionRepository ? new TransitionsFinder(transitionRepository) : null;
```

- [ ] **Step 3: Pass the finders to `buildEmailTemplateContext`**

In `execute` (line 82), extend the `buildEmailTemplateContext` call from:

```js
            const context = await buildEmailTemplateContext({
                entity,
                clientFinder: this.clientFinder,
                userFinder: this.userFinder,
                classificationFinder: this.classificationFinder,
                auxCasesFinder: this.auxCasesFinder,
                auxClientsFinder: this.auxClientsFinder,
            });
```

to:

```js
            const context = await buildEmailTemplateContext({
                entity,
                clientFinder: this.clientFinder,
                userFinder: this.userFinder,
                classificationFinder: this.classificationFinder,
                auxCasesFinder: this.auxCasesFinder,
                auxClientsFinder: this.auxClientsFinder,
                stateFinder: this.stateFinder,
                transitionFinder: this.transitionFinder,
            });
```

- [ ] **Step 4: Verify the existing `SendEmail` test still passes**

Run:
```bash
cd packages/kace_cloud_core && pnpm tests -- tests/actions/types/SendEmailCaseAttachmentsUnit.test.js
```

Expected: PASS. The test instantiates `SendEmail` with 8 null repos — the two new optional parameters are omitted, so the constructor accepts the call. The `stateFinder` and `transitionFinder` are `null`, and `buildEmailTemplateContext` gracefully returns `estados: {}`.

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_core/src/actions/domain/types/SendEmail.js
git commit -m "feat(templates): wire stateFinder and transitionFinder through SendEmail

Both repositories are optional; existing callers that do not pass them
keep working unchanged. Wiring the repositories at the deployment sites
(stack bootstrap, Lambda handler) is a follow-up task outside this plan."
```

---

## Self-Review Checklist (run before declaring the plan complete)

- [ ] Spec coverage: every section in `docs/superpowers/specs/2026-07-14-template-states-and-empty-unknown-design.md` maps to a task:
  - §1 constants.js → Task 4 ✓
  - §2 i18n app.title.states → Task 3 ✓
  - §3a buildEmailTemplateContext state aliases → Task 2 ✓
  - §3b aliasContext → Task 2 ✓
  - §3c `{{Unknown}}` → `''` → Task 1 ✓
  - §4a buildFrontendTemplateContext state aliases → Task 9 ✓
  - §4b frontend replaceTemplateVariables empty → Task 10 ✓
  - §5 SendEmail wiring → Task 11 ✓
  - §6 DropdownSubMenu search + sort + DropdownSearch → Tasks 6, 7 ✓
  - §7 DropdownMenuModel search + sort → Task 8 ✓
  - §8 i18n app.dropdown.* → Task 5 ✓
  - Tests 1–5 (backend) → Tasks 1, 2 ✓
  - Tests 6–8 (frontend context) → Tasks 9, 10 ✓
  - Test 9 (constants) → Task 4 ✓
  - Tests 10–14 (submenu) → Task 7 ✓
  - Tests 15–17 (top menu) → Task 8 ✓
  - Tests 18–20 (DropdownSearch) → Task 6 ✓
- [ ] No "TBD", "TODO", "fill in details" placeholders in any task.
- [ ] No "Add appropriate error handling" style steps without concrete code.
- [ ] Every code change is shown as a complete code block.
- [ ] Test commands use the actual package's test runner (`pnpm vitest run` for kace-saas and onescript plugin, `pnpm tests --` for kace_cloud_core jest).
- [ ] Commit messages follow conventional commits (`feat:`, `fix:`, etc.) and are short.
- [ ] Each task produces a self-contained, committable unit.
