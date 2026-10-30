# Case Stale Responsable + Public Error Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al actualizar un caso, no pisar `responsable_id` ni `transicion_id` si el snapshot de carga está stale, y avisar con HTTP 200 + `data.warnings[]` usando `0x030041` / `0x030042`.

**Architecture:** `ResponsableStaleChecker` (dominio, boolean, gated por `responsable_stale_check`, default off) + `TransitionStaleChecker` (sigue gated por `transition_stale_check`) + `CaseStaleSnapshotEvaluator` (strip del payload y `warnings[]`) + CAS en `CaseUpdater` **solo cuando el valor pretendido difiere del actual**. Si OneScript reenvía el mismo `transicion_id` / `responsable_id`, el write sigue el UPDATE normal (no-op de `AggregateRoot.update`) y no dispara `STATE_CHANGE` ni toca `state_change_at` / `assignment_change_type`. Dos PRs atómicas: release (`ErrorCodes.js`) y cherry-pick sobre `feat/error-codes-ssot` (`@kace/error-codes`).

**Tech Stack:** Node.js ESM, Jest (`node --experimental-vm-modules`), Vitest (OneScript), Joi, Knex, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-13-case-stale-responsable-error-codes-design.md`

**Branch PR 1:** `feat/case-stale-responsable` (desde `origin/release/1.23.x`)

**Branch PR 2:** `feat/case-stale-responsable-ssot` (desde `origin/feat/error-codes-ssot`; se crea en Task 6)

## Global Constraints

- TDD: test rojo → implementación mínima → verde → commit. No implementar antes del rojo.
- Códigos: `CASE_TRANSITION_STALE = '0x030041'`, `CASE_RESPONSIBLE_STALE = '0x030042'`. Formato `0x` + 6 dígitos decimales. No reutilizar `0x030003`, `0x030005`, `0x030029`, `0x03002A`.
- Message genérico exacto: `An unexpected error occurred. Please contact support` (sin punto final). Core no importa `@kace/api-common`.
- Soft-save: persistir el resto; `delete` del campo stale. HTTP 200 + `data.warnings[]`. Se elimina `data.transition_stale`. Stale no va en `errors[]`.
- `CanUpdateCase` no se toca. 403 gana. Flags `responsable_stale_check` (default off) y `transition_stale_check`.
- CAS en `CaseUpdater` solo cuando el valor pretendido cambia. Toggle y copy en GeneralSetup (aplica a formularios OneScript).
- Conventional commits. Después de cada `git commit`, `git log -1 --format='%B'`. Si aparece `Co-authored-by: Cursor`, reescribir con `commit-tree` (no `git commit --amend`):

```bash
TREE=$(git rev-parse 'HEAD^{tree}')
PARENT=$(git rev-parse 'HEAD^')
NEW=$(git commit-tree "$TREE" -p "$PARENT" -m "$(cat <<'EOF'
mensaje limpio aquí
EOF
)")
git reset --soft "$NEW"
```

- No commitear `.atl/`, `code_review.md`, `docs/code-review/`.
- No añadir comentarios en código generado.

## File Map

| File | Responsibility |
|------|----------------|
| `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js` | Constantes `0x030041` / `0x030042` (PR 1) |
| `packages/kace_cloud_core/src/cases/domain/ResponsableStaleChecker.js` | Boolean stale de responsable; gated por `responsable_stale_check` |
| `packages/kace_cloud_core/tests/cases/ResponsableStaleChecker.test.js` | Tests del checker |
| `packages/kace_cloud_core/src/cases/application/CaseStaleSnapshotEvaluator.js` | Strip + `warnings[]` |
| `packages/kace_cloud_core/tests/cases/CaseStaleSnapshotEvaluator.test.js` | Tests del evaluator |
| `packages/kace_cloud_core/src/cases/infrastructure/persistence/KnexCaseRepository.js` | `getResponsableId` + CAS `update*IfSnapshotMatches` |
| `packages/kace_cloud_api_common/src/http_responses/Response.js` | Sin cambio: stale viaja en `data.warnings`, no en `errors[]` |
| `packages/kace_cloud_api_common/tests/http_responses/Response.test.js` | Sin tests de `sanitizeErrors` para códigos stale |
| `apps/apiv1/kace_cloud_api_cases/src/schemas.mjs` | `current_responsable_id` |
| `apps/apiv1/kace_cloud_api_cases_2/src/schemas.mjs` | `current_responsable_id` |
| `apps/apiv1/kace_cloud_api_cases/src/controller.mjs` | Llama evaluator; `warnings[]` en 200 |
| `apps/apiv1/kace_cloud_api_cases_2/src/controller.mjs` | Igual |
| `apps/apiv1/kace_cloud_api_cases/test/schemaUpdateStaleSnapshots.test.mjs` | Joi snapshots |
| `apps/apiv1/kace_cloud_api_cases_2/test/schemaUpdateStaleSnapshots.test.mjs` | Joi snapshots |
| `apps/onescript_plugin_kace/src/plugins/kace/components/auth/buildInitialCaseData.js` | Snapshot `current_responsable_id` |
| `apps/onescript_plugin_kace/src/plugins/kace/services/caseService.js` | `staleCodes` + warnings |
| `apps/onescript_plugin_kace/src/plugins/kace/components/submit/index.js` | Swal por código |
| `packages/kace_cloud_error_codes/src/catalog/validation.js` | Códigos en PR 2 |
| `packages/kace_cloud_error_codes/tests/catalog.test.js` | `EXPECTED_PUBLIC_ERROR_CODES` en PR 2 |

---

### Task 1: ResponsableStaleChecker

**Files:**
- Create: `packages/kace_cloud_core/tests/cases/ResponsableStaleChecker.test.js`
- Create: `packages/kace_cloud_core/src/cases/domain/ResponsableStaleChecker.js`

**Interfaces:**
- Consumes: repository with `getResponsableId(caseId) → Promise<string|null|undefined>`
- Produces: `ResponsableStaleChecker.check(repository, caseId, currentResponsableId) → Promise<boolean>` — no `globalConfig`, no flag

- [ ] **Step 1: Write the failing test**

Crear `packages/kace_cloud_core/tests/cases/ResponsableStaleChecker.test.js`:

```js
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/shared/index.js', () => ({
    Helper: { logInfo: jest.fn() },
}));

const { ResponsableStaleChecker } = await import('../../src/cases/domain/ResponsableStaleChecker.js');
const { Helper } = await import('../../src/shared/index.js');

function makeRepository(dbResponsableId) {
    return {
        getResponsableId: jest.fn().mockResolvedValue(dbResponsableId),
    };
}

describe('ResponsableStaleChecker.check', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns false when case row is not found and logs a warning', async () => {
        const repo = makeRepository(undefined);

        const result = await ResponsableStaleChecker.check(repo, 'case-1', '123');

        expect(result).toBe(false);
        expect(Helper.logInfo).toHaveBeenCalledWith(
            'Stale responsable check: case case-1 not found in DB, skipping.'
        );
    });

    it('returns false when DB responsable matches the snapshot', async () => {
        const repo = makeRepository('123');

        const result = await ResponsableStaleChecker.check(repo, 'case-1', '123');

        expect(result).toBe(false);
    });

    it('returns true when DB responsable differs from the snapshot', async () => {
        const repo = makeRepository('456');

        const result = await ResponsableStaleChecker.check(repo, 'case-1', '123');

        expect(result).toBe(true);
    });

    it('returns true when DB is a uuid and snapshot is null', async () => {
        const repo = makeRepository('456');

        const result = await ResponsableStaleChecker.check(repo, 'case-1', null);

        expect(result).toBe(true);
    });

    it('returns false when both DB and snapshot responsable are null', async () => {
        const repo = makeRepository(null);

        const result = await ResponsableStaleChecker.check(repo, 'case-1', null);

        expect(result).toBe(false);
    });

    it('delegates to repository.getResponsableId with the case id', async () => {
        const repo = makeRepository('456');

        await ResponsableStaleChecker.check(repo, 'case-99', '123');

        expect(repo.getResponsableId).toHaveBeenCalledWith('case-99');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @kace/core exec node --experimental-vm-modules node_modules/jest/bin/jest.js tests/cases/ResponsableStaleChecker.test.js --detectOpenHandles --forceExit --bail
```

Expected: FAIL — `Cannot find module` `ResponsableStaleChecker.js`

- [ ] **Step 3: Write minimal implementation**

Crear `packages/kace_cloud_core/src/cases/domain/ResponsableStaleChecker.js`:

```js
import { Helper } from '../../shared/index.js';

export class ResponsableStaleChecker {
    /**
     * @param {object} repository - Case repository with getResponsableId(caseId)
     * @param {string} caseId
     * @param {string|null} currentResponsableId
     * @returns {Promise<boolean>}
     */
    static async check(repository, caseId, currentResponsableId) {
        const dbResponsableId = await repository.getResponsableId(caseId);

        if (dbResponsableId === undefined) {
            Helper.logInfo(`Stale responsable check: case ${caseId} not found in DB, skipping.`);
            return false;
        }

        return dbResponsableId !== currentResponsableId;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run the same command as Step 2.

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_core/tests/cases/ResponsableStaleChecker.test.js packages/kace_cloud_core/src/cases/domain/ResponsableStaleChecker.js
git commit -m "$(cat <<'EOF'
feat(cases): detect stale responsable snapshot on case update

EOF
)"
git log -1 --format='%B'
```

---

### Task 2: Error codes + CaseStaleSnapshotEvaluator

**Files:**
- Modify: `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js` (append after `AUTH_SESSION_COOKIE_STALE`)
- Create: `packages/kace_cloud_core/tests/cases/CaseStaleSnapshotEvaluator.test.js`
- Create: `packages/kace_cloud_core/src/cases/application/CaseStaleSnapshotEvaluator.js`

**Interfaces:**
- Consumes: `ResponsableStaleChecker.check(repository, caseId, currentResponsableId)`, `TransitionStaleChecker.check(repository, globalConfig, caseId, currentTransicionId)`, `CASE_TRANSITION_STALE`, `CASE_RESPONSIBLE_STALE`
- Produces: `CaseStaleSnapshotEvaluator.execute({ repository, globalConfig, caseId, caseValue }) → Promise<{ code: string, message: string }[]>` — mutates `caseValue` in place

- [ ] **Step 1: Write the failing test**

Crear `packages/kace_cloud_core/tests/cases/CaseStaleSnapshotEvaluator.test.js`:

```js
import { jest } from '@jest/globals';

const { CaseStaleSnapshotEvaluator } = await import(
    '../../src/cases/application/CaseStaleSnapshotEvaluator.js'
);
const { CASE_TRANSITION_STALE, CASE_RESPONSIBLE_STALE } = await import(
    '../../src/shared/errors/ErrorCodes.js'
);

const GENERIC = 'An unexpected error occurred. Please contact support';

function makeRepository({ transicionId, responsableId }) {
    return {
        getTransitionId: jest.fn().mockResolvedValue(transicionId),
        getResponsableId: jest.fn().mockResolvedValue(responsableId),
    };
}

function makeGlobalConfig({ enabled }) {
    return {
        settings: {
            behaviors: {
                getConfig: jest.fn().mockReturnValue({ transition_stale_check: enabled }),
            },
        },
    };
}

describe('CaseStaleSnapshotEvaluator.execute', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns [] and does not require config when no snapshots are present', async () => {
        const caseValue = { transicion_id: 't1', responsable_id: 'r1' };

        const errors = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't2', responsableId: 'r2' }),
            caseId: 'case-1',
            caseValue,
        });

        expect(errors).toEqual([]);
        expect(caseValue.transicion_id).toBe('t1');
        expect(caseValue.responsable_id).toBe('r1');
    });

    it('strips transicion_id and returns CASE_TRANSITION_STALE when transition is stale and flag is on', async () => {
        const caseValue = {
            transicion_id: 't-form',
            current_transicion_id: 't-load',
            responsable_id: 'r1',
        };

        const errors = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't-db', responsableId: 'r1' }),
            globalConfig: makeGlobalConfig({ enabled: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(errors).toEqual([{ code: CASE_TRANSITION_STALE, message: GENERIC }]);
        expect(caseValue.transicion_id).toBeUndefined();
        expect(caseValue.current_transicion_id).toBeUndefined();
        expect(caseValue.responsable_id).toBe('r1');
    });

    it('does not strip transicion_id when transition_stale_check is off', async () => {
        const caseValue = {
            transicion_id: 't-form',
            current_transicion_id: 't-load',
        };

        const errors = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't-db', responsableId: 'r1' }),
            globalConfig: makeGlobalConfig({ enabled: false }),
            caseId: 'case-1',
            caseValue,
        });

        expect(errors).toEqual([]);
        expect(caseValue.transicion_id).toBe('t-form');
        expect(caseValue.current_transicion_id).toBeUndefined();
    });

    it('strips responsable_id and returns CASE_RESPONSIBLE_STALE when responsable is stale', async () => {
        const caseValue = {
            responsable_id: 'r-form',
            current_responsable_id: 'r-load',
        };

        const errors = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't1', responsableId: 'r-db' }),
            caseId: 'case-1',
            caseValue,
        });

        expect(errors).toEqual([{ code: CASE_RESPONSIBLE_STALE, message: GENERIC }]);
        expect(caseValue.responsable_id).toBeUndefined();
        expect(caseValue.current_responsable_id).toBeUndefined();
    });

    it('returns transition then responsable when both snapshots are stale', async () => {
        const caseValue = {
            transicion_id: 't-form',
            current_transicion_id: 't-load',
            responsable_id: 'r-form',
            current_responsable_id: 'r-load',
        };

        const errors = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't-db', responsableId: 'r-db' }),
            globalConfig: makeGlobalConfig({ enabled: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(errors).toEqual([
            { code: CASE_TRANSITION_STALE, message: GENERIC },
            { code: CASE_RESPONSIBLE_STALE, message: GENERIC },
        ]);
        expect(caseValue.transicion_id).toBeUndefined();
        expect(caseValue.responsable_id).toBeUndefined();
        expect(caseValue.current_transicion_id).toBeUndefined();
        expect(caseValue.current_responsable_id).toBeUndefined();
    });

    it('always deletes snapshot fields even when values match DB', async () => {
        const caseValue = {
            transicion_id: 't1',
            current_transicion_id: 't1',
            responsable_id: 'r1',
            current_responsable_id: 'r1',
        };

        const errors = await CaseStaleSnapshotEvaluator.execute({
            repository: makeRepository({ transicionId: 't1', responsableId: 'r1' }),
            globalConfig: makeGlobalConfig({ enabled: true }),
            caseId: 'case-1',
            caseValue,
        });

        expect(errors).toEqual([]);
        expect(caseValue.transicion_id).toBe('t1');
        expect(caseValue.responsable_id).toBe('r1');
        expect(caseValue.current_transicion_id).toBeUndefined();
        expect(caseValue.current_responsable_id).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @kace/core exec node --experimental-vm-modules node_modules/jest/bin/jest.js tests/cases/CaseStaleSnapshotEvaluator.test.js --detectOpenHandles --forceExit --bail
```

Expected: FAIL — `Cannot find module` `CaseStaleSnapshotEvaluator.js` (o `CASE_TRANSITION_STALE` is not exported)

- [ ] **Step 3: Write minimal implementation**

Append to `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js` after `AUTH_SESSION_COOKIE_STALE`:

```js
export const CASE_TRANSITION_STALE = '0x030041';
export const CASE_RESPONSIBLE_STALE = '0x030042';
```

Crear `packages/kace_cloud_core/src/cases/application/CaseStaleSnapshotEvaluator.js`:

```js
import { TransitionStaleChecker } from '../../transition-rules/domain/TransitionStaleChecker.js';
import { ResponsableStaleChecker } from '../domain/ResponsableStaleChecker.js';
import { CASE_TRANSITION_STALE, CASE_RESPONSIBLE_STALE } from '../../shared/errors/ErrorCodes.js';

const GENERIC = 'An unexpected error occurred. Please contact support';

export class CaseStaleSnapshotEvaluator {
    /**
     * @param {object} params
     * @param {object} params.repository
     * @param {object} [params.globalConfig]
     * @param {string} params.caseId
     * @param {object} params.caseValue
     * @returns {Promise<{ code: string, message: string }[]>}
     */
    static async execute({ repository, globalConfig, caseId, caseValue }) {
        const errors = [];

        if (caseValue.current_transicion_id !== undefined) {
            const transitionStale = await TransitionStaleChecker.check(
                repository,
                globalConfig,
                caseId,
                caseValue.current_transicion_id
            );
            if (transitionStale) {
                delete caseValue.transicion_id;
                errors.push({ code: CASE_TRANSITION_STALE, message: GENERIC });
            }
        }

        if (caseValue.current_responsable_id !== undefined) {
            const responsableStale = await ResponsableStaleChecker.check(
                repository,
                caseId,
                caseValue.current_responsable_id
            );
            if (responsableStale) {
                delete caseValue.responsable_id;
                errors.push({ code: CASE_RESPONSIBLE_STALE, message: GENERIC });
            }
        }

        delete caseValue.current_transicion_id;
        delete caseValue.current_responsable_id;

        return errors;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run the same command as Step 2.

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_core/src/shared/errors/ErrorCodes.js packages/kace_cloud_core/src/cases/application/CaseStaleSnapshotEvaluator.js packages/kace_cloud_core/tests/cases/CaseStaleSnapshotEvaluator.test.js
git commit -m "$(cat <<'EOF'
feat(cases): map stale snapshots to public error codes

EOF
)"
git log -1 --format='%B'
```

---

### Task 3: sanitizeErrors preserves `{ code, message }`

**Files:**
- Modify: `packages/kace_cloud_api_common/src/http_responses/Response.js` (`sanitizeErrors`, objeto con `code`)
- Modify: `packages/kace_cloud_api_common/tests/http_responses/Response.test.js` (append tests)

**Interfaces:**
- Consumes: `errors` array items that may have `code` and `message`
- Produces: `toJson()` body `errors[]` as `{ code, message }` without `field` when `code` is present; `{ field, message }` unchanged for validation items

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe('Response', …)` in `packages/kace_cloud_api_common/tests/http_responses/Response.test.js`:

```js
    it('preserves code and message on stale error items and does not invent field', () => {
        const response = new Response({
            event: EventExamples.getIdEvent(),
            errors: [
                {
                    code: '0x030041',
                    message: 'An unexpected error occurred. Please contact support',
                },
            ],
        });

        const body = JSON.parse(response.toJson().body);

        expect(body.errors).toEqual([
            {
                code: '0x030041',
                message: 'An unexpected error occurred. Please contact support',
            },
        ]);
        expect(body.errors[0].field).toBeUndefined();
    });

    it('still serializes validation items as field and message', () => {
        const response = new Response({
            event: EventExamples.getIdEvent(),
            errors: [{ field: 'responsable_id', message: 'is required' }],
        });

        const body = JSON.parse(response.toJson().body);

        expect(body.errors).toEqual([{ field: 'responsable_id', message: 'is required' }]);
    });
```

`EventExamples` ya está importado en ese archivo.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @kace/api-common exec node --experimental-vm-modules node_modules/jest/bin/jest.js tests/http_responses/Response.test.js --detectOpenHandles --forceExit --bail
```

Expected: FAIL — `body.errors[0]` tiene `field: 'unknown'` y no tiene `code`

- [ ] **Step 3: Write minimal implementation**

En `packages/kace_cloud_api_common/src/http_responses/Response.js`, reemplazar el branch `if (typeof err === 'object')` dentro de `sanitizeErrors` por:

```js
                    if (typeof err === 'object') {
                        if (err.code) {
                            return {
                                code: err.code,
                                message: containsSensitiveData(err.message)
                                    ? SAFE_MESSAGES.DEFAULT
                                    : err.message,
                            };
                        }
                        return {
                            field: err.field ?? 'unknown',
                            message: containsSensitiveData(err.message) ? SAFE_MESSAGES.DEFAULT : err.message,
                        };
                    }
```

No cambiar el branch de Joi ni el de string.

- [ ] **Step 4: Run test to verify it passes**

Run the same command as Step 2.

Expected: PASS (todos los tests de `Response.test.js`, incluidos los dos nuevos)

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_api_common/src/http_responses/Response.js packages/kace_cloud_api_common/tests/http_responses/Response.test.js
git commit -m "$(cat <<'EOF'
fix(api-common): keep public error code when sanitizing response errors

EOF
)"
git log -1 --format='%B'
```

---

### Task 4: Repo, schemas, controllers

**Files:**
- Modify: `packages/kace_cloud_core/src/cases/infrastructure/persistence/KnexCaseRepository.js` (después de `getTransitionId`)
- Modify: `apps/apiv1/kace_cloud_api_cases/src/schemas.mjs` (`schemaUpdate`)
- Modify: `apps/apiv1/kace_cloud_api_cases_2/src/schemas.mjs` (`schemaUpdate`)
- Modify: `apps/apiv1/kace_cloud_api_cases/src/controller.mjs`
- Modify: `apps/apiv1/kace_cloud_api_cases_2/src/controller.mjs`
- Create: `apps/apiv1/kace_cloud_api_cases/test/schemaUpdateStaleSnapshots.test.mjs`
- Create: `apps/apiv1/kace_cloud_api_cases_2/test/schemaUpdateStaleSnapshots.test.mjs`

**Interfaces:**
- Consumes: `CaseStaleSnapshotEvaluator.execute({ repository, globalConfig, caseId, caseValue })`
- Produces: `KnexCaseRepository.getResponsableId(caseId) → Promise<string|null|undefined>`; Joi `current_responsable_id`; HTTP 200 `errors` en vez de `data.transition_stale`

- [ ] **Step 1: Write the failing schema tests**

Crear el mismo archivo en ambos paquetes (`@kace/api-cases` y `@kace/api-cases2`).

`apps/apiv1/kace_cloud_api_cases/test/schemaUpdateStaleSnapshots.test.mjs`:

```js
import { describe, expect, it } from '@jest/globals';
import { schemaUpdate } from '../src/schemas.mjs';

describe('schemaUpdate stale snapshots', () => {
    it('accepts current_responsable_id as uuid', () => {
        const { error, value } = schemaUpdate.validate({
            current_responsable_id: '11111111-1111-1111-1111-111111111111',
        });
        expect(error).toBeUndefined();
        expect(value.current_responsable_id).toBe('11111111-1111-1111-1111-111111111111');
    });

    it('accepts current_responsable_id null', () => {
        const { error, value } = schemaUpdate.validate({ current_responsable_id: null });
        expect(error).toBeUndefined();
        expect(value.current_responsable_id).toBeNull();
    });

    it('rejects current_responsable_id that is not a uuid', () => {
        const { error } = schemaUpdate.validate({ current_responsable_id: 'not-a-uuid' });
        expect(error).toBeDefined();
    });

    it('still accepts current_transicion_id', () => {
        const { error, value } = schemaUpdate.validate({
            current_transicion_id: '22222222-2222-2222-2222-222222222222',
        });
        expect(error).toBeUndefined();
        expect(value.current_transicion_id).toBe('22222222-2222-2222-2222-222222222222');
    });
});
```

Copiar idéntico a `apps/apiv1/kace_cloud_api_cases_2/test/schemaUpdateStaleSnapshots.test.mjs` (el import `../src/schemas.mjs` es el mismo relativo).

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @kace/api-cases exec node --experimental-vm-modules node_modules/jest/bin/jest.js test/schemaUpdateStaleSnapshots.test.mjs --detectOpenHandles --forceExit --bail
pnpm --filter @kace/api-cases2 exec node --experimental-vm-modules node_modules/jest/bin/jest.js test/schemaUpdateStaleSnapshots.test.mjs --detectOpenHandles --forceExit --bail
```

Expected: FAIL — `"current_responsable_id" is not allowed`

- [ ] **Step 3: Implement schemas, getResponsableId, controllers**

En ambos `schemas.mjs`, dentro de `schemaUpdate`, al lado de `current_transicion_id`:

```js
    current_transicion_id: Joi.string().uuid().allow(null).optional(),
    current_responsable_id: Joi.string().uuid().allow(null).optional(),
```

En `KnexCaseRepository.js`, inmediatamente después de `getTransitionId` (termina ~línea 1885):

```js
    /**
     * @param {string} caseId
     * @returns {Promise<string|null|undefined>} `undefined` when the case does not exist
     */
    async getResponsableId(caseId) {
        try {
            const row = await this.table().select('responsable_id').where({ id: caseId }).first();
            if (!row) {
                return undefined;
            }
            return row.responsable_id ?? null;
        } catch (error) {
            Helper.logError('Error getting case responsable id', error);
            throw new QueryDBError('find');
        }
    }
```

En **ambos** controllers:

Reemplazar el import:

```js
import { TransitionStaleChecker } from '@kace/core/src/transition-rules/domain/TransitionStaleChecker.js';
```

por:

```js
import { CaseStaleSnapshotEvaluator } from '@kace/core/src/cases/application/CaseStaleSnapshotEvaluator.js';
```

Reemplazar el bloque stale (~líneas 958–969) por:

```js
            const hasTransitionSnapshot = caseValue.current_transicion_id !== undefined;
            const hasResponsableSnapshot = caseValue.current_responsable_id !== undefined;
            let staleErrors = [];
            if (hasTransitionSnapshot || hasResponsableSnapshot) {
                const globalConfig = hasTransitionSnapshot ? await this.getGlobalConfig() : undefined;
                staleErrors = await CaseStaleSnapshotEvaluator.execute({
                    repository: this.repository,
                    globalConfig,
                    caseId: id,
                    caseValue,
                });
            }
```

Reemplazar el `HttpResponse.ok` del final de `actionUpdateWithAux`:

```js
            return HttpResponse.ok({
                errors: staleErrors.length ? staleErrors : undefined,
                event: this.event,
            });
```

No tocar `CanUpdateCase` ni `CaseUpdater`.

- [ ] **Step 4: Run schema tests to verify they pass**

Run the same two commands as Step 2.

Expected: PASS (4 tests cada uno)

También re-correr:

```bash
pnpm --filter @kace/core exec node --experimental-vm-modules node_modules/jest/bin/jest.js tests/cases/ResponsableStaleChecker.test.js tests/cases/CaseStaleSnapshotEvaluator.test.js --detectOpenHandles --forceExit --bail
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_core/src/cases/infrastructure/persistence/KnexCaseRepository.js apps/apiv1/kace_cloud_api_cases/src/schemas.mjs apps/apiv1/kace_cloud_api_cases_2/src/schemas.mjs apps/apiv1/kace_cloud_api_cases/src/controller.mjs apps/apiv1/kace_cloud_api_cases_2/src/controller.mjs apps/apiv1/kace_cloud_api_cases/test/schemaUpdateStaleSnapshots.test.mjs apps/apiv1/kace_cloud_api_cases_2/test/schemaUpdateStaleSnapshots.test.mjs
git commit -m "$(cat <<'EOF'
feat(cases): wire stale snapshot evaluator into case update

EOF
)"
git log -1 --format='%B'
```

---

### Task 5: OneScript snapshot, staleCodes, warnings

**Files:**
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/auth/buildInitialCaseData.js`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/auth/buildInitialCaseData.test.js`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/services/caseService.js`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/services/caseService.test.js`
- Modify: `apps/onescript_plugin_kace/src/plugins/kace/components/submit/index.js`

**Interfaces:**
- Consumes: envelope `response.data.errors[].code`
- Produces: `flatCaseToSubmissionCase` incluye `current_responsable_id`; `CaseService.createCase` → `{ staleCodes: string[] }`; `extractStaleCodes(response)`; `STALE_CODE_WARNINGS`; submit dispara un Swal por código

- [ ] **Step 1: Write the failing tests**

En `buildInitialCaseData.test.js`, añadir:

```js
  it('copies responsable_id to current_responsable_id at load time', () => {
    const flat = { responsable_id: 'user-123', id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    expect(result.current_responsable_id).toBe('user-123');
    expect(result.responsable_id).toBe('user-123');
  });

  it('sets current_responsable_id to null when responsable_id is absent', () => {
    const flat = { id: 'case-001' };
    const result = flatCaseToSubmissionCase(flat, {
      ...baseCtx,
      payload: { client_id: 'client-001' },
    });
    expect(result.current_responsable_id).toBeNull();
  });

  it('current_responsable_id reflects original value independently of responsable_id mutation', () => {
    const flat = { responsable_id: 'user-123' };
    const result = flatCaseToSubmissionCase(flat, baseCtx);
    result.responsable_id = 'user-999';
    expect(result.current_responsable_id).toBe('user-123');
  });
```

En `caseService.test.js`:

1. Cambiar el import a:

```js
import {
  CaseService,
  TRANSITION_STALE_WARNING,
  RESPONSIBLE_STALE_WARNING,
  CASE_TRANSITION_STALE,
  CASE_RESPONSIBLE_STALE,
  extractStaleCodes,
} from './caseService.js';
```

2. Reemplazar el bloque `describe('CaseService.createCase'` (no el de `finishTimerAfterSubmit`) por:

```js
describe('extractStaleCodes', () => {
  it('reads codes from envelope response.data.errors', () => {
    expect(
      extractStaleCodes({
        data: {
          errors: [{ code: '0x030041', message: 'An unexpected error occurred. Please contact support' }],
        },
      })
    ).toEqual(['0x030041']);
  });

  it('ignores transition_stale on data.data', () => {
    expect(
      extractStaleCodes({
        data: {
          data: { transition_stale: true },
        },
      })
    ).toEqual([]);
  });

  it('returns [] when errors is missing', () => {
    expect(extractStaleCodes({ data: { data: { id: '789' } } })).toEqual([]);
  });

  it('keeps only known stale codes in listed order', () => {
    expect(
      extractStaleCodes({
        data: {
          errors: [
            { code: '0x030041' },
            { code: '0x030003' },
            { code: '0x030042' },
          ],
        },
      })
    ).toEqual(['0x030041', '0x030042']);
  });
});

describe('RESPONSIBLE_STALE_WARNING', () => {
  it('is a non-empty Spanish string', () => {
    expect(typeof RESPONSIBLE_STALE_WARNING).toBe('string');
    expect(RESPONSIBLE_STALE_WARNING.length).toBeGreaterThan(0);
    expect(RESPONSIBLE_STALE_WARNING).toMatch(/responsable|guardaron|edición/);
  });
});

describe('CaseService.createCase', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CaseService({
      apiService: {},
      store: {},
    });
    service.submitCaseData = vi.fn();
    service.storeService = { get: vi.fn(), set: vi.fn() };
  });

  it('returns staleCodes from envelope errors', async () => {
    service.submitCaseData.mockResolvedValueOnce({
      data: {
        errors: [{ code: CASE_TRANSITION_STALE }, { code: CASE_RESPONSIBLE_STALE }],
      },
    });

    const result = await service.createCase({
      caseData: { case: { id: '123' } },
      description: 'test',
    });

    expect(result).toEqual({
      staleCodes: [CASE_TRANSITION_STALE, CASE_RESPONSIBLE_STALE],
    });
  });

  it('returns empty staleCodes when response has no errors', async () => {
    service.submitCaseData.mockResolvedValueOnce({
      data: {
        data: { id: '789' },
      },
    });

    const result = await service.createCase({
      caseData: { case: { id: '789' } },
      description: 'test',
    });

    expect(result).toEqual({ staleCodes: [] });
  });

  it('sets cases.case_id in the store when caseData.case.id exists', async () => {
    const caseData = { case: { id: 'abc' } };
    service.submitCaseData.mockResolvedValueOnce({ data: {} });

    await service.createCase({
      caseData,
      description: 'test',
    });

    expect(service.storeService.set).toHaveBeenCalledWith(
      'cases.case_id',
      'abc'
    );
    expect(removeKeysFromSubmissionData).toHaveBeenCalledWith(caseData);
  });

  it('propagates errors from submitCaseData', async () => {
    service.submitCaseData.mockRejectedValue(new Error('Network error'));
    await expect(
      service.createCase({ caseData: { case: {} }, description: 'test' })
    ).rejects.toThrow('Network error');
  });
});
```

Dejar intactos `describe('TRANSITION_STALE_WARNING'` y `describe('CaseService.finishTimerAfterSubmit'`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter onescript-plugin-tutorial exec vitest run src/plugins/kace/components/auth/buildInitialCaseData.test.js src/plugins/kace/services/caseService.test.js
```

Expected: FAIL — `current_responsable_id` undefined; `extractStaleCodes` / `CASE_TRANSITION_STALE` not exported; `createCase` still returns `{ transitionStale }`

- [ ] **Step 3: Write minimal implementation**

En `flatCaseToSubmissionCase`, al lado de `current_transicion_id`:

```js
    current_transicion_id: flat.transicion_id ?? null,
    current_responsable_id: flat.responsable_id ?? null,
```

Cuando `responsable_id` está ausente, `flat.responsable_id ?? null` es `null` aunque `payload.user_id` llene `responsable_id`. Eso es correcto: el snapshot es el valor de carga del caso, no el fallback del usuario. Si `flat.responsable_id` falta, snapshot `null`.

En `caseService.js`, reemplazar el export de `TRANSITION_STALE_WARNING` y el método `createCase` por:

```js
export const CASE_TRANSITION_STALE = '0x030041';
export const CASE_RESPONSIBLE_STALE = '0x030042';

export const TRANSITION_STALE_WARNING =
  'El estado del caso fue actualizado automáticamente durante la edición. Se guardaron los demás cambios, pero el estado no fue modificado.';

export const RESPONSIBLE_STALE_WARNING =
  'El responsable del caso fue actualizado automáticamente durante la edición. Se guardaron los demás cambios, pero el responsable no fue modificado.';

export const STALE_CODE_WARNINGS = {
  [CASE_TRANSITION_STALE]: TRANSITION_STALE_WARNING,
  [CASE_RESPONSIBLE_STALE]: RESPONSIBLE_STALE_WARNING,
};

export function extractStaleCodes(response) {
  const errors = response?.data?.errors;
  if (!Array.isArray(errors)) return [];
  const known = new Set(Object.keys(STALE_CODE_WARNINGS));
  return errors.map((err) => err?.code).filter((code) => known.has(code));
}
```

Y el método:

```js
  /**
   * @returns {Promise<{ staleCodes: string[] }>}
   */
  async createCase({ caseData, description }) {
    try {
      removeKeysFromSubmissionData(caseData);
      const response = await this.submitCaseData({ caseData, description });
      if (caseData.case?.id) {
        this.storeService.set('cases.case_id', caseData.case.id);
      }
      return { staleCodes: extractStaleCodes(response) };
    } catch (error) {
      throw new Error(error.message);
    }
  }
```

En `submit/index.js`, cambiar el import:

```js
import {
  STALE_CODE_WARNINGS,
} from '../../services/caseService';
```

Reemplazar el uso de `transitionStale`:

```js
      const { staleCodes } = await caseService.createCase({
        caseData: this.root.submission.data.case_data ?? {},
        description,
      });
```

Y el Swal posterior al de éxito:

```js
      for (const code of staleCodes) {
        const text = STALE_CODE_WARNINGS[code];
        if (text) {
          await Swal.fire({
            icon: 'warning',
            text,
          });
        }
      }
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same command as Step 2.

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/onescript_plugin_kace/src/plugins/kace/components/auth/buildInitialCaseData.js apps/onescript_plugin_kace/src/plugins/kace/components/auth/buildInitialCaseData.test.js apps/onescript_plugin_kace/src/plugins/kace/services/caseService.js apps/onescript_plugin_kace/src/plugins/kace/services/caseService.test.js apps/onescript_plugin_kace/src/plugins/kace/components/submit/index.js
git commit -m "$(cat <<'EOF'
feat(onescript): warn on stale transition and responsable error codes

EOF
)"
git log -1 --format='%B'
```

---

### Task 6: PR 2 cherry-pick onto feat/error-codes-ssot

**Files:**
- Create branch: `feat/case-stale-responsable-ssot` from `origin/feat/error-codes-ssot`
- Cherry-pick commits de `feat/case-stale-responsable` que no estén en esa base
- Modify on conflict: evaluator import `ErrorCodes.js` → `@kace/error-codes`
- Modify: `packages/kace_cloud_error_codes/src/catalog/validation.js`
- Modify: `packages/kace_cloud_error_codes/tests/catalog.test.js`
- Drop: cambios a `packages/kace_cloud_core/src/shared/errors/ErrorCodes.js` (el archivo no existe en SSOT)

**Interfaces:**
- Consumes: mismos nombres `CASE_TRANSITION_STALE` / `CASE_RESPONSIBLE_STALE` y valores `0x030041` / `0x030042`
- Produces: catálogo SSOT con sufijos consecutivos 041 y 042; evaluator importa `@kace/error-codes`

Hacer este task en un worktree o checkout limpio. No mezclar el working tree de PR 1.

- [ ] **Step 1: Create branch and cherry-pick**

```bash
git fetch origin feat/error-codes-ssot
git checkout -b feat/case-stale-responsable-ssot origin/feat/error-codes-ssot
git log --oneline origin/release/1.23.x..feat/case-stale-responsable
```

Cherry-pick esos commits en orden (incluye la spec). El commit de Task 2 toca `ErrorCodes.js` (borrado en SSOT) y el evaluator a la vez. Al resolver:

1. `git rm -f packages/kace_cloud_core/src/shared/errors/ErrorCodes.js` si git lo reaparece.
2. En `CaseStaleSnapshotEvaluator.js` dejar el resto del archivo y cambiar el import a:

```js
import { CASE_TRANSITION_STALE, CASE_RESPONSIBLE_STALE } from '@kace/error-codes';
```

3. `git add` el evaluator y `git cherry-pick --continue`.
4. Los códigos viven en Task 6 Steps 2–4 (`validation.js` + `catalog.test.js`), no en `ErrorCodes.js`.

- [ ] **Step 2: Write the failing catalog test**

En `packages/kace_cloud_error_codes/tests/catalog.test.js`, dentro de `EXPECTED_PUBLIC_ERROR_CODES`, inmediatamente después de `BROKER_MAPPER_VALIDATION_FAILED: '0x030040',`:

```js
    CASE_TRANSITION_STALE: '0x030041',
    CASE_RESPONSIBLE_STALE: '0x030042',
```

- [ ] **Step 3: Run catalog test to verify it fails**

Run:

```bash
pnpm --filter @kace/error-codes test
```

Expected: FAIL — `PUBLIC_ERROR_CODES` no iguala `EXPECTED` (faltan las dos claves)

- [ ] **Step 4: Add catalog literals**

Al final de `packages/kace_cloud_error_codes/src/catalog/validation.js`:

```js
export const CASE_TRANSITION_STALE = '0x030041';
export const CASE_RESPONSIBLE_STALE = '0x030042';
```

El barrel `export * from './src/catalog/validation.js'` los reexporta. No tocar `index.js`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @kace/error-codes test
pnpm --filter @kace/core exec node --experimental-vm-modules node_modules/jest/bin/jest.js tests/cases/ResponsableStaleChecker.test.js tests/cases/CaseStaleSnapshotEvaluator.test.js --detectOpenHandles --forceExit --bail
pnpm --filter @kace/api-common exec node --experimental-vm-modules node_modules/jest/bin/jest.js tests/http_responses/Response.test.js --detectOpenHandles --forceExit --bail
pnpm --filter onescript-plugin-tutorial exec vitest run src/plugins/kace/components/auth/buildInitialCaseData.test.js src/plugins/kace/services/caseService.test.js
```

Expected: PASS. El invariante `assigns consecutive suffixes per category prefix` queda en 1..42 para validación.

- [ ] **Step 6: Commit leftover SSOT-only changes**

Si el catálogo / import no quedó en un cherry-pick limpio:

```bash
git add packages/kace_cloud_error_codes/src/catalog/validation.js packages/kace_cloud_error_codes/tests/catalog.test.js packages/kace_cloud_core/src/cases/application/CaseStaleSnapshotEvaluator.js
git commit -m "$(cat <<'EOF'
feat(error-codes): add CASE_TRANSITION_STALE and CASE_RESPONSIBLE_STALE

EOF
)"
git log -1 --format='%B'
```

No commitear sobre `feat/error-codes-ssot` (ensuciaría PR #90). La rama es `feat/case-stale-responsable-ssot`.

---

### Task 7: Open the two atomic PRs

**Files:** none (git/gh)

- [ ] **Step 1: Push PR 1**

Desde `feat/case-stale-responsable`:

```bash
git push -u origin HEAD
gh pr create --base release/1.23.x --head feat/case-stale-responsable --title "feat(cases): stale responsable check with public error codes" --body "$(cat <<'EOF'
## Summary
- Soft-save on case update when load-time `responsable_id` / `transicion_id` snapshots are stale.
- HTTP 200 `errors[]` with `CASE_TRANSITION_STALE` (`0x030041`) and `CASE_RESPONSIBLE_STALE` (`0x030042`). Drops `transition_stale`.
- OneScript sends `current_responsable_id` and shows per-code warnings.

## Chain
```
origin/release/1.23.x
        └── feat/case-stale-responsable   📍 this PR
```

Follow-up: cherry-pick onto `feat/error-codes-ssot` (does not land on develop directly).

## Test plan
- [ ] `pnpm --filter @kace/core exec node --experimental-vm-modules node_modules/jest/bin/jest.js tests/cases/ResponsableStaleChecker.test.js tests/cases/CaseStaleSnapshotEvaluator.test.js --detectOpenHandles --forceExit --bail`
- [ ] `pnpm --filter @kace/api-common exec node --experimental-vm-modules node_modules/jest/bin/jest.js tests/http_responses/Response.test.js --detectOpenHandles --forceExit --bail`
- [ ] `pnpm --filter @kace/api-cases exec node --experimental-vm-modules node_modules/jest/bin/jest.js test/schemaUpdateStaleSnapshots.test.mjs --detectOpenHandles --forceExit --bail`
- [ ] `pnpm --filter onescript-plugin-tutorial exec vitest run src/plugins/kace/components/auth/buildInitialCaseData.test.js src/plugins/kace/services/caseService.test.js`
- [ ] CanUpdateCase 403 still wins when the editor is not the current owner

EOF
)"
```

- [ ] **Step 2: Push PR 2**

Desde `feat/case-stale-responsable-ssot`:

```bash
git push -u origin HEAD
gh pr create --base feat/error-codes-ssot --head feat/case-stale-responsable-ssot --title "feat(cases): stale responsable check on error-codes SSOT" --body "$(cat <<'EOF'
## Summary
- Cherry-pick of stale snapshot check onto `@kace/error-codes`.
- Catalog: `CASE_TRANSITION_STALE` `0x030041`, `CASE_RESPONSIBLE_STALE` `0x030042`.
- Evaluator imports `@kace/error-codes` (no `ErrorCodes.js`).

## Chain
```
origin/feat/error-codes-ssot  (PR #90 → develop)
        └── feat/case-stale-responsable-ssot   📍 this PR
```

Depends on #90. Retarget to `develop` after #90 merges. Do not merge this into #90's branch.

## Test plan
- [ ] `pnpm --filter @kace/error-codes test`
- [ ] Same core / api-common / OneScript commands as the release PR

EOF
)"
```

- [ ] **Step 3: Return both PR URLs**

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| `ResponsableStaleChecker` always on, boolean, no flag | 1 |
| `getResponsableId` | 4 |
| `CASE_TRANSITION_STALE` `0x030041` / `CASE_RESPONSIBLE_STALE` `0x030042` | 2, 6 |
| Evaluator strip + `errors[]` order transition then responsable | 2 |
| Generic message, no `api_common` import from core | 2 |
| Skip evaluator when no snapshots; `globalConfig` only if transition snapshot | 2, 4 |
| `sanitizeErrors` preserves `code` | 3 |
| Controllers `cases` + `cases_2`, drop `transition_stale` | 4 |
| Joi `current_responsable_id` | 4 |
| `CanUpdateCase` untouched | 4 (no edits) |
| OneScript snapshot + `staleCodes` + warnings | 5 |
| Dual PR cherry-pick / catalog consecutive suffixes | 6, 7 |
| No GeneralSetup / saas i18n / CAS / create-case | (out of scope, no task) |
