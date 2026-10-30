# Nested OneScript Dependent Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que un campo dependiente dentro de un `container` Form.io (ej. `correo_electronico` si `linea === "AUTOS"`) se muestre y se valide en el cliente con la misma regla que en la raíz: hermano primero, si la key no existe subir a ancestro/raíz.

**Architecture:** Una función pura `resolveDependencyParentValue` en `shared/` recorre ámbitos objeto-plano. `buildCustomConditional` genera JS Form.io equivalente. `preprocessSchema` y `KaceBaseComponent` reutilizan el resolvedor. Joi del servidor no se toca.

**Tech Stack:** OneScript plugin (`apps/onescript_plugin_kace`), Vitest, Form.io `customConditional`, ESM.

**Spec:** `docs/superpowers/specs/2026-08-18-nested-dependent-fields-design.md`

**Branch:** `fix/nested-dependent-fields`

## Review follow-up (PR #102)

Hallazgos del review de 2026-08-18, implementados en la misma rama:

- [x] HIGH-1: borrar claves de dependencia solo si `scope === 'ancestor'`; `type: 'array'` ya no congela la fila 0.
- [x] MEDIUM-2: anclar en `row` los segmentos posteriores al último `editgrid`/`datagrid`; `form` y `tree` alargan el path.
- [x] MEDIUM-3: `JSON.stringify` en `dependsOn`, segmentos y lista de `dependencyValue`.
- [x] MEDIUM-4: documentado como follow-up [#104](https://github.com/colombia-it-desarrollo/kace-cloud/issues/104) (`Joi.ref` absoluto en SchemaBuilder).
- [x] LOW-5: `hasOwnProperty.call` en el resolvedor (alineado con Vite `modules`).
- [x] LOW-6: accessor lineal con helper `at(o,p)`.
- [x] LOW-7: test + spec para sibling `undefined`.
- [x] LOW-8: harness de test `var show = true`.
- [x] INFO-9: tests de array divergente contra `SchemaBuilder.build`.
- [x] INFO-10: `import/no-unresolved` ignora subpaths `#*` (el resto de lint preexistente no se toca).

## Global Constraints

- TDD estricto: test rojo → implementación mínima → verde → commit.
- `Object.prototype.hasOwnProperty.call(obj, key)` define “existe la key”. Un hermano `""` o `undefined` no cae a la raíz.
- No modificar `packages/kace_cloud_schemas_builder` ni `DependencyHelper` en esta rama.
- No commitear `schema.json` ni `.atl/`.
- Sin suite nueva que monte `KaceBaseComponent` / Form.io.
- `evaluateDependency` no cambia su firma ni su semántica.
- Conventional commits. Si el hook inyecta `Co-authored-by: Cursor`, reescribir con `git commit-tree` (nunca `--amend` tras el hook).
- No agregar dependencias npm.

## File Map

| File | Responsibility |
|------|----------------|
| Create: `apps/onescript_plugin_kace/src/plugins/kace/shared/resolveDependencyParentValue.js` | `isPlainObject`, `formioTypeNestsData`, `nextDependencyPath`, `dependencyPathFromFormioPath`, `resolveDependencyParentValue` |
| Create: `apps/onescript_plugin_kace/src/plugins/kace/shared/resolveDependencyParentValue.test.js` | Tabla de la spec + path Form.io + tipos que anidan datos |
| Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.js` | `buildCustomConditional(..., path)`, `preprocessSchema` con `ctx`, extraer `transformFormioComponents` |
| Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.test.js` | Nested `linea`/`correo_electronico`, fallback a raíz, `editgrid` `row`, `preprocessSchema` ancestro |
| Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js` | Delegar transform al utils; `preprocessSchema` sigue con 2 args en el call site |
| Modify: `apps/onescript_plugin_kace/src/plugins/kace/shared/KaceBaseComponent.js` | Resolver + `evaluateDependency` en lugar de `formData[dependsOn]` |

---

### Task 1: Resolvedor puro y helpers de path

**Files:**
- Create: `apps/onescript_plugin_kace/src/plugins/kace/shared/resolveDependencyParentValue.js`
- Create: `apps/onescript_plugin_kace/src/plugins/kace/shared/resolveDependencyParentValue.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `isPlainObject(value: unknown) => boolean`
  - `formioTypeNestsData(type: unknown) => boolean` — `true` solo para `'container' | 'editgrid' | 'datagrid'`
  - `nextDependencyPath(path: string[], type: unknown, key: unknown) => string[]`
  - `dependencyPathFromFormioPath(formioPath: unknown, fieldKey: unknown) => string[]`
  - `resolveDependencyParentValue(rootData: unknown, path: unknown, dependsOn: unknown, localData?: unknown) => unknown`

- [ ] **Step 1: Write the failing test**

Crear `apps/onescript_plugin_kace/src/plugins/kace/shared/resolveDependencyParentValue.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  formioTypeNestsData,
  nextDependencyPath,
  dependencyPathFromFormioPath,
  resolveDependencyParentValue,
} from './resolveDependencyParentValue.js';

describe('formioTypeNestsData', () => {
  it('is true only for container, editgrid, and datagrid', () => {
    expect(formioTypeNestsData('container')).toBe(true);
    expect(formioTypeNestsData('editgrid')).toBe(true);
    expect(formioTypeNestsData('datagrid')).toBe(true);
    expect(formioTypeNestsData('panel')).toBe(false);
    expect(formioTypeNestsData('columns')).toBe(false);
    expect(formioTypeNestsData('tabs')).toBe(false);
    expect(formioTypeNestsData('table')).toBe(false);
  });
});

describe('nextDependencyPath', () => {
  it('appends key only when the Form.io type nests submission data', () => {
    expect(nextDependencyPath([], 'container', 'asignacion_asistencia_movilidad')).toEqual(
      ['asignacion_asistencia_movilidad']
    );
    expect(nextDependencyPath([], 'panel', 'asignacion')).toEqual([]);
    expect(
      nextDependencyPath(['asignacion_asistencia_movilidad'], 'columns', 'cols')
    ).toEqual(['asignacion_asistencia_movilidad']);
  });
});

describe('dependencyPathFromFormioPath', () => {
  it('drops the field key and array indices', () => {
    expect(
      dependencyPathFromFormioPath(
        'asignacion_asistencia_movilidad.correo_electronico',
        'correo_electronico'
      )
    ).toEqual(['asignacion_asistencia_movilidad']);
    expect(dependencyPathFromFormioPath('items[0].flag', 'flag')).toEqual([
      'items',
    ]);
    expect(dependencyPathFromFormioPath('', 'x')).toEqual([]);
    expect(dependencyPathFromFormioPath(undefined, 'x')).toEqual([]);
  });
});

describe('resolveDependencyParentValue', () => {
  it('reads the sibling inside a nested object', () => {
    const rootData = {
      asignacion_asistencia_movilidad: { linea: 'AUTOS' },
    };
    expect(
      resolveDependencyParentValue(
        rootData,
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toBe('AUTOS');
  });

  it('falls back to root when the nested object lacks the key', () => {
    const rootData = {
      linea: 'AUTOS',
      asignacion_asistencia_movilidad: {},
    };
    expect(
      resolveDependencyParentValue(
        rootData,
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toBe('AUTOS');
  });

  it('does not fall through when the sibling exists and is empty', () => {
    const rootData = {
      linea: 'RAIZ',
      asignacion_asistencia_movilidad: { linea: '' },
    };
    expect(
      resolveDependencyParentValue(
        rootData,
        ['asignacion_asistencia_movilidad'],
        'linea'
      )
    ).toBe('');
  });

  it('reads only the root when path is empty', () => {
    expect(
      resolveDependencyParentValue({ campo_qa: 'Test' }, [], 'campo_qa')
    ).toBe('Test');
  });

  it('uses localData (grid row) and skips the array at path', () => {
    const rootData = { items: [{ flag: 'x' }], flag: 'raiz' };
    expect(
      resolveDependencyParentValue(rootData, ['items'], 'flag', { flag: 'x' })
    ).toBe('x');
  });

  it('returns undefined and does not throw on invalid input', () => {
    expect(
      resolveDependencyParentValue(null, ['asignacion_asistencia_movilidad'], 'linea')
    ).toBeUndefined();
    expect(resolveDependencyParentValue([], [], 'linea')).toBeUndefined();
    expect(
      resolveDependencyParentValue({}, ['asignacion_asistencia_movilidad'], 'linea')
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/shared/resolveDependencyParentValue.test.js
```

Expected: FAIL — cannot find module `./resolveDependencyParentValue.js` (or named exports missing).

- [ ] **Step 3: Write minimal implementation**

Crear `apps/onescript_plugin_kace/src/plugins/kace/shared/resolveDependencyParentValue.js`:

```js
export const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const formioTypeNestsData = (type) =>
  type === 'container' || type === 'editgrid' || type === 'datagrid';

export const nextDependencyPath = (path, type, key) => {
  const base = Array.isArray(path) ? path : [];
  if (!formioTypeNestsData(type) || typeof key !== 'string' || key === '') {
    return base;
  }
  return [...base, key];
};

export const dependencyPathFromFormioPath = (formioPath, fieldKey) => {
  if (typeof formioPath !== 'string' || formioPath.trim() === '') return [];
  const segments = formioPath.split('.').flatMap((seg) => {
    const name = seg.replace(/\[\d+\]/g, '');
    return name ? [name] : [];
  });
  if (typeof fieldKey === 'string' && segments[segments.length - 1] === fieldKey) {
    segments.pop();
  }
  return segments;
};

const getAtPath = (rootData, path) => {
  let current = rootData;
  for (const segment of path) {
    if (!isPlainObject(current)) return undefined;
    current = current[segment];
  }
  return current;
};

export const resolveDependencyParentValue = (
  rootData,
  path,
  dependsOn,
  localData
) => {
  if (typeof dependsOn !== 'string' || dependsOn === '') return undefined;

  const pathArr = Array.isArray(path)
    ? path.filter((segment) => typeof segment === 'string' && segment !== '')
    : [];

  const candidates = [];
  if (localData !== undefined) {
    candidates.push(localData);
  } else if (pathArr.length === 0) {
    candidates.push(rootData);
  } else {
    candidates.push(getAtPath(rootData, pathArr));
  }

  for (let i = pathArr.length; i >= 0; i -= 1) {
    candidates.push(i === 0 ? rootData : getAtPath(rootData, pathArr.slice(0, i)));
  }

  const seen = new Set();
  for (const obj of candidates) {
    if (!isPlainObject(obj) || seen.has(obj)) continue;
    seen.add(obj);
    if (Object.hasOwn(obj, dependsOn)) return obj[dependsOn];
  }
  return undefined;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/shared/resolveDependencyParentValue.test.js
```

Expected: PASS (all tests in that file).

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/shared/resolveDependencyParentValue.js \
  apps/onescript_plugin_kace/src/plugins/kace/shared/resolveDependencyParentValue.test.js
git commit -m "$(cat <<'EOF'
feat(onescript): add sibling-then-ancestor dependency parent resolver

EOF
)"
```

If `Co-authored-by: Cursor` appears in `git log -1 --format='%B'`, strip it with `commit-tree` + `reset --soft` (workspace rule).

---

### Task 2: `buildCustomConditional` con `path`

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.js:68-94`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.test.js` (bloque `buildCustomConditional`)

**Interfaces:**
- Consumes: `resolveDependencyParentValue` semantics (replicate in generated JS; do not call the function from Form.io)
- Produces: `buildCustomConditional(rule?: object, key?: string, isInEditGrid?: boolean, path?: string[]) => string | null`

El 3er argumento sigue siendo `boolean` para no romper tests existentes (`buildCustomConditional(rule, 'campo', true)`).

- [ ] **Step 1: Write the failing test**

Al final del `describe('buildCustomConditional')` en `useSchema.utils.test.js`, agregar (usar `evalNestedExpr` para no chocar con el `evalExpr` que ya existe en ese describe):

```js
  const evalNestedExpr = (expr, data, row = null) =>
    new Function('data', 'row', `var show = false; ${expr}; return show;`)(
      data,
      row
    );

  it('shows nested correo_electronico when sibling linea is AUTOS', () => {
    const rule = {
      dependency: true,
      dependsOn: 'linea',
      dependencyValue: 'AUTOS',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(
      rule,
      'correo_electronico',
      false,
      ['asignacion_asistencia_movilidad']
    );
    expect(
      evalNestedExpr(expr, { asignacion_asistencia_movilidad: { linea: 'AUTOS' } })
    ).toBe(true);
    expect(
      evalNestedExpr(expr, { asignacion_asistencia_movilidad: { linea: 'OTRO' } })
    ).toBe(false);
    expect(evalNestedExpr(expr, {})).toBe(false);
  });

  it('falls back to root linea when the nested object lacks the key', () => {
    const rule = {
      dependency: true,
      dependsOn: 'linea',
      dependencyValue: 'AUTOS',
      dependencyValueValidation: true,
    };
    const expr = buildCustomConditional(
      rule,
      'correo_electronico',
      false,
      ['asignacion_asistencia_movilidad']
    );
    expect(
      evalNestedExpr(expr, { linea: 'AUTOS', asignacion_asistencia_movilidad: {} })
    ).toBe(true);
  });

  it('does not read row when not in editgrid (container inside columns)', () => {
    const rule = { dependency: true, dependsOn: 'linea' };
    const expr = buildCustomConditional(
      rule,
      'correo_electronico',
      false,
      ['asignacion_asistencia_movilidad']
    );
    expect(expr).not.toContain('row[');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/hooks/useSchema.utils.test.js
```

Expected: FAIL — `shows nested correo_electronico when sibling linea is AUTOS` (generated accessor still reads `data['linea']`, so nested `AUTOS` yields `show === false`).

- [ ] **Step 3: Write minimal implementation**

En `useSchema.utils.js`, reemplazar el cuerpo de `buildCustomConditional` (líneas 68-94) por:

```js
const buildDependencyValueAccessor = (dependsOn, path, isInEditGrid) => {
  const pathArr = Array.isArray(path)
    ? path.filter((segment) => typeof segment === 'string' && segment !== '')
    : [];
  const keyLit = `'${dependsOn}'`;
  const consider = (objExpr) =>
    `if(!found&&has(${objExpr},${keyLit})){value=${objExpr}[${keyLit}];found=true;}`;
  const lines = [];
  if (isInEditGrid) {
    lines.push(consider('row'));
  }
  for (let i = pathArr.length; i >= 0; i -= 1) {
    const objExpr =
      i === 0
        ? 'data'
        : pathArr
            .slice(0, i)
            .reduce((acc, seg) => `(${acc}&&${acc}['${seg}'])`, 'data');
    lines.push(consider(objExpr));
  }
  return `(function(){var has=function(obj,key){return obj!=null&&typeof obj==='object'&&!Array.isArray(obj)&&Object.prototype.hasOwnProperty.call(obj,key);};var value;var found=false;${lines.join('')}return value;})()`;
};

export const buildCustomConditional = (
  rule = {},
  key,
  isInEditGrid = false,
  path = []
) => {
  const dependsOn = rule.dependsOn;
  if (!rule.dependency || !dependsOn) return null;

  const valueAccessor = buildDependencyValueAccessor(
    dependsOn,
    path,
    isInEditGrid
  );

  if (rule.dependencyValueValidation) {
    const rawValue =
      typeof rule.dependencyValue === 'string' ? rule.dependencyValue : '';

    if (rawValue.includes(',')) {
      const list = parseDependencyValues(rawValue);
      return `const value = ${valueAccessor}; const normalizedValue = value != null && value !== '' ? String(value) : ''; show = [${list.map((v) => `'${v}'`).join(',')}].includes(normalizedValue);`;
    }

    const expected = JSON.stringify(rule.dependencyValue);
    return `const value = ${valueAccessor}; show = value != null && value !== '' && (value == ${expected} || String(value) == String(${expected}));`;
  }

  return `const value = ${valueAccessor}; show = value !== undefined && value !== null && value !== '';`;
};
```

Usar comillas simples en `data['key']` / `row['key']` para no romper los expects actuales que buscan `data['tipo']` y `row['tipo']`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/hooks/useSchema.utils.test.js
```

Expected: PASS (archivo completo, incluidos tests viejos de `buildCustomConditional` y `editgrid`).

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.js \
  apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.test.js
git commit -m "$(cat <<'EOF'
feat(onescript): resolve nested Form.io customConditional via data path

EOF
)"
```

Strip Cursor trailer if injected.

---

### Task 3: `preprocessSchema` con raíz + path

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.js:145-185`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.test.js` (bloque `nested data_structure` y uno nuevo de fallback a raíz)

**Interfaces:**
- Consumes: `resolveDependencyParentValue(rootData, path, dependsOn, localData)`, `nextDependencyPath` no aplica aquí (el path de payload crece en cada `data_structure`, sea object o array)
- Produces: `preprocessSchema(schema, data, isInArray?: boolean, ctx?: { rootData?: object, path?: string[] }) => object`

Call sites actuales `preprocessSchema(schema, data)` siguen válidos: `rootData` default = `data`, `path` default = `[]`.

- [ ] **Step 1: Write the failing test**

Agregar en `useSchema.utils.test.js` dentro de `describe('preprocessSchema')`:

```js
  describe('nested dependsOn ancestor at root', () => {
    const schema = {
      campo_qa: { type: 'string', required: false },
      asignacion_asistencia_movilidad: {
        type: 'object',
        data_structure: {
          correo_electronico: {
            type: 'string',
            required: true,
            min: 2,
            dependency: true,
            dependsOn: 'campo_qa',
            dependencyValue: 'Test',
            dependencyValueValidation: true,
          },
        },
      },
    };

    it('keeps nested required when only the root parent matches', () => {
      const result = preprocessSchema(schema, {
        campo_qa: 'Test',
        asignacion_asistencia_movilidad: {},
      });
      expect(
        result.asignacion_asistencia_movilidad.data_structure.correo_electronico
          .required
      ).toBe(true);
      expect(
        result.asignacion_asistencia_movilidad.data_structure.correo_electronico.min
      ).toBe(2);
    });

    it('strips nested required when the root parent does not match', () => {
      const result = preprocessSchema(schema, {
        campo_qa: 'Nope',
        asignacion_asistencia_movilidad: {},
      });
      expect(
        result.asignacion_asistencia_movilidad.data_structure.correo_electronico
      ).not.toHaveProperty('required');
      expect(
        result.asignacion_asistencia_movilidad.data_structure.correo_electronico
      ).not.toHaveProperty('min');
    });
  });

  describe('nested sibling empty does not fall through to root', () => {
    const schema = {
      linea: { type: 'string' },
      contenedor: {
        type: 'object',
        data_structure: {
          linea: { type: 'string' },
          correo: {
            type: 'string',
            required: true,
            dependency: true,
            dependsOn: 'linea',
            dependencyValue: 'AUTOS',
            dependencyValueValidation: true,
          },
        },
      },
    };

    it('strips validators when nested linea is empty even if root linea is AUTOS', () => {
      const result = preprocessSchema(schema, {
        linea: 'AUTOS',
        contenedor: { linea: '' },
      });
      expect(result.contenedor.data_structure.correo).not.toHaveProperty(
        'required'
      );
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/hooks/useSchema.utils.test.js
```

Expected: FAIL — `keeps nested required when only the root parent matches` (`parentValue` se lee solo del slice `{}`).

- [ ] **Step 3: Write minimal implementation**

En `useSchema.utils.js`:

```js
import {
  isPlainObject,
  resolveDependencyParentValue,
} from '#plugins/kace/shared/resolveDependencyParentValue.js';
```

Reemplazar `preprocessSchema`:

```js
export const preprocessSchema = (
  schema,
  data,
  isInArray = false,
  ctx = {}
) => {
  if (!schema || typeof schema !== 'object') return schema;

  const rootData = isPlainObject(ctx.rootData)
    ? ctx.rootData
    : isPlainObject(data)
      ? data
      : {};
  const path = Array.isArray(ctx.path) ? ctx.path : [];
  const processed = {};

  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (!fieldSchema || typeof fieldSchema !== 'object') {
      processed[key] = fieldSchema;
      continue;
    }

    const copy = { ...fieldSchema };
    const parentValue = resolveDependencyParentValue(
      rootData,
      path,
      copy.dependsOn,
      data
    );
    const isActive = evaluateDependency(copy, parentValue);

    if (!isActive) {
      for (const k of Object.keys(copy)) {
        if (!STRUCTURAL_KEYS.has(k)) delete copy[k];
      }
    }

    if (copy.data_structure) {
      const childPath = [...path, key];
      if (copy.type === 'array' && Array.isArray(data?.[key])) {
        const arrayData = /** @type {Record<string, unknown>[]} */ (data[key]);
        copy.data_structure =
          arrayData.map((itemData) =>
            preprocessSchema(fieldSchema.data_structure, itemData, true, {
              rootData,
              path: childPath,
            })
          )[0] ||
          preprocessSchema(fieldSchema.data_structure, {}, true, {
            rootData,
            path: childPath,
          });
      } else {
        const nested = /** @type {Record<string, unknown>} */ (
          data?.[key] ?? {}
        );
        copy.data_structure = preprocessSchema(copy.data_structure, nested, false, {
          rootData,
          path: childPath,
        });
      }
    }

    processed[key] = copy;
  }

  return processed;
};
```

`isInArray` se conserva en la firma; no cambia el comportamiento. El 4º argumento es el `ctx`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/hooks/useSchema.utils.test.js
```

Expected: PASS (incluye `nested data_structure` y `array-type data_structure` previos).

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.js \
  apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.test.js
git commit -m "$(cat <<'EOF'
feat(onescript): evaluate nested schema dependencies against ancestor data

EOF
)"
```

Strip Cursor trailer if injected.

---

### Task 4: `transformFormioComponents` propaga `path`

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.js` (mover `applyUiOverrides` + extraer `transformFormioComponents`)
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js:34-78` y `204-300`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.test.js`

**Interfaces:**
- Consumes: `buildCustomConditional(rule, key, isInEditGrid, path)`, `nextDependencyPath(path, type, key)`, `buildRequiredValidation(rule)`
- Produces: `transformFormioComponents(list, ds, isInEditGrid?: boolean, path?: string[]) => array`

Se extrae del closure de `fetchSchema` para poder testear el árbol `panel > container > columns` (el formulario real). El hook solo llama a la función extraída. Mover `applyUiOverrides` junto con ella (ya es pura salvo `console.error`).

- [ ] **Step 1: Write the failing test**

Agregar en `useSchema.utils.test.js`:

```js
import { transformFormioComponents } from './useSchema.utils.js';

describe('transformFormioComponents', () => {
  const evalExpr = (expr, data, row = null) =>
    new Function('data', 'row', `var show = false; ${expr}; return show;`)(
      data,
      row
    );

  const correoRule = {
    type: 'string',
    dependency: true,
    dependsOn: 'linea',
    dependencyValue: 'AUTOS',
    dependencyValueValidation: true,
  };

  const ds = {
    asignacion_asistencia_movilidad: {
      type: 'object',
      data_structure: {
        linea: { type: 'string' },
        correo_electronico: correoRule,
      },
    },
  };

  const components = [
    {
      type: 'panel',
      key: 'asignacion',
      components: [
        {
          type: 'container',
          key: 'asignacion_asistencia_movilidad',
          components: [
            {
              type: 'columns',
              key: 'cols',
              columns: [
                {
                  components: [
                    { type: 'kace_text_field', key: 'correo_electronico' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  it('injects customConditional that reads nested linea through panel/container/columns', () => {
    const result = transformFormioComponents(components, ds);
    const correo =
      result[0].components[0].components[0].columns[0].components[0];
    expect(correo.customConditional).toEqual(expect.any(String));
    expect(
      evalExpr(correo.customConditional, {
        asignacion_asistencia_movilidad: { linea: 'AUTOS' },
      })
    ).toBe(true);
    expect(
      evalExpr(correo.customConditional, {
        asignacion_asistencia_movilidad: { linea: 'MOTO' },
      })
    ).toBe(false);
  });
});
```

Hasta que `transformFormioComponents` exista, el import fallará: primero agregar el export vacío o dejar que el test falle por export missing, luego implementar.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/hooks/useSchema.utils.test.js
```

Expected: FAIL — `transformFormioComponents` is not exported.

- [ ] **Step 3: Write minimal implementation**

1. Mover `applyUiOverrides` de `useSchema.js` a `useSchema.utils.js` (copiar tal cual, incluyendo imports de `kace-events.constants.js` que ya no harán falta en el hook).
2. Extraer la closure `transformComponents` a `export const transformFormioComponents = (list, ds, isInEditGrid = false, path = []) => { ... }`.
3. Cambios respecto al closure actual:
   - `buildCustomConditional(rule, copy.key, isInEditGrid, path)`
   - `const childPath = nextDependencyPath(path, copy.type, copy.key);`
   - todas las recursiones usan `childPath` (4º argumento) y `isGridComponent || isInEditGrid` como 3º.
4. Importar `nextDependencyPath` desde `resolveDependencyParentValue.js`.
5. En `useSchema.js`: borrar `applyUiOverrides` y constantes UI; importar `transformFormioComponents`; reemplazar la closure y la llamada por:

```js
const transformedComponents = transformFormioComponents(
  loadedComponents || [],
  dataStructure
);
```

Firma de recursión (referencia; copiar las ramas `components` / `columns` / `tabs` / `rows` / grid duplicado que ya existen, solo agregando `childPath`):

```js
export const transformFormioComponents = (
  list,
  ds,
  isInEditGrid = false,
  path = []
) => {
  if (!Array.isArray(list)) return list;
  return list.map((comp) => {
    const copy = { ...comp };
    const rule = ds?.[copy.key];
    const customConditional = buildCustomConditional(
      rule,
      copy.key,
      isInEditGrid,
      path
    );
    if (customConditional) {
      copy.customConditional = customConditional;
    }
    if (rule) {
      copy.kaceValidation = rule;
    }

    const requiredValidation = buildRequiredValidation(rule);
    if (requiredValidation !== null) {
      copy.validate = {
        ...(copy.validate || {}),
        required: requiredValidation,
      };
    }

    applyUiOverrides(rule, copy);

    const nestedDataStructure = rule?.data_structure ?? ds;
    const isGridComponent =
      copy.type === 'editgrid' || copy.type === 'datagrid';
    const childPath = nextDependencyPath(path, copy.type, copy.key);
    const childInGrid = isGridComponent || isInEditGrid;

    if (Array.isArray(copy.components) && copy.components.length) {
      copy.components = transformFormioComponents(
        copy.components,
        nestedDataStructure,
        childInGrid,
        childPath
      );
    }

    if (Array.isArray(copy.columns) && copy.columns.length) {
      copy.columns = copy.columns.map((col) => ({
        ...col,
        components: transformFormioComponents(
          col.components || [],
          nestedDataStructure,
          childInGrid,
          childPath
        ),
      }));
    }

    if (Array.isArray(copy.tabs) && copy.tabs.length) {
      copy.tabs = copy.tabs.map((tab) => ({
        ...tab,
        components: transformFormioComponents(
          tab.components || [],
          nestedDataStructure,
          childInGrid,
          childPath
        ),
      }));
    }

    if (Array.isArray(copy.rows) && copy.rows.length) {
      copy.rows = copy.rows.map((row) => {
        if (Array.isArray(row)) {
          return row.map((col) => ({
            ...col,
            components: transformFormioComponents(
              col.components || [],
              nestedDataStructure,
              childInGrid,
              childPath
            ),
          }));
        }
        return row;
      });
    }

    if (
      isGridComponent &&
      Array.isArray(copy.components) &&
      copy.components.length
    ) {
      copy.components = transformFormioComponents(
        copy.components,
        nestedDataStructure,
        true,
        childPath
      );
    }

    return copy;
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/hooks/useSchema.utils.test.js src/plugins/kace/shared/resolveDependencyParentValue.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.js \
  apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.utils.test.js \
  apps/onescript_plugin_kace/src/plugins/kace/hooks/useSchema.js
git commit -m "$(cat <<'EOF'
feat(onescript): pass nested data path through Form.io component transform

EOF
)"
```

Strip Cursor trailer if injected.

---

### Task 5: `KaceBaseComponent` usa el resolvedor

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/shared/KaceBaseComponent.js:1-8` (imports) y `85-122` (bloque dependency)
- Test: sin archivo nuevo de la clase. Cubierto por Task 1 (`dependencyPathFromFormioPath`, `resolveDependencyParentValue`) + `evaluateDependency` existente.

**Interfaces:**
- Consumes:
  - `resolveDependencyParentValue(rootData, path, dependsOn, localData)`
  - `dependencyPathFromFormioPath(formioPath, fieldKey)`
  - `isPlainObject(value)`
  - `evaluateDependency(rule, parentValue)` from `useSchema.utils.js`
- Produces: `checkValidity` skips Joi when the resolved parent does not activate the field

- [ ] **Step 1: Confirm resolver tests still pass (no new Form.io suite)**

Run:

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/shared/resolveDependencyParentValue.test.js
```

Expected: PASS. No agregar archivo de test de `KaceBaseComponent`.

- [ ] **Step 2: Implement `checkValidity` dependency lookup**

Imports en `KaceBaseComponent.js`:

```js
import { evaluateDependency } from '#plugins/kace/hooks/useSchema.utils.js';
import {
  dependencyPathFromFormioPath,
  isPlainObject,
  resolveDependencyParentValue,
} from '#plugins/kace/shared/resolveDependencyParentValue.js';
```

Reemplazar el bloque (aprox. líneas 85-122):

```js
          if (kace_schema.dependency && kace_schema.dependsOn) {
            const rootData =
              this.rootValue ||
              this.root?.submission?.data ||
              this.data ||
              data ||
              {};
            const path = dependencyPathFromFormioPath(this.path, compKey);
            const localData = isPlainObject(this.data) ? this.data : undefined;
            const parentValue = resolveDependencyParentValue(
              rootData,
              path,
              kace_schema.dependsOn,
              localData
            );

            if (!evaluateDependency(kace_schema, parentValue)) {
              if (this.error) this.error = null;
              return true;
            }
          }
```

Borrar el `if/else` duplicado de `dependencyValueValidation` / comma-list / presence.

- [ ] **Step 3: Run tests**

```bash
cd apps/onescript_plugin_kace && npx vitest run src/plugins/kace/shared/resolveDependencyParentValue.test.js src/plugins/kace/hooks/useSchema.utils.test.js
```

Expected: PASS. Luego lint del plugin:

```bash
cd apps/onescript_plugin_kace && npx eslint src/plugins/kace/shared/KaceBaseComponent.js src/plugins/kace/hooks/useSchema.utils.js src/plugins/kace/hooks/useSchema.js src/plugins/kace/shared/resolveDependencyParentValue.js
```

Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/shared/KaceBaseComponent.js
git commit -m "$(cat <<'EOF'
feat(onescript): resolve nested field dependencies in client validation

EOF
)"
```

Strip Cursor trailer if injected.

No incluir `schema.json` ni `.atl/`.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Sibling then ancestor/root | 1 |
| `Object.hasOwn`; empty sibling does not fall through | 1, 3 |
| Never throw | 1 |
| `customConditional` nested `linea=AUTOS` | 2, 4 |
| `path=[]` primer nivel intacto | 2 (tests existentes) |
| `editgrid` `row` primero | 2 (tests existentes `isInEditGrid`) |
| `preprocessSchema` recorta validadores | 3 |
| Nested → root `campo_qa` | 3 |
| `panel`/`columns` no alargan path; `container` sí | 1 (`nextDependencyPath`), 4 (árbol real) |
| `KaceBaseComponent` usa resolvedor | 5 |
| Sin Joi / sin e2e / sin `schema.json` | constraints + Task 5 add list |
| TDD | cada task Steps 1–4 |

No quedan requisitos de la spec sin task.
