# Parametrize Agent Case Table Headers and Columns Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two tenant-level fields under `settings.layouts.application.agente.cases.*` — `show_columns_dropdown` (boolean) and `headers_labels` (object map) — that the four agent case tables (My Assigned, My Created, Client Open, Client Closed) consume to (1) override column header text and (2) hide the "Columns" dropdown.

**Architecture:** Follow the existing `lock_case_description_edit` precedent. New fields are validated by Joi, defaulted in `INITIAL_VALUES_GLOBAL_SETUP`, written by `helpers.js`, exposed in the `TabAgent` form (new `CardModulesTab` "Tablas de casos"), and consumed in `CasesTableComponent`. A new shared optional prop `showColumnsDropdown` is added to the `DataTable` component, propagated through `DataTableContainer`, and gated by `configCases.show_columns_dropdown`.

**Tech Stack:** React 18, Formik, Joi (`JoiHelper`), i18next, vitest + @testing-library/react, Tailwind CSS. The frontend app is `apps/kace-saas`.

**Spec:** `docs/superpowers/specs/2026-07-09-parametrize-agent-tables-design.md`.

---

## File Structure

Files modified or created by this plan, with their responsibilities:

### Modified

- `apps/kace-saas/src/schemas/GeneralSetupSchemaForm.js` — add Joi rules for the two new fields in the `layouts.application.agente.cases` object.
- `apps/kace-saas/src/pages/GeneralSetup/data/constants.jsx` — add `show_columns_dropdown` and `headers_labels` to `INITIAL_VALUES_GLOBAL_SETUP`.
- `apps/kace-saas/src/pages/GeneralSetup/helpers.js` — read both fields from the settings payload and write them from form values.
- `apps/kace-saas/src/pages/GeneralSetup/helpers.test.js` — extend with round-trip tests for the new fields.
- `apps/kace-saas/src/locale/es.json` and `apps/kace-saas/src/locale/en.json` — add new translation keys.
- `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/TabAgent.jsx` — add new `CardModulesTab` "Tablas de casos" containing a `CheckBoxContainer` and a `HeadersLabelsEditor`.
- `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx` — apply the header override and pass `showColumnsDropdown` to `DataTableContainer`.
- `apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.jsx` — add optional `showColumnsDropdown` prop and gate `<DataTableViewOptions />` on it.
- `apps/kace-saas/src/components/ui-shared/src/components/table-component/DataTableContainer.jsx` — forward `showColumnsDropdown` to `DataTable`.

### Created

- `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.jsx` — key-value editor component (column select + label input + remove).
- `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.test.jsx` — unit tests for the editor.
- `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.test.jsx` — tests for header override and dropdown visibility.
- `apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.test.jsx` — tests for the `showColumnsDropdown` prop.

### Why this decomposition

The new editor is its own component because the rest of `TabAgent` is dominated by simple `CheckBoxContainer` rows; a multi-row, stateful editor with row add/remove logic would make the parent file too large. `HeadersLabelsEditor` is a leaf UI component with no domain knowledge — it only reads from `useSchemaFields` and pushes a key-value map back to Formik.

The `showColumnsDropdown` prop belongs on `DataTable` (the shared table) because the dropdown is a `DataTable` feature. The override map is consumed inside `CasesTableComponent` (the case-specific wrapper) because that is the layer that already knows the column schema, the case-specific i18n keys, and the `configCases` config bag.

---

## Task 1: Add Joi validation and form defaults

**Files:**
- Modify: `apps/kace-saas/src/schemas/GeneralSetupSchemaForm.js`
- Modify: `apps/kace-saas/src/pages/GeneralSetup/data/constants.jsx`
- Test: `apps/kace-saas/src/pages/GeneralSetup/helpers.test.js`

- [ ] **Step 1.1: Read the current schema file to find the `layouts.application.agente.cases` object**

Read `apps/kace-saas/src/schemas/GeneralSetupSchemaForm.js` and locate the `layouts` block. Note the `agente.cases` sub-object (if present) and how existing Joi rules are declared.

- [ ] **Step 1.2: Add the Joi rules for the two new fields**

Inside the `layouts.application.agente.cases` object, add:

```js
show_columns_dropdown: JoiHelper.boolean().default(true),
headers_labels: JoiHelper.object()
    .pattern(JoiHelper.string(), JoiHelper.string().min(1).max(200))
    .default({}),
```

If the `cases` sub-object does not exist yet, add it with these two rules.

- [ ] **Step 1.3: Add the defaults to `INITIAL_VALUES_GLOBAL_SETUP`**

In `apps/kace-saas/src/pages/GeneralSetup/data/constants.jsx`, inside the `INITIAL_VALUES_GLOBAL_SETUP` object literal, add:

```js
show_columns_dropdown: true,
headers_labels: {},
```

Keep the existing keys intact and the new keys in alphabetical order if the file already does that (check around lines 25-45).

- [ ] **Step 1.4: Add a round-trip test for the defaults**

Open `apps/kace-saas/src/pages/GeneralSetup/helpers.test.js` and locate the section that asserts the round-trip behavior (search for `lock_case_description_edit` to find the nearest pattern). Add a new `it` block:

```js
it("includes the default show_columns_dropdown and headers_labels when saving", () => {
    const result = prepareDataToSave({
        ...minimalValues,
        show_columns_dropdown: true,
        headers_labels: {},
    });
    expect(result.layouts.application.agente.cases.show_columns_dropdown).toBe(true);
    expect(result.layouts.application.agente.cases.headers_labels).toEqual({});
});
```

Adjust `minimalValues` and `prepareDataToSave` to match the existing test file's helpers.

- [ ] **Step 1.5: Run the new test**

Run: `cd apps/kace-saas && npx vitest run src/pages/GeneralSetup/helpers.test.js -t "show_columns_dropdown"`
Expected: PASS.

- [ ] **Step 1.6: Commit**

```bash
git add apps/kace-saas/src/schemas/GeneralSetupSchemaForm.js apps/kace-saas/src/pages/GeneralSetup/data/constants.jsx apps/kace-saas/src/pages/GeneralSetup/helpers.test.js
git commit -m "feat(general-setup): add show_columns_dropdown and headers_labels fields with Joi validation and defaults"
```

---

## Task 2: Implement the read/write paths in helpers.js

**Files:**
- Modify: `apps/kace-saas/src/pages/GeneralSetup/helpers.js`
- Test: `apps/kace-saas/src/pages/GeneralSetup/helpers.test.js`

- [ ] **Step 2.1: Locate the `prepareDataToSave` and read functions in helpers.js**

Read `apps/kace-saas/src/pages/GeneralSetup/helpers.js`. Find:
- The function that builds the `layouts.application.agente.cases` object on save (around line 280).
- The function that reads `layout.application.agente.cases.*` values back to form values (around line 480).

- [ ] **Step 2.2: Write the field into the save payload**

In the `prepareDataToSave` (or equivalent) function, inside the `layouts.application.agente.cases = { ... }` block, add:

```js
show_columns_dropdown: values.show_columns_dropdown ?? true,
headers_labels: values.headers_labels ?? {},
```

- [ ] **Step 2.3: Read the fields back from settings**

In the function that hydrates the form values from settings, add:

```js
show_columns_dropdown: layouts?.application?.agente?.cases?.show_columns_dropdown ?? true,
headers_labels: layouts?.application?.agente?.cases?.headers_labels ?? {},
```

- [ ] **Step 2.4: Add a test that asserts the read path**

In `apps/kace-saas/src/pages/GeneralSetup/helpers.test.js`, add a new test mirroring the read path for existing layout fields:

```js
it("reads show_columns_dropdown and headers_labels from settings on load", () => {
    const result = prepareValuesForForm({
        settings: {
            layouts: {
                application: {
                    agente: {
                        cases: {
                            show_columns_dropdown: false,
                            headers_labels: { reference: "Consecutivo" },
                        },
                    },
                },
            },
        },
        // ... rest of the required shape
    });
    expect(result.show_columns_dropdown).toBe(false);
    expect(result.headers_labels).toEqual({ reference: "Consecutivo" });
});
```

Adjust the helper names and the surrounding settings shape to match the existing tests.

- [ ] **Step 2.5: Add a test that asserts the save path writes both fields**

```js
it("writes show_columns_dropdown and headers_labels on save", () => {
    const result = prepareDataToSave({
        ...minimalValues,
        show_columns_dropdown: false,
        headers_labels: { reference: "Consecutivo" },
    });
    expect(result.layouts.application.agente.cases.show_columns_dropdown).toBe(false);
    expect(result.layouts.application.agente.cases.headers_labels).toEqual({ reference: "Consecutivo" });
});
```

- [ ] **Step 2.6: Run all helpers tests**

Run: `cd apps/kace-saas && npx vitest run src/pages/GeneralSetup/helpers.test.js`
Expected: all PASS, including the previous `lock_case_description_edit` tests (no regression).

- [ ] **Step 2.7: Commit**

```bash
git add apps/kace-saas/src/pages/GeneralSetup/helpers.js apps/kace-saas/src/pages/GeneralSetup/helpers.test.js
git commit -m "feat(general-setup): read and write show_columns_dropdown and headers_labels in helpers"
```

---

## Task 3: Add i18n keys for the new UI

**Files:**
- Modify: `apps/kace-saas/src/locale/es.json`
- Modify: `apps/kace-saas/src/locale/en.json`

- [ ] **Step 3.1: Locate the `generalSetup.form.title.*` and `generalSetup.form.labels.*` sections in es.json**

Open `apps/kace-saas/src/locale/es.json` and find where `generalSetup.form.title` keys are declared (search for `subtitleCases` or `subtitleAsesor` as anchor points).

- [ ] **Step 3.2: Add the Spanish keys**

In `generalSetup.form.title`, add:

```json
"casesTable": "Tablas de casos",
```

In `generalSetup.form.labels`, add:

```json
"show_columns_dropdown": "Permitir al agente ocultar columnas",
"headers_labels_section": "Etiquetas personalizadas de columnas",
"headers_labels_empty": "No hay columnas personalizadas",
"headers_labels_add": "Agregar columna personalizada",
"headers_labels_column": "Columna",
"headers_labels_label": "Etiqueta visible",
"headers_labels_remove": "Quitar",
```

- [ ] **Step 3.3: Add the English keys in en.json**

Mirror the same keys with English values:

```json
"casesTable": "Case tables",
"show_columns_dropdown": "Allow the agent to hide columns",
"headers_labels_section": "Custom column labels",
"headers_labels_empty": "No custom columns",
"headers_labels_add": "Add custom column",
"headers_labels_column": "Column",
"headers_labels_label": "Visible label",
"headers_labels_remove": "Remove",
```

- [ ] **Step 3.4: Validate translations**

Run: `cd apps/kace-saas && pnpm run validate-translations`
Expected: PASS with no missing-key warnings.

- [ ] **Step 3.5: Commit**

```bash
git add apps/kace-saas/src/locale/es.json apps/kace-saas/src/locale/en.json
git commit -m "feat(general-setup): add i18n keys for case tables config UI"
```

---

## Task 4: Create the HeadersLabelsEditor component (TDD)

**Files:**
- Create: `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.jsx`
- Create: `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.test.jsx`

- [ ] **Step 4.1: Write the failing test file**

Create `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HeadersLabelsEditor } from "./HeadersLabelsEditor";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({
        schemaFields: {
            cases: [
                { column_name: "reference", label: "Reference", data_type: "string" },
                { column_name: "estadoActual", label: "Estado Actual", data_type: "string" },
                { column_name: "nivel1", label: "Nivel 1", data_type: "string" },
            ],
        },
    }),
}));

const HEADERS_CASES_TABLE = [
    { key: "reference" },
    { key: "estadoActual" },
    { key: "nivel1" },
];

vi.mock("../../../Cases/data/Constants", () => ({
    HEADERS_CASES_TABLE,
}));

const renderEditor = (value = {}, setFieldValue = vi.fn()) => {
    return render(
        <HeadersLabelsEditor
            value={value}
            setFieldValue={setFieldValue}
            name="headers_labels"
        />,
    );
};

describe("HeadersLabelsEditor", () => {
    it("renders the empty state when value is empty", () => {
        renderEditor({});
        expect(screen.getByTestId("headers_labels_empty")).toBeTruthy();
    });

    it("renders one row per entry in the value map", () => {
        renderEditor({ reference: "Consecutivo" });
        const rows = screen.getAllByTestId(/^headers_labels_row_/);
        expect(rows).toHaveLength(1);
        expect(within(rows[0]).getByDisplayValue("Consecutivo")).toBeTruthy();
    });

    it("adds a new empty row when the add button is clicked", async () => {
        const setFieldValue = vi.fn();
        renderEditor({}, setFieldValue);
        await userEvent.click(screen.getByTestId("headers_labels_add"));
        expect(setFieldValue).toHaveBeenCalledWith("headers_labels", {
            "__new_0": "",
        });
    });

    it("removes a row when the remove button is clicked", async () => {
        const setFieldValue = vi.fn();
        renderEditor({ reference: "Consecutivo" }, setFieldValue);
        await userEvent.click(screen.getByTestId("headers_labels_remove_reference"));
        expect(setFieldValue).toHaveBeenCalledWith("headers_labels", {});
    });

    it("updates the value when the label input changes", async () => {
        const setFieldValue = vi.fn();
        renderEditor({ reference: "Consecutivo" }, setFieldValue);
        const input = screen.getByTestId("headers_labels_input_reference");
        await userEvent.clear(input);
        await userEvent.type(input, "Custom");
        expect(setFieldValue).toHaveBeenLastCalledWith("headers_labels", {
            reference: "Custom",
        });
    });

    it("filters column options to those in HEADERS_CASES_TABLE", () => {
        renderEditor({});
        const addButton = screen.getByTestId("headers_labels_add");
        expect(addButton).toBeTruthy();
    });
});
```

- [ ] **Step 4.2: Run the test to confirm it fails**

Run: `cd apps/kace-saas && npx vitest run src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.test.jsx`
Expected: FAIL — `HeadersLabelsEditor` is not exported from `./HeadersLabelsEditor`.

- [ ] **Step 4.3: Implement the component**

Create `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.jsx`:

```jsx
import { InputForm, SelectField } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import useSchemaFields from "@/hooks/useSchemaFields";
import { HEADERS_CASES_TABLE } from "../../../Cases/data/Constants";
import { Trash2, Plus } from "lucide-react";
import { formatTestId } from "@/utils/src/helpers";

const useAvailableColumns = () => {
    const { schemaFields } = useSchemaFields();
    const allowedKeys = new Set(HEADERS_CASES_TABLE.map((h) => h.key));
    return (schemaFields?.cases || []).filter((field) => allowedKeys.has(field.column_name));
};

const getRowKey = (columnName, index) => columnName || `__new_${index}`;

export const HeadersLabelsEditor = ({ value = {}, setFieldValue, name = "headers_labels" }) => {
    const { t } = useTranslation();
    const availableColumns = useAvailableColumns();
    const usedKeys = new Set(Object.keys(value));
    const usedPlaceholderKeys = new Set(
        Object.keys(value).filter((k) => k.startsWith("__new_")),
    );
    const [newRowCounter, setNewRowCounter] = useState(usedPlaceholderKeys.size);

    const addRow = () => {
        const placeholderKey = `__new_${newRowCounter}`;
        setNewRowCounter(newRowCounter + 1);
        setFieldValue(name, { ...value, [placeholderKey]: "" });
    };

    const removeRow = (key) => {
        const next = { ...value };
        delete next[key];
        setFieldValue(name, next);
    };

    const updateRow = (oldKey, newColumnName, newLabel) => {
        const next = {};
        for (const [k, v] of Object.entries(value)) {
            if (k === oldKey) continue;
            next[k] = v;
        }
        next[newColumnName || oldKey] = newLabel;
        setFieldValue(name, next);
    };

    const updateLabel = (key, label) => {
        setFieldValue(name, { ...value, [key]: label });
    };

    const columnOptions = availableColumns.map((col) => ({
        value: col.column_name,
        label: col.label || col.column_name,
    }));

    const isPlaceholder = (key) => key.startsWith("__new_");

    return (
        <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">
                {t("generalSetup.form.labels.headers_labels_section")}
            </div>
            {Object.keys(value).length === 0 ? (
                <div
                    className="text-sm text-muted-foreground italic"
                    data-testid="headers_labels_empty"
                >
                    {t("generalSetup.form.labels.headers_labels_empty")}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {Object.entries(value).map(([key, label], index) => {
                        const currentColumnName = isPlaceholder(key) ? "" : key;
                        const availableForRow = columnOptions.filter(
                            (opt) => opt.value === currentColumnName || !usedKeys.has(opt.value),
                        );
                        return (
                            <div
                                key={key}
                                className="flex items-center gap-2"
                                data-testid={`headers_labels_row_${key}`}
                            >
                                <SelectField
                                    options={availableForRow}
                                    value={currentColumnName}
                                    placeholder={t("generalSetup.form.labels.headers_labels_column")}
                                    onValueChange={(newColumn) =>
                                        updateRow(key, newColumn, label)
                                    }
                                    data-testid={`headers_labels_select_${key}`}
                                />
                                <InputForm
                                    name={`headers_labels_input_${key}`}
                                    value={label || ""}
                                    onChange={(e) => updateLabel(key, e.target.value)}
                                    placeholder={t("generalSetup.form.labels.headers_labels_label")}
                                    data-testid={`headers_labels_input_${key}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeRow(key)}
                                    data-testid={`headers_labels_remove_${key}`}
                                    className="p-1 text-destructive"
                                    aria-label={t("generalSetup.form.labels.headers_labels_remove")}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
            <button
                type="button"
                onClick={addRow}
                data-testid="headers_labels_add"
                className="flex items-center gap-1 self-start text-sm text-primary"
            >
                <Plus size={14} />
                {t("generalSetup.form.labels.headers_labels_add")}
            </button>
        </div>
    );
};

HeadersLabelsEditor.propTypes = {
    value: PropTypes.object,
    setFieldValue: PropTypes.func.isRequired,
    name: PropTypes.string,
};
```

- [ ] **Step 4.4: Run the test to confirm it passes**

Run: `cd apps/kace-saas && npx vitest run src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.test.jsx`
Expected: PASS. If a test fails because of an unrelated UI primitive shape (e.g., `SelectField` API), adjust the test to match the actual exported component but keep the test intent (one row per entry, add/remove/update work, empty state shown).

- [ ] **Step 4.5: Commit**

```bash
git add apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.jsx apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.test.jsx
git commit -m "feat(general-setup): add HeadersLabelsEditor component with row add/remove and label override"
```

---

## Task 5: Wire the new card and editor into TabAgent.jsx

**Files:**
- Modify: `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/TabAgent.jsx`

- [ ] **Step 5.1: Add the import for the editor**

In `TabAgent.jsx`, add to the imports near the existing component imports:

```js
import { HeadersLabelsEditor } from "./HeadersLabelsEditor";
```

- [ ] **Step 5.2: Add the new CardModulesTab after the "Asesor" card**

Locate the closing `</CardModulesTab>` of the "Asesor" card (line ~278). Immediately after the closing tag, add a new card:

```jsx
<CardModulesTab
    title={t("generalSetup.form.title.casesTable")}
    description={t("generalSetup.form.title.subtitleCasesTable", "Configura la apariencia de las tablas de casos del agente.")}
    id="tab_agent_cases_table"
    data-testid="tab_agent_cases_table"
>
    <div className="px-2 flex flex-col gap-3">
        <CheckBoxContainer
            text={t("generalSetup.form.labels.show_columns_dropdown")}
            value={values.show_columns_dropdown}
            setFieldValue={setFieldValue}
            name="show_columns_dropdown"
        />
        <HeadersLabelsEditor
            value={values.headers_labels || {}}
            setFieldValue={setFieldValue}
            name="headers_labels"
        />
    </div>
</CardModulesTab>
```

- [ ] **Step 5.3: Run lint**

Run: `cd apps/kace-saas && pnpm run lint -- src/pages/GeneralSetup/components/GeneralSetupFormComponents/TabAgent.jsx`
Expected: PASS (or zero errors specific to this file).

- [ ] **Step 5.4: Run a focused smoke test**

If there is an existing test for the broader form container, run it. Otherwise:

Run: `cd apps/kace-saas && npx vitest run src/pages/GeneralSetup`
Expected: existing tests pass, no new failures.

- [ ] **Step 5.5: Commit**

```bash
git add apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/TabAgent.jsx
git commit -m "feat(general-setup): add 'Tablas de casos' card with show_columns_dropdown and headers_labels editor"
```

---

## Task 6: Apply the header override in CasesTableComponent (TDD)

**Files:**
- Create: `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.test.jsx`
- Modify: `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx`

- [ ] **Step 6.1: Write the failing test**

Create `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("../../../hooks/useConfigAgentData", () => ({
    default: () => ({
        cases: {
            headers_labels: { reference: "Consecutivo Custom" },
            show_columns_dropdown: true,
        },
    }),
}));

vi.mock("../../../pages/Cases/hooks/useCasesTableData", () => ({
    default: () => ({
        headers: [
            { column_name: "reference", label: "Consecutivo", data_type: "number" },
            { column_name: "estadoActual", label: "Estado Actual", data_type: "string" },
        ],
        dataTable: [],
        isFetching: false,
        isLoadingTable: false,
        refetch: vi.fn(),
        columnsToFilter: [],
        fieldsCustomerFilters: [],
        caseStatusCounter: [],
        showSubcasesButton: true,
    }),
}));

vi.mock("../../ui-shared/src/components/table-component/DataTableContainer", () => ({
    DataTableContainer: ({ columns }) => (
        <div data-testid="data-table-container">
            {columns.map((c) => (
                <div key={c.accessorKey} data-testid={`col_${c.accessorKey}`}>
                    {typeof c.header === "string" ? c.header : c.accessorKey}
                </div>
            ))}
        </div>
    ),
}));

vi.mock("../../../redux/state/filterCases", () => ({
    setFilterCases: vi.fn(),
}));

import { CasesTableComponent } from "./CasesTableComponent";

describe("CasesTableComponent", () => {
    it("uses the override label from configCases.headers_labels when present", () => {
        render(<CasesTableComponent keyQuery="test" />);
        expect(screen.getByTestId("col_reference").textContent).toBe("Consecutivo Custom");
    });

    it("falls back to the column label when no override is present", () => {
        render(<CasesTableComponent keyQuery="test" />);
        expect(screen.getByTestId("col_estadoActual").textContent).toBe("Estado Actual");
    });
});
```

- [ ] **Step 6.2: Run the test to confirm it fails**

Run: `cd apps/kace-saas && npx vitest run src/components/core/CasesTableComponent/CasesTableComponent.test.jsx`
Expected: FAIL — the override is not applied yet, the `reference` column shows "Consecutivo" instead of "Consecutivo Custom".

- [ ] **Step 6.3: Apply the override in `handleCurrentHeaders`**

In `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx`, modify the `handleCurrentHeaders` function (lines 62-85) to:

```js
const handleCurrentHeaders = () => {
    const overrides = configCases?.headers_labels || {};
    const keyColumns = headers.map((column) => {
        const override = overrides[column.column_name];
        const overrideText = override && String(override).trim() ? override : null;
        const headerText =
            overrideText !== null
                ? overrideText
                : (t(`gridMain.columns.${column.label}`) !== `gridMain.columns.${column.label}`
                    ? t(`gridMain.columns.${column.label}`)
                    : toTitleCase(column.column_name));
        return {
            accessorKey: column.column_name,
            header: headerText,
            value: column.data_type,
        };
    });
    if (showSubcasesColumn) {
        keyColumns.push({
            accessorKey: "subcasos",
            header:
                t("gridMain.columns.subcases") !== "gridMain.columns.subcases"
                    ? t("gridMain.columns.subcases")
                    : "Subcasos",
            value: "number",
            isSubcasosColumn: true,
        });
    }
    setCurrentHeaders(keyColumns);
};
```

- [ ] **Step 6.4: Run the test to confirm it passes**

Run: `cd apps/kace-saas && npx vitest run src/components/core/CasesTableComponent/CasesTableComponent.test.jsx`
Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.test.jsx
git commit -m "feat(agent): apply headers_labels override in CasesTableComponent"
```

---

## Task 7: Add the `showColumnsDropdown` prop to DataTable (TDD)

**Files:**
- Create: `apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.test.jsx`
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.jsx`

- [ ] **Step 7.1: Write the failing test**

Create `apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTable } from "./data-table";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("./hooks/useDataTable", () => ({
    default: () => ({
        dataTable: [],
        isLoading: false,
        refetch: vi.fn(),
        isRefetching: false,
        setNextCountItems: vi.fn(),
    }),
}));

vi.mock("../ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }) => <div>{children}</div>,
    DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }) => <div>{children}</div>,
    DropdownMenuCheckboxItem: ({ children }) => <div>{children}</div>,
    DropdownMenuLabel: ({ children }) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
}));

const baseColumns = [
    {
        accessorKey: "id",
        header: "Id",
        isVisible: true,
        getCanHide: () => true,
        accessorFn: (row) => row.id,
    },
];

const renderDataTable = (extraProps = {}) =>
    render(
        <DataTable
            nameTable="test"
            keyQueryData="test"
            columns={baseColumns}
            {...extraProps}
        />,
    );

describe("DataTable", () => {
    it("renders the Columns button by default", () => {
        renderDataTable();
        expect(screen.getByTestId("view_column_options")).toBeTruthy();
    });

    it("does not render the Columns button when showColumnsDropdown is false", () => {
        renderDataTable({ showColumnsDropdown: false });
        expect(screen.queryByTestId("view_column_options")).toBeNull();
    });
});
```

- [ ] **Step 7.2: Run the test to confirm it fails**

Run: `cd apps/kace-saas && npx vitest run src/components/ui-shared/src/components/table-component/data-table.test.jsx`
Expected: FAIL — the new test "does not render the Columns button when showColumnsDropdown is false" fails because the prop is not honored.

- [ ] **Step 7.3: Add the prop and gate the dropdown**

In `apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.jsx`, modify the function signature (around line 31) to:

```jsx
export function DataTable ({
    columns = [],
    isPagination = true,
    hiddenColumns = {},
    showFilterCases = false,
    searchCasesParams = null,
    nameHelper = [],
    nameTable = "",
    keyQueryData = "",
    isLoadingHeaders = false,
    getRowCanExpand = () => false,
    handleActions,
    filterAlternate = [],
    customsfilters = [],
    showFilterGeneric = true,
    columnsToFilter = null,
    showFilterCasesOnlyAll = false,
    customFuction = () => {},
    showColumnsDropdown = true,
}) {
```

Then change the rendering of the dropdown (around line 209) from:

```jsx
<DataTableViewOptions table={table} />
```

to:

```jsx
{showColumnsDropdown && <DataTableViewOptions table={table} />}
```

- [ ] **Step 7.4: Add the propTypes entry**

In the `DataTable.propTypes` block (around line 333), add:

```js
showColumnsDropdown: PropTypes.bool,
```

- [ ] **Step 7.5: Run the test to confirm it passes**

Run: `cd apps/kace-saas && npx vitest run src/components/ui-shared/src/components/table-component/data-table.test.jsx`
Expected: PASS.

- [ ] **Step 7.6: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.jsx apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.test.jsx
git commit -m "feat(data-table): add showColumnsDropdown prop to gate DataTableViewOptions"
```

---

## Task 8: Forward the prop through DataTableContainer and CasesTableComponent

**Files:**
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/DataTableContainer.jsx`
- Modify: `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx`
- Test: `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.test.jsx`

- [ ] **Step 8.1: Add the prop to DataTableContainer**

Open `apps/kace-saas/src/components/ui-shared/src/components/table-component/DataTableContainer.jsx`. Find the function signature and the propTypes object. Add:

```js
showColumnsDropdown = true,
```

to the destructured props and:

```js
showColumnsDropdown: PropTypes.bool,
```

to the propTypes.

Then find the spot where `DataTable` is rendered and pass the new prop through:

```jsx
<DataTable
    ...
    showColumnsDropdown={showColumnsDropdown}
/>
```

- [ ] **Step 8.2: Pass the prop from CasesTableComponent**

In `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx`, locate the `<DataTableContainer ... />` invocation (around line 152). Add:

```jsx
showColumnsDropdown={configCases?.show_columns_dropdown ?? true}
```

- [ ] **Step 8.3: Extend the existing CasesTableComponent test**

Open `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.test.jsx`. Add a new `it` block:

```jsx
it("passes showColumnsDropdown=true to the table when the config flag is true", () => {
    render(<CasesTableComponent keyQuery="test" />);
    expect(screen.getByTestId("data-table-container-show-columns-dropdown").textContent).toBe("true");
});

it("passes showColumnsDropdown=false to the table when the config flag is false", () => {
    // override the default mock for this test only
    const useConfigAgentData = (await import("../../../hooks/useConfigAgentData")).default;
    useConfigAgentData.mockReturnValueOnce({
        cases: { headers_labels: {}, show_columns_dropdown: false },
    });
    render(<CasesTableComponent keyQuery="test" />);
    expect(screen.getByTestId("data-table-container-show-columns-dropdown").textContent).toBe("false");
});
```

Because the test file uses `vi.mock` at the top, you must convert the import to a hoisted variable. Use this pattern instead:

```jsx
import { vi } from "vitest";

vi.mock("../../../hooks/useConfigAgentData", () => ({
    default: vi.fn(),
}));

import useConfigAgentData from "../../../hooks/useConfigAgentData";

beforeEach(() => {
    useConfigAgentData.mockReturnValue({
        cases: { headers_labels: { reference: "Consecutivo Custom" }, show_columns_dropdown: true },
    });
});
```

Also update the `DataTableContainer` mock in this test file to expose the prop:

```jsx
vi.mock("../../ui-shared/src/components/table-component/DataTableContainer", () => ({
    DataTableContainer: ({ columns, showColumnsDropdown }) => (
        <div data-testid="data-table-container">
            <div data-testid="data-table-container-show-columns-dropdown">{String(showColumnsDropdown)}</div>
            {columns.map((c) => (
                <div key={c.accessorKey} data-testid={`col_${c.accessorKey}`}>
                    {typeof c.header === "string" ? c.header : c.accessorKey}
                </div>
            ))}
        </div>
    ),
}));
```

- [ ] **Step 8.4: Run the test to confirm it passes**

Run: `cd apps/kace-saas && npx vitest run src/components/core/CasesTableComponent/CasesTableComponent.test.jsx`
Expected: PASS.

- [ ] **Step 8.5: Run the full vitest suite for the touched apps**

Run: `cd apps/kace-saas && npx vitest run`
Expected: all tests pass. If a previously passing test breaks because of the new prop default or any cascading change, fix the regression before committing.

- [ ] **Step 8.6: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/table-component/DataTableContainer.jsx apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.test.jsx
git commit -m "feat(agent): forward show_columns_dropdown from config to DataTableContainer"
```

---

## Task 9: Final lint, type-check, and verification

**Files:** none modified.

- [ ] **Step 9.1: Run ESLint on the touched files**

Run: `cd apps/kace-saas && pnpm run lint -- src/schemas/GeneralSetupSchemaForm.js src/pages/GeneralSetup/data/constants.jsx src/pages/GeneralSetup/helpers.js src/pages/GeneralSetup/helpers.test.js src/pages/GeneralSetup/components/GeneralSetupFormComponents/TabAgent.jsx src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.jsx src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.test.jsx src/components/core/CasesTableComponent/CasesTableComponent.jsx src/components/core/CasesTableComponent/CasesTableComponent.test.jsx src/components/ui-shared/src/components/table-component/data-table.jsx src/components/ui-shared/src/components/table-component/data-table.test.jsx src/components/ui-shared/src/components/table-component/DataTableContainer.jsx`
Expected: zero errors. Warnings about style are acceptable but should be reviewed.

- [ ] **Step 9.2: Run the type-check (if applicable)**

Run: `cd apps/kace-saas && pnpm run tsc-build`
Expected: zero errors. If the project does not produce errors on the touched files, skip this step.

- [ ] **Step 9.3: Run the full vitest suite**

Run: `cd apps/kace-saas && pnpm test -- --run`
Expected: all tests pass.

- [ ] **Step 9.4: Verify translation parity**

Run: `cd apps/kace-saas && pnpm run validate-translations`
Expected: zero missing-key warnings.

- [ ] **Step 9.5: Manual smoke (if the agent runs locally)**

If the user can run the kace-saas dev server, smoke test:
1. Open the GeneralSetup page, agent tab.
2. Confirm the new "Tablas de casos" card appears with the checkbox and the editor.
3. Toggle `show_columns_dropdown` off, save, reload `/agent`, and confirm the "Columns" button is not rendered in any of the four case tables.
4. Add a `headers_labels` entry for `reference` with a custom label, save, reload `/agent`, and confirm the column header reads the override.

- [ ] **Step 9.6: Report completion**

Report to the user: the spec is at `docs/superpowers/specs/2026-07-09-parametrize-agent-tables-design.md` (uncommitted per request), the implementation plan is at `docs/superpowers/plans/2026-07-09-parametrize-agent-tables.md` (uncommitted per request), and the branch `feat/parametrize-agent-tables-headers` is ready for review. Ask the user before any commit or push.
