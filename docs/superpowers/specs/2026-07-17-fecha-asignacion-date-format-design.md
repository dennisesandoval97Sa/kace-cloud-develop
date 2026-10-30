# Fecha Asignacion Date Format — Design Spec

**Branch:** `fix/fecha-asignacion-date-format`  
**Base:** `origin/release/1.23.x`  
**Date:** 2026-07-17  
**Scope:** `CaseDataTable` only (minimal change)

## Problem

In custom case views (e.g. `view_case_felipe`), the column `fecha_asignacion` (alias of `cases.last_assigned_at`) renders as raw ISO 8601 (`2026-07-15T15:40:01.049Z`) while sibling date columns like `created_at` display as `DD/MM/YYYY HH:mm:ss`.

## Root Cause

`/schema-fields` correctly maps PostgreSQL `timestamp with time zone` to `data_type: "Date"` for view columns including `fecha_asignacion`.

The frontend ignores schema metadata when formatting row data. `handleStateTimer` in `FormatData.jsx` uses a hardcoded field list that omits `fecha_asignacion` and any future date columns added to custom views.

## Out of Scope

- Global `useDataTable` post-processing
- Legacy `ui-shared/useDataTable.jsx`
- Legacy `form-format.jsx`
- `useCasesTableData` and other tables
- SQL view or API changes

## Solution

Wire schema-derived date columns into the existing `CaseDataTable` → `processCasesData` → `handleStateTimer` pipeline.

### Architecture

```
/schema-fields (fecha_asignacion → Date)
        ↓
CaseDataTable (getSchemaField(entity))
        ↓
processCasesData(..., schema)
        ↓
resolveDateColumnNamesFromSchema(schema)
        ↓
handleStateTimer(data, [], schema)
        ↓
formatDate(value, "dd/MM/yyyy HH:mm:ss")
```

### New Module

**`apps/kace-saas/src/utils/src/utils/resolveDateColumnNamesFromSchema.js`**

Pure function. Input: schema column array from `/schema-fields`. Output: `column_name[]` for columns whose type is date-like.

Type detection (case-insensitive):

- `data_type`: `date`, `datetime`
- `schema_column_type` (when present): same values
- API raw value `Date` normalizes to `date`

### Changes to Existing Code

**`handleStateTimer` (`FormatData.jsx`)**

- Signature: `(data, additionalDateFields = [], schema = null)`
- Effective fields = `DEFAULT_DATE_FIELDS` ∪ `additionalDateFields` ∪ `resolveDateColumnNamesFromSchema(schema)`
- Only format values matching ISO pattern `/^\d{4}-\d{2}-\d{2}T/` to avoid double-formatting already transformed strings
- Continue using `formatDate(value, "dd/MM/yyyy HH:mm:ss")`

**`processCasesData` (`processCasesData.js`)**

- Factory accepts optional `schema` as fourth argument
- Passes `schema` to `handleStateTimer`

**`CaseDataTable` (`index.jsx`)**

- Read schema via `useSchemaFields().getSchemaField(tableConfig.entity)`
- Pass schema into `processCasesData(..., schema)` inside `useMemo`/`useDataTable` config

### Schema-Fields Validation

No API change required. Add explicit unit test asserting `#mapPostgresToJavaScriptType('timestamp with time zone')` returns `'Date'` in `KnexFieldListRepository` test suite (or equivalent isolated test if repository method is private).

## Tests (TDD)

| File | Cases |
|------|-------|
| `resolveDateColumnNamesFromSchema.test.js` | Returns `fecha_asignacion` for Date type; excludes string columns |
| `handleStateTimer.test.js` | Formats `fecha_asignacion` when present in schema; leaves already-formatted `created_at` unchanged; backward compatible when schema is null |

## Success Criteria

1. `fecha_asignacion` displays as `DD/MM/YYYY HH:mm:ss` in `CaseDataTable` with custom view enabled
2. Any other date column in the same custom view schema is formatted consistently
3. Default cases table (non-custom view) behavior unchanged
4. All new and existing unit tests pass

## Files Touched

| File | Action |
|------|--------|
| `apps/kace-saas/src/utils/src/utils/resolveDateColumnNamesFromSchema.js` | Create |
| `apps/kace-saas/src/utils/src/utils/resolveDateColumnNamesFromSchema.test.js` | Create |
| `apps/kace-saas/src/utils/src/utils/handleStateTimer.test.js` | Create |
| `apps/kace-saas/src/utils/src/utils/FormatData.jsx` | Modify |
| `apps/kace-saas/src/pages/Cases/components/CaseDataTable/utils/processCasesData.js` | Modify |
| `apps/kace-saas/src/pages/Cases/components/CaseDataTable/index.jsx` | Modify |
| `packages/kace_cloud_core/tests/field-list/KnexFieldListRepositoryIntegration.test.js` | Add timestamp mapping assertion (optional, if feasible without DB) |

## Risk

Low. Change is isolated to CaseDataTable data processing. ISO guard prevents regressions on pre-formatted fields.
