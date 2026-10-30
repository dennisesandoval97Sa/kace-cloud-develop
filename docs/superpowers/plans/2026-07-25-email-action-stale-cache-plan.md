# Email Action Stale Cross-Process Cache — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the email template context built for action-triggered emails (`buildEmailTemplateContext`) always read `aux_cases`, `classifications`, and `transitions` fresh from the database, bypassing the process-local `EntityCache` that causes stale data when the action runs in a worker process different from the one that wrote the data.

**Architecture:** Add an optional `{ skipCache = false }` parameter to the three cached repository read methods (`KnexAuxCasesRepository.findByCaseId`, `KnexClassificationRepository.find`, `KnexTransitionsRepository.find`). Thread this parameter, unchanged, through the domain (and for aux_cases, application) finders that wrap them. `buildEmailTemplateContext` is the only call site that opts in, passing `{ skipCache: true }` on its three affected calls. Default `skipCache: false` everywhere else preserves today's caching behavior for every other consumer.

**Tech Stack:** Node.js (ESM), Jest (`packages/kace_cloud_core`), Knex (sqlite in-memory for integration tests via `tests/knexfile.js`), existing test-data builders (`AuxCasesMother`, `ClassificationsMother`, `TransitionsMother`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-25-email-action-stale-cache-design.md`. Branch: `fix/email-action-stale-cache-cross-process` (already created from `develop`).
- Strict TDD is active for this project: for every step below, write the failing test first, run it and confirm the failure, then write the minimal implementation, then run and confirm it passes. Do not write implementation code before its failing test exists.
- Default `skipCache: false` on every modified method/finder — zero behavior change for any caller that doesn't pass `{ skipCache: true }`.
- Do not touch `EntityCache.js`, `KnexCaseRepository.js`, or `KnexStateRepository.js` — confirmed out of scope (no cache to bypass there).
- Do not touch `EmailSender.js`/`EmailReplier.js` directly — they inherit the fix transitively through `buildEmailTemplateContext` with no code change needed on their side.
- All commands below run from `packages/kace_cloud_core` (the package root), e.g. `cd packages/kace_cloud_core && pnpm run tests -- <path>`.
- Commit after each task (not after each step) once its tests are green.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js` | Modify `findByCaseId` to accept `{ skipCache }` |
| `src/aux_casos/domain/AuxCasesFinderByCase.js` | Modify `execute` to forward `options` |
| `src/aux_casos/application/find/AuxCasesFinder.js` | Modify `execute` to forward `options` |
| `src/classifications/infrastructure/persistence/KnexClassificationsRepository.js` | Modify `find` to accept `{ skipCache }` |
| `src/classifications/domain/ClassificationFinder.js` | Modify `execute` to forward `options` |
| `src/transition/infrastructure/persistance/KnexTransitionsRepository.js` | Modify `find` to accept `{ skipCache }` |
| `src/transition/domain/TransitionsFinder.js` | Modify `execute` to forward `options` |
| `src/shared/domain/services/emailTemplating/emailTemplatesUtils.js` | Modify the 3 call sites in `buildEmailTemplateContext` to pass `{ skipCache: true }` |
| `tests/aux-cases/KnexAuxCasesRepositoryCacheIntegration.test.js` | Extend with a `skipCache` case |
| `tests/aux-cases/domain/AuxCasesFinderByCase.test.js` | **New** — options forwarding |
| `tests/aux-cases/application/AuxCasesFinder.test.js` | **New** — options forwarding |
| `tests/classifications/KnexClassificationsRepositoryCacheIntegration.test.js` | Extend with a `skipCache` case |
| `tests/classifications/domain/ClassificationFinder.test.js` | **New** — options forwarding |
| `tests/transition/KnexTransitionsRepositoryCacheIntegration.test.js` | Extend with a `skipCache` case |
| `tests/transition/domain/TransitionsFinder.test.js` | **New** — options forwarding |
| `tests/emails/EmailTemplateContextSkipCache.test.js` | **New** — `buildEmailTemplateContext` requests fresh reads |

No new production files. No changes to `EntityCache.js`.

---

### Task 1: Aux cases — fresh read support

**Files:**
- Modify: `src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js:60-79`
- Modify: `src/aux_casos/domain/AuxCasesFinderByCase.js` (whole file, 22 lines)
- Modify: `src/aux_casos/application/find/AuxCasesFinder.js` (whole file, 28 lines)
- Test: `tests/aux-cases/KnexAuxCasesRepositoryCacheIntegration.test.js`
- Test: `tests/aux-cases/domain/AuxCasesFinderByCase.test.js` (new)
- Test: `tests/aux-cases/application/AuxCasesFinder.test.js` (new)

**Interfaces:**
- Produces: `KnexAuxCasesRepository.findByCaseId(caseId: ValueObjectUuid, options?: { skipCache?: boolean }): Promise<AuxCases|null>`
- Produces: `AuxCasesFinderByCase.execute(caseId: string, options?: { skipCache?: boolean }): Promise<AuxCases|null>`
- Produces: `AuxCasesFinder.execute(caseId: string, options?: { skipCache?: boolean }): Promise<AuxCaseResponse>`

- [ ] **Step 1: Write the failing repository test**

Add to `tests/aux-cases/KnexAuxCasesRepositoryCacheIntegration.test.js` (add the import and the new `it`, keep the existing one):

```js
import { KnexAuxCasesRepository } from '../../src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';
import { AuxCasesMother } from './domain/AuxCasesMother.js';
import { v4 as uuidv4 } from 'uuid';

describe('KnexAuxCasesRepository cache', () => {
    const repository = new KnexAuxCasesRepository(knexConfig);

    beforeAll(async () => {
        await repository.connection.migrate.latest();
    });

    afterAll(async () => {
        await repository.connection.destroy();
    });

    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns the same cached instance on second findByCaseId', async () => {
        const caseId = { value: '00000000-0000-0000-0000-000000000050' };

        const first = await repository.findByCaseId(caseId);
        const second = await repository.findByCaseId(caseId);

        expect(second).toBe(first);
    });

    it('skipCache bypasses the stale cached value and reads the current row', async () => {
        const caseId = uuidv4();
        await AuxCasesMother.createAuxCase(repository, {
            caso_id: caseId,
            data: { formulario_aux_felipe: { nombre: 'Felipe', apellido: 'Original' } },
        });

        const cached = await repository.findByCaseId({ value: caseId });
        expect(cached.data.value.formulario_aux_felipe.apellido).toBe('Original');

        // Simulates a write from a different process: this process's cache is never invalidated.
        await repository
            .table()
            .where({ caso_id: caseId })
            .update({ data: JSON.stringify({ formulario_aux_felipe: { nombre: 'Felipe', apellido: 'Updated elsewhere' } }) });

        const stillCached = await repository.findByCaseId({ value: caseId });
        expect(stillCached.data.value.formulario_aux_felipe.apellido).toBe('Original');

        const fresh = await repository.findByCaseId({ value: caseId }, { skipCache: true });
        expect(fresh.data.value.formulario_aux_felipe.apellido).toBe('Updated elsewhere');
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm run tests -- tests/aux-cases/KnexAuxCasesRepositoryCacheIntegration.test.js`
Expected: FAIL on the new test — `fresh.data.value...` still equals `'Original'` (skipCache is not implemented yet, second-arg is ignored).

- [ ] **Step 3: Implement `skipCache` in `KnexAuxCasesRepository.findByCaseId`**

Replace lines 60-79 of `src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js`:

```js
    async findByCaseId(caseId, { skipCache = false } = {}) {
        try {
            const fetcher = async () => {
                const auxCase = await this.table()
                    .select('*')
                    .where({ caso_id: caseId.value })
                    .whereNull('deleted_at')
                    .first();
                return auxCase ? new AuxCases(auxCase) : null;
            };
            if (skipCache) {
                return await fetcher();
            }
            return await EntityCache.get(AUX_CASES_BY_CASE_NAMESPACE, caseId.value, fetcher, AUX_CASES_TTL_MS);
        } catch (error) {
            Helper.logError('Error finding aux casos by id', error);
            throw new QueryDBError('find');
        }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run tests -- tests/aux-cases/KnexAuxCasesRepositoryCacheIntegration.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Write the failing domain finder test**

Create `tests/aux-cases/domain/AuxCasesFinderByCase.test.js`:

```js
import { AuxCasesFinderByCase } from '../../../src/aux_casos/domain/AuxCasesFinderByCase.js';

describe('AuxCasesFinderByCase — options forwarding', () => {
    it('forwards options unchanged to repository.findByCaseId', async () => {
        const calls = [];
        const repository = {
            findByCaseId: async (caseId, options) => {
                calls.push({ caseId, options });
                return null;
            },
        };
        const finder = new AuxCasesFinderByCase(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111', { skipCache: true });

        expect(calls[0].options).toEqual({ skipCache: true });
    });

    it('defaults to an empty options object when none is given', async () => {
        const calls = [];
        const repository = {
            findByCaseId: async (caseId, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new AuxCasesFinderByCase(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111');

        expect(calls[0]).toEqual({});
    });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm run tests -- tests/aux-cases/domain/AuxCasesFinderByCase.test.js`
Expected: FAIL — `calls[0].options` is `undefined` (current `execute` takes only `caseId`).

- [ ] **Step 7: Implement forwarding in `AuxCasesFinderByCase`**

Replace the `execute` method in `src/aux_casos/domain/AuxCasesFinderByCase.js`:

```js
    async execute(caseId, options = {}) {
        return this.#repository.findByCaseId(new ValueObjectUuid('Caso id', caseId), options);
    }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm run tests -- tests/aux-cases/domain/AuxCasesFinderByCase.test.js`
Expected: PASS.

- [ ] **Step 9: Write the failing application finder test**

Create `tests/aux-cases/application/AuxCasesFinder.test.js`:

```js
import { AuxCasesFinder } from '../../../src/aux_casos/application/find/AuxCasesFinder.js';

describe('AuxCasesFinder — options forwarding', () => {
    it('forwards options unchanged to DomainAuxCasesFinderByCase.execute', async () => {
        const calls = [];
        // Constructor takes a repository; stub only the method AuxCasesFinderByCase calls on it.
        const repository = {
            findByCaseId: async (caseId, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new AuxCasesFinder(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111', { skipCache: true });

        expect(calls[0]).toEqual({ skipCache: true });
    });
});
```

- [ ] **Step 10: Run it to verify it fails**

Run: `pnpm run tests -- tests/aux-cases/application/AuxCasesFinder.test.js`
Expected: FAIL — `calls[0]` is `undefined`.

- [ ] **Step 11: Implement forwarding in `AuxCasesFinder`**

Replace the `execute` method in `src/aux_casos/application/find/AuxCasesFinder.js`:

```js
    async execute(caseId, options = {}) {
        const auxCase = await this.#finder.execute(caseId, options);
        return new AuxCaseResponse(auxCase);
    }
```

- [ ] **Step 12: Run test to verify it passes**

Run: `pnpm run tests -- tests/aux-cases/application/AuxCasesFinder.test.js`
Expected: PASS.

- [ ] **Step 13: Run the full aux_cases test slice**

Run: `pnpm run tests -- tests/aux-cases`
Expected: PASS (all files under `tests/aux-cases`).

- [ ] **Step 14: Commit**

```bash
git add src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js \
        src/aux_casos/domain/AuxCasesFinderByCase.js \
        src/aux_casos/application/find/AuxCasesFinder.js \
        tests/aux-cases/KnexAuxCasesRepositoryCacheIntegration.test.js \
        tests/aux-cases/domain/AuxCasesFinderByCase.test.js \
        tests/aux-cases/application/AuxCasesFinder.test.js
git commit -m "fix(aux-cases): support skipCache option for fresh reads"
```

---

### Task 2: Classifications — fresh read support

**Files:**
- Modify: `src/classifications/infrastructure/persistence/KnexClassificationsRepository.js:61-85`
- Modify: `src/classifications/domain/ClassificationFinder.js` (whole file, 19 lines)
- Test: `tests/classifications/KnexClassificationsRepositoryCacheIntegration.test.js`
- Test: `tests/classifications/domain/ClassificationFinder.test.js` (new)

**Interfaces:**
- Consumes: none from Task 1.
- Produces: `KnexClassificationRepository.find(id: ValueObjectUuid, options?: { skipCache?: boolean }): Promise<Classification|null>`
- Produces: `ClassificationFinder.execute(id: string, options?: { skipCache?: boolean }): Promise<Classification|null>`

- [ ] **Step 1: Write the failing repository test**

Add to `tests/classifications/KnexClassificationsRepositoryCacheIntegration.test.js`:

```js
import { KnexClassificationRepository } from '../../src/classifications/infrastructure/persistence/KnexClassificationsRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';
import ClassificationsMother from './domain/ClassificationsMother.js';

describe('KnexClassificationRepository cache', () => {
    const repository = new KnexClassificationRepository(knexConfig);

    beforeAll(async () => {
        await repository.connection.migrate.latest();
    });

    afterAll(async () => {
        await repository.connection.destroy();
    });

    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns the same cached instance on second find', async () => {
        const id = { value: '00000000-0000-0000-0000-000000000030' };

        const first = await repository.find(id);
        const second = await repository.find(id);

        expect(second).toBe(first);
    });

    it('skipCache bypasses the stale cached value and reads the current row', async () => {
        const classification = await ClassificationsMother.createClassification(repository, { nivel1: 'Original' });

        const id = { value: classification.id.value };
        const cached = await repository.find(id);
        expect(cached.nivel1.value).toBe('Original');

        // Simulates a write from a different process: this process's cache is never invalidated.
        await repository.table().where({ id: classification.id.value }).update({ nivel1: 'Updated elsewhere' });

        const stillCached = await repository.find(id);
        expect(stillCached.nivel1.value).toBe('Original');

        const fresh = await repository.find(id, { skipCache: true });
        expect(fresh.nivel1.value).toBe('Updated elsewhere');
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm run tests -- tests/classifications/KnexClassificationsRepositoryCacheIntegration.test.js`
Expected: FAIL on the new test — `fresh.nivel1.value` still equals `'Original'`.

- [ ] **Step 3: Implement `skipCache` in `KnexClassificationRepository.find`**

Replace lines 61-85 of `src/classifications/infrastructure/persistence/KnexClassificationsRepository.js`:

```js
    async find(id, { skipCache = false } = {}) {
        try {
            const fetcher = async () => {
                const result = await this.read.table().where({ id: id.value }).first();
                if (!result) return null;
                const classification = new Classification(result);
                const relatedIds = classification.getClassificationsIds();
                if (relatedIds?.length) {
                    const relatedClassifications = await this.read.table().whereIn('id', relatedIds);
                    classification.relations = relatedClassifications.map((rc) => new Classification(rc).toJson());
                } else {
                    classification.relations = [];
                }
                return classification;
            };
            if (skipCache) {
                return await fetcher();
            }
            return await EntityCache.get(CLASSIFICATIONS_NAMESPACE, id.value, fetcher, CLASSIFICATIONS_TTL_MS);
        } catch (error) {
            Helper.logError('Error finding classification:', error);
            throw new QueryDBError('find');
        }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run tests -- tests/classifications/KnexClassificationsRepositoryCacheIntegration.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Write the failing domain finder test**

Create `tests/classifications/domain/ClassificationFinder.test.js`:

```js
import { ClassificationFinder } from '../../../src/classifications/domain/ClassificationFinder.js';

describe('ClassificationFinder — options forwarding', () => {
    it('forwards options unchanged to repository.find', async () => {
        const calls = [];
        const repository = {
            find: async (id, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new ClassificationFinder(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111', { skipCache: true });

        expect(calls[0]).toEqual({ skipCache: true });
    });

    it('defaults to an empty options object when none is given', async () => {
        const calls = [];
        const repository = {
            find: async (id, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new ClassificationFinder(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111');

        expect(calls[0]).toEqual({});
    });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm run tests -- tests/classifications/domain/ClassificationFinder.test.js`
Expected: FAIL — `calls[0]` is `undefined`.

- [ ] **Step 7: Implement forwarding in `ClassificationFinder`**

Replace the `execute` method in `src/classifications/domain/ClassificationFinder.js`:

```js
    async execute(id, options = {}) {
        return this.#repository.find(new ValueObjectUuid('id', id), options);
    }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm run tests -- tests/classifications/domain/ClassificationFinder.test.js`
Expected: PASS.

- [ ] **Step 9: Run the full classifications test slice**

Run: `pnpm run tests -- tests/classifications`
Expected: PASS (all files under `tests/classifications`).

- [ ] **Step 10: Commit**

```bash
git add src/classifications/infrastructure/persistence/KnexClassificationsRepository.js \
        src/classifications/domain/ClassificationFinder.js \
        tests/classifications/KnexClassificationsRepositoryCacheIntegration.test.js \
        tests/classifications/domain/ClassificationFinder.test.js
git commit -m "fix(classifications): support skipCache option for fresh reads"
```

---

### Task 3: Transitions — fresh read support

**Files:**
- Modify: `src/transition/infrastructure/persistance/KnexTransitionsRepository.js:59-77`
- Modify: `src/transition/domain/TransitionsFinder.js` (whole file, 23 lines)
- Test: `tests/transition/KnexTransitionsRepositoryCacheIntegration.test.js`
- Test: `tests/transition/domain/TransitionsFinder.test.js` (new)

**Interfaces:**
- Consumes: none from Tasks 1-2.
- Produces: `KnexTransitionsRepository.find(id: ValueObjectUuid, options?: { skipCache?: boolean }): Promise<Transitions|null>`
- Produces: `TransitionsFinder.execute(id: string, options?: { skipCache?: boolean }): Promise<Transitions|null>`

- [ ] **Step 1: Write the failing repository test**

Add to `tests/transition/KnexTransitionsRepositoryCacheIntegration.test.js`:

```js
import { KnexTransitionsRepository } from '../../src/transition/infrastructure/persistance/KnexTransitionsRepository.js';
import { EntityCache } from '../../src/shared';
import { knexConfig } from '../knexfile.js';
import { TransitionsMother } from '../transitions/domain/TransitionsMother.js';

describe('KnexTransitionsRepository cache', () => {
    const repository = new KnexTransitionsRepository(knexConfig);

    beforeAll(async () => {
        await repository.connection.migrate.latest();
    });

    afterAll(async () => {
        await repository.connection.destroy();
    });

    beforeEach(() => {
        EntityCache.clear();
    });

    it('returns the same cached instance on second find', async () => {
        const id = { value: '00000000-0000-0000-0000-000000000020' };

        const first = await repository.find(id);
        const second = await repository.find(id);

        expect(second).toBe(first);
    });

    it('skipCache bypasses the stale cached value and reads the current row', async () => {
        const transition = await TransitionsMother.createRandomTransition(repository);
        const id = { value: transition.id.value };

        const cached = await repository.find(id);
        expect(cached.ans_id.value).toBe(transition.ans_id.value);

        // Simulates a write from a different process: this process's cache is never invalidated.
        const otherAnsId = '99999999-9999-4999-8999-999999999999';
        await repository.table().where({ id: transition.id.value }).update({ ans_id: otherAnsId });

        const stillCached = await repository.find(id);
        expect(stillCached.ans_id.value).toBe(transition.ans_id.value);

        const fresh = await repository.find(id, { skipCache: true });
        expect(fresh.ans_id.value).toBe(otherAnsId);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm run tests -- tests/transition/KnexTransitionsRepositoryCacheIntegration.test.js`
Expected: FAIL on the new test — `fresh.ans_id.value` still equals the original id.

- [ ] **Step 3: Implement `skipCache` in `KnexTransitionsRepository.find`**

Replace lines 59-77 of `src/transition/infrastructure/persistance/KnexTransitionsRepository.js`:

```js
    async find(id, { skipCache = false } = {}) {
        try {
            const fetcher = async () => {
                const result = await this.table()
                    .where({ id: id.value })
                    .andWhere({ status: StatusEnum.ACTIVE.value })
                    .first();
                return !result ? null : new Transitions(result);
            };
            if (skipCache) {
                return await fetcher();
            }
            return await EntityCache.get(TRANSITIONS_NAMESPACE, id.value, fetcher, TRANSITIONS_TTL_MS);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('find');
        }
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run tests -- tests/transition/KnexTransitionsRepositoryCacheIntegration.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Write the failing domain finder test**

Create `tests/transition/domain/TransitionsFinder.test.js`:

```js
import { TransitionsFinder } from '../../../src/transition/domain/TransitionsFinder.js';

describe('TransitionsFinder — options forwarding', () => {
    it('forwards options unchanged to repository.find', async () => {
        const calls = [];
        const repository = {
            find: async (id, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new TransitionsFinder(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111', { skipCache: true });

        expect(calls[0]).toEqual({ skipCache: true });
    });

    it('defaults to an empty options object when none is given', async () => {
        const calls = [];
        const repository = {
            find: async (id, options) => {
                calls.push(options);
                return null;
            },
        };
        const finder = new TransitionsFinder(repository);

        await finder.execute('11111111-1111-4111-8111-111111111111');

        expect(calls[0]).toEqual({});
    });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm run tests -- tests/transition/domain/TransitionsFinder.test.js`
Expected: FAIL — `calls[0]` is `undefined`.

- [ ] **Step 7: Implement forwarding in `TransitionsFinder`**

Replace the `execute` method in `src/transition/domain/TransitionsFinder.js`:

```js
    async execute(id, options = {}) {
        return this.#repository.find(new ValueObjectUuid('id', id), options);
    }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm run tests -- tests/transition/domain/TransitionsFinder.test.js`
Expected: PASS.

- [ ] **Step 9: Run the full transition test slice**

Run: `pnpm run tests -- tests/transition`
Expected: PASS (all files under `tests/transition`).

- [ ] **Step 10: Commit**

```bash
git add src/transition/infrastructure/persistance/KnexTransitionsRepository.js \
        src/transition/domain/TransitionsFinder.js \
        tests/transition/KnexTransitionsRepositoryCacheIntegration.test.js \
        tests/transition/domain/TransitionsFinder.test.js
git commit -m "fix(transitions): support skipCache option for fresh reads"
```

---

### Task 4: Wire `buildEmailTemplateContext` to request fresh reads

**Files:**
- Modify: `src/shared/domain/services/emailTemplating/emailTemplatesUtils.js:51,56,66`
- Test: `tests/emails/EmailTemplateContextSkipCache.test.js` (new)

**Interfaces:**
- Consumes: `AuxCasesFinder.execute(caseId, options)`, `ClassificationFinder.execute(id, options)`, `TransitionsFinder.execute(id, options)` from Tasks 1-3 (any object exposing a matching `execute(id, options)` shape works, per this function's existing duck-typed finder parameters).
- Produces: no new public interface — same `buildEmailTemplateContext(...)` signature and return shape as today.

- [ ] **Step 1: Write the failing test**

Create `tests/emails/EmailTemplateContextSkipCache.test.js`:

```js
import { buildEmailTemplateContext } from '../../src/shared/domain/services/emailTemplating/emailTemplatesUtils.js';

// The `entity.responsable_id` stub and `userFinder` are required because buildEmailTemplateContext
// always resolves the "usuarios" block for non-Case entities (see emailTemplatesUtils.js:45-48);
// without them the call throws before reaching the finder under test.
const userFinder = { execute: async () => ({ toJson: () => ({}) }) };

describe('buildEmailTemplateContext — requests fresh reads (skipCache) for action-triggered emails', () => {
    it('passes { skipCache: true } to auxCasesFinder.execute', async () => {
        const calls = [];
        const auxCasesFinder = {
            execute: async (caseId, options) => {
                calls.push(options);
                return { toJson: () => ({ data: { data: {} } }) };
            },
        };
        const entity = { id: { value: 'case-1' }, responsable_id: { value: 'user-1' }, toJson: () => ({}) };

        await buildEmailTemplateContext({ entity, userFinder, auxCasesFinder });

        expect(calls[0]).toEqual({ skipCache: true });
    });

    it('passes { skipCache: true } to classificationFinder.execute', async () => {
        const calls = [];
        const classificationFinder = {
            execute: async (id, options) => {
                calls.push(options);
                return { toJson: () => ({ data: {} }) };
            },
        };
        const entity = { clasificacion_id: { value: 'clasif-1' }, responsable_id: { value: 'user-1' }, toJson: () => ({}) };

        await buildEmailTemplateContext({ entity, userFinder, classificationFinder });

        expect(calls[0]).toEqual({ skipCache: true });
    });

    it('passes { skipCache: true } to transitionFinder.execute', async () => {
        const calls = [];
        const transitionFinder = {
            execute: async (id, options) => {
                calls.push(options);
                return { estado_actual_id: { value: null }, siguiente_estado_id: { value: null } };
            },
        };
        const stateFinder = { execute: async () => ({ toJson: () => ({ data: {} }) }) };
        const entity = { transicion_id: { value: 'trans-1' }, responsable_id: { value: 'user-1' }, toJson: () => ({}) };

        await buildEmailTemplateContext({ entity, userFinder, transitionFinder, stateFinder });

        expect(calls[0]).toEqual({ skipCache: true });
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm run tests -- tests/emails/EmailTemplateContextSkipCache.test.js`
Expected: FAIL on all three — `calls[0]` is `undefined` (the finders are currently called with a single argument).

- [ ] **Step 3: Implement the three call sites**

In `src/shared/domain/services/emailTemplating/emailTemplatesUtils.js`, replace lines 50-59 and lines 65-66 as follows.

Lines 50-53 (classification block):

```js
        if (entity.clasificacion_id?.value) {
            const found = await classificationFinder.execute(entity.clasificacion_id.value, { skipCache: true });
            clasificaciones = found?.toJson?.().data ?? {};
        }
```

Lines 55-59 (aux_cases block):

```js
        if (auxCasesFinder && entity.id?.value) {
            const found = await auxCasesFinder.execute(entity.id.value, { skipCache: true });
            const rawData = found?.toJson?.().data?.data ?? {};
            aux_cases = rawData;
        }
```

Line 65-66 (transition block, first line only — the rest of the block is unchanged):

```js
        if (stateFinder && transitionFinder && entity.transicion_id?.value) {
            const transition = await transitionFinder.execute(entity.transicion_id.value, { skipCache: true });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm run tests -- tests/emails/EmailTemplateContextSkipCache.test.js`
Expected: PASS (all three).

- [ ] **Step 5: Run the full emailTemplating and emails test slices (regression check)**

Run: `pnpm run tests -- tests/emails tests/shared/domain/services/emailTemplating`
Expected: PASS — confirms `EmailTemplateContextFinders.test.js`, `EmailTemplateFieldsRendering.test.js`, and `emailTemplatesUtils.test.js` still pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domain/services/emailTemplating/emailTemplatesUtils.js \
        tests/emails/EmailTemplateContextSkipCache.test.js
git commit -m "fix(email-templating): request fresh aux_cases/classification/transition reads"
```

---

### Task 5: Full regression run and manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `pnpm run tests`
Expected: PASS, no regressions in any other package test relying on `KnexAuxCasesRepository`, `KnexClassificationRepository`, `KnexTransitionsRepository`, or `buildEmailTemplateContext`.

- [ ] **Step 2: Manual reproduction against a running environment**

Reproduce the original bug's exact sequence (per the design spec's "Verificación manual" section) against a deployed/staging environment with the worker running:

1. Create a case with the auxiliary form fully filled, state "Inicial".
2. Update `apellido` and transition to "Secundario" in the same save → confirm the email arrives with the new `apellido`.
3. Immediately (no wait) update `apellido` again and transition to "Secundario" again → confirm the email now arrives with the **new** value (previously arrived with the stale one).
4. Confirm no regression: repeat step 3 after waiting 5+ minutes → still arrives correct (this already worked before the fix; must keep working).

- [ ] **Step 3: Push the branch**

```bash
git push -u origin fix/email-action-stale-cache-cross-process
```
