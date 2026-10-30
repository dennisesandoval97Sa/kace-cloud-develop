# Kace States Hide Buttons Custom Code — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir ocultar dinámicamente botones individuales de "Estados disponibles" en `kace_states` mediante un script JS configurable en la pestaña Custom del builder.

**Architecture:** Lógica pura de evaluación en `statesHide.helpers.js` (helpers imperativos + filtrado); hook `useStatesVisibility` suscrito a `root.on('change')` y cambios en `states[]`; integración en `States.jsx` e `index.js`; pestaña Custom documentada en `custom.form.json`.

**Tech Stack:** React 18, Vitest, `@testing-library/react`, Form.io (`evaluateKace`), Vite, plugin path `apps/onescript_plugin_kace`.

## Global Constraints

- Solo ocultar botones de **Estados disponibles**; el botón **Estado actual** siempre visible.
- Script invocable **solo** desde pestaña Custom del componente States (sin eventos cross-component).
- Helpers: `hideById`, `hideByName`, `hideByTransitionId` — cada uno acepta escalar o array.
- Matching ID/transition: `String(a) === String(b)`; nombre: trim + case-insensitive exact match.
- Reevaluación completa en cada trigger (reset → ejecutar script → filtrar); fail-open ante error.
- Schema key: `SCHEMA_KEY_STATES_HIDE_CODE = 'hideStatesCode'`.
- Sin comentarios en código generado (regla del workspace).
- Rama: `feature/states-hide-buttons-custom-code`.

**Spec de referencia:** `docs/superpowers/specs/2026-07-16-states-hide-buttons-custom-code-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `shared/kace-events.constants.js` | Nueva constante de schema |
| `hooks/statesHide.helpers.js` | Lógica pura: helpers, evaluación, filtrado |
| `hooks/statesHide.helpers.test.js` | Tests unitarios de la lógica pura |
| `hooks/useStatesVisibility.js` | Hook React: suscripción `change`, delega a helpers |
| `hooks/useStatesVisibility.test.js` | Tests del hook con `renderHook` |
| `states/custom.form.json` | UI builder + documentación |
| `states/index.js` | Schema, editForm, pasar `component` |
| `states/States.jsx` | Consumir hook, renderizar `visibleStates` |

---

### Task 1: Schema constant

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/shared/kace-events.constants.js`

**Interfaces:**
- Produces: `SCHEMA_KEY_STATES_HIDE_CODE` (string `'hideStatesCode'`)

- [ ] **Step 1: Add constant**

Add after `SCHEMA_KEY_ATTACHMENT_HIDDEN_INITIAL`:

```javascript
export const SCHEMA_KEY_STATES_HIDE_CODE = 'hideStatesCode';
```

- [ ] **Step 2: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/shared/kace-events.constants.js
git commit -m "feat(states): add SCHEMA_KEY_STATES_HIDE_CODE constant"
```

---

### Task 2: Pure evaluation helpers (TDD)

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/hooks/statesHide.helpers.js`
- Create: `apps/onescript_plugin_kace/src/plugins/kace/hooks/statesHide.helpers.test.js`

**Interfaces:**
- Consumes: `evaluateKace` from `#plugins/kace/shared/evaluateKace.js`
- Produces:
  - `normalizeHideArgs(value: unknown): unknown[]`
  - `createHideHelpers(states, hiddenStateIds, hiddenTransitionIds): { hideById, hideByName, hideByTransitionId }`
  - `filterVisibleStates(states, hiddenStateIds, hiddenTransitionIds): State[]`
  - `evaluateStatesHideCode({ code, states, selected, defaultState, formData }): State[]`

- [ ] **Step 1: Write failing tests**

Create `statesHide.helpers.test.js`:

```javascript
import { describe, expect, it, vi } from 'vitest';
import {
  createHideHelpers,
  evaluateStatesHideCode,
  filterVisibleStates,
  normalizeHideArgs,
} from './statesHide.helpers.js';

const STATES = [
  { state_id: 1, transition_id: 10, nombre: 'Abierto' },
  { state_id: 2, transition_id: 20, nombre: 'Escalado' },
  { state_id: 3, transition_id: 30, nombre: 'escalado' },
];

describe('normalizeHideArgs', () => {
  it('wraps scalar in array', () => {
    expect(normalizeHideArgs(5)).toEqual([5]);
  });
  it('returns array as-is', () => {
    expect(normalizeHideArgs([1, 2])).toEqual([1, 2]);
  });
  it('returns empty for null/undefined', () => {
    expect(normalizeHideArgs(null)).toEqual([]);
    expect(normalizeHideArgs(undefined)).toEqual([]);
  });
});

describe('filterVisibleStates', () => {
  it('excludes by state_id', () => {
    const hiddenStateIds = new Set(['1']);
    const result = filterVisibleStates(STATES, hiddenStateIds, new Set());
    expect(result.map((s) => s.state_id)).toEqual([2, 3]);
  });
  it('excludes by transition_id', () => {
    const hiddenTransitionIds = new Set(['20']);
    const result = filterVisibleStates(STATES, new Set(), hiddenTransitionIds);
    expect(result.map((s) => s.state_id)).toEqual([1, 3]);
  });
});

describe('createHideHelpers', () => {
  it('hideById hides one or many', () => {
    const hiddenStateIds = new Set();
    const hiddenTransitionIds = new Set();
    const { hideById } = createHideHelpers(
      STATES,
      hiddenStateIds,
      hiddenTransitionIds
    );
    hideById(1);
    hideById([2, 3]);
    expect([...hiddenStateIds]).toEqual(['1', '2', '3']);
  });

  it('hideByName is case-insensitive and hides homonyms', () => {
    const hiddenStateIds = new Set();
    const hiddenTransitionIds = new Set();
    const { hideByName } = createHideHelpers(
      STATES,
      hiddenStateIds,
      hiddenTransitionIds
    );
    hideByName('ESCALADO');
    expect([...hiddenStateIds].sort()).toEqual(['2', '3']);
  });

  it('hideByTransitionId hides by transition', () => {
    const hiddenStateIds = new Set();
    const hiddenTransitionIds = new Set();
    const { hideByTransitionId } = createHideHelpers(
      STATES,
      hiddenStateIds,
      hiddenTransitionIds
    );
    hideByTransitionId(10);
    hideByTransitionId([20]);
    expect([...hiddenTransitionIds].sort()).toEqual(['10', '20']);
  });
});

describe('evaluateStatesHideCode', () => {
  it('returns all states when code is empty', () => {
    expect(
      evaluateStatesHideCode({
        code: '',
        states: STATES,
        selected: null,
        defaultState: null,
        formData: {},
      })
    ).toEqual(STATES);
  });

  it('evaluates hide helpers from script', () => {
    const result = evaluateStatesHideCode({
      code: "hideById(1); hideByName('Escalado');",
      states: STATES,
      selected: null,
      defaultState: null,
      formData: { tipo: 'x' },
    });
    expect(result).toEqual([]);
  });

  it('fail-open on script error', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = evaluateStatesHideCode({
      code: 'throw new Error("boom")',
      states: STATES,
      selected: null,
      defaultState: null,
      formData: {},
    });
    expect(result).toEqual(STATES);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('reevaluates cleanly when data changes', () => {
    const code = "if (data.hide) hideById(1);";
    const visible = evaluateStatesHideCode({
      code,
      states: STATES,
      selected: null,
      defaultState: null,
      formData: { hide: false },
    });
    expect(visible.map((s) => s.state_id)).toEqual([1, 2, 3]);
    const hidden = evaluateStatesHideCode({
      code,
      states: STATES,
      selected: null,
      defaultState: null,
      formData: { hide: true },
    });
    expect(hidden.map((s) => s.state_id)).toEqual([2, 3]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/hooks/statesHide.helpers.test.js
```

Expected: FAIL — module `./statesHide.helpers.js` not found.

- [ ] **Step 3: Implement helpers**

Create `statesHide.helpers.js`:

```javascript
import { evaluateKace } from '#plugins/kace/shared/evaluateKace.js';

export function normalizeHideArgs(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function createHideHelpers(states, hiddenStateIds, hiddenTransitionIds) {
  const hideById = (value) => {
    for (const id of normalizeHideArgs(value)) {
      hiddenStateIds.add(String(id));
    }
  };

  const hideByName = (value) => {
    for (const rawName of normalizeHideArgs(value)) {
      const normalized = String(rawName).trim().toLowerCase();
      if (!normalized) continue;
      for (const state of states) {
        if (String(state.nombre).trim().toLowerCase() === normalized) {
          hiddenStateIds.add(String(state.state_id));
        }
      }
    }
  };

  const hideByTransitionId = (value) => {
    for (const id of normalizeHideArgs(value)) {
      hiddenTransitionIds.add(String(id));
    }
  };

  return { hideById, hideByName, hideByTransitionId };
}

export function filterVisibleStates(
  states,
  hiddenStateIds,
  hiddenTransitionIds
) {
  return states.filter((state) => {
    const stateId = String(state.state_id);
    const transitionId = String(state.transition_id);
    if (hiddenStateIds.has(stateId)) return false;
    if (hiddenTransitionIds.has(transitionId)) return false;
    return true;
  });
}

export function evaluateStatesHideCode({
  code,
  states,
  selected,
  defaultState,
  formData,
}) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    return states;
  }

  const hiddenStateIds = new Set();
  const hiddenTransitionIds = new Set();
  const data = formData ?? {};
  const { hideById, hideByName, hideByTransitionId } = createHideHelpers(
    states,
    hiddenStateIds,
    hiddenTransitionIds
  );

  try {
    evaluateKace(code, {
      data,
      row: data,
      states,
      selected,
      defaultState,
      hideById,
      hideByName,
      hideByTransitionId,
    });
  } catch (error) {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[States] hideStatesCode error:', error);
    }
    return states;
  }

  return filterVisibleStates(states, hiddenStateIds, hiddenTransitionIds);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/hooks/statesHide.helpers.test.js
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/hooks/statesHide.helpers.js \
        apps/onescript_plugin_kace/src/plugins/kace/hooks/statesHide.helpers.test.js
git commit -m "feat(states): add pure helpers to evaluate hideStatesCode"
```

---

### Task 3: React hook `useStatesVisibility`

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useStatesVisibility.js`
- Create: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useStatesVisibility.test.js`

**Interfaces:**
- Consumes: `evaluateStatesHideCode` from `./statesHide.helpers.js`, `SCHEMA_KEY_STATES_HIDE_CODE` from constants
- Produces: `useStatesVisibility({ root, component, states, selected, defaultState }) → { visibleStates }`

- [ ] **Step 1: Write failing hook test**

Create `useStatesVisibility.test.js`:

```javascript
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SCHEMA_KEY_STATES_HIDE_CODE } from '#plugins/kace/shared/kace-events.constants.js';
import useStatesVisibility from './useStatesVisibility.js';

const STATES = [
  { state_id: 1, transition_id: 10, nombre: 'Abierto' },
  { state_id: 2, transition_id: 20, nombre: 'Cerrado' },
];

describe('useStatesVisibility', () => {
  it('returns all states when no code configured', () => {
    const { result } = renderHook(() =>
      useStatesVisibility({
        root: null,
        component: {},
        states: STATES,
        selected: null,
        defaultState: null,
      })
    );
    expect(result.current.visibleStates).toEqual(STATES);
  });

  it('reevaluates on root change event', () => {
    const listeners = {};
    const root = {
      data: { flag: false },
      on: (event, cb) => {
        listeners[event] = cb;
      },
      off: (event) => {
        delete listeners[event];
      },
    };
    const component = {
      [SCHEMA_KEY_STATES_HIDE_CODE]: "if (data.flag) hideById(1);",
    };
    const { result } = renderHook(() =>
      useStatesVisibility({
        root,
        component,
        states: STATES,
        selected: null,
        defaultState: null,
      })
    );
    expect(result.current.visibleStates.map((s) => s.state_id)).toEqual([1, 2]);
    act(() => {
      root.data.flag = true;
      listeners.change?.();
    });
    expect(result.current.visibleStates.map((s) => s.state_id)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/hooks/useStatesVisibility.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement hook**

Create `useStatesVisibility.js`:

```javascript
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SCHEMA_KEY_STATES_HIDE_CODE } from '#plugins/kace/shared/kace-events.constants.js';
import { evaluateStatesHideCode } from './statesHide.helpers.js';

const useStatesVisibility = ({
  root,
  component,
  states,
  selected,
  defaultState,
}) => {
  const hideStatesCode = component?.[SCHEMA_KEY_STATES_HIDE_CODE];

  const computeVisible = useCallback(() => {
    return evaluateStatesHideCode({
      code: hideStatesCode,
      states,
      selected,
      defaultState,
      formData: root?.data ?? {},
    });
  }, [hideStatesCode, states, selected, defaultState, root?.data]);

  const [visibleStates, setVisibleStates] = useState(() => computeVisible());

  useEffect(() => {
    setVisibleStates(computeVisible());
  }, [computeVisible]);

  useEffect(() => {
    if (!root || typeof root.on !== 'function') return;

    const handleChange = () => {
      setVisibleStates(
        evaluateStatesHideCode({
          code: hideStatesCode,
          states,
          selected,
          defaultState,
          formData: root.data ?? {},
        })
      );
    };

    root.on('change', handleChange);
    handleChange();

    return () => {
      if (typeof root.off === 'function') {
        root.off('change', handleChange);
      }
    };
  }, [root, hideStatesCode, states, selected, defaultState]);

  return useMemo(() => ({ visibleStates }), [visibleStates]);
};

export default useStatesVisibility;
```

- [ ] **Step 4: Run tests**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/hooks/useStatesVisibility.test.js
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/hooks/useStatesVisibility.js \
        apps/onescript_plugin_kace/src/plugins/kace/hooks/useStatesVisibility.test.js
git commit -m "feat(states): add useStatesVisibility hook"
```

---

### Task 4: Integrate in `States.jsx`

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/states/States.jsx`

**Interfaces:**
- Consumes: `useStatesVisibility`, new prop `component`

- [ ] **Step 1: Update component props and render**

Add import:

```javascript
import useStatesVisibility from '#plugins/kace/hooks/useStatesVisibility.js';
```

Change signature:

```javascript
export const States = ({
  onEvent,
  handleChange,
  root,
  component,
  disabled = false,
}) => {
```

After `useStates` destructuring, add:

```javascript
  const { visibleStates } = useStatesVisibility({
    root,
    component,
    states,
    selected,
    defaultState,
  });
```

Replace `states.length > 0` block to use `visibleStates`:

```javascript
          {visibleStates.length > 0 && (
            <div className="text-center">
              <h2 className="h5 font-weight-bold mb-3">Estados disponibles</h2>
              <div className="d-flex flex-wrap justify-content-center">
                {visibleStates.map((state) => (
```

Replace empty check:

```javascript
          {visibleStates.length === 0 && !defaultState && (
```

- [ ] **Step 2: Run existing tests (if any) + lint**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/hooks/statesHide.helpers.test.js src/plugins/kace/hooks/useStatesVisibility.test.js
pnpm run lint
```

Expected: tests PASS, no new lint errors in modified files.

- [ ] **Step 3: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/states/States.jsx
git commit -m "feat(states): filter available buttons via useStatesVisibility"
```

---

### Task 5: Builder UI and Formio wrapper

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/states/custom.form.json`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/states/index.js`

**Interfaces:**
- Consumes: `SCHEMA_KEY_STATES_HIDE_CODE`, `customEditForm`
- Produces: `component.hideStatesCode` persisted in form JSON; `component` prop passed to React

- [ ] **Step 1: Replace custom.form.json**

```json
{
  "key": "statesCustom",
  "label": "Custom",
  "components": [
    {
      "key": "hideStatesSection",
      "type": "panel",
      "title": "Ocultar estados",
      "collapsible": true,
      "components": [
        {
          "key": "hideStatesDoc",
          "type": "content",
          "input": false,
          "html": "<p class=\"mb-2\">Script evaluado en cada cambio del formulario y al cargar la lista de estados. Use las funciones para ocultar botones de <strong>Estados disponibles</strong> (no aplica al botón de Estado actual).</p><p class=\"font-weight-bold mb-2\">Funciones:</p><table class=\"table table-bordered table-sm\"><thead><tr><th>Función</th><th>Descripción</th></tr></thead><tbody><tr><td><code>hideById(id | ids[])</code></td><td>Oculta por <code>state_id</code></td></tr><tr><td><code>hideByName(name | names[])</code></td><td>Oculta por <code>nombre</code> (sin distinguir mayúsculas)</td></tr><tr><td><code>hideByTransitionId(id | ids[])</code></td><td>Oculta por <code>transition_id</code></td></tr></tbody></table><p class=\"font-weight-bold mb-2\">Variables:</p><table class=\"table table-bordered table-sm\"><thead><tr><th>Variable</th><th>Descripción</th></tr></thead><tbody><tr><td><code>data</code> / <code>row</code></td><td>Datos del formulario</td></tr><tr><td><code>states</code></td><td>Lista de estados disponibles</td></tr><tr><td><code>selected</code></td><td><code>state_id</code> seleccionado</td></tr><tr><td><code>defaultState</code></td><td>Estado actual del caso</td></tr></tbody></table><pre style=\"background:#f5f5f5;padding:10px;border-radius:4px;font-size:12px\">if (data.tipo_caso === 'interno') {\n  hideByName('Escalado');\n}\nif (data.prioridad === 'baja') {\n  hideById([3, 7]);\n  hideByTransitionId(99);\n}</pre>"
        },
        {
          "key": "hideStatesCode",
          "type": "textarea",
          "label": "Código para ocultar estados",
          "input": true,
          "editor": "ace",
          "as": "javascript",
          "rows": 8,
          "validate": {
            "javascript": true
          }
        }
      ]
    }
  ]
}
```

- [ ] **Step 2: Update index.js**

Add imports:

```javascript
import customEditForm from './custom.form.json';
import { SCHEMA_KEY_STATES_HIDE_CODE } from '#plugins/kace/shared/kace-events.constants.js';
```

In `schema()`:

```javascript
      [SCHEMA_KEY_STATES_HIDE_CODE]: null,
```

Replace `editForm`:

```javascript
  static editForm = (...extend) => {
    return Components.baseEditForm([customEditForm], ...extend);
  };
```

Pass `component` in both `attach` and `setDisabled` render calls:

```javascript
        component: this.component,
```

- [ ] **Step 3: Run full test suite for plugin**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/hooks/statesHide.helpers.test.js src/plugins/kace/hooks/useStatesVisibility.test.js
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/states/custom.form.json \
        apps/onescript_plugin_kace/src/plugins/kace/components/states/index.js
git commit -m "feat(states): expose hideStatesCode in builder Custom tab"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run all plugin tests**

```bash
cd apps/onescript_plugin_kace && pnpm test -- --run
```

Expected: no regressions.

- [ ] **Step 2: Manual smoke test checklist**

1. Abrir form builder → componente Kace States → pestaña Custom.
2. Pegar script de ejemplo con `hideByName` / `hideById` / `hideByTransitionId`.
3. Guardar formulario y abrir en runtime con caso que tenga estados disponibles.
4. Cambiar campo referenciado en `data` → verificar que botones se ocultan/muestran.
5. Script con error → todos los botones visibles, error en consola.

- [ ] **Step 3: Verify commit log on branch**

```bash
git log origin/develop..HEAD --oneline
```

Expected: spec commit + 4-5 implementation commits.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| `SCHEMA_KEY_STATES_HIDE_CODE` | Task 1 |
| Helpers hideById/Name/TransitionId | Task 2 |
| Reevaluación en change + states load | Task 3 |
| Fail-open | Task 2 |
| Solo estados disponibles | Task 4 |
| custom.form.json documentado | Task 5 |
| index.js schema + editForm + component prop | Task 5 |
| Tests unitarios | Tasks 2, 3 |
| Out of scope respetado | N/A (no implementar eventos ni ocultar estado actual) |
