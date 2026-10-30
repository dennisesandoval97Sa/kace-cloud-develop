# Parametrize Agent Case Table Headers and Columns Dropdown

## Context

The agent tab in `kace-saas` (`/agent`) shows four case tables that share the same `CasesTableComponent`:
- My Assigned Cases
- My Created Cases
- Client Open Cases
- Client Closed Cases

Two pieces of behavior are currently hard-coded:

1. **Column header labels** are derived from the case schema (`useSchemaFields`), with i18n fallback through `t(gridMain.columns.<label>)` or a `toTitleCase(column_name)` heuristic. Admins cannot change the visible text per tenant; localization is the only knob.
2. **The "Columns" dropdown** (the per-column show/hide menu rendered by `DataTableViewOptions`) is always visible. There is no tenant-level toggle to hide it for the whole agent surface, even though the consumer-facing value of the dropdown is sometimes noise (the canonical columns are already curated by `HEADERS_CASES_TABLE`).

There is a working precedent in this repo for tenant-level UI flags: `settings.behaviors.application.agente.casos.lock_case_description_edit` is a boolean flag, validated in `GeneralSetupSchemaForm`, defaulted in `data/constants.jsx`, written by `helpers.js`, surfaced in the `TabAgent` form, and consumed in business logic. The same pattern extends naturally here.

## Goals

- Allow an admin to override the visible text of any column header in the four agent case tables.
- Allow an admin to hide the "Columns" dropdown in the four agent case tables with a single toggle.
- Keep current behavior as the default (no breaking change for existing tenants).
- Make the new fields discoverable in the GeneralSetup agent tab with a UX consistent with neighboring flags.
- Cover the four tables with a single shared configuration (the tables already share `HEADERS_CASES_TABLE` and `CasesTableComponent`).

## Non-goals

- No new columns may be added. The override is rename-only; the set of visible columns stays curated by `HEADERS_CASES_TABLE` and the case schema.
- No per-table override. All four tables share the same configuration.
- No reordering of columns. The existing `hiddenColumns` / `columnVisibility` mechanic in `DataTable` is untouched.
- No change to the i18n bundle or the existing translation keys.
- No new API endpoint. The fields flow through the existing `general-configurations` create/update endpoints.

## Decisions

- **Storage location**: `settings.layouts.application.agente.cases.*` (not `behaviors`). Layouts is the right home because:
  - `useConfigAgentData` already merges `layouts.cases` and `behaviors.casos` into a single `cases` object, so a single merge surface is unchanged.
  - The sibling field `visible_columns` (admin's column visibility for the case detail form) already lives in `layouts.application.agente.cases`.
  - These are display-layer concerns, not runtime behavior.
- **Two new fields**:
  - `show_columns_dropdown`: boolean, default `true`. When `false`, the `<DataTableViewOptions />` component is not rendered.
  - `headers_labels`: array of `{ key: string, label: string }` entries, default `[]`. Each `key` and `label` is a non-empty string; the `key` must exist in the curated `HEADERS_CASES_TABLE` set. Array form is used (not a map) so that `remove` operations are persisted correctly through the backend merge logic — arrays are replaced wholesale.
- **Override semantics for headers**: the override is a flat text replacement. It wins over the i18n key lookup and over the `toTitleCase` fallback. Empty / whitespace-only values are treated as "no override" so an admin can clear a previous override without removing the entry.
- **Override resolution happens at render time** in `CasesTableComponent.handleCurrentHeaders`. The `column_name` (already available on each header) is the lookup key — no new column iteration, no schema change.
- **DataTable prop**: add a single optional `showColumnsDropdown` prop (default `true`) to the shared `DataTable` component, then propagate it through `DataTableContainer` and `CasesTableComponent`. The prop only controls visibility of the `DataTableViewOptions` button; column toggles, sorting, filtering, and pagination are unaffected.
- **UI for the override list**: a new structured `HeadersLabelsEditor` component (one row per entry). Source of column options is the case schema (`useSchemaFields`) intersected with `HEADERS_CASES_TABLE` so admins cannot invent columns. Duplicate `key` selections across rows are blocked. Defensive read accepts the legacy map shape and converts it on the fly.
- **Form placement**: a new `CardModulesTab` titled "Tablas de casos" in `TabAgent.jsx`, placed immediately after the existing "Asesor" card. This keeps case-table concerns grouped without mixing them into the agent toggles card.

## Behavior

### Data shape (settings payload)

```json
{
  "layouts": {
    "application": {
      "agente": {
        "cases": {
          "show_columns_dropdown": true,
          "headers_labels": [
            { "key": "reference", "label": "Consecutivo Custom" }
          ],
            "reference": "Consecutivo Custom",
            "estadoActual": "Estado Custom",
            "nivel1": "Clasificación Custom"
          }
        }
      }
    }
  }
}
```

Defaults when the section is missing: `show_columns_dropdown = true`, `headers_labels = []`.

### Form defaults (`INITIAL_VALUES_GLOBAL_SETUP`)

```js
show_columns_dropdown: true,
headers_labels: [],
```

### Joi validation (`GeneralSetupSchemaForm.js`, layouts.application.agente.cases)

```js
show_columns_dropdown: JoiHelper.boolean().default(true),
headers_labels: JoiHelper.array()
    .items(
        JoiHelper.object({
            key: JoiHelper.string().min(1).max(200),
            label: JoiHelper.string().min(1).max(200),
        }),
    )
    .default([]),
```

Empty / whitespace-only values are rejected at the form layer. The consumer treats them as "no override" defensively.

### Admin form

New `CardModulesTab` in `TabAgent.jsx`:

```
CardModulesTab "Tablas de casos"
  ├── CheckBoxContainer (show_columns_dropdown)
  │     text: "Permitir al agente ocultar columnas"
  │     name: "show_columns_dropdown"
  └── HeadersLabelsEditor
        ├── Fila 1: [Select: column_name] [Input: override] [X]
        ├── Fila 2: ...
        └── [+ Agregar fila]
```

`HeadersLabelsEditor`:
- Loads column options from `useSchemaFields('cases')` and intersects with the keys of `HEADERS_CASES_TABLE`. This means the editor only shows columns the agent can actually see today.
- Each row is bound to a single entry in the `headers_labels` array. Duplicate `key` selections across rows are blocked.
- Removing a row deletes the key from the map (does not set it to `""`).
- Empty state: "No hay columnas personalizadas" with a prominent "Agregar fila" button.

### Read path

`useConfigAgentData.js` already exposes `cases` as a merge of `configAgentLayouts.cases` and `configAgentBehaviors.casos`. No changes are required to the hook itself — the two new fields flow through transparently.

### Consumer (rename)

`CasesTableComponent.handleCurrentHeaders` (apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx:62):

```js
const overridesList = Array.isArray(configCases?.headers_labels) ? configCases.headers_labels : [];
const overrides = new Map(overridesList.filter((e) => e?.key).map((e) => [e.key, e.label]));
const overrideLabel = overrides.get(column.column_name);
const headerText =
    overrideLabel && String(overrideLabel).trim()
        ? overrideLabel
        : (t(`gridMain.columns.${column.label}`) !== `gridMain.columns.${column.label}`
            ? t(`gridMain.columns.${column.label}`)
            : toTitleCase(column.column_name));

return {
    accessorKey: column.column_name,
    header: headerText,
    value: column.data_type,
};
```

Behavior at the cell level is unchanged; only the displayed `header` value is replaced.

### Consumer (show/hide Columns dropdown)

`DataTable` (`apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.jsx`):
- Add prop `showColumnsDropdown = true`.
- Wrap the existing `<DataTableViewOptions table={table} />` in `{showColumnsDropdown && ...}`.

`DataTableContainer` (the wrapper used by `CasesTableComponent`):
- Forward the new prop to `DataTable` unchanged.

`CasesTableComponent`:
- Read `configCases?.show_columns_dropdown ?? true` and pass it as `showColumnsDropdown` to `DataTableContainer`.

### Edge cases

- **Empty override value**: treated as "no override" (trim + check). The Joi validation rejects empty values at form submission time as well.
- **Override for a `column_name` not in `HEADERS_CASES_TABLE`**: technically allowed in the storage shape (the consumer just looks it up), but the editor's column options only allow keys that are in `HEADERS_CASES_TABLE`. If a value arrives from an older format or a manual edit, the consumer never matches it because it iterates over schema headers, not the map keys, so it has no visible effect.
- **Override for the `subcasos` column**: not supported in this iteration. The `subcasos` column is appended programmatically in `handleCurrentHeaders` and is not part of `HEADERS_CASES_TABLE`. If we want it overridable later, that is a follow-up.
- **Missing `cases` config**: defensive `Array.isArray(configCases?.headers_labels) ? configCases.headers_labels : []` and `configCases?.show_columns_dropdown ?? true` both default cleanly, so missing or malformed config behaves like the defaults.
- **Multi-tenant**: each tenant has its own `global_configurations` row, so the override is per-tenant without any further work.

## Files to change

### Frontend (kace-saas)

- `apps/kace-saas/src/schemas/GeneralSetupSchemaForm.js` — add Joi rules for both fields.
- `apps/kace-saas/src/pages/GeneralSetup/data/constants.jsx` — add defaults to `INITIAL_VALUES_GLOBAL_SETUP`.
- `apps/kace-saas/src/pages/GeneralSetup/helpers.js` — add both fields to the read and write paths under `layouts.application.agente.cases.*`.
- `apps/kace-saas/src/pages/GeneralSetup/helpers.test.js` — add coverage for the new fields.
- `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/TabAgent.jsx` — add the new `CardModulesTab` with the checkbox and the editor.
- `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.jsx` (new) — key-value editor component.
- `apps/kace-saas/src/pages/GeneralSetup/components/GeneralSetupFormComponents/HeadersLabelsEditor.test.jsx` (new) — unit tests.
- `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.jsx` — apply the header override in `handleCurrentHeaders` and pass `showColumnsDropdown` to `DataTableContainer`.
- `apps/kace-saas/src/components/core/CasesTableComponent/CasesTableComponent.test.jsx` (new, if missing) — cover header override and dropdown visibility.
- `apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.jsx` — add the optional `showColumnsDropdown` prop and gate the `DataTableViewOptions` render on it.
- `apps/kace-saas/src/components/ui-shared/src/components/table-component/data-table.test.jsx` (new, if missing) — assert the dropdown is hidden when the prop is `false`.
- `apps/kace-saas/src/components/ui-shared/src/components/table-component/DataTableContainer.jsx` — forward `showColumnsDropdown` to `DataTable`.

### i18n

- Add translation keys for the new card title, the checkbox label, the editor placeholder/help text, and the empty state. Keys live under `generalSetup.form.title.*` and `generalSetup.form.labels.*` consistent with the rest of `TabAgent`.

## Acceptance criteria

1. With default config (`show_columns_dropdown = true`, `headers_labels = []`), the four agent case tables behave exactly as today.

3. Setting `headers_labels = [{ "key": "reference", "label": "Consecutivo Custom" }]` causes the "Reference" column to render with the header "Consecutivo Custom" on all four tables.
4. Empty / whitespace values in `headers_labels[i].label` are treated as "no override" (fallback to i18n / `toTitleCase`). Entries with empty `key` are ignored.
5. The editor only allows selecting `column_name` values that exist in `HEADERS_CASES_TABLE`.
6. The editor prevents selecting the same `column_name` twice.
7. Removing a row from the editor deletes the key from the map.
8. Submitting the form fails with a Joi error if a value is empty or longer than 200 characters.
9. Existing tests pass.
10. New tests cover: `HeadersLabelsEditor` (render, add, remove, duplicate prevention, empty state), `CasesTableComponent` header override and dropdown visibility, `DataTable` dropdown visibility, `helpers.js` round-trip.

## Testing plan

- **Unit (`vitest`/`@testing-library/react`)**:
  - `HeadersLabelsEditor.test.jsx`: render empty state, add a row, remove a row (including the correct row when there are multiple), attempt duplicate column, edit input value, change column select, migrate legacy map value defensively.
  - `CasesTableComponent.test.jsx`: render with `configCases = { headers_labels: [{ key: "reference", label: "Custom" }] }` and assert the `header` prop is "Custom"; render with `show_columns_dropdown: false` and assert the dropdown button is not in the DOM.
  - `data-table.test.jsx`: render with `showColumnsDropdown = false` and assert the dropdown button is not in the DOM; render with the prop omitted (default `true`) and assert it is in the DOM.
  - `helpers.test.js`: round-trip write/read of the new fields; default values when missing.
- **Manual smoke** (out of scope for CI): edit a tenant's `global_configurations.settings` JSON to set `show_columns_dropdown = false` and a `headers_labels` entry, reload the agent tab, and confirm both UI changes.
