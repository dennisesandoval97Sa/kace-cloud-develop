# DataTable Bulk Modal Select — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace native `<select>` elements in DataTable bulk-action modals with searchable dropdowns supporting local filter (legacy scripts) and API-backed search + infinite scroll (extended `showWhen` contract).

**Architecture:** New `BulkActionModalSelect` component + `useBulkActionModalSelect` hook evaluate the existing `showWhen` script in two passes (`loadPass: false` visibility, `loadPass: true` load). Reuse existing Kace select utilities (`useKaceScriptSelectLoad`, `useDebouncedStableTerm`, `mergeScriptSelectOptions`, `isKaceSelectScrollNearBottom`, `ensureSelectedOption`). Extend `setSelectOptions` in DataTable to support `{ append, replace }`.

**Tech Stack:** React 18, Vitest, Testing Library, existing onescript_plugin_kace Kace hooks/utils.

**Spec:** `docs/DATATABLE_BULK_MODAL_SELECT_DESIGN.md`  
**Branch:** `feature/data-table-bulk-modal-select-search-infinite-scroll`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/plugins/kace/shared/kaceSelect.constants.js` | `KACE_SELECT_DEFAULT_PAGE_SIZE = 20` |
| `src/plugins/kace/hooks/useBulkActionModalSelect.js` | Segmented/legacy logic, showWhen load passes |
| `src/plugins/kace/components/data-table/BulkActionModalSelect.jsx` | Dropdown UI (single select) |
| `src/plugins/kace/components/data-table/BulkActionModalSelect.test.jsx` | Unit tests |
| `src/plugins/kace/components/data-table/DataTable.jsx` | Wire component; extend `setSelectOptionsForContext` |
| `src/plugins/kace/components/data-table/acciones.form.json` | Builder docs for new context vars |
| `src/plugins/kace/components/data-table/schema.json` | Migrate Reasignar user/group scripts |
| `src/plugins/kace/components/custom-select/CustomSelect.css` | Reused styles (import in new component) |

---

### Task 1: Shared page-size constant

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/shared/kaceSelect.constants.js`

- [ ] **Step 1: Add constant file**

```javascript
export const KACE_SELECT_DEFAULT_PAGE_SIZE = 20;
```

- [ ] **Step 2: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/shared/kaceSelect.constants.js
git commit -m "chore(kace): add shared KACE_SELECT_DEFAULT_PAGE_SIZE constant"
```

---

### Task 2: Extend `setSelectOptions` merge in DataTable

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/data-table/DataTable.jsx`

- [ ] **Step 1: Import merge helper**

At top of `DataTable.jsx`:

```javascript
import { mergeScriptSelectOptions } from '#plugins/kace/utils/mergeScriptSelectOptions.js';
```

- [ ] **Step 2: Replace `setSelectOptionsForContext`**

Find `setSelectOptionsForContext` (~line 473) and replace body:

```javascript
const setSelectOptionsForContext = useCallback(
  (fieldKey, options, opts) => {
    const normalized = Array.isArray(options) ? options : [];
    const append = opts?.append === true;
    const replace = opts?.replace === true;
    setModalDynamicOptions((prev) => {
      const current = prev?.[fieldKey] ?? [];
      const next = append
        ? mergeScriptSelectOptions(current, normalized, true)
        : replace || !append
          ? mergeScriptSelectOptions([], normalized, false)
          : normalized;
      if (areOptionsEqual(current, next)) return prev;
      return { ...prev, [fieldKey]: next };
    });
  },
  [areOptionsEqual]
);
```

- [ ] **Step 3: Run lint**

```bash
cd apps/onescript_plugin_kace && pnpm run lint
```

Expected: no new errors in DataTable.jsx

- [ ] **Step 4: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/data-table/DataTable.jsx
git commit -m "feat(data-table): support append/replace in setSelectOptions for modal fields"
```

---

### Task 3: `useBulkActionModalSelect` hook

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useBulkActionModalSelect.js`
- Create: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useBulkActionModalSelect.test.js`

- [ ] **Step 1: Write failing tests for legacy local filter**

Create `useBulkActionModalSelect.test.js`:

```javascript
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBulkActionModalSelect } from './useBulkActionModalSelect.js';

describe('useBulkActionModalSelect legacy mode', () => {
  it('filters static options locally by searchTerm', () => {
    const options = [
      { label: 'Ana Garcia', value: '1' },
      { label: 'Bob Smith', value: '2' },
    ];
    const { result } = renderHook(() =>
      useBulkActionModalSelect({
        fieldKey: 'user',
        options,
        value: '',
        showWhenCode: '',
        evaluateShowWhen: vi.fn(() => true),
        setSelectOptions: vi.fn(),
        pageSize: 20,
        dependencySignature: '',
        disabled: false,
      })
    );
    act(() => {
      result.current.setSearchTerm('ana');
    });
    expect(result.current.filteredOptions).toEqual([
      { label: 'Ana Garcia', value: '1' },
    ]);
    expect(result.current.mode).toBe('legacy');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/hooks/useBulkActionModalSelect.test.js -v
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement minimal hook (legacy path)**

Create `useBulkActionModalSelect.js` with exports:

```javascript
import { useCallback, useMemo, useRef, useState } from 'react';
import { useDebouncedStableTerm } from '#plugins/kace/hooks/useDebouncedStableTerm.js';
import { useKaceScriptSelectLoad } from '#plugins/kace/hooks/useKaceScriptSelectLoad.js';
import { KACE_SELECT_DEFAULT_PAGE_SIZE } from '#plugins/kace/shared/kaceSelect.constants.js';
import { isKaceSelectScrollNearBottom } from '#plugins/kace/utils/kaceSelectScrollNearBottom.js';
import { ensureSelectedOption } from '#plugins/kace/shared/EnsureSelectedOption.js';

export function useBulkActionModalSelect({
  fieldKey,
  options,
  value,
  showWhenCode,
  evaluateShowWhen,
  setSelectOptions,
  pageSize = KACE_SELECT_DEFAULT_PAGE_SIZE,
  dependencySignature,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('legacy');
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const segmentedScrollInFlightRef = useRef(false);
  const openRef = useRef(false);
  openRef.current = open;

  const stableRemoteTerm = useDebouncedStableTerm(
    searchTerm,
    500,
    mode === 'segmented' && open
  );

  const catalog = useMemo(
    () => (Array.isArray(options) ? options : []),
    [options]
  );

  const displayCatalog = useMemo(() => {
    if (value === undefined || value === null || value === '') {
      return catalog;
    }
    return ensureSelectedOption(catalog, value, {
      createTempOption: (v) => ({ label: String(v), value: v }),
    });
  }, [catalog, value]);

  const filteredOptions = useMemo(() => {
    if (mode === 'segmented') {
      return displayCatalog;
    }
    const term = searchTerm.trim().toLowerCase();
    if (!term) return displayCatalog;
    return displayCatalog.filter((o) =>
      String(o?.label ?? '').toLowerCase().includes(term)
    );
  }, [mode, displayCatalog, searchTerm]);

  const getContext = useCallback(
    () => ({
      page: pageRef.current,
      remoteTerm: stableRemoteTerm,
    }),
    [stableRemoteTerm]
  );

  const applyOptionsFromLoad = useCallback(
    (items) => {
      setSelectOptions(fieldKey, items);
    },
    [fieldKey, setSelectOptions]
  );

  const handleInfiniteStall = useCallback(() => {
    hasMoreRef.current = false;
  }, []);

  const { load: loadSegmented, invalidateCache } = useKaceScriptSelectLoad({
    componentKey: `bulk-modal-${fieldKey}`,
    refetchOnEveryOpen: false,
    segmented: mode === 'segmented',
    dependencySignature,
    getContext,
    mergeOptionsForDisplay: (items) => items,
    applyOptions: applyOptionsFromLoad,
    onInfiniteStall: handleInfiniteStall,
  });

  const runLoadPass = useCallback(async () => {
    if (!showWhenCode?.trim()) return;
    setLoading(true);
    try {
      await evaluateShowWhen({
        loadPass: true,
        kaceSelectPage: pageRef.current,
        kaceRemoteSearchTerm: stableRemoteTerm,
        kaceSelectPageSize: pageSize,
        onSetSelectOptions: (opts, meta) => {
          if (meta?.append) setMode('segmented');
          setSelectOptions(fieldKey, opts, meta);
          if (Array.isArray(opts) && opts.length >= pageSize) {
            hasMoreRef.current = true;
          } else if (pageRef.current > 1) {
            hasMoreRef.current = false;
          }
        },
      });
    } finally {
      setLoading(false);
    }
  }, [
    showWhenCode,
    evaluateShowWhen,
    stableRemoteTerm,
    pageSize,
    fieldKey,
    setSelectOptions,
  ]);

  const runSegmentedLoad = useCallback(async () => {
    await loadSegmented(async ({ kaceSelectPage, kaceRemoteSearchTerm }) => {
      pageRef.current = kaceSelectPage;
      await evaluateShowWhen({
        loadPass: true,
        kaceSelectPage,
        kaceRemoteSearchTerm,
        kaceSelectPageSize: pageSize,
        onSetSelectOptions: (opts, meta) => {
          setMode('segmented');
          const append = meta?.append === true || kaceSelectPage > 1;
          setSelectOptions(fieldKey, opts, append ? { append: true } : { replace: true });
          hasMoreRef.current =
            Array.isArray(opts) && opts.length > 0 && opts.length >= pageSize;
        },
      });
    });
  }, [loadSegmented, evaluateShowWhen, pageSize, fieldKey, setSelectOptions]);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    if (mode === 'segmented' || showWhenCode?.trim()) {
      pageRef.current = 1;
      hasMoreRef.current = true;
      invalidateCache();
      void runSegmentedLoad();
    }
  }, [disabled, mode, showWhenCode, invalidateCache, runSegmentedLoad]);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setSearchTerm('');
    pageRef.current = 1;
    hasMoreRef.current = true;
    invalidateCache();
  }, [invalidateCache]);

  const onDropdownScroll = useCallback(
    (e) => {
      if (mode !== 'segmented' || loading || segmentedScrollInFlightRef.current || !hasMoreRef.current) {
        return;
      }
      if (!isKaceSelectScrollNearBottom(e.currentTarget)) return;
      segmentedScrollInFlightRef.current = true;
      pageRef.current += 1;
      void runSegmentedLoad().finally(() => {
        segmentedScrollInFlightRef.current = false;
      });
    },
    [mode, loading, runSegmentedLoad]
  );

  return {
    open,
    openDropdown,
    closeDropdown,
    searchTerm,
    setSearchTerm,
    loading,
    filteredOptions,
    mode,
    onDropdownScroll,
    resetForDependencyChange: () => {
      setSearchTerm('');
      pageRef.current = 1;
      hasMoreRef.current = true;
      setMode('legacy');
      invalidateCache();
    },
  };
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/hooks/useBulkActionModalSelect.test.js -v
```

- [ ] **Step 5: Add segmented-mode test**

Add to same test file:

```javascript
describe('useBulkActionModalSelect segmented detection', () => {
  it('enters segmented mode when load pass uses append', async () => {
    const setSelectOptions = vi.fn();
    const evaluateShowWhen = vi.fn(async ({ onSetSelectOptions }) => {
      onSetSelectOptions([{ label: 'U1', value: '1' }], { append: true });
    });
    const { result } = renderHook(() =>
      useBulkActionModalSelect({
        fieldKey: 'user',
        options: [],
        value: '',
        showWhenCode: 'return true',
        evaluateShowWhen,
        setSelectOptions,
        pageSize: 20,
        dependencySignature: 'x',
        disabled: false,
      })
    );
    await act(async () => {
      result.current.openDropdown();
    });
    expect(setSelectOptions).toHaveBeenCalledWith(
      'user',
      [{ label: 'U1', value: '1' }],
      { append: true }
    );
  });
});
```

- [ ] **Step 6: Run all hook tests — expect PASS**

- [ ] **Step 7: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/hooks/useBulkActionModalSelect.js \
  apps/onescript_plugin_kace/src/plugins/kace/hooks/useBulkActionModalSelect.test.js
git commit -m "feat(kace): add useBulkActionModalSelect hook for bulk modal selects"
```

---

### Task 4: `BulkActionModalSelect` UI component

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/components/data-table/BulkActionModalSelect.jsx`

- [ ] **Step 1: Create component**

```javascript
import '../../custom-select/CustomSelect.css';
import '#plugins/kace/shared/styles/kace-select-loader.css';
import { useBulkActionModalSelect } from '#plugins/kace/hooks/useBulkActionModalSelect.js';
import { useEffect, useRef } from 'react';
import { BULK_ACTION_MODAL_SELECT_PLACEHOLDER } from './lib/data-table.constants.js';

export function BulkActionModalSelect({
  id,
  fieldKey,
  fieldLabel,
  placeholder,
  value,
  options,
  showWhenCode,
  evaluateShowWhen,
  setSelectOptions,
  onChange,
  disabled,
  dependencySignature,
}) {
  const containerRef = useRef(null);
  const {
    open,
    openDropdown,
    closeDropdown,
    searchTerm,
    setSearchTerm,
    loading,
    filteredOptions,
    onDropdownScroll,
    resetForDependencyChange,
  } = useBulkActionModalSelect({
    fieldKey,
    options,
    value,
    showWhenCode,
    evaluateShowWhen,
    setSelectOptions,
    dependencySignature,
    disabled,
  });

  useEffect(() => {
    resetForDependencyChange();
  }, [dependencySignature, resetForDependencyChange]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [closeDropdown]);

  const selectedLabel =
    filteredOptions.find((o) => String(o.value) === String(value))?.label ??
    (value ? String(value) : '');

  return (
    <div className="kace-bulk-modal-select" ref={containerRef}>
      <div
        className={`select-input ${open ? 'open' : ''}`}
        onClick={openDropdown}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        id={id}
      >
        <span className={selectedLabel ? '' : 'select-placeholder'}>
          {selectedLabel || placeholder || BULK_ACTION_MODAL_SELECT_PLACEHOLDER}
        </span>
      </div>
      {open && (
        <div
          className="select-dropdown"
          data-testid={`bulk-modal-select-${fieldKey}`}
          style={{ maxHeight: '280px', overflowY: 'auto' }}
          onScroll={onDropdownScroll}
          id={`${id}-listbox`}
          role="listbox"
        >
          <div className="kace-multiselect-menu-sticky" style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', paddingBottom: 8 }}>
            <input
              type="text"
              className="select-search"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              disabled={disabled || loading}
              aria-label={`Buscar ${fieldLabel || fieldKey}`}
            />
            {loading && filteredOptions.length > 0 && (
              <div className="kace-select-loader px-2 py-1" role="status">
                <small>Cargando...</small>
              </div>
            )}
          </div>
          {!loading && filteredOptions.length === 0 && (
            <div className="no-results">No se encontraron resultados</div>
          )}
          {loading && filteredOptions.length === 0 && (
            <div className="no-results kace-select-list-loading">Cargando…</div>
          )}
          {filteredOptions.map((opt) => (
            <div
              key={String(opt.value)}
              className={`select-option ${String(opt.value) === String(value) ? 'selected' : ''}`}
              role="option"
              aria-selected={String(opt.value) === String(value)}
              onClick={() => {
                onChange(opt.value);
                closeDropdown();
              }}
            >
              {opt.label ?? opt.value}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/data-table/BulkActionModalSelect.jsx
git commit -m "feat(data-table): add BulkActionModalSelect dropdown component"
```

---

### Task 5: Integrate into DataTable modal

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/data-table/DataTable.jsx`

- [ ] **Step 1: Import component**

```javascript
import { BulkActionModalSelect } from './BulkActionModalSelect.jsx';
```

- [ ] **Step 2: Add `evaluateShowWhenForField` helper inside component**

```javascript
const evaluateShowWhenForField = useCallback(
  async (field, loadPassPayload) => {
    if (!field?.showWhen?.trim()) {
      return loadPassPayload ? undefined : true;
    }
    const ctx = {
      modalFormData,
      kaceEngine: kaceEngine ?? undefined,
      apiService: apiService ?? undefined,
      selectedRows: selectedRowsData,
      selectedCount: selectedRowsData.length,
      data,
      component,
      Swal: swalForContext,
      setFieldValue: setFieldValueForContext,
      loadPass: Boolean(loadPassPayload?.loadPass),
      kaceSelectPage: loadPassPayload?.kaceSelectPage ?? 1,
      kaceRemoteSearchTerm: loadPassPayload?.kaceRemoteSearchTerm ?? '',
      kaceSelectPageSize: loadPassPayload?.kaceSelectPageSize ?? 20,
      setSelectOptions: (fk, opts, meta) => {
        if (loadPassPayload?.onSetSelectOptions) {
          loadPassPayload.onSetSelectOptions(opts, meta);
          return;
        }
        setSelectOptionsDeferredForContext(fk, opts, meta);
      },
    };
    let result = evaluateKace(field.showWhen.trim(), ctx);
    if (result != null && typeof result.then === 'function') {
      result = await result;
    }
    return result;
  },
  [
    modalFormData,
    kaceEngine,
    apiService,
    selectedRowsData,
    data,
    component,
    swalForContext,
    setFieldValueForContext,
    setSelectOptionsDeferredForContext,
  ]
);
```

- [ ] **Step 3: Update `setSelectOptionsDeferredForContext` to forward third arg**

```javascript
const setSelectOptionsDeferredForContext = useCallback(
  (fieldKey, options, meta) => {
    setTimeout(() => {
      setSelectOptionsForContext(fieldKey, options, meta);
    }, 0);
  },
  [setSelectOptionsForContext]
);
```

- [ ] **Step 4: Replace modal `<select>` block (~line 817) with:**

```javascript
<BulkActionModalSelect
  id={id}
  fieldKey={field.fieldKey}
  fieldLabel={field.fieldLabel}
  placeholder={field.placeholder}
  value={value}
  options={
    Array.isArray(modalDynamicOptions[field.fieldKey]) &&
    modalDynamicOptions[field.fieldKey].length > 0
      ? modalDynamicOptions[field.fieldKey]
      : Array.isArray(field.options)
        ? field.options
        : []
  }
  showWhenCode={field.showWhen}
  evaluateShowWhen={(payload) =>
    evaluateShowWhenForField(field, payload)
  }
  setSelectOptions={setSelectOptionsForContext}
  onChange={(v) => setModalFormDataField(field.fieldKey, v)}
  disabled={disabled}
  dependencySignature={JSON.stringify(modalFormData)}
/>
```

- [ ] **Step 5: Keep visibility check** — existing `showWhen` block before render stays; only replace inner `<select>`.

- [ ] **Step 6: Run lint**

```bash
cd apps/onescript_plugin_kace && pnpm run lint
```

- [ ] **Step 7: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/data-table/DataTable.jsx
git commit -m "feat(data-table): use BulkActionModalSelect in bulk action modal"
```

---

### Task 6: Component integration tests

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/components/data-table/BulkActionModalSelect.test.jsx`

- [ ] **Step 1: Write test — open dropdown and local filter**

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BulkActionModalSelect } from './BulkActionModalSelect.jsx';

describe('BulkActionModalSelect', () => {
  it('filters options locally in legacy mode', async () => {
    const user = userEvent.setup();
    render(
      <BulkActionModalSelect
        id="f-user"
        fieldKey="user"
        fieldLabel="Usuario"
        value=""
        options={[
          { label: 'Ana Garcia', value: '1' },
          { label: 'Pedro Lopez', value: '2' },
        ]}
        showWhenCode=""
        evaluateShowWhen={vi.fn()}
        setSelectOptions={vi.fn()}
        onChange={vi.fn()}
        disabled={false}
        dependencySignature="{}"
      />
    );
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Buscar...'), 'ana');
    expect(screen.getByText('Ana Garcia')).toBeInTheDocument();
    expect(screen.queryByText('Pedro Lopez')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/components/data-table/BulkActionModalSelect.test.jsx -v
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/data-table/BulkActionModalSelect.test.jsx
git commit -m "test(data-table): add BulkActionModalSelect legacy filter test"
```

---

### Task 7: Update builder documentation

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/data-table/acciones.form.json`

- [ ] **Step 1: Extend `showWhen` field description** — add paragraph documenting:

  - `loadPass`, `kaceSelectPage`, `kaceRemoteSearchTerm`, `kaceSelectPageSize`
  - `setSelectOptions(fieldKey, options, { append: true })` for pagination
  - Legacy scripts unchanged (local search on loaded array)

- [ ] **Step 2: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/data-table/acciones.form.json
git commit -m "docs(data-table): document showWhen loadPass and pagination context"
```

---

### Task 8: Migrate Reasignar scripts in schema.json

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/data-table/schema.json`

- [ ] **Step 1: Rewrite `user` field `showWhen`**

Structure:

```javascript
if (loadPass) {
  const term = String(kaceRemoteSearchTerm ?? '').trim();
  const filters = [/* deleted_at null, existing business filters */];
  if (term) {
    filters.push({
      filters: [
        { field: 'nombres', operator: 'ilike', type: 'OR', value: `%${term}%` },
        { field: 'apellido1', operator: 'ilike', type: 'OR', value: `%${term}%` },
      ],
      groupType: 'AND',
    });
  }
  const response = await apiService.post('/users/search', {
    filter: filters,
    limit: kaceSelectPageSize,
    offset: (kaceSelectPage - 1) * kaceSelectPageSize,
    order: { direction: 'asc', field: 'nombres' },
    relationship: null,
  });
  const items = (response?.data?.data?.items ?? []).map((user) => ({
    label: `${user.nombres} ${user.apellido1}`.trim(),
    value: user.id,
  }));
  setSelectOptions('user', items, { append: kaceSelectPage > 1 });
  return true;
}
if (modalFormData.asignamentType !== 'user') return false;
return true;
```

Remove `limit: 500` one-shot load.

- [ ] **Step 2: Rewrite `group` field `showWhen` similarly**

Use `/user-group-relationships/search` with `usuario_id` filter, paginate with `limit`/`offset`, optional `ilike` on group name if term present.

- [ ] **Step 3: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/data-table/schema.json
git commit -m "feat(data-table): paginate Reasignar user/group modal selects via showWhen"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run onescript_plugin_kace tests**

```bash
cd apps/onescript_plugin_kace && pnpm test --run
```

Expected: all tests PASS (including CustomSelect, CustomMultiselect)

- [ ] **Step 2: Manual smoke (dev build optional)**

1. Open form with DataTable bulk actions
2. Reasignar → search user → scroll for more
3. Select user → open group select
4. Cambiar estado → local search on states

- [ ] **Step 3: Final commit if fixes needed**

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| All modal selects use new component | Task 5 |
| Legacy local search | Task 3, 6 |
| Segmented API search + infinite scroll | Task 3, 8 |
| Extended showWhen context | Task 5 |
| setSelectOptions append/replace | Task 2 |
| Builder docs | Task 7 |
| Schema migration user/group | Task 8 |
| Tests | Task 6, 9 |
| CustomSelect no regression | Task 9 (full suite) |

## Deferred (YAGNI for this branch)

- Refactoring `CustomSelect.jsx` to import `KACE_SELECT_DEFAULT_PAGE_SIZE` only (optional small follow-up)
- Full extraction of shared hook used by both CustomSelect and BulkActionModalSelect (future DRY pass once bulk modal is stable)

---

## Plan self-review

- [x] No TBD/TODO placeholders
- [x] All spec acceptance criteria mapped to tasks
- [x] `setSelectOptions` signature consistent across Tasks 2, 3, 5
- [x] `loadPass` contract matches approved design doc
