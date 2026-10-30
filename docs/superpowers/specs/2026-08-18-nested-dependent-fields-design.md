# Campos dependientes anidados en OneScript (visibilidad + validación cliente)

**Fecha:** 2026-08-18
**Rama:** `fix/nested-dependent-fields` (desde `origin/release/1.23.x`)
**Estado:** Pendiente de review del spec (diseño aprobado en brainstorming)

## Resumen

Un campo con `dependency: true` dentro de un `container` Form.io (ejemplo: `correo_electronico` depende de `linea === "AUTOS"` en `asignacion_asistencia_movilidad`) no se muestra. Los dependientes de primer nivel sí. La causa es el adaptador Form.io: `customConditional` lee `data['linea']` en la raíz, y `linea` vive en `data.asignacion_asistencia_movilidad.linea`.

Este diseño introduce un resolvedor puro hermano → ancestro → raíz, lo usa en visibilidad y en validación cliente, y no toca Joi del servidor.

## Problema

**Síntoma:** en el OneScript ligado a `base_felipe`, al elegir `linea = AUTOS` no aparece `correo_electronico`. `dependiente_uno` (depende de `campo_qa === "Test"`) sí se renderiza.

**Causa raíz:**

1. `GET /schemas/:id/rules` **sí** inlinea el `data_structure` hijo vía `schema_id` (`KnexSchemasRepository.#resolveRulesInMemory`). La regla de `correo_electronico` llega al plugin.
2. `buildCustomConditional` genera `data['${dependsOn}']` salvo dentro de `editgrid`/`datagrid` (`row` primero). Un `container` no activa ese flag.
3. En Form.io, `data` es el submission raíz. `linea` no está en la raíz; el condicional queda en `show = false` siempre.

Evidencia en el formulario OS: scripts y `redrawOn` ya usan la ruta `asignacion_asistencia_movilidad.linea`.

**Por qué no es un bug de configuración del schema:** `dependsOn: "linea"` es correcto a nivel de `data_structure` del hijo. El fallo es el ámbito de lectura en Form.io.

## Objetivos

1. Mostrar `correo_electronico` cuando el hermano `linea` vale `AUTOS`.
2. Resolver `dependsOn` así: key en el objeto actual; si **no existe la key**, subir un nivel hasta la raíz (un campo anidado puede depender de `campo_qa` de la raíz).
3. Aplicar la misma resolución a visibilidad (`customConditional`) y validación cliente (`preprocessSchema`, `KaceBaseComponent`).
4. No romper dependientes de primer nivel ni el comportamiento actual de `editgrid`.
5. TDD: tests que fallen primero; código mínimo.

## No-objetivos

- Backend Joi (`SchemaBuilder`, `DependencyHelper`): `Joi.ref` sigue siendo entre hermanos del objeto Joi actual.
- kace-saas y otros renderers.
- Commitear `schema.json` / `.atl/` (export local del formulario).
- Suite nueva de `KaceBaseComponent` (acopla Form.io; solo llamará al resolvedor testeado).
- E2E del formulario OS.
- Dependencias con ruta explícita en `dependsOn` (`"asignacion_asistencia_movilidad.linea"`). El valor sigue siendo una key simple.

## Solución elegida

**Resolvedor compartido + path de anidación.**

Función pura `resolveDependencyParentValue(rootData, path, dependsOn, localData)`:

- `localData`: objeto de hermanos del campo (slice del container, o `row` del editgrid). Primer ámbito.
- `path`: segmentos hasta ese objeto, ej. `['asignacion_asistencia_movilidad']`. Sirve para subir ancestros sobre `rootData`.
- En cada ámbito, si es un objeto plano y `Object.prototype.hasOwnProperty.call(obj, dependsOn)`, devolver ese valor (aunque sea `""` o `undefined`).
- Orden: `localData` → objeto en `path` si es objeto plano y no es el mismo que `localData` → recortar `path` → `rootData`.
- Un segmento cuyo valor no es objeto plano (p. ej. el array de un `editgrid`) se salta. Así la fila (`localData`/`row`) no se confunde con `data[gridKey]`.
- `path = []` y `localData = rootData`: solo raíz.
- Nunca lanza: datos inválidos → `undefined`.

`evaluateDependency(rule, parentValue)` no cambia.

### Por qué no las otras opciones

- **Tratar `container` como `editgrid` (`row` + `data`):** `row` no está garantizado igual dentro de `columns` de un container; el fallback sería solo dos niveles, no una cadena de ancestros.
- **Servicio de dominio `FieldDependency`:** más archivos de los que pide el bug; la regla cabe en una función pura.

## Decisiones

| Tema | Decisión |
|------|----------|
| Resolución | Hermano primero; si la key **no existe**, ancestro hasta la raíz |
| “Existe la key” | `Object.prototype.hasOwnProperty.call`. Un hermano `""` o `undefined` no cae a la raíz |
| Alcance | Visibilidad + validación cliente. No Joi de servidor (follow-up aparte) |
| Tipos que alargan `path` | `container`, `editgrid`, `datagrid`, `form`, `tree` |
| Tipos que no alargan `path` | `panel`, `columns`, `tabs`, filas de tabla |
| `editgrid` | `row` es el primer ámbito; segmentos **posteriores** al último grid se anclan en `row` (p. ej. `row.contenedor`) |
| Active + Joi cliente | Borrar `dependsOn`/`dependency*` **solo** si el padre se resolvió en un **ancestro**. Local/root conservan las claves para `Joi.when` por objeto o por fila |
| Generated JS | Literales con `JSON.stringify`; helper `at(o,p)` lineal; `hasOwnProperty.call` |

## Componentes

| Unidad | Dónde | Qué hace |
|--------|--------|----------|
| `resolveDependencyParentValue` | `apps/onescript_plugin_kace/src/plugins/kace/shared/resolveDependencyParentValue.js` | Resolvedor puro. Vive en `shared/` para que `KaceBaseComponent` no importe `hooks/` |
| `formioTypeNestsData` | mismo archivo o vecino de 5 líneas | `true` solo para `container` \| `editgrid` \| `datagrid` |
| `buildCustomConditional` | `hooks/useSchema.utils.js` | Gana `path: string[]`. Genera JS que replica el resolvedor sobre `data` (y `row` si `isInEditGrid`) |
| `preprocessSchema` | `hooks/useSchema.utils.js` | Recibe `rootData` + `path`. Al bajar a objeto: `path.concat(key)` y `localData = data[key]`. Al bajar a item de array: mismo path y `localData = item` (el array no es ámbito) |
| `evaluateDependency` | `hooks/useSchema.utils.js` | Sin cambios |
| `transformComponents` | `hooks/useSchema.js` | Propaga `path`; lo alarga solo si `formioTypeNestsData(copy.type)` |
| `KaceBaseComponent` | `shared/KaceBaseComponent.js` | Sustituye `formData[dependsOn]` por el resolvedor: submission raíz + path sin la key del campo + `localData = this.data` si es objeto |

### Contrato del resolvedor

```text
resolveDependencyParentValue(rootData, path, dependsOn, localData) → unknown | undefined
```

`localData` por defecto es el objeto en `path` sobre `rootData` (o `rootData` si `path` está vacío).

Ejemplos con el formulario real (`localData` = objeto en `path`, salvo la fila de grid):

| `rootData` (resumido) | `path` | `dependsOn` | Resultado |
|------------------------|--------|-------------|-----------|
| `{ asignacion_asistencia_movilidad: { linea: "AUTOS" } }` | `['asignacion_asistencia_movilidad']` | `linea` | `"AUTOS"` |
| `{ linea: "AUTOS", asignacion_asistencia_movilidad: {} }` | `['asignacion_asistencia_movilidad']` | `linea` | `"AUTOS"` (fallback raíz) |
| `{ linea: "RAIZ", asignacion_asistencia_movilidad: { linea: "" } }` | `['asignacion_asistencia_movilidad']` | `linea` | `""` (hermano existe) |
| `{ campo_qa: "Test" }` | `[]` | `campo_qa` | `"Test"` |
| `{ items: [{ flag: "x" }], flag: "raiz" }` con `localData = { flag: "x" }` | `['items']` | `flag` | `"x"` (fila; el array se salta) |
| `{}` | `['asignacion_asistencia_movilidad']` | `linea` | `undefined` |

### JS generado (visibilidad)

Para `correo_electronico` con `path = ['asignacion_asistencia_movilidad']` y `dependencyValueValidation` / `dependencyValue: "AUTOS"`, la expresión debe evaluar `show === true` solo cuando el valor resuelto es `AUTOS`.

Ámbitos en orden, parando en el primero que **tenga la key**:

1. Si `isInEditGrid`: `row` (si `row` es objeto y tiene la key).
2. `data['asignacion_asistencia_movilidad']` (objeto en el path).
3. `data` (raíz).

Misma semántica que `resolveDependencyParentValue`; los tests evalúan la string con `new Function('data', 'row', …)` como hoy.

### Path en `KaceBaseComponent`

- Raíz: `this.rootValue` o `this.root?.submission?.data` o `this.data` si no hay raíz.
- Path: `this.path` (data path Form.io), quitar el último segmento (key del campo) y los índices de array (`[0]`). Si no hay `path`, usar `[]`.
- `localData`: `this.data` si es objeto plano; si no, el objeto en `path` sobre la raíz.

## Flujo

1. Plugin carga `/schemas/{base_felipe}/rules` (hijo ya inlined).
2. `transformComponents` entra al `container` `asignacion_asistencia_movilidad` → `path = ['asignacion_asistencia_movilidad']`. Panel/columns no cambian el path.
3. Inyecta `customConditional` en `correo_electronico`.
4. Usuario elige `linea = AUTOS` → Form.io reevalúa → el campo se muestra.
5. `preprocessSchema` recorta required/min/max si el resolvedor deja el campo inactivo.
6. `KaceBaseComponent` usa el mismo padre; si la dependencia no se cumple, no valida.

`dependiente_uno` en la raíz: `path = []` → solo `data.campo_qa`.

## Errores y bordes

- El resolvedor no lanza.
- Segmento ausente o no-objeto: se salta y se sube.
- Sin `dependency` / sin `dependsOn`: no se genera condicional (igual que hoy).
- Submission incompleto: JS defensivo; `show` queda false.
- Sin UI de error nueva ni logs extra.

## Testing (TDD)

Orden: tests rojos → implementación mínima. Sin montar Form.io.

**`resolveDependencyParentValue` / `resolveDependencyParentScope`:** tabla de ejemplos (incluye fila de grid vs array) + no-throw con `rootData` null/array + etiqueta `local` | `ancestor` | `root` | `none`. Sibling con valor `undefined` no cae a la raíz.

**`formioTypeNestsData`:** true para `container`, `editgrid`, `datagrid`, `form`, `tree`.

**`buildCustomConditional`:** extender `useSchema.utils.test.js`:

- nested `linea=AUTOS` → `show === true` para la regla de `correo_electronico`.
- nested `linea=OTRO` → `false`.
- `path=[]` no rompe primer nivel (`dependiente_uno` / `campo_qa`).
- `editgrid`: `row` gana si tiene la key; un `container` dentro de la fila se ancla en `row`.
- harness `var show = true` (mismo default que Form.io).
- `dependsOn` con comillas se interpola con `JSON.stringify` y la expresión sigue siendo JS válido.

**`preprocessSchema`:**

- anidado inactivo pierde required/min/max; activo los conserva.
- `dependsOn` a un campo de raíz desde el nested usa el fallback y **borra** las claves de dependencia (Joi.ref sibling no ve al ancestro).
- activo **local** (hermano o raíz) **conserva** `dependsOn` para `Joi.when`.
- `type: 'array'` con dos filas de activación divergente: SchemaBuilder no exige el campo en la fila inactiva ni deja de exigirlo en la activa.

No hay e2e OS ni suite nueva de `KaceBaseComponent`.

## Follow-up (fuera de esta rama)

`DependencyHelper.applyConditionalRequired` sigue emitiendo `Joi.when(Joi.ref(dependsOn))` sibling-scoped. El servidor no exige un campo cuyo padre vive en un ancestro. El cliente sí (tras este PR). PR aparte: https://github.com/colombia-it-desarrollo/kace-cloud/issues/104 (`Joi.ref('/' + ancestorPath.join('.'))` en `kace_cloud_schemas_builder`).

No se añadió un allowlist `/^[A-Za-z_$][\w$]*$/` sobre `dependsOn`: rechazar la key devolvería `null` (sin `customConditional`) y Form.io deja el campo visible. `JSON.stringify` cierra la interpolación sin ese fail-open.

## Criterio de hecho

- [ ] `linea = AUTOS` en el container muestra `correo_electronico`.
- [ ] `linea` distinto de `AUTOS` lo oculta y no aplica validadores cliente del correo.
- [ ] `dependiente_uno` / `dependiente_dos` en la raíz siguen igual.
- [ ] Un nested con `dependsOn` a una key que solo existe en la raíz la resuelve.
- [ ] Hermano presente y vacío no usa el homónimo de la raíz.
- [ ] Tests nuevos en verde; tests previos de `useSchema.utils` en verde.
- [ ] Ningún cambio en `packages/kace_cloud_schemas_builder`.

## Siguiente paso

Tras aprobación de este archivo: skill `writing-plans` → plan TDD en `docs/superpowers/plans/`.
