# Classifications Init Code Once — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que `classificationsInitCode` en `classification_id` se evalúe como máximo una vez por ciclo de vida del componente en creación de caso, sin re-ejecutarse en `redraw` / `kaceAuthData` / cambios de `options`, manteniendo defaults diferidos vía cola.

**Architecture:** Lógica pura en `classificationsInitPolicy.js` (sesión `scriptRan` + `pendingDefaults`); `Classifications.jsx` orquesta evaluación única, apply/queue de `setDefaultSelections`, y listeners Form.io sin init; docs del builder alineadas al contrato.

**Tech Stack:** React 18, Vitest, Form.io (`evaluateKace`), Vite, plugin `apps/onescript_plugin_kace`.

## Global Constraints

- Scope: solo `Classifications` / `classification_id`. No tocar `ClassificationLevels`.
- El JS del usuario se evalúa ≤1 vez por mount React en create; nunca en edit.
- `redraw` y `kaceAuthData` solo refrescan opciones (`onExternalDataEvent`), no ejecutan init.
- `setDefaultSelections` sin árbol encola; al llegar `options` se aplica sin re-evaluar el script.
- Si `evaluateKace` falla: `console.error` + marcar `scriptRan` (no reintentar).
- Sin comentarios en código generado.
- Rama: `fix/classifications-init-code-once`.
- Tras cada `git commit`, verificar `git log -1 --format='%B'` y eliminar trailer `Co-authored-by: Cursor` con `commit-tree` si aparece.

**Spec de referencia:** `docs/superpowers/specs/2026-07-21-classifications-init-code-once-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `classifications/classificationsInitPolicy.js` | Sesión de init, guards, queue/consume de defaults |
| `classifications/classificationsInitPolicy.test.js` | Tests vitest del policy (TDD) |
| `classifications/Classifications.jsx` | Wiring: once evaluate, pending apply, listeners sin init |
| `classifications/custom.form.json` | Docs builder: once + deferred defaults |

---

### Task 1: Policy puro — tests fallando (TDD)

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/components/classifications/classificationsInitPolicy.test.js`

**Interfaces (a implementar en Task 2):**
- `createInitSession() → { scriptRan: boolean, pendingDefaults: object | null }`
- `markScriptRan(session) → session`
- `shouldEvaluateUserScript(session, { caseContextResolved, isEditCase, code }) → boolean`
- `queueOrResolveDefaults(session, selection, tree, validateSelection) → { kind, session, validated? }`
- `consumePendingDefaults(session, tree, validateSelection) → { kind, session, validated? }`

- [ ] **Step 1: Write failing tests**

Create `classificationsInitPolicy.test.js`:

```javascript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumePendingDefaults,
  createInitSession,
  markScriptRan,
  queueOrResolveDefaults,
  shouldEvaluateUserScript,
} from './classificationsInitPolicy.js';

describe('classificationsInitPolicy', () => {
  const tree = [{ value: 'A', label: 'A' }];
  const validateSelection = vi.fn((t, selection) => ({ ...selection }));

  beforeEach(() => {
    validateSelection.mockClear();
    validateSelection.mockImplementation((t, selection) => ({ ...selection }));
  });

  describe('shouldEvaluateUserScript', () => {
    it('returns false when case context is not resolved', () => {
      expect(
        shouldEvaluateUserScript(createInitSession(), {
          caseContextResolved: false,
          isEditCase: false,
          code: 'console.log(1)',
        })
      ).toBe(false);
    });

    it('returns false when editing a case', () => {
      expect(
        shouldEvaluateUserScript(createInitSession(), {
          caseContextResolved: true,
          isEditCase: true,
          code: 'console.log(1)',
        })
      ).toBe(false);
    });

    it('returns false when code is empty or whitespace', () => {
      const session = createInitSession();
      expect(
        shouldEvaluateUserScript(session, {
          caseContextResolved: true,
          isEditCase: false,
          code: '',
        })
      ).toBe(false);
      expect(
        shouldEvaluateUserScript(session, {
          caseContextResolved: true,
          isEditCase: false,
          code: '   ',
        })
      ).toBe(false);
      expect(
        shouldEvaluateUserScript(session, {
          caseContextResolved: true,
          isEditCase: false,
          code: null,
        })
      ).toBe(false);
    });

    it('returns true once for create, then false after markScriptRan', () => {
      let session = createInitSession();
      const ctx = {
        caseContextResolved: true,
        isEditCase: false,
        code: 'setDefaultSelections({ nivel1: "A" })',
      };
      expect(shouldEvaluateUserScript(session, ctx)).toBe(true);
      session = markScriptRan(session);
      expect(shouldEvaluateUserScript(session, ctx)).toBe(false);
    });
  });

  describe('queueOrResolveDefaults', () => {
    it('queues selection when tree is empty', () => {
      const session = createInitSession();
      const result = queueOrResolveDefaults(
        session,
        { nivel1: 'A' },
        [],
        validateSelection
      );
      expect(result.kind).toBe('queue');
      expect(result.session.pendingDefaults).toEqual({ nivel1: 'A' });
      expect(validateSelection).not.toHaveBeenCalled();
    });

    it('applies validated selection when tree is ready', () => {
      const session = createInitSession();
      validateSelection.mockReturnValue({ nivel1: 'A' });
      const result = queueOrResolveDefaults(
        session,
        { nivel1: 'A', nivel2: 'missing' },
        tree,
        validateSelection
      );
      expect(result.kind).toBe('apply');
      expect(result.validated).toEqual({ nivel1: 'A' });
      expect(result.session.pendingDefaults).toBeNull();
      expect(validateSelection).toHaveBeenCalledWith(tree, {
        nivel1: 'A',
        nivel2: 'missing',
      });
    });

    it('returns noop for invalid selection', () => {
      const session = createInitSession();
      expect(
        queueOrResolveDefaults(session, null, tree, validateSelection).kind
      ).toBe('noop');
    });
  });

  describe('consumePendingDefaults', () => {
    it('applies and clears pending when tree arrives', () => {
      let session = createInitSession();
      session = queueOrResolveDefaults(
        session,
        { nivel1: 'A' },
        [],
        validateSelection
      ).session;
      validateSelection.mockReturnValue({ nivel1: 'A' });
      const result = consumePendingDefaults(session, tree, validateSelection);
      expect(result.kind).toBe('apply');
      expect(result.validated).toEqual({ nivel1: 'A' });
      expect(result.session.pendingDefaults).toBeNull();
    });

    it('returns noop when there is no pending', () => {
      const result = consumePendingDefaults(
        createInitSession(),
        tree,
        validateSelection
      );
      expect(result.kind).toBe('noop');
      expect(validateSelection).not.toHaveBeenCalled();
    });

    it('does not require script re-evaluation after scriptRan', () => {
      let session = markScriptRan(createInitSession());
      session = queueOrResolveDefaults(
        session,
        { nivel1: 'A' },
        [],
        validateSelection
      ).session;
      expect(
        shouldEvaluateUserScript(session, {
          caseContextResolved: true,
          isEditCase: false,
          code: 'console.log(1)',
        })
      ).toBe(false);
      const result = consumePendingDefaults(session, tree, validateSelection);
      expect(result.kind).toBe('apply');
      expect(
        shouldEvaluateUserScript(result.session, {
          caseContextResolved: true,
          isEditCase: false,
          code: 'console.log(1)',
        })
      ).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/components/classifications/classificationsInitPolicy.test.js
```

Expected: FAIL (module not found / exports missing).

- [ ] **Step 3: Commit tests only**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/classifications/classificationsInitPolicy.test.js
git commit -m "$(cat <<'EOF'
test(classifications): add failing tests for init-once policy

EOF
)"
git log -1 --format='%B'
```

If `Co-authored-by: Cursor` appears, rewrite with `commit-tree` per workspace rule.

---

### Task 2: Implement `classificationsInitPolicy.js`

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/components/classifications/classificationsInitPolicy.js`

- [ ] **Step 1: Minimal implementation**

```javascript
export function createInitSession() {
  return {
    scriptRan: false,
    pendingDefaults: null,
  };
}

export function markScriptRan(session) {
  return {
    ...session,
    scriptRan: true,
  };
}

export function shouldEvaluateUserScript(
  session,
  { caseContextResolved, isEditCase, code }
) {
  if (!session || session.scriptRan) return false;
  if (!caseContextResolved) return false;
  if (isEditCase) return false;
  if (!code || typeof code !== 'string' || !code.trim()) return false;
  return true;
}

function hasClassificationTree(tree) {
  return Array.isArray(tree) && tree.length > 0;
}

export function queueOrResolveDefaults(
  session,
  selection,
  tree,
  validateSelection
) {
  if (!selection || typeof selection !== 'object') {
    return { kind: 'noop', session };
  }
  if (!hasClassificationTree(tree)) {
    return {
      kind: 'queue',
      session: {
        ...session,
        pendingDefaults: { ...selection },
      },
    };
  }
  const validated = validateSelection(tree, selection);
  return {
    kind: 'apply',
    validated,
    session: {
      ...session,
      pendingDefaults: null,
    },
  };
}

export function consumePendingDefaults(session, tree, validateSelection) {
  if (!session?.pendingDefaults) {
    return { kind: 'noop', session };
  }
  if (!hasClassificationTree(tree)) {
    return { kind: 'noop', session };
  }
  const validated = validateSelection(tree, session.pendingDefaults);
  return {
    kind: 'apply',
    validated,
    session: {
      ...session,
      pendingDefaults: null,
    },
  };
}
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/components/classifications/classificationsInitPolicy.test.js
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/classifications/classificationsInitPolicy.js
git commit -m "$(cat <<'EOF'
feat(classifications): add init-once policy for classificationsInitCode

EOF
)"
git log -1 --format='%B'
```

---

### Task 3: Wire policy into `Classifications.jsx`

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/classifications/Classifications.jsx`

**Interfaces:**
- Consumes: policy exports + existing `validateSelectionAgainstTree`, `consecutiveLockedLevelCount`, `evaluateKace`, `ensureLoaded`
- Behavior change only around init lifecycle; no UI changes

- [ ] **Step 1: Add imports and session ref**

Near the top of the file (with other imports), add:

```javascript
import {
  consumePendingDefaults,
  createInitSession,
  markScriptRan,
  queueOrResolveDefaults,
  shouldEvaluateUserScript,
} from './classificationsInitPolicy.js';
```

Inside the `Classifications` component, after the other refs (`lockedLevelCountRef`), add:

```javascript
const initSessionRef = useRef(createInitSession());
```

- [ ] **Step 2: Replace `runInitScript` and related effects**

Replace the existing `runInitScript` `useCallback` and the two effects that call it (the one with deps `[classificationsLoading, caseContextResolved, isEditCase, runInitScript, options]` and the `onEvent` effect) with the following.

Helper to apply a validated selection (keep inside the component, next to other callbacks):

```javascript
  const applyValidatedDefaults = useCallback(
    (validated, tree) => {
      setSelectedOptions(validated);
      setLockedLevelCount(consecutiveLockedLevelCount(validated));
      persistClassificationLabels(validated, tree);
    },
    [persistClassificationLabels]
  );

  const runInitScriptOnce = useCallback(() => {
    const code = component?.classificationsInitCode;
    const session = initSessionRef.current;

    if (isEditCaseRef.current) {
      setLockedLevelCount(0);
      setLevelLabelOverrides({});
      return;
    }

    if (!caseContextResolvedRef.current) {
      return;
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      setLockedLevelCount(0);
      setLevelLabelOverrides({});
      return;
    }

    if (
      !shouldEvaluateUserScript(session, {
        caseContextResolved: caseContextResolvedRef.current,
        isEditCase: isEditCaseRef.current,
        code,
      })
    ) {
      return;
    }

    setLockedLevelCount(0);
    setLevelLabelOverrides({});

    let engine;
    try {
      engine = KaceEngine();
    } catch {
      engine = null;
    }

    const setDefaultSelections = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      const tree = optionsRef.current;
      const result = queueOrResolveDefaults(
        initSessionRef.current,
        obj,
        tree,
        validateSelectionAgainstTree
      );
      initSessionRef.current = result.session;
      if (result.kind === 'queue') {
        setHasRequestedOptions(true);
        void ensureLoaded();
        return;
      }
      if (result.kind === 'apply') {
        applyValidatedDefaults(result.validated, tree);
      }
    };

    const setLevelLabels = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      setLevelLabelOverrides((prev) => ({ ...prev, ...obj }));
    };

    try {
      evaluateKace(code, {
        kaceEngine: engine,
        apiService: engine?.getService?.('apiService'),
        url_api: storeService.get('config.api_url'),
        data: dataRef.current,
        root: rootRef.current,
        options: optionsRef.current,
        caseData: caseDataRef.current,
        isEditCase: isEditCaseRef.current,
        setDefaultSelections,
        setLevelLabels,
      });
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Classifications] classificationsInitCode error:', err);
      }
    } finally {
      initSessionRef.current = markScriptRan(initSessionRef.current);
    }
  }, [
    component?.classificationsInitCode,
    ensureLoaded,
    applyValidatedDefaults,
  ]);

  useEffect(() => {
    if (!caseContextResolved) return;
    if (isEditCase) return;
    runInitScriptOnce();
  }, [caseContextResolved, isEditCase, runInitScriptOnce]);

  useEffect(() => {
    if (!options?.length) return;
    const result = consumePendingDefaults(
      initSessionRef.current,
      options,
      validateSelectionAgainstTree
    );
    initSessionRef.current = result.session;
    if (result.kind === 'apply') {
      applyValidatedDefaults(result.validated, options);
    }
  }, [options, applyValidatedDefaults]);

  useEffect(() => {
    if (typeof onEvent !== 'function') return;
    const onAuth = () => {
      onExternalDataEvent();
    };
    const onRedraw = () => {
      onExternalDataEvent();
    };
    onEvent('kaceAuthData', onAuth);
    onEvent('redraw', onRedraw);
    onEvent('resetForm', resetCache);
  }, [onEvent, onExternalDataEvent, resetCache]);
```

Important: remove the old `runInitScript` and the old effect that depended on `classificationsLoading` / `options` for re-running init. Keep the other effects (`persistClassificationLabels`, `fetchCaseData`, etc.) unchanged.

- [ ] **Step 3: Re-run policy tests (sanity)**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/components/classifications/classificationsInitPolicy.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/classifications/Classifications.jsx
git commit -m "$(cat <<'EOF'
fix(classifications): run classificationsInitCode only once per mount

EOF
)"
git log -1 --format='%B'
```

---

### Task 4: Update builder docs in `custom.form.json`

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/classifications/custom.form.json`

- [ ] **Step 1: Replace the `html` of `classificationsInitDoc`**

Replace the `html` string of the content component so it no longer claims re-execution on `kaceAuthData` / `redraw`. Use this content (keep as a single JSON string):

```html
<p class="font-weight-bold mb-2">Valores por defecto y bloqueo</p>
<p class="small text-muted mb-2"><strong>Solo al crear un caso</strong> (no en edición). El script se evalúa <strong>una sola vez</strong> cuando el contexto del caso está listo. Si llamás <code>setDefaultSelections(...)</code> antes de que exista el árbol de opciones, la selección queda en cola y se aplica automáticamente al cargar las opciones <strong>sin volver a ejecutar</strong> el script. No se re-ejecuta en <code>redraw</code> (p. ej. colapsar un panel) ni en <code>kaceAuthData</code>. Los niveles que definan un prefijo válido desde <code>nivel1</code> quedan <strong>bloqueados</strong>. Si definís la <strong>última hoja</strong> del árbol, se propagan <code>clasificacion_id</code> y <code>flujo_id</code> al formulario.</p>
<table class="table table-bordered table-sm"><thead><tr><th>Nombre</th><th>Descripción</th></tr></thead><tbody><tr><td><span style="font-family: monospace; font-weight: bold;">setDefaultSelections(obj)</span></td><td>Ej. <code>{ nivel1: 'Ventas', nivel2: 'Retail' }</code>. Valida contra el árbol; bloquea solo ese prefijo consecutivo. Sin árbol: encola y aplica al cargar.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">setLevelLabels(obj)</span></td><td>Opcional. Etiquetas de nivel, ej. <code>{ nivel1: 'Área' }</code>.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">kaceEngine</span></td><td>Motor Kace.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">apiService</span></td><td>Servicio API.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">url_api</span></td><td>URL base API.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">data</span></td><td>Datos del formulario.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">root</span></td><td>Raíz Form.io.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">options</span></td><td>Árbol de opciones cargado (puede estar vacío en la única evaluación).</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">caseData</span></td><td>Datos del caso.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">isEditCase</span></td><td>En edición el script no se ejecuta.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">params</span></td><td>Parámetros del handshake de Auth. <code>null</code> hasta completar la autenticación.</td></tr><tr><td><span style="font-family: monospace; font-weight: bold;">authCognitoResponse</span></td><td>Respuesta de <code>/auth-cognito</code>. <code>null</code> hasta completar la autenticación.</td></tr></tbody></table>
```

Keep the rest of the JSON structure unchanged (`key`, `textarea`, etc.).

- [ ] **Step 2: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/classifications/custom.form.json
git commit -m "$(cat <<'EOF'
docs(classifications): document once-only classificationsInitCode contract

EOF
)"
git log -1 --format='%B'
```

---

### Task 5: Manual verification checklist

- [ ] **Step 1: Manual smoke (local form preview)**

Usar un schema con `classificationsInitCode: "console.log('Felipe')"` y un panel colapsable:

1. Carga en creación → log **una** vez.
2. Colapsar/expandir el panel → **no** vuelve a loguear.
3. Script con `setDefaultSelections({ nivel1: '...' })` sin árbol previo → defaults se aplican al cargar opciones **sin** segundo log.

- [ ] **Step 2: Final test run**

```bash
cd apps/onescript_plugin_kace && pnpm exec vitest run src/plugins/kace/components/classifications/classificationsInitPolicy.test.js
```

Expected: PASS.

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| Once per React lifecycle on create | Task 2 + Task 3 |
| No re-run on `redraw` | Task 3 |
| No re-run on `kaceAuthData` | Task 3 |
| No re-run when `options` arrive | Task 3 (pending consume only) |
| Deferred `setDefaultSelections` without re-eval | Task 1–3 |
| Edit case: script never runs | Task 1 + Task 3 |
| Error → mark scriptRan | Task 3 (`finally`) |
| Builder docs updated | Task 4 |
| Policy unit tests | Task 1–2 |
| Out of scope ClassificationLevels / States timeout | Not in plan |

## Self-review notes

- No TBD/TODO placeholders in tasks.
- Function names consistent across tasks: `createInitSession`, `markScriptRan`, `shouldEvaluateUserScript`, `queueOrResolveDefaults`, `consumePendingDefaults`.
- `validateSelection` injected; production wiring uses `validateSelectionAgainstTree`.