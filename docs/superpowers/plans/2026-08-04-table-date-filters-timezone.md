# Table Date Filters Timezone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que los filtros de fecha desde tablas del frontal usen el día calendario (o wall-clock datetime) en la zona del navegador, enviando `between` con offset real al backend.

**Architecture:** Un helper puro `normalizeTableDateRangeFilter` (TDD + matriz LATAM) vive en `@kace/utils`. Se cablea en legacy (`useHookFilter`), DataTable V2 (`useDataTable` vía un normalizador de mapa de filtros) y `src_v2` `filterBuilder`. El picker no se cambia; el helper corrige la `Z` literal.

**Tech Stack:** React, Vitest, `date-fns-tz` (`fromZonedTime`, `formatInTimeZone`), pipelines existentes de filtros de tabla.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-04-table-date-filters-timezone-design.md`
- Rama: `fix/frontend-date-filters-timezone` (desde `origin/develop`)
- TDD RED → GREEN por tarea. Código mínimo. SOLID / sin sobre-ingeniería.
- Fuente de TZ: navegador (`Intl.DateTimeFormat().resolvedOptions().timeZone`), inyectable en tests.
- Formato de salida preferido: `yyyy-MM-dd'T'HH:mm:ss.SSSXXX` (ej. `-05:00`).
- No cambiar `DatePickerWithRange` / `DateTimePickerWithRange` globalmente.
- No tocar formularios/exports fuera de tablas; no cambios de backend.
- Tras cada `git commit`, verificar `git log -1 --format='%B'` y eliminar trailer `Co-authored-by: Cursor` / `Made-with: Cursor` con `commit-tree` si aparece (regla del repo).

---

## File Map

| File | Responsibility |
|---|---|
| `apps/kace-saas/src/utils/src/utils/normalizeTableDateRangeFilter.js` | **Nuevo** — helper puro date/datetime |
| `apps/kace-saas/src/utils/src/utils/normalizeTableDateRangeFilter.test.js` | **Nuevo** — matriz LATAM + edges |
| `apps/kace-saas/src/utils/src/utils/normalizeAppliedTableDateFilters.js` | **Nuevo** — normaliza mapa de filtros V2 |
| `apps/kace-saas/src/utils/src/utils/normalizeAppliedTableDateFilters.test.js` | **Nuevo** — TDD mapa V2 |
| `apps/kace-saas/src/utils/main.js` | Re-export del helper |
| `…/table-component/hooks/useHookFilter.js` | Cablear helper; quitar TZ inline |
| `…/table-component/helpers.js` | Ampliar `DATE_EXACT_COLUMNS` (`receipt_at`, etc.) |
| `…/table-component/helpers.test.js` | Extender tests de detección de fechas |
| `apps/kace-saas/src/hooks/useDataTable.jsx` | Usar `normalizeAppliedTableDateFilters` en `handleApplyFilters` |
| `apps/kace-saas/src_v2/shared/utils/filterBuilder.util.js` | Normalizar en `case "date"` |
| `apps/kace-saas/src_v2/shared/utils/filterBuilder.util.test.js` | **Nuevo** — TDD filterBuilder date |

---

### Task 1: `normalizeTableDateRangeFilter` (TDD + LATAM)

**Files:**
- Create: `apps/kace-saas/src/utils/src/utils/normalizeTableDateRangeFilter.js`
- Create: `apps/kace-saas/src/utils/src/utils/normalizeTableDateRangeFilter.test.js`
- Modify: `apps/kace-saas/src/utils/main.js`

**Interfaces:**
- Consumes: `date-fns-tz` (`fromZonedTime`, `formatInTimeZone`)
- Produces:
  - `normalizeTableDateRangeFilter(value: string, timeZone: string, options?: { mode?: 'date' | 'datetime' }): string | null`
  - Default `mode`: `'date'`
  - Output shape: `"startISO, endISO"` con `XXX` offset, o `null`

- [ ] **Step 1: Write the failing tests**

Create `normalizeTableDateRangeFilter.test.js`:

```javascript
import { describe, expect, it } from "vitest";
import { normalizeTableDateRangeFilter } from "./normalizeTableDateRangeFilter";

const LATAM_ZONES = [
    { country: "Colombia", timeZone: "America/Bogota", singleDayOffset: "-05:00" },
    { country: "Mexico", timeZone: "America/Mexico_City", singleDayOffset: "-06:00" },
    { country: "Chile", timeZone: "America/Santiago", singleDayOffset: "-04:00" }, // 2026-07 winter
    { country: "Argentina", timeZone: "America/Argentina/Buenos_Aires", singleDayOffset: "-03:00" },
    { country: "Peru", timeZone: "America/Lima", singleDayOffset: "-05:00" },
    { country: "Brazil", timeZone: "America/Sao_Paulo", singleDayOffset: "-03:00" },
    { country: "Uruguay", timeZone: "America/Montevideo", singleDayOffset: "-03:00" },
    { country: "Ecuador", timeZone: "America/Guayaquil", singleDayOffset: "-05:00" },
];

describe("normalizeTableDateRangeFilter", () => {
    describe.each(LATAM_ZONES)("$country ($timeZone)", ({ timeZone, singleDayOffset }) => {
        it("normalizes a single calendar day from picker fake-Z input", () => {
            const input = "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z";
            const result = normalizeTableDateRangeFilter(input, timeZone, { mode: "date" });
            expect(result).toBe(
                `2026-07-23T00:00:00.000${singleDayOffset}, 2026-07-23T23:59:59.999${singleDayOffset}`,
            );
        });

        it("normalizes a multi-day range", () => {
            const input = "2026-07-23T00:00:00.000Z, 2026-07-25T23:59:59.999Z";
            const result = normalizeTableDateRangeFilter(input, timeZone, { mode: "date" });
            expect(result).toBe(
                `2026-07-23T00:00:00.000${singleDayOffset}, 2026-07-25T23:59:59.999${singleDayOffset}`,
            );
        });

        it("treats a single side as a full calendar day", () => {
            const input = "2026-07-23T00:00:00.000Z";
            const result = normalizeTableDateRangeFilter(input, timeZone, { mode: "date" });
            expect(result).toBe(
                `2026-07-23T00:00:00.000${singleDayOffset}, 2026-07-23T23:59:59.999${singleDayOffset}`,
            );
        });
    });

    it("Bogota midnight boundary is not treated as UTC day", () => {
        const result = normalizeTableDateRangeFilter(
            "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
            "America/Bogota",
        );
        expect(result.startsWith("2026-07-23T00:00:00.000-05:00")).toBe(true);
        expect(result).not.toContain("2026-07-23T00:00:00.000Z");
    });

    it("Mexico City midnight boundary uses -06:00", () => {
        const result = normalizeTableDateRangeFilter(
            "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
            "America/Mexico_City",
        );
        expect(result).toContain("-06:00");
        expect(result).not.toContain("-05:00");
    });

    it("preserves wall-clock times in datetime mode", () => {
        // Absolute UTC for 2026-07-23 10:15:00 in Bogota (-05) = 15:15Z
        const input = "2026-07-23T15:15:00.000Z, 2026-07-23T20:30:59.999Z";
        const result = normalizeTableDateRangeFilter(input, "America/Bogota", { mode: "datetime" });
        expect(result).toBe("2026-07-23T10:15:00.000-05:00, 2026-07-23T15:30:59.999-05:00");
    });

    it("returns null for empty / invalid / inverted ranges", () => {
        expect(normalizeTableDateRangeFilter("", "America/Bogota")).toBeNull();
        expect(normalizeTableDateRangeFilter("not-a-date", "America/Bogota")).toBeNull();
        expect(
            normalizeTableDateRangeFilter(
                "2026-07-25T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
                "America/Bogota",
            ),
        ).toBeNull();
    });

    it("throws for invalid timeZone", () => {
        expect(() =>
            normalizeTableDateRangeFilter("2026-07-23T00:00:00.000Z", "Not/A_Zone"),
        ).toThrow();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd apps/kace-saas && pnpm exec vitest run src/utils/src/utils/normalizeTableDateRangeFilter.test.js
```

Expected: FAIL (module not found / export missing).

- [ ] **Step 3: Implement the helper**

Create `normalizeTableDateRangeFilter.js`:

```javascript
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const RANGE_SPLIT = /, /;
const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;
const OUTPUT = "yyyy-MM-dd'T'HH:mm:ss.SSSXXX";

const extractCalendarDate = (part) => {
    const trimmed = String(part ?? "").trim();
    const match = trimmed.match(DATE_PREFIX);
    return match ? match[1] : null;
};

const formatBound = (calendarDate, wallTime, timeZone) => {
    const utcDate = fromZonedTime(`${calendarDate}T${wallTime}`, timeZone);
    return formatInTimeZone(utcDate, timeZone, OUTPUT);
};

const normalizeDateMode = (startPart, endPart, timeZone) => {
    const startDay = extractCalendarDate(startPart);
    const endDay = extractCalendarDate(endPart ?? startPart);
    if (!startDay || !endDay) return null;
    if (endDay < startDay) return null;

    const start = formatBound(startDay, "00:00:00.000", timeZone);
    const end = formatBound(endDay, "23:59:59.999", timeZone);
    return `${start}, ${end}`;
};

const normalizeDatetimeMode = (startPart, endPart, timeZone) => {
    const startInstant = new Date(String(startPart).trim());
    const endInstant = new Date(String(endPart ?? startPart).trim());
    if (Number.isNaN(startInstant.getTime()) || Number.isNaN(endInstant.getTime())) return null;
    if (endInstant.getTime() < startInstant.getTime()) return null;

    const start = formatInTimeZone(startInstant, timeZone, OUTPUT);
    const end = formatInTimeZone(endInstant, timeZone, OUTPUT);
    return `${start}, ${end}`;
};

/**
 * @param {string} value
 * @param {string} timeZone IANA timezone
 * @param {{ mode?: 'date' | 'datetime' }} [options]
 * @returns {string|null}
 */
export const normalizeTableDateRangeFilter = (value, timeZone, options = {}) => {
    if (value === null || value === undefined || value === "") return null;
    if (!timeZone || typeof timeZone !== "string") {
        throw new Error("normalizeTableDateRangeFilter: timeZone is required");
    }

    try {
        Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    } catch {
        throw new Error(`normalizeTableDateRangeFilter: invalid timeZone "${timeZone}"`);
    }

    const mode = options.mode === "datetime" ? "datetime" : "date";
    const [startPart, endPart] = String(value).split(RANGE_SPLIT);

    return mode === "datetime"
        ? normalizeDatetimeMode(startPart, endPart, timeZone)
        : normalizeDateMode(startPart, endPart, timeZone);
};
```

Export from `main.js` next to the existing `dateUtils` exports:

```javascript
export { normalizeTableDateRangeFilter } from "./src/utils/normalizeTableDateRangeFilter.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/kace-saas && pnpm exec vitest run src/utils/src/utils/normalizeTableDateRangeFilter.test.js
```

Expected: PASS.  
If Chile offset fails for `2026-07-23`, re-check IANA rules for that date and adjust **only** the expected `singleDayOffset` in the test table (do not change product semantics).

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/utils/src/utils/normalizeTableDateRangeFilter.js \
  apps/kace-saas/src/utils/src/utils/normalizeTableDateRangeFilter.test.js \
  apps/kace-saas/src/utils/main.js
git commit -m "$(cat <<'EOF'
feat(filters): add normalizeTableDateRangeFilter with LATAM coverage

Pure helper converts table date/datetime filter ranges to browser-TZ
ISO bounds so UTC-stored rows match the selected calendar day.
EOF
)"
git log -1 --format='%B'
```

---

### Task 2: Wire legacy `useHookFilter`

**Files:**
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/hooks/useHookFilter.js`
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js`

**Interfaces:**
- Consumes: `normalizeTableDateRangeFilter` from `@kace/utils`
- Produces: `normalizeDateRange` callback using browser TZ + mode `date`

- [ ] **Step 1: Add failing wiring assertion**

Append to `useHookFilter.casesFilters.test.js`:

```javascript
import { normalizeTableDateRangeFilter } from "@kace/utils";

it("normalizes created_at between with Bogota offset via real helper", () => {
    const criteria = buildFilterCriteriaFromForm({
        dataForm: {
            created_at: "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
        },
        nameTable: { view: "cases", key: "cases" },
        fieldsCustomerFilters: [],
        resolveDateOperator: resolveDateFilterOperator,
        validateSearchToTable,
        casesTable: false,
        normalizeDateRange: (value) =>
            normalizeTableDateRangeFilter(value, "America/Bogota", { mode: "date" }),
        numberFieldNames: [],
    });

    expect(criteria).toEqual([
        expect.objectContaining({
            field: "cases.created_at",
            operator: "between",
            value: "2026-07-23T00:00:00.000-05:00, 2026-07-23T23:59:59.999-05:00",
            type: "AND",
        }),
    ]);
});
```

(Adjust `field` expectation to match what `buildFilterCriteriaFromForm` already emits for `view: "cases"` — mirror existing tests in the same file.)

- [ ] **Step 2: Run test to verify it fails or passes depending on hook wiring**

Run:

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js
```

Expected: the new case may PASS already if only testing `buildFilterCriteriaFromForm` injection; that is fine — proceed to replace the hook inline.

- [ ] **Step 3: Replace inline normalizeDateRange in `useHookFilter.js`**

Remove:

```javascript
import { format, fromZonedTime, toZonedTime } from "date-fns-tz";
```

Add:

```javascript
import { normalizeTableDateRangeFilter } from "@kace/utils";
```

Replace the `normalizeDateRange` callback body with:

```javascript
normalizeDateRange: (value) => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return normalizeTableDateRangeFilter(value, userTimezone, { mode: "date" });
},
```

- [ ] **Step 4: Re-run the casesFilters tests**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/table-component/hooks/useHookFilter.js \
  apps/kace-saas/src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js
git commit -m "$(cat <<'EOF'
fix(filters): use timezone helper in legacy table filter hook

Replace inline toZonedTime/fromZonedTime date normalization with the
shared calendar-day helper for browser TZ between filters.
EOF
)"
git log -1 --format='%B'
```

---

### Task 3: Wire DataTable V2 via `normalizeAppliedTableDateFilters`

**Files:**
- Create: `apps/kace-saas/src/utils/src/utils/normalizeAppliedTableDateFilters.js`
- Create: `apps/kace-saas/src/utils/src/utils/normalizeAppliedTableDateFilters.test.js`
- Modify: `apps/kace-saas/src/utils/main.js`
- Modify: `apps/kace-saas/src/hooks/useDataTable.jsx`

**Interfaces:**
- Consumes: `normalizeTableDateRangeFilter`, `SPECIAL_FIELDS` values `"date"` / `"datetime"` (string compare; avoid hard import cycle — pass `data_type` from schema)
- Produces:
  - `normalizeAppliedTableDateFilters(filtersMap, schema, timeZone) => filtersMap`
  - For each descriptor with `data_type` date/datetime (or `operator === "between"` and date-like column), replace `value` with normalized string
  - Invalid date values (`null` from helper): omit that key from the result map

- [ ] **Step 1: Write failing tests for the map normalizer**

```javascript
import { describe, expect, it } from "vitest";
import { normalizeAppliedTableDateFilters } from "./normalizeAppliedTableDateFilters";

describe("normalizeAppliedTableDateFilters", () => {
    const schema = [
        { column_name: "created_at", data_type: "date", filterData: { field: "created_at", operator: "between", type: "AND" } },
        { column_name: "receipt_at", data_type: "datetime", filterData: { field: "receipt_at", operator: "between", type: "AND" } },
        { column_name: "status", data_type: "string", filterData: { field: "status", operator: "eq", type: "AND" } },
    ];

    it("normalizes date fields with calendar-day bounds", () => {
        const input = {
            created_at: {
                field: "created_at",
                operator: "between",
                type: "AND",
                value: "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
            },
            status: { field: "status", operator: "eq", type: "AND", value: "open" },
        };

        const result = normalizeAppliedTableDateFilters(input, schema, "America/Bogota");

        expect(result.created_at.value).toBe(
            "2026-07-23T00:00:00.000-05:00, 2026-07-23T23:59:59.999-05:00",
        );
        expect(result.status).toEqual(input.status);
    });

    it("normalizes datetime fields preserving wall clock", () => {
        const input = {
            receipt_at: {
                field: "receipt_at",
                operator: "between",
                type: "AND",
                value: "2026-07-23T15:15:00.000Z, 2026-07-23T20:30:59.999Z",
            },
        };

        const result = normalizeAppliedTableDateFilters(input, schema, "America/Bogota");
        expect(result.receipt_at.value).toBe(
            "2026-07-23T10:15:00.000-05:00, 2026-07-23T15:30:59.999-05:00",
        );
    });

    it("omits invalid date filters", () => {
        const input = {
            created_at: {
                field: "created_at",
                operator: "between",
                type: "AND",
                value: "not-a-date",
            },
        };
        const result = normalizeAppliedTableDateFilters(input, schema, "America/Bogota");
        expect(result.created_at).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/kace-saas && pnpm exec vitest run src/utils/src/utils/normalizeAppliedTableDateFilters.test.js
```

- [ ] **Step 3: Implement map normalizer**

```javascript
import { normalizeTableDateRangeFilter } from "./normalizeTableDateRangeFilter";

const isDateLikeType = (dataType) => dataType === "date" || dataType === "datetime";

export const normalizeAppliedTableDateFilters = (filtersMap = {}, schema = [], timeZone) => {
    const schemaByColumn = new Map(schema.map((field) => [field.column_name, field]));

    return Object.fromEntries(
        Object.entries(filtersMap).flatMap(([key, descriptor]) => {
            if (!descriptor || typeof descriptor !== "object") return [[key, descriptor]];

            const fieldSchema = schemaByColumn.get(key);
            const dataType = fieldSchema?.data_type;
            const shouldNormalize =
                isDateLikeType(dataType) ||
                (descriptor.operator === "between" && isDateLikeType(dataType));

            if (!shouldNormalize) return [[key, descriptor]];

            const mode = dataType === "datetime" ? "datetime" : "date";
            const normalized = normalizeTableDateRangeFilter(descriptor.value, timeZone, { mode });
            if (normalized === null) return [];

            return [[key, { ...descriptor, value: normalized }]];
        }),
    );
};
```

Export from `main.js`:

```javascript
export { normalizeAppliedTableDateFilters } from "./src/utils/normalizeAppliedTableDateFilters.js";
```

- [ ] **Step 4: Wire into `useDataTable.jsx` `handleApplyFilters`**

Import:

```javascript
import { normalizeAppliedTableDateFilters } from "@/utils/src/utils/normalizeAppliedTableDateFilters";
```

Inside `handleApplyFilters`, after building `cleanedFilters` and before `setCurrentFiltersValues` / `setUserFilters`:

```javascript
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const normalizedFilters = normalizeAppliedTableDateFilters(
    cleanedFilters,
    filteredSchema /* or the schema array already in scope for filters */,
    timeZone,
);
```

Use `normalizedFilters` for `setCurrentFiltersValues`, `setUserFilters(Object.values(normalizedFilters))`, and the save prompt payload.

If the schema variable name differs (`filteredSchema` / `schema`), use the same array already used to render filter inputs in that hook — do not invent a second schema fetch.

- [ ] **Step 5: Run map tests + a focused useDataTable filter test if one exists**

```bash
cd apps/kace-saas && pnpm exec vitest run src/utils/src/utils/normalizeAppliedTableDateFilters.test.js src/hooks/useDataTable.clearFilters.spec.jsx
```

Expected: PASS (clearFilters specs still green; map tests green).

- [ ] **Step 6: Commit**

```bash
git add apps/kace-saas/src/utils/src/utils/normalizeAppliedTableDateFilters.js \
  apps/kace-saas/src/utils/src/utils/normalizeAppliedTableDateFilters.test.js \
  apps/kace-saas/src/utils/main.js \
  apps/kace-saas/src/hooks/useDataTable.jsx
git commit -m "$(cat <<'EOF'
fix(filters): normalize date ranges in DataTable V2 apply path

Apply shared timezone helper when users submit table filters so V2
between criteria include browser offsets before search.
EOF
)"
git log -1 --format='%B'
```

---

### Task 4: Wire `src_v2` `filterBuilder`

**Files:**
- Modify: `apps/kace-saas/src_v2/shared/utils/filterBuilder.util.js`
- Create: `apps/kace-saas/src_v2/shared/utils/filterBuilder.util.test.js`

**Interfaces:**
- Consumes: `normalizeTableDateRangeFilter` from `@kace/utils`
- Produces: same filter object shape; `value` normalized in `case "date"`

- [ ] **Step 1: Write failing test**

```javascript
import { describe, expect, it, vi } from "vitest";
import { filterBuilder } from "./filterBuilder.util";

describe("filterBuilder date", () => {
    it("normalizes date between value with browser timezone helper", () => {
        vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
            timeZone: "America/Bogota",
        });

        const result = filterBuilder(
            "date",
            "created_at",
            "2026-07-23T00:00:00.000Z, 2026-07-23T23:59:59.999Z",
        );

        expect(result).toEqual({
            field: "created_at",
            operator: "between",
            type: "AND",
            value: "2026-07-23T00:00:00.000-05:00, 2026-07-23T23:59:59.999-05:00",
        });
    });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/kace-saas && pnpm exec vitest run src_v2/shared/utils/filterBuilder.util.test.js
```

- [ ] **Step 3: Implement**

In `filterBuilder.util.js`:

```javascript
import { pathToObject } from "@kace_v2/features/boards/utils/pathToObject.util";
import { normalizeTableDateRangeFilter } from "@kace/utils";

// ... existing code ...

        case "date": {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const normalized = normalizeTableDateRangeFilter(value, timeZone, { mode: "date" });
            return {
                ...baseFilter,
                operator: "between",
                type: "AND",
                value: normalized ?? value,
            };
        }
```

Prefer omitting/nulling invalid dates if callers can tolerate it; if existing callers require a descriptor always, keep `normalized ?? value` only when `normalized` is null **and** document that invalid remains raw — preferred product behavior: if `normalized === null`, return `null` from `filterBuilder` (same as `default`) so the field is skipped. Choose **return null when normalized is null** to match legacy omit semantics.

```javascript
        case "date": {
            const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const normalized = normalizeTableDateRangeFilter(value, timeZone, { mode: "date" });
            if (normalized === null) return null;
            return {
                ...baseFilter,
                operator: "between",
                type: "AND",
                value: normalized,
            };
        }
```

Update the test accordingly if empty value should yield `null`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/kace-saas && pnpm exec vitest run src_v2/shared/utils/filterBuilder.util.test.js
```

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src_v2/shared/utils/filterBuilder.util.js \
  apps/kace-saas/src_v2/shared/utils/filterBuilder.util.test.js
git commit -m "$(cat <<'EOF'
fix(filters): normalize date between values in src_v2 filterBuilder

Ensure v2 table filter modal date criteria include browser timezone
offsets before they reach search.
EOF
)"
git log -1 --format='%B'
```

---

### Task 5: Expand date field detection + inventory closeout

**Files:**
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.js`
- Modify: `apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.test.js`

**Interfaces:**
- Produces: `resolveDateFilterOperator` returns `"between"` for additional exact columns used by tables (`receipt_at`, and any other datetime columns found in the inventory that lack `fecha_` prefix)

- [ ] **Step 1: Inventory (no code yet)**

Search table filter configs for `operator: "between"` and `data_type: "date"|"datetime"`. List columns that are **not** covered by `fecha_*` or current `DATE_EXACT_COLUMNS`. Minimum known gap: `receipt_at`.

- [ ] **Step 2: Write failing tests**

```javascript
it("treats receipt_at as a between date filter", () => {
    expect(resolveDateFilterOperator("receipt_at")).toBe("between");
});
```

Add one test per extra column found in the inventory.

- [ ] **Step 3: Run — expect FAIL for new columns**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/helpers.test.js
```

- [ ] **Step 4: Extend `DATE_EXACT_COLUMNS`**

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
    "receipt_at",
    // plus any other inventoried columns
];
```

- [ ] **Step 5: Run helpers tests — expect PASS**

```bash
cd apps/kace-saas && pnpm exec vitest run src/components/ui-shared/src/components/table-component/helpers.test.js
```

- [ ] **Step 6: Commit**

```bash
git add apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.js \
  apps/kace-saas/src/components/ui-shared/src/components/table-component/helpers.test.js
git commit -m "$(cat <<'EOF'
fix(filters): cover remaining table datetime columns as between

Extend resolveDateFilterOperator exact columns so table date filters
route through timezone normalization consistently.
EOF
)"
git log -1 --format='%B'
```

---

### Task 6: Verification suite

**Files:** none new (run existing)

- [ ] **Step 1: Run all new/related tests together**

```bash
cd apps/kace-saas && pnpm exec vitest run \
  src/utils/src/utils/normalizeTableDateRangeFilter.test.js \
  src/utils/src/utils/normalizeAppliedTableDateFilters.test.js \
  src/components/ui-shared/src/components/table-component/hooks/useHookFilter.casesFilters.test.js \
  src/components/ui-shared/src/components/table-component/helpers.test.js \
  src_v2/shared/utils/filterBuilder.util.test.js
```

Expected: all PASS.

- [ ] **Step 2: Manual smoke (optional but recommended)**

1. App in browser TZ `America/Bogota` or OS set to Colombia.  
2. Open a legacy table with `created_at` filter and a V2 DataTable with date filter.  
3. Filter a single day that has known rows.  
4. Confirm network payload `between` value ends with `-05:00` (or local offset) and results match that local day.

- [ ] **Step 3: Final commit only if Task 6 produced doc/test fixes; otherwise stop**

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| Helper puro + offset ISO | Task 1 |
| Matriz LATAM 8 zonas | Task 1 |
| Calendar day + fake Z handling | Task 1 |
| Datetime mode preserves times | Task 1 |
| Legacy `useHookFilter` wiring | Task 2 |
| DataTable V2 / `useDataTable` wiring | Task 3 |
| src_v2 `filterBuilder` wiring | Task 4 |
| Expand date field detection | Task 5 |
| No picker/backend changes | All (non-goals) |

## Self-review notes

- No TBD placeholders in task steps.
- Signatures consistent: `normalizeTableDateRangeFilter(value, timeZone, { mode })`.
- Chile expected offset pinned to `2026-07-23` winter (`-04:00`); adjust test expectation only if runtime IANA differs.
- `useDataTable` must reuse existing schema variable in scope — implementer confirms name while editing (`filteredSchema` vs local `schema`).
