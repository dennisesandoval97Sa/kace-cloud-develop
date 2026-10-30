# Stale de responsable + códigos públicos en update de caso

**Fecha:** 2026-08-13
**Revisión:** 2026-08-14 (default de `responsable_stale_check` a **false**, opt-in)
**Rama PR 1:** `feat/case-stale-responsable` (desde `origin/release/1.23.x`) — [PR #92](https://github.com/colombia-it-desarrollo/kace-cloud/pull/92)
**Rama develop:** `feat/case-stale-responsable-develop` (desde `origin/develop`) — [PR #97](https://github.com/colombia-it-desarrollo/kace-cloud/pull/97). Portar cuando #92 esté OK.
**Estado:** Implementación en #92. El review del 14 ago está cerrado en código.

## Quick path

1. Al guardar un caso, comparar snapshots de carga (`current_transicion_id`, `current_responsable_id`) contra DB.
2. Soft-save: persistir el resto; no pisar el campo stale.
3. HTTP 200 + `data.warnings[]` con `{ code, message }` (`0x030041` / `0x030042`). Se elimina `transition_stale` y **no** se usa `errors[]` para stale.
4. `responsable_stale_check` default **false** (opt-in, igual que `transition_stale_check`). Hay que activarlo en GeneralSetup.
5. Write de `responsable_id` y `transicion_id` con UPDATE condicional al snapshot, después de `CanUpdateCase`.
6. `CanUpdateCase` no se toca: si no eres dueño actual ni tienes `CaseUpdateNotOwner`, sigue 403.

## Resumen

Hoy el update detecta transición obsoleta con `TransitionStaleChecker`: guarda el resto, no pisa `transicion_id`. El aviso ya no es `data.transition_stale: true`; es un ítem en `data.warnings`.

Mientras el agente edita, acciones y post-procesos async pueden cambiar `responsable_id`. El form reenvía el asignado de carga y lo revertiría.

Esta spec añade el mismo check para responsable (off por default, activable desde GeneralSetup), write condicional de `responsable_id` y `transicion_id` para no perder un cambio entre el SELECT y el UPDATE, y códigos públicos alineados con [PR #90](https://github.com/colombia-it-desarrollo/kace-cloud/pull/90) (`0x` + 6 dígitos decimales).

## Problema

1. **Responsable stale.** El agente abre el caso (responsable A). Un proceso async reasigna a B. Al guardar, el form envía `responsable_id: A` y pisa B. `CanUpdateCase` no cubre esto: mira dueño actual vs usuario logueado, no snapshot de carga vs DB.
2. **Señal al frontal.** `transition_stale: true` no es un código. Stale no es un error de request: el resto sí se guardó. El canal correcto es `data.warnings`, no `errors[]`.
3. **Códigos vs PR #90.** Una spec previa usó `0x030029` / `0x03002A`. En `@kace/error-codes`, `0x030029` ya es `APPOINTMENT_TIME_SLOT_EXCEEDS_AGENDA_DAILY_LIMIT` y las letras en el hex están prohibidas. El último código de validación es `0x030040`.
4. **TOCTOU.** Un SELECT al inicio y un UPDATE de fila completa después deja una ventana: un reassign entre medio se perdería sin warning. Un WHERE en el UPDATE de toda la fila saltaría también el resto de campos (rompe soft-save).

## Objetivos

1. Detectar responsable stale (snapshot de carga vs DB al inicio del update) y, si el check está on, no pisar el campo.
2. Soft-save: persistir el resto; no pisar el campo stale.
3. HTTP 200 con `data.warnings[]` de `{ code, message descriptivo }`. Eliminar `transition_stale`. No dual-contract con `errors[]`.
4. Códigos alineados con PR #90: `0x030041` y `0x030042`.
5. Flag `responsable_stale_check` (default **false**, opt-in) paralelo a `transition_stale_check` (default false).
6. Write de `responsable_id` y `transicion_id` condicional al snapshot, **después** de `CanUpdateCase`.
7. No debilitar `CanUpdateCase` (403 gana).
8. TDD. Un evaluator en core; los dos controllers no duplican orquestación (`prepare` / `applyWriteOutcome` / `httpData`).

## No-objetivos

- Cambiar `CanUpdateCase` (ni saltarlo, ni evaluarlo contra el snapshot).
- Catálogo i18n de estos códigos en kace-saas.
- Check en create-case (solo `actionUpdateWithAux`).
- Portar `publicErrorCode` / `BaseError` 4º arg de develop.
- Dual-contract `errors[]` + `data.warnings` (OneScript solo lee `response.data.data.warnings`).

## Solución elegida

**Enfoque A + review 14 ago:** `ResponsableStaleChecker` (dominio, boolean, gated por `responsable_stale_check`) + `TransitionStaleChecker` (gated por `transition_stale_check`) + `CaseStaleSnapshotEvaluator` (strip + `warnings[]` + snapshots para el write + wiring de controllers) + `KnexCaseRepository.update*IfSnapshotMatches` llamado desde `CaseUpdater` después de `CanUpdateCase`. Una sola lectura `getStaleSnapshotFields`. Toggle de ambos flags en GeneralSetup.

### Por qué no las otras

- **B (checker genérico):** indirección de más para dos funciones cortas; mezcla bounded contexts (Case vs transition-rules).
- **C (inline en controllers):** duplica orquestación en `cases` y `cases_2`; mezcla HTTP con dominio.
- **Hard-fail 4xx:** el save del resto sí ocurrió; un 4xx implica fallo/reintento.
- **Reutilizar `0x030003` / `0x030005`:** en el catálogo SSOT ya significan otra cosa.
- **CAS en el evaluator (antes de CanUpdateCase):** asignaría `responsable_id` aunque el caller reciba 403.
- **WHERE en el UPDATE de toda la fila:** si el snapshot no coincide, Knex no escribe ningún campo. Soft-save exige persistir el resto.

## Contrato HTTP

Update con el resto persistido: **HTTP 200**, `message: "Success"`. Se elimina `data.transition_stale`. Stale **no** va en `errors[]`.

Sin stale: igual que hoy (`data: {}`).

Con stale (uno o dos ítems; transición primero si hay ambos):

```json
{
  "message": "Success",
  "data": {
    "warnings": [
      {
        "code": "0x030041",
        "message": "Field was not updated because it changed after the form was loaded"
      }
    ]
  }
}
```

Axios: el envelope es `response.data`; el canal stale es `response.data.data.warnings`.

| Regla | Decisión |
|---|---|
| Shape | Solo `code` + `message`. Sin `field`. |
| `message` | `Field was not updated because it changed after the form was loaded` (`STALE_SNAPSHOT_MESSAGE`). Copy útil en español: OneScript. |
| Frontal | Lee `response.data.data.warnings[].code`. No lee `errors[]` para stale. |
| Ambos stale | Dos ítems en `warnings[]`. |
| Stale al write (CAS 0 filas) | Mismo código (`0x030041` transición / `0x030042` responsable) en `warnings[]`; el resto ya persistió. |
| `CanUpdateCase` | 403 gana. Estos códigos solo si el caller podía actualizar (dueño actual en DB o `CaseUpdateNotOwner`). |

`Response.sanitizeErrors` sigue conservando `{ code, message }` en el canal `errors` para otros flujos. Stale no lo usa.

## Códigos públicos

Mismos nombres y literales en release y develop. Formato PR #90: `0x` + 6 dígitos decimales.

| Constante | Valor | Cuándo |
|---|---|---|
| `CASE_TRANSITION_STALE` | `'0x030041'` | Snapshot `current_transicion_id` ≠ DB y `transition_stale_check` está on |
| `CASE_RESPONSIBLE_STALE` | `'0x030042'` | Snapshot `current_responsable_id` ≠ DB y `responsable_stale_check` está on (SELECT inicial o CAS 0 filas) |

No reutilizar:

- `CASE_TRANSITION_NOT_ALLOWED` (`0x030003`)
- `CASE_RESPONSIBLE_ASSIGNMENT_UNAVAILABLE` (`0x030005`)
- `0x030029` / `0x03002A` (colisionan con el catálogo SSOT)

**PR 1 (release / #92):** `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js`.

**Develop / #97:** `@kace/error-codes` (`catalog/validation.js` + `EXPECTED_PUBLIC_ERROR_CODES`). El invariante de sufijos consecutivos por categoría exige `041` y `042` (siguiente libre tras `0x030040`).

## Dominio

### `TransitionStaleChecker`

`transition-rules/domain`, `boolean`, gated por `transition_stale_check` (default **false**). Acepta `preload.dbValue` para no repetir el SELECT. Flag off → `false` sin tocar DB. El caller deja de armar `{ transition_stale: true }`.

### `ResponsableStaleChecker`

`packages/kace_cloud_core/src/cases/domain/ResponsableStaleChecker.js`.

```
static async check(repository, globalConfig, caseId, currentResponsableId, preload?) → Promise<boolean>
```

- Lee `behaviors.getConfig('agente','casos').responsable_stale_check`. Flag off → `false` sin tocar DB.
- Sin preload: `getResponsableId(caseId)` → `undefined` (caso no existe) → log + `false`. El 404 lo resuelve `CaseUpdater`.
- Con preload: usa `dbValue` (viene de `getStaleSnapshotFields`).
- Stale iff `db !== snapshot` (`null` vs uuid cuenta). Ambos `null` → no stale.
- No conoce HTTP ni códigos. No escribe.

### Flag `responsable_stale_check`

En `Behaviors.#EXPECTED_STRUCTURE` bajo `application.agente.casos`, default **`false`**. Config incompleta rellena el default al cargar. Toggle en GeneralSetup junto a `transition_stale_check`.

Flag **off (default):** no strip, no warning, no CAS: `responsable_id` se escribe en el UPDATE de fila como hoy.

Flag **on:** strip + warning + CAS, igual que la transición con su flag encendido.

### Repositorio

`KnexCaseRepository.getStaleSnapshotFields(caseId)`: un SELECT de `transicion_id` y `responsable_id`. `undefined` si el caso no existe. Los checkers unitarios siguen usando `getTransitionId` / `getResponsableId`.

`updateResponsableIdIfSnapshotMatches` y `updateTransicionIdIfSnapshotMatches` (helper privado `#updateColumnIfSnapshotMatches`):

```sql
UPDATE cases
   SET <columna> = :nuevo
 WHERE id = :caseId
   AND deleted_at IS NULL
   AND (<columna> IS NULL AND :snapshot IS NULL
        OR <columna> = :snapshot)
```

Equivalente a `IS NOT DISTINCT FROM` (null-safe). Retorna `true` si actualizó una fila viva.

### Timing

1. SELECT en el evaluator (`getStaleSnapshotFields`): strip + `warnings` + snapshots para el write + contexto para `TransitionRuleValidator`.
2. `CanUpdateCase` dentro de `CaseUpdater.execute` (403/404).
3. UPDATE de fila **sin** los campos que van por CAS.
4. UPDATE condicional de `responsable_id` y/o `transicion_id`. Si 0 filas → `*StaleAtWrite`; el resto ya persistió. `STATE_CHANGE` solo si el CAS de transición escribió.

Aux y descripción siguen persistiendo **antes** de `CaseUpdater` (orden actual). Un 403 posterior no revierte aux/descripción.

## Application: `CaseStaleSnapshotEvaluator`

`packages/kace_cloud_core/src/cases/application/CaseStaleSnapshotEvaluator.js`

```
static async execute({ repository, getGlobalConfig, caseId, caseValue })
  → Promise<{ warnings, caseValue, responsableSnapshot, transitionSnapshot }>

static async prepare(...) → { warnings, persistedCase, responsableSnapshot, transitionSnapshot }
static applyWriteOutcome(warnings, persistedCase, updateResult)
static httpData(warnings) → { warnings } | undefined
```

No muta el input. Carga `getGlobalConfig` si hay **cualquiera** de los dos snapshots (una sola vez). Una sola lectura de DB cuando algún check está on.

1. Si `current_transicion_id !== undefined` y `TransitionStaleChecker.check(...)`: omite `transicion_id`; push `{ code: CASE_TRANSITION_STALE, message: STALE_SNAPSHOT_MESSAGE }`.
2. Si `current_responsable_id !== undefined` y `ResponsableStaleChecker.check(...)`: omite `responsable_id`; push `{ code: CASE_RESPONSIBLE_STALE, message: STALE_SNAPSHOT_MESSAGE }`.
3. Omite ambos `current_*` en el `caseValue` devuelto (no persistir snapshots).
4. `*Snapshot`: el snapshot de carga si el check está on, el campo no se strippeó, y el id sigue en el payload. `undefined` si no hay CAS. Un snapshot `null` es un valor válido para el CAS.
5. Sin stale → `warnings: []`. Orden: transición, luego responsable.

## Wiring API

Controllers `apps/apiv1/kace_cloud_api_cases/src/controller.mjs` y `..._cases_2/...` llaman al helper compartido:

- `prepare(...)` (no llama a `execute`/`getGlobalConfig` si no hay snapshots).
- `payload.case = persistedCase` (reglas de transición ven los campos ya strippeados).
- `CaseUpdater.execute(..., { responsableSnapshot, transitionSnapshot })`.
- `applyWriteOutcome` si el CAS de write no coincidió.
- `HttpResponse.ok({ data: httpData(warnings), event })`.

Joi compartido en `@kace/api-common` (`caseStaleSnapshotFields`), importado por ambos `schemas.mjs`. Los tests de schema de cada API se quedan como prueba de cableado.

`CanUpdateCase` sigue dentro de `CaseUpdater.execute` sobre el caso cargado de DB, **después** del strip y **antes** del CAS. No se modifica.

## OneScript

No depende de `@kace/core` ni de `@kace/error-codes`. Constantes hex locales que deben coincidir con el catálogo (test de contrato).

| Pieza | Cambio |
|---|---|
| `flatCaseToSubmissionCase` | `current_responsable_id` solo si la clave existía en el caso cargado (`null` = cargó sin responsable). El snapshot no cambia si el form edita `responsable_id`. |
| `CaseService.createCase` | Lee `response.data.data.warnings`, extrae `code`, devuelve `{ staleCodes: string[] }`. No lee `errors[]`. |
| Submit | Tras Swal de éxito, **un** Swal agrupado con los warnings conocidos. |
| 403 | Flujo de error de hoy. Sin cambio. |

## GeneralSetup (kace-saas)

Toggle `responsable_stale_check` (default **false**) junto a `transition_stale_check`. Serialize/deserialize en `helpers.js`. Un save del formulario envía la clave; si falta, rellena `false`.

kace-saas no mapea los códigos HTTP de stale.

## Testing (TDD)

Orden: test que falla → implementación mínima.

1. **`ResponsableStaleChecker.test.js`** — flag off (sin leer DB), caso missing + log, match, mismatch, ambos null, llama `getResponsableId(caseId)`, preload.
2. **`CaseStaleSnapshotEvaluator.test.js`** — `warnings` (no `errors`), transición stale (flag on/off), responsable stale (flag on/off), ambos, ninguno, snapshots para CAS, una sola query, `prepare`/`applyWriteOutcome`/`httpData`, no muta el input, no carga `getGlobalConfig` sin snapshots.
3. **`Behaviors — responsable_stale_check`** — default false si falta la clave; se puede encender; no toca siblings.
4. **`getStaleSnapshotFields` / `update*IfSnapshotMatches`** — match, mismatch, snapshot null, fila soft-deleted.
5. **`CaseUpdater.responsableCas.test.js`** — CAS vs bulk UPDATE para responsable y transición; 0 filas → `*StaleAtWrite`; sin snapshot → write de fila.
6. **OneScript** — `staleCodes` desde `response.data.data.warnings`; ignora `errors[]` y `transition_stale`.
7. **`Response` / `HttpResponse`** — `sanitizeErrors` conserva `{ code, message }` (otros flujos).
8. **GeneralSetup `helpers.test.js`** — mapeo y persistencia de `responsable_stale_check`.

## Archivos (mínimo)

| Área | Archivos |
|---|---|
| Códigos PR 1 | `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js` |
| Códigos develop | `packages/kace_cloud_error_codes/src/catalog/validation.js`, `tests/catalog.test.js` |
| Dominio | `ResponsableStaleChecker.js` + test; `TransitionStaleChecker.js` (preload) |
| App | `CaseStaleSnapshotEvaluator.js` + test; `CaseUpdater.js` (CAS) + test |
| Flag | `Behaviors.js`, `SettingsMother.js`, `GlobalConfigurationsUnitTest.test.js` |
| Repo | `KnexCaseRepository.js` (`getStaleSnapshotFields`, `update*IfSnapshotMatches`) + test |
| HTTP | `packages/kace_cloud_api_common/src/http_responses/Response.js` (`sanitizeErrors`, ya hecho); `caseStaleSnapshotFields.js` |
| API | `kace_cloud_api_cases` y `_cases_2` `controller.mjs` + `schemas.mjs` |
| OneScript | `buildInitialCaseData.js`, `caseService.js` (`extractStaleCodes`), `submit/index.js` + tests |
| SaaS | GeneralSetup schema, constants, helpers, form, locales |

## Checklist de aceptación

- [x] Responsable stale (flag on): no se pisa `responsable_id`; el resto se guarda; `0x030042` en `data.warnings`.
- [x] Transición stale (flag on): no se pisa `transicion_id`; `0x030041` en `data.warnings`; desaparece `transition_stale`.
- [x] Ambos stale: dos ítems, transición primero.
- [x] Flag de transición off: no hay código de transición aunque el snapshot no coincida.
- [x] Flag de responsable off: se escribe `responsable_id` como hoy; no hay warning; no hay CAS.
- [x] CAS 0 filas (cambio entre SELECT y write): resto persistido; código stale en `data.warnings`.
- [x] Sin snapshots: 200 sin `warnings`; no se carga `getGlobalConfig`.
- [x] No dueño y sin `CaseUpdateNotOwner`: 403; no se sustituye por código stale; el CAS no corre.
- [x] OneScript envía snapshot de carga, lee `data.warnings`, muestra warning agrupado.
- [x] Toggle GeneralSetup para `responsable_stale_check` (default false).
- [ ] Develop (#97): catálogo SSOT incluye los dos códigos cuando se porte.

## Next step

Cerrar #92 con este contrato. Portar a #97 solo cuando el usuario lo confirme.

