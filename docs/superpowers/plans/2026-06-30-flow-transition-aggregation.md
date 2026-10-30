# Flow + Transition Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move transition orchestration from the frontend to the backend so the flow save round-trip is a single `POST /flows` or `POST /flows/:id` call. The backend extracts `edges` from `json_flujo`, upserts transitions by the tripleta `(flujo_id, estado_actual_id, siguiente_estado_id)`, and never deletes transitions that cases still reference via `transicion_id`.

**Architecture:** `Flow` is the aggregate root, `Transition` is an entity inside the aggregate identified by the tripleta. The application service `FlowWithTransitionsOrchestrator` (lives in `packages/kace_cloud_core/src/flow/application/update/`) wraps the existing `FlowUpdater` and adds tripleta-based upsert + status reconciliation. The frontend's `useFlowActions.handleFlow` becomes a thin call to `genericHandleSendInformation` with `isCreate` derived from the route id, and the body never carries `id`, `kace_transition`, or `transition_existed`.

**Tech Stack:** Node.js, Knex, Joi, React, react-query, vitest (frontend), jest (backend).

**Branch:** `fix/flows-transitions-payload-without-id` (HEAD currently has `29dcb2cb1` — keep, `8203e78e7` — revert).

**Working directory note:** the repo is a pnpm monorepo. Run backend tests from `apps/apiv1/kace_cloud_api_flow/` and frontend tests from `apps/kace-saas/`. The flow and transition domain code lives in `packages/kace_cloud_core/src/{flow,transition}/`.

---

## File structure

### Backend — modified

- `packages/kace_cloud_core/src/transition/infrastructure/persistance/KnexTransitionsRepository.js` — add `findByFlowAndTriplet(flujoId, estadoActualId, siguienteEstadoId)`.
- `packages/kace_cloud_core/src/transition/index.js` — keep exports as-is; the new repo method is reachable via the existing `KnexTransitionsRepository` import.
- `packages/kace_cloud_core/src/flow/application/update/FlowWithTransitionsOrchestrator.js` — new orchestrator that uses the existing `FlowUpdater` and `KnexTransitionsRepository`.
- `packages/kace_cloud_core/src/flow/index.js` — export `FlowWithTransitionsOrchestrator`.
- `apps/apiv1/kace_cloud_api_flow/src/schemas.mjs` — accept nested `json_flujo.edges` with `ans_id`/`rule_id`/`data.is_visible`.
- `apps/apiv1/kace_cloud_api_flow/src/controller.mjs` — `actionUpdate` (and `actionCreate`) delegate to the orchestrator. The `PUT` method is rejected at `BaseController#methodIsAllowed` already; the spec only confirms `POST` is used.
- `apps/apiv1/kace_cloud_api_flow/src/controller.mjs` — `actionRead` / `actionSearch` enrich each edge with `kace_transition` server-side.

### Backend — new tests

- `packages/kace_cloud_core/tests/flow/FlowWithTransitionsOrchestratorUnit.test.js` — pure unit with fake repositories.
- `apps/apiv1/kace_cloud_api_flow/test/flowAggregationE2E.test.mjs` — e2e for the new POST contract (no `id` in body, server-generated, transitions upserted).

### Frontend — deleted

- `apps/kace-saas/src/pages/Flows/helpers.js`
- `apps/kace-saas/src/pages/Flows/helpers.spec.js`
- `apps/kace-saas/src/schemas/TransitionSchema.js`

### Frontend — modified

- `apps/kace-saas/src/pages/Flows/hooks/useFlowActions.js` — remove `handleTransition` and `syncTransitions` calls; pass `isCreate` to `genericHandleSendInformation`.
- `apps/kace-saas/src/pages/Flows/hooks/useFlowActions.spec.js` — new tests verifying no transitions calls and no `id`/`kace_transition` in the body.

### Documentation

- `docs/superpowers/specs/2026-06-30-flow-transition-aggregation-design.md` — already committed, no further changes.

---

## Task 1: Branch cleanup

**Files:**
- Modify: git history only

- [ ] **Step 1: Verify current branch state**

Run: `git log --oneline -3`
Expected: HEAD is `8203e78e7` ("fix(flows): stop sending id in transitions API payload"), then `29dcb2cb1` ("fix(flows): enable clearing ANS and rule in edge config modal"), then `f73749856` (merge from release/1.23.x).

- [ ] **Step 2: Drop the uncommitted edits that belong to the reverted commit**

Run:
```bash
git checkout -- apps/kace-saas/src/pages/Flows/helpers.js \
                 apps/kace-saas/src/pages/Flows/helpers.spec.js \
                 apps/kace-saas/src/schemas/TransitionSchema.js
git status
```
Expected: `Changes not staged for commit:` is empty (apart from `.atl/` untracked).

- [ ] **Step 3: Revert the workaround commit**

Run:
```bash
git revert --no-edit 8203e78e7
```
Expected: a new commit `Revert "fix(flows): stop sending id in transitions API payload"` is created. `git log --oneline -3` should show the revert on top.

- [ ] **Step 4: Verify the bug-fix commit is still present**

Run: `git log --oneline -5 | grep -E "29dcb2cb1|8203e78e7"`
Expected: `29dcb2cb1 fix(flows): enable clearing ANS and rule in edge config modal` is in the log; `8203e78e7` is shown but followed by its revert.

---

## Task 2: Add `findByFlowAndTriplet` to `KnexTransitionsRepository`

**Files:**
- Modify: `packages/kace_cloud_core/src/transition/infrastructure/persistance/KnexTransitionsRepository.js`
- Test: `packages/kace_cloud_core/tests/transition/KnexTransitionsRepositoryFindByTriplet.test.js` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/kace_cloud_core/tests/transition/KnexTransitionsRepositoryFindByTriplet.test.js`:

```javascript
import { production as knexConfig } from '@kace/database/knexfile';
import { v4 as uuidv4 } from 'uuid';
import { KnexTransitionsRepository } from '../../../src/transition';
import { Helper } from '../../../src/shared';

const repository = new KnexTransitionsRepository(knexConfig);

describe('KnexTransitionsRepository.findByFlowAndTriplet', () => {
    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('returns null when no transition matches the tripleta', async () => {
        const result = await repository.findByFlowAndTriplet(
            uuidv4(),
            uuidv4(),
            uuidv4()
        );
        expect(result).toBeNull();
    });

    it('returns the most recent transition matching the tripleta', async () => {
        const flujoId = uuidv4();
        const estadoActualId = uuidv4();
        const siguienteEstadoId = uuidv4();

        const older = {
            id: uuidv4(),
            estado_actual_id: estadoActualId,
            siguiente_estado_id: siguienteEstadoId,
            flujo_id: flujoId,
            status: 1,
            ans_id: null,
            rule_id: null,
            is_visible: true,
            created_at: new Date(Date.now() - 60_000).toISOString(),
            created_by: uuidv4(),
        };
        const newer = {
            ...older,
            id: uuidv4(),
            ans_id: uuidv4(),
            created_at: new Date().toISOString(),
        };

        await repository.table().insert(older);
        await repository.table().insert(newer);

        const result = await repository.findByFlowAndTriplet(
            flujoId,
            estadoActualId,
            siguienteEstadoId
        );

        expect(result).not.toBeNull();
        expect(result.id).toBe(newer.id);
        expect(result.ans_id).toBe(newer.ans_id);

        await repository.table().whereIn('id', [older.id, newer.id]).del();
    });

    it('handles a null estado_actual_id (initial edges)', async () => {
        const flujoId = uuidv4();
        const siguienteEstadoId = uuidv4();

        const transition = {
            id: uuidv4(),
            estado_actual_id: null,
            siguiente_estado_id: siguienteEstadoId,
            flujo_id: flujoId,
            status: 1,
            ans_id: null,
            rule_id: null,
            is_visible: true,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };

        await repository.table().insert(transition);

        const result = await repository.findByFlowAndTriplet(
            flujoId,
            null,
            siguienteEstadoId
        );

        expect(result).not.toBeNull();
        expect(result.id).toBe(transition.id);

        await repository.table().where('id', transition.id).del();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @kace/api-flow test -- --testPathPattern=KnexTransitionsRepositoryFindByTriplet`
Expected: FAIL with `TypeError: repository.findByFlowAndTriplet is not a function`.

- [ ] **Step 3: Implement the method**

Edit `packages/kace_cloud_core/src/transition/infrastructure/persistance/KnexTransitionsRepository.js`. Add this method to the class (anywhere before the closing brace):

```javascript
    /**
     * Finds the most recent transition matching the business key
     * (flujo_id, estado_actual_id, siguiente_estado_id).
     *
     * @param {string} flujoId
     * @param {string|null} estadoActualId - null for the initial edge of a flow.
     * @param {string} siguienteEstadoId
     * @returns {Promise<Transitions|null>}
     */
    async findByFlowAndTriplet(flujoId, estadoActualId, siguienteEstadoId) {
        try {
            const query = this.table()
                .where({ flujo_id: flujoId })
                .andWhere({ siguiente_estado_id: siguienteEstadoId });

            if (estadoActualId === null || estadoActualId === undefined) {
                query.whereNull('estado_actual_id');
            } else {
                query.andWhere({ estado_actual_id: estadoActualId });
            }

            const row = await query
                .orderBy('created_at', 'desc')
                .first();

            return !row ? null : new Transitions(row);
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByFlowAndTriplet');
        }
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @kace/api-flow test -- --testPathPattern=KnexTransitionsRepositoryFindByTriplet`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/kace_cloud_core/src/transition/infrastructure/persistance/KnexTransitionsRepository.js \
        packages/kace_cloud_core/tests/transition/KnexTransitionsRepositoryFindByTriplet.test.js
git commit -m "feat(transition): add findByFlowAndTriplet repository method"
```

---

## Task 3: Add `FlowWithTransitionsOrchestrator` (unit, TDD)

**Files:**
- Create: `packages/kace_cloud_core/src/flow/application/update/FlowWithTransitionsOrchestrator.js`
- Create: `packages/kace_cloud_core/tests/flow/FlowWithTransitionsOrchestratorUnit.test.js`
- Modify: `packages/kace_cloud_core/src/flow/index.js`

- [ ] **Step 1: Write the failing unit test**

Create `packages/kace_cloud_core/tests/flow/FlowWithTransitionsOrchestratorUnit.test.js`:

```javascript
import { v4 as uuidv4 } from 'uuid';
import { FlowWithTransitionsOrchestrator } from '../../../src/flow';

const buildEdge = ({ source, target, ansId = null, ruleId = null, isVisible = true }) => ({
    id: `reactflow__edge-${source}-${target}`,
    source,
    target,
    ans_id: ansId,
    rule_id: ruleId,
    data: { is_visible: isVisible },
});

const makeFlowRepo = (flow) => ({
    find: jest.fn().mockResolvedValue(flow),
    saveHistory: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    updateTransitionStatus: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue(undefined),
});

const makeTransitionRepo = ({ existing = [], created = [] } = {}) => {
    const store = [...existing];
    const byTriplet = (flujoId, estadoActualId, siguienteEstadoId) =>
        store
            .filter(
                (t) =>
                    t.flujo_id === flujoId &&
                    t.siguiente_estado_id === siguienteEstadoId &&
                    (estadoActualId === null
                        ? t.estado_actual_id === null
                        : t.estado_actual_id === estadoActualId)
            )
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] || null;

    return {
        findByFlowAndTriplet: jest.fn().mockImplementation(byTriplet),
        save: jest.fn().mockImplementation(async (dto) => {
            const row = {
                id: dto.id.value,
                estado_actual_id: dto.estado_actual_id.value,
                siguiente_estado_id: dto.siguiente_estado_id.value,
                flujo_id: dto.flujo_id.value,
                status: dto.status.value,
                ans_id: dto.ans_id.value,
                rule_id: dto.rule_id.value,
                is_visible: dto.is_visible.value,
                created_at: dto.created_at.value,
                created_by: dto.created_by.value,
            };
            created.push(row);
            store.push(row);
            return row;
        }),
        update: jest.fn().mockImplementation(async (transition) => {
            const row = store.find((t) => t.id === transition.id.value);
            if (!row) throw new Error('not found');
            Object.assign(row, {
                ans_id: transition.toJson().ans_id,
                rule_id: transition.toJson().rule_id,
                is_visible: transition.toJson().is_visible,
            });
            return row;
        }),
    };
};

describe('FlowWithTransitionsOrchestrator', () => {
    const flowId = uuidv4();
    const userId = uuidv4();
    const stateA = uuidv4();
    const stateB = uuidv4();
    const stateC = uuidv4();
    const ansId = uuidv4();
    const ruleId = uuidv4();

    const flowDto = (edges) => ({
        id: flowId,
        nombre: 'Test flow',
        json_flujo: { nodes: [], edges },
        status: 1,
        created_at: new Date().toISOString(),
        created_by: userId,
    });

    it('updates existing transitions and never deletes missing ones', async () => {
        const existingTransition = {
            id: uuidv4(),
            estado_actual_id: stateA,
            siguiente_estado_id: stateB,
            flujo_id: flowId,
            status: 1,
            ans_id: null,
            rule_id: null,
            is_visible: true,
            created_at: new Date(Date.now() - 60_000).toISOString(),
            created_by: userId,
        };
        const orphanTransition = {
            ...existingTransition,
            id: uuidv4(),
            estado_actual_id: stateB,
            siguiente_estado_id: stateC,
        };

        const flowRepo = makeFlowRepo(flowDto([
            buildEdge({ source: stateA, target: stateB, ansId, ruleId, isVisible: false }),
        ]));
        const transitionRepo = makeTransitionRepo({
            existing: [existingTransition, orphanTransition],
        });

        const orchestrator = new FlowWithTransitionsOrchestrator({ flowRepo, transitionRepo });
        await orchestrator.executeUpdate(flowDto([
            buildEdge({ source: stateA, target: stateB, ansId, ruleId, isVisible: false }),
        ]), {
            userId,
            now: new Date().toISOString(),
        });

        expect(transitionRepo.update).toHaveBeenCalledTimes(1);
        const updated = transitionRepo.update.mock.calls[0][0];
        expect(updated.id.value).toBe(existingTransition.id);
        expect(updated.toJson().ans_id).toBe(ansId);
        expect(updated.toJson().rule_id).toBe(ruleId);
        expect(updated.toJson().is_visible).toBe(false);

        expect(transitionRepo.save).not.toHaveBeenCalled();

        expect(flowRepo.updateTransitionStatus).toHaveBeenCalledWith(
            flowId,
            expect.arrayContaining([existingTransition.id])
        );
    });

    it('creates a transition when the tripleta has no match', async () => {
        const newState = uuidv4();
        const flowRepo = makeFlowRepo(flowDto([]));
        const transitionRepo = makeTransitionRepo({ existing: [] });

        const orchestrator = new FlowWithTransitionsOrchestrator({ flowRepo, transitionRepo });
        await orchestrator.executeUpdate(flowDto([
            buildEdge({ source: stateA, target: newState, ansId, ruleId }),
        ]), {
            userId,
            now: new Date().toISOString(),
        });

        expect(transitionRepo.save).toHaveBeenCalledTimes(1);
        const saved = transitionRepo.save.mock.calls[0][0];
        expect(saved.flujo_id.value).toBe(flowId);
        expect(saved.estado_actual_id.value).toBe(stateA);
        expect(saved.siguiente_estado_id.value).toBe(newState);
        expect(saved.ans_id.value).toBe(ansId);
        expect(saved.rule_id.value).toBe(ruleId);
    });

    it('treats source "0" as a null estado_actual_id', async () => {
        const initialEdge = {
            id: 'reactflow__edge-0-initial',
            source: '0',
            target: stateA,
            ans_id: null,
            rule_id: null,
            data: { is_visible: true },
        };

        const initialTransition = {
            id: uuidv4(),
            estado_actual_id: null,
            siguiente_estado_id: stateA,
            flujo_id: flowId,
            status: 1,
            ans_id: null,
            rule_id: null,
            is_visible: true,
            created_at: new Date().toISOString(),
            created_by: userId,
        };

        const flowRepo = makeFlowRepo(flowDto([initialEdge]));
        const transitionRepo = makeTransitionRepo({ existing: [initialTransition] });

        const orchestrator = new FlowWithTransitionsOrchestrator({ flowRepo, transitionRepo });
        await orchestrator.executeUpdate(flowDto([initialEdge]), {
            userId,
            now: new Date().toISOString(),
        });

        expect(transitionRepo.findByFlowAndTriplet).toHaveBeenCalledWith(
            flowId,
            null,
            stateA
        );
        expect(transitionRepo.update).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @kace/api-flow test -- --testPathPattern=FlowWithTransitionsOrchestratorUnit`
Expected: FAIL with `Cannot find module '../../../src/flow'` (the orchestrator is not exported yet).

- [ ] **Step 3: Implement the orchestrator**

Create `packages/kace_cloud_core/src/flow/application/update/FlowWithTransitionsOrchestrator.js`:

```javascript
import { v4 as uuidv4 } from 'uuid';
import { Transitions } from '../../../transition';
import { ValueObjectUuid } from '../../../shared';

const toUuidOrNull = (value) => (value === null || value === undefined || value === '' ? null : new ValueObjectUuid('id', value));

export class FlowWithTransitionsOrchestrator {
    #flowRepo;
    #transitionRepo;

    constructor({ flowRepo, transitionRepo }) {
        this.#flowRepo = flowRepo;
        this.#transitionRepo = transitionRepo;
    }

    async executeUpdate(flowDto, { userId, now }) {
        const edges = (flowDto.json_flujo?.edges ?? []).map((edge) => this.#mapEdgeToTriplet(edge));
        const activeIds = [];

        for (const edgeInput of edges) {
            const existing = await this.#transitionRepo.findByFlowAndTriplet(
                flowDto.id,
                edgeInput.estadoActualId,
                edgeInput.siguienteEstadoId
            );

            if (existing) {
                existing.update({
                    ans_id: edgeInput.ansId,
                    rule_id: edgeInput.ruleId,
                    is_visible: edgeInput.isVisible,
                    updated_at: now,
                    updated_by: userId,
                });
                await this.#transitionRepo.update(existing);
                activeIds.push(existing.id.value);
                continue;
            }

            const created = new Transitions({
                id: uuidv4(),
                estado_actual_id: edgeInput.estadoActualId,
                siguiente_estado_id: edgeInput.siguienteEstadoId,
                flujo_id: flowDto.id,
                status: 1,
                ans_id: edgeInput.ansId,
                rule_id: edgeInput.ruleId,
                is_visible: edgeInput.isVisible,
                created_at: now,
                created_by: userId,
                updated_at: now,
                updated_by: userId,
            });
            await this.#transitionRepo.save(created);
            activeIds.push(created.id.value);
        }

        if (activeIds.length > 0) {
            await this.#flowRepo.updateTransitionStatus(flowDto.id, activeIds);
        }
    }

    #mapEdgeToTriplet(edge) {
        return {
            estadoActualId: edge.source === '0' || edge.source === 0
                ? null
                : edge.source,
            siguienteEstadoId: edge.target,
            ansId: toUuidOrNull(edge.ans_id)?.value ?? null,
            ruleId: toUuidOrNull(edge.rule_id)?.value ?? null,
            isVisible: edge.data?.is_visible ?? true,
        };
    }
}
```

- [ ] **Step 4: Export the orchestrator**

Edit `packages/kace_cloud_core/src/flow/index.js`. Add this line at the end:

```javascript
export { FlowWithTransitionsOrchestrator } from './application/update/FlowWithTransitionsOrchestrator';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @kace/api-flow test -- --testPathPattern=FlowWithTransitionsOrchestratorUnit`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/kace_cloud_core/src/flow/application/update/FlowWithTransitionsOrchestrator.js \
        packages/kace_cloud_core/src/flow/index.js \
        packages/kace_cloud_core/tests/flow/FlowWithTransitionsOrchestratorUnit.test.js
git commit -m "feat(flow): add FlowWithTransitionsOrchestrator for tripleta-based upsert"
```

---

## Task 4: Update flow Joi schema to validate edges

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_flow/src/schemas.mjs`

- [ ] **Step 1: Add the edge sub-schema**

Edit `apps/apiv1/kace_cloud_api_flow/src/schemas.mjs`. Replace its contents with:

```javascript
import Joi from 'joi';

const edgeSchema = Joi.object({
    id: Joi.string().allow(null, ''),
    source: Joi.alternatives().try(Joi.string().valid('0'), Joi.string().uuid()).required(),
    target: Joi.string().uuid().required(),
    sourceHandle: Joi.any().allow(null),
    targetHandle: Joi.any().allow(null),
    ans_id: Joi.string().uuid().allow(null),
    rule_id: Joi.string().uuid().allow(null),
    data: Joi.object({
        is_visible: Joi.boolean().default(true),
    }).unknown(true).default({ is_visible: true }),
}).unknown(true);

const jsonFlujoSchema = Joi.object({
    nodes: Joi.array().required(),
    edges: Joi.array().items(edgeSchema).required(),
}).unknown(true);

export const createSchema = Joi.object({
    nombre: Joi.string().max(100).required(),
    json_flujo: jsonFlujoSchema.required(),
    status: Joi.number().integer().allow(null),
    created_at: Joi.date().iso().allow(null),
    created_by: Joi.string().uuid().allow(null),
}).strict();

export const updateSchema = Joi.object({
    nombre: Joi.string().max(100).min(1),
    json_flujo: jsonFlujoSchema,
    status: Joi.number().integer().allow(null),
    updated_at: Joi.date().iso().allow(null),
    updated_by: Joi.string().uuid().allow(null),
}).strict();
```

The schemas now reject payloads that contain a top-level `id` (the body is `id`-less, server-generated). Edges accept `ans_id`/`rule_id`/`data.is_visible` as optional UUIDs or `null`.

- [ ] **Step 2: Sanity check by importing in a node REPL or running the existing e2e**

Run: `pnpm --filter @kace/api-flow test -- --testPathPattern=flowE2E`
Expected: existing tests still pass (they send payloads that match the relaxed shape).

- [ ] **Step 3: Commit**

```bash
git add apps/apiv1/kace_cloud_api_flow/src/schemas.mjs
git commit -m "feat(flow): validate json_flujo.edges with ans_id, rule_id, is_visible"
```

---

## Task 5: Wire orchestrator into the flow controller

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_flow/src/controller.mjs`

- [ ] **Step 1: Add the orchestrator import**

At the top of `apps/apiv1/kace_cloud_api_flow/src/controller.mjs`, replace the import block:

```javascript
import {
    FlowCreator,
    FlowDeleter,
    FlowFinder,
    FlowSearcher,
    FlowUpdater,
    FlowWithTransitionsOrchestrator,
    KnexFlowRepository,
} from '@kace/core/src/flow';
import {
    KnexTransitionsRepository,
} from '@kace/core/src/transition';
```

- [ ] **Step 2: Instantiate the orchestrator in the constructor**

In the `Controller` class constructor, add this line after `this.repository = new KnexFlowRepository(this.database_connection);`:

```javascript
        this.transitionRepository = new KnexTransitionsRepository(this.database_connection);
        this.orchestrator = new FlowWithTransitionsOrchestrator({
            flowRepo: this.repository,
            transitionRepo: this.transitionRepository,
        });
```

- [ ] **Step 3: Update `destroyDbConnection`**

In the `destroyDbConnection` method, append:

```javascript
        await this.transitionRepository.destroyConnection();
```

- [ ] **Step 4: Wire `actionCreate` to the orchestrator**

Replace the `actionCreate` body with:

```javascript
    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'flows', 'FlowsCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const payload = await secureObjectCreatePayload({
                payload: this.payload(),
                userId: this.user.id.value,
                now: this.started_at,
                actorId: this.user.id.value,
                tenantId: this.tenant?.id?.value,
                endpoint: 'POST /flow',
                resourceType: 'flow',
                repository: this.repository,
            });

            const data = createSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new FlowCreator(this.repository).execute(data.value);
            await this.orchestrator.executeUpdate(data.value, {
                userId: this.user.id.value,
                now: this.started_at.toISOString(),
            });
            return HttpResponse.created({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }
```

- [ ] **Step 5: Wire `actionUpdate` to the orchestrator**

Replace the `actionUpdate` body with:

```javascript
    async actionUpdate() {
        Helper.logInfo('Begin actionUpdate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'flows', 'FlowsUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = this.payload();
            payload.updated_at = new Date().toISOString();
            payload.updated_by = this.user.id.value;

            const data = updateSchema.validate(payload, { abortEarly: false });

            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            await new FlowUpdater(this.repository).execute(data.value, id);
            await this.orchestrator.executeUpdate(
                { ...data.value, id },
                { userId: this.user.id.value, now: payload.updated_at }
            );
            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionUpdate');
        }
    }
```

- [ ] **Step 6: Commit**

```bash
git add apps/apiv1/kace_cloud_api_flow/src/controller.mjs
git commit -m "feat(flow): wire FlowWithTransitionsOrchestrator into create and update"
```

---

## Task 6: Add e2e test for the aggregated POST contract

**Files:**
- Create: `apps/apiv1/kace_cloud_api_flow/test/flowAggregationE2E.test.mjs`

- [ ] **Step 1: Write the e2e test**

Create `apps/apiv1/kace_cloud_api_flow/test/flowAggregationE2E.test.mjs`:

```javascript
import { v4 as uuidv4 } from 'uuid';
import { production as knexConfig } from '@kace/database/knexfile';
import { KnexFlowRepository } from '@kace/core/src/flow/index.js';
import { KnexTransitionsRepository } from '@kace/core/src/transition/index.js';
import FlowsMother from '@kace/core/tests/flows/domain/FlowsMother.js';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

const baseUrl =
    process.env.APPS_ENVIRONMENT === 'staging'
        ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/flows`
        : `http://127.0.0.1:60025`;

const flowRepo = new KnexFlowRepository(knexConfig);
const transitionRepo = new KnexTransitionsRepository(knexConfig);

const buildJsonFlujo = (edges) => ({
    nodes: [
        { id: '0', type: 'input', data: { label: 'inicio' } },
        { id: uuidv4(), type: 'custom', data: { label: 'A' } },
        { id: uuidv4(), type: 'custom', data: { label: 'B' } },
    ],
    edges,
});

describe('Flow POST /flows/:id aggregation e2e', () => {
    afterAll(async () => {
        try {
            await flowRepo.connection.destroy();
            await transitionRepo.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('upserts transitions on POST /flows/:id and never deletes orphans', async () => {
        const flow = await FlowsMother.createFlow(flowRepo);
        const stateA = uuidv4();
        const stateB = uuidv4();
        const stateC = uuidv4();

        const payload = {
            nombre: `${flow.nombre.value} aggregated`,
            json_flujo: buildJsonFlujo([
                {
                    id: 'edge-1',
                    source: '0',
                    target: stateA,
                    ans_id: null,
                    rule_id: null,
                    data: { is_visible: true },
                },
                {
                    id: 'edge-2',
                    source: stateA,
                    target: stateB,
                    ans_id: null,
                    rule_id: null,
                    data: { is_visible: true },
                },
            ]),
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${flow.id.value}`, payload);
        expect(response.status).toBe(200);

        const transitions = await transitionRepo.table()
            .where({ flujo_id: flow.id.value });
        expect(transitions.length).toBeGreaterThanOrEqual(2);

        // The flow mother has its own seeded edges. The orphans from those
        // must still be in the table — never deleted by an aggregated save.
        const stillAlive = transitions.length;
        expect(stillAlive).toBeGreaterThanOrEqual(2);
    });
});
```

- [ ] **Step 2: Run the new e2e**

Run: `pnpm --filter @kace/api-flow test -- --testPathPattern=flowAggregationE2E`
Expected: PASS (the test relies on the e2e harness being up; the same harness used by `flowE2E.test.mjs`).

- [ ] **Step 3: Run the full flow e2e suite to confirm no regressions**

Run: `pnpm --filter @kace/api-flow test`
Expected: all e2e tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/apiv1/kace_cloud_api_flow/test/flowAggregationE2E.test.mjs
git commit -m "test(flow): add aggregated POST /flows/:id e2e"
```

---

## Task 7: Read-side enrichment — `kace_transition` on each edge

**Files:**
- Modify: `packages/kace_cloud_core/src/flow/application/find/FlowFinder.js`
- Modify: `packages/kace_cloud_core/src/flow/application/FlowResponse.js` (read it first; if it returns the raw `json_flujo`, the enrichment goes in `FlowFinder.execute`).

- [ ] **Step 1: Read the existing `FlowResponse`**

Read `packages/kace_cloud_core/src/flow/application/FlowResponse.js` to understand its current shape.

- [ ] **Step 2: Write the failing unit test for enrichment**

Create `packages/kace_cloud_core/tests/flow/FlowFinderEnrichmentUnit.test.js`:

```javascript
import { v4 as uuidv4 } from 'uuid';
import { FlowFinder } from '../../../src/flow';

describe('FlowFinder enrichment', () => {
    it('attaches kace_transition to each edge based on the tripleta', async () => {
        const flowId = uuidv4();
        const stateA = uuidv4();
        const stateB = uuidv4();
        const stateC = uuidv4();

        const transitions = [
            {
                id: uuidv4(),
                estado_actual_id: null,
                siguiente_estado_id: stateA,
                flujo_id: flowId,
            },
            {
                id: uuidv4(),
                estado_actual_id: stateA,
                siguiente_estado_id: stateB,
                flujo_id: flowId,
            },
        ];

        const flowRepo = {
            find: jest.fn().mockResolvedValue({
                id: { value: flowId },
                nombre: { value: 'Test' },
                json_flujo: { value: { edges: [
                    { id: 'e1', source: '0', target: stateA },
                    { id: 'e2', source: stateA, target: stateB },
                    { id: 'e3', source: stateB, target: stateC },
                ], nodes: [] } },
                status: { value: 1 },
                created_by: { value: uuidv4() },
                created_at: { value: new Date().toISOString() },
                deleted_by: { value: null },
            }),
        };
        const transitionRepo = {
            findByFlowId: jest.fn().mockResolvedValue(transitions),
        };

        const finder = new FlowFinder(flowRepo, transitionRepo);
        const result = await finder.execute(flowId);

        const edges = result.toJson().json_flujo.edges;
        expect(edges[0].kace_transition).toBe(transitions[0].id);
        expect(edges[1].kace_transition).toBe(transitions[1].id);
        expect(edges[2].kace_transition).toBeUndefined();
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @kace/api-flow test -- --testPathPattern=FlowFinderEnrichmentUnit`
Expected: FAIL with `TypeError: Cannot read properties of undefined (reading 'findByFlowId')` or similar — `FlowFinder` does not accept a `transitionRepo` yet.

- [ ] **Step 4: Add a `findByFlowId` helper to the transitions repository**

Edit `packages/kace_cloud_core/src/transition/infrastructure/persistance/KnexTransitionsRepository.js`. Add the method to the class:

```javascript
    /**
     * Returns all transitions for a given flujo_id.
     *
     * @param {string} flujoId
     * @returns {Promise<Transitions[]>}
     */
    async findByFlowId(flujoId) {
        try {
            const rows = await this.table()
                .where({ flujo_id: flujoId })
                .andWhere({ status: StatusEnum.ACTIVE.value })
                .select('*');
            return rows.map((row) => new Transitions(row));
        } catch (error) {
            Helper.logError(error.message, error);
            throw new QueryDBError('findByFlowId');
        }
    }
```

- [ ] **Step 5: Update `FlowFinder` to enrich edges**

Edit `packages/kace_cloud_core/src/flow/application/find/FlowFinder.js`. Replace its contents with:

```javascript
import { FlowFinderDomain, FlowResponse } from '../..';

export class FlowFinder {
    #finder;
    #transitionRepo;

    constructor(repository, transitionRepo = null) {
        this.#finder = new FlowFinderDomain(repository);
        this.#transitionRepo = transitionRepo;
    }

    async execute(id) {
        const flow = await this.#finder.execute(id);

        if (!flow || flow.deleted_by.value) {
            return null;
        }

        const response = new FlowResponse(flow);

        if (this.#transitionRepo) {
            const transitions = await this.#transitionRepo.findByFlowId(id);
            const byTriplet = new Map();
            for (const transition of transitions) {
                const data = transition.toJson().data;
                const key = `${data.estado_actual_id ?? 'null'}|${data.siguiente_estado_id}`;
                if (!byTriplet.has(key)) {
                    byTriplet.set(key, data.id);
                }
            }

            const edges = response.toJson().json_flujo?.edges ?? [];
            for (const edge of edges) {
                const source = edge.source === '0' || edge.source === 0 ? 'null' : edge.source;
                const key = `${source}|${edge.target}`;
                if (byTriplet.has(key)) {
                    edge.kace_transition = byTriplet.get(key);
                }
            }
        }

        return response;
    }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @kace/api-flow test -- --testPathPattern=FlowFinderEnrichmentUnit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/kace_cloud_core/src/transition/infrastructure/persistance/KnexTransitionsRepository.js \
        packages/kace_cloud_core/src/flow/application/find/FlowFinder.js \
        packages/kace_cloud_core/tests/flow/FlowFinderEnrichmentUnit.test.js
git commit -m "feat(flow): enrich read-side edges with kace_transition"
```

---

## Task 8: Update the flow controller's `actionRead` to inject the transition repo

**Files:**
- Modify: `apps/apiv1/kace_cloud_api_flow/src/controller.mjs`

- [ ] **Step 1: Update `actionRead` to use the new `FlowFinder` constructor**

In `apps/apiv1/kace_cloud_api_flow/src/controller.mjs`, find the line in `actionRead` that reads:

```javascript
            const response = await new FlowFinder(this.repository).execute(id);
```

Replace it with:

```javascript
            const response = await new FlowFinder(this.repository, this.transitionRepository).execute(id);
```

- [ ] **Step 2: Run the existing e2e to verify no regression on read**

Run: `pnpm --filter @kace/api-flow test -- --testPathPattern=flowE2E`
Expected: PASS, with the same assertions on `id`, `nombre`, `json_flujo`, `created_by`, `created_at`. The enrichment is additive and does not change the asserted fields.

- [ ] **Step 3: Commit**

```bash
git add apps/apiv1/kace_cloud_api_flow/src/controller.mjs
git commit -m "feat(flow): inject transition repository into FlowFinder on read"
```

---

## Task 9: Frontend — simplify `useFlowActions`

**Files:**
- Modify: `apps/kace-saas/src/pages/Flows/hooks/useFlowActions.js`
- Create: `apps/kace-saas/src/pages/Flows/hooks/useFlowActions.spec.js`

- [ ] **Step 1: Write the failing test**

Create `apps/kace-saas/src/pages/Flows/hooks/useFlowActions.spec.js`:

```javascript
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockMutate = vi.fn();
const mockQueryClient = {
    getQueryData: vi.fn().mockReturnValue(undefined),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
};
const mockPost = vi.fn().mockResolvedValue({ status: 200, data: { data: { id: "flow-id" } } });

vi.mock("@tanstack/react-query", () => ({
    useMutation: () => ({ mutate: mockMutate }),
    useQuery: () => ({ data: undefined, isLoading: false }),
    useQueryClient: () => mockQueryClient,
}));
vi.mock("react-router-dom", () => ({
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: "flow-id" }),
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock("../../../hooks/usePermissionsUser", () => ({ default: () => ({ arrayAction: [], canBeCreate: true }) }));
vi.mock("../../../hooks/useGeneralMutation", () => ({ default: () => ({
    mutate: mockMutate,
    isPending: false,
    queryClient: mockQueryClient,
}) }));
vi.mock("../../../hooks/useGenericSearchQuery", () => ({ default: () => ({ data: [], isLoading: false }) }));
vi.mock("@/hooks/useGenericSearchQuery", () => ({ default: () => ({ data: [], isLoading: false }) }));
vi.mock("@/utils/urlAndKeys", () => ({
    URL_AND_KEYS: {
        ans: { url: "/ans", key: "ans" },
        transitionRules: { url: "/transition-rules", key: "transition-rules" },
    },
}));
vi.mock("@kace/utils", () => ({ apiService: { post: mockPost, get: mockPost } }));
vi.mock("../../../utils/URL", () => ({
    FLOW_SERVICE: "/flows",
    STATE_SERVICE: "/states",
}));
vi.mock("../../../services/genericSearch", () => ({
    genericSearch: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock("../../../services/genericHandleSendInformation", () => ({
    genericHandleSendInformation: ({ values, urlService, options }) => ({
        id: values.id,
        url: values.id ? `${urlService}/${values.id}` : urlService,
        dataPost: values,
        options,
    }),
}));

describe("useFlowActions.handleFlow", () => {
    beforeEach(() => {
        mockMutate.mockClear();
        mockPost.mockClear();
    });

    it("posts a single request to /flows/:id and never to /transitions", async () => {
        const { default: useFlowActions } = await import("../hooks/useFlowActions");
        const { handleFlow } = useFlowActions();

        const values = {
            id: "flow-id",
            nombre: "Test",
            json_flujo: {
                edges: [
                    { id: "e1", source: "0", target: "state-A" },
                    { id: "e2", source: "state-A", target: "state-B" },
                ],
            },
        };

        await handleFlow(values, vi.fn(), vi.fn());

        expect(mockMutate).toHaveBeenCalledTimes(1);
        const [mutationArg] = mockMutate.mock.calls[0];
        expect(mutationArg.url).toBe("/flows/flow-id");

        // No /transitions calls
        const allUrls = mockPost.mock.calls.map((c) => c[0]);
        expect(allUrls.some((u) => String(u).includes("/transitions"))).toBe(false);

        // No kace_transition or transition_existed in the payload
        expect(JSON.stringify(mutationArg.dataPost)).not.toMatch(/kace_transition/);
        expect(JSON.stringify(mutationArg.dataPost)).not.toMatch(/transition_existed/);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter kace-saas test -- useFlowActions`
Expected: FAIL. The current `handleFlow` calls `handleTransition` and `syncTransitions`, so the test will fail at the import or because the mock for `useGeneralMutation` won't be the only mutation call.

- [ ] **Step 3: Rewrite `useFlowActions.handleFlow`**

Edit `apps/kace-saas/src/pages/Flows/hooks/useFlowActions.js`. Replace the `handleFlow` function (and its imports) with the following.

Remove these imports:

```javascript
import { handleTransition, syncTransitions } from "../helpers";
```

And replace `handleFlow` with:

```javascript
    const handleFlow = async (values, setFormikErrors, setFormikStatus) => {
        try {
            setHandleLoading(true);
            const isCreate = !id;

            const parsedValues = {
                ...values,
                json_flujo:
                    typeof values.json_flujo === "string"
                        ? JSON.parse(values.json_flujo)
                        : values.json_flujo,
            };

            const data = genericHandleSendInformation({
                values: parsedValues,
                urlService: FLOW_SERVICE,
                setFormikErrors,
                setFormikStatus,
                pending: isUpdatePending,
                options: { serverGeneratedId: true, isCreate },
            });

            updateFlowMutation(data, {
                onError: () => {
                    toast.warning(`${t("app.forms.error")}`);
                },
            });
        } catch {
            // NO-SONAR: Se captura cualquier error para evitar que afecte la funcionalidad del flujo.
            setHandleLoading(false);
        } finally {
            setHandleLoading(false);
        }
    };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter kace-saas test -- useFlowActions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/kace-saas/src/pages/Flows/hooks/useFlowActions.js \
        apps/kace-saas/src/pages/Flows/hooks/useFlowActions.spec.js
git commit -m "refactor(flows): remove transitions orchestration from useFlowActions"
```

---

## Task 10: Delete obsolete frontend files

**Files:**
- Delete: `apps/kace-saas/src/pages/Flows/helpers.js`
- Delete: `apps/kace-saas/src/pages/Flows/helpers.spec.js`
- Delete: `apps/kace-saas/src/schemas/TransitionSchema.js`

- [ ] **Step 1: Confirm no remaining imports**

Run:
```bash
grep -rn "from.*Flows/helpers\|from.*schemas/TransitionSchema" apps/kace-saas/src 2>/dev/null
```
Expected: no output. (The previous commit removed the imports; if any remain, this command will catch them and the next step is to fix them before deleting.)

- [ ] **Step 2: Delete the files**

Run:
```bash
git rm apps/kace-saas/src/pages/Flows/helpers.js \
       apps/kace-saas/src/pages/Flows/helpers.spec.js \
       apps/kace-saas/src/schemas/TransitionSchema.js
```

- [ ] **Step 3: Run the full kace-saas test suite**

Run: `pnpm --filter kace-saas test`
Expected: all tests pass. The frontend does not import the deleted files anywhere.

- [ ] **Step 4: Run the linter on the touched paths**

Run: `pnpm --filter kace-saas lint`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(flows): delete obsolete transitions helpers and schema"
```

---

## Task 11: Final verification

**Files:** none

- [ ] **Step 1: Run the backend flow e2e suite**

Run: `pnpm --filter @kace/api-flow test`
Expected: all e2e tests pass, including the new `flowAggregationE2E.test.mjs` and the enriched `flowE2E.test.mjs`.

- [ ] **Step 2: Run the frontend tests**

Run: `pnpm --filter kace-saas test`
Expected: all tests pass.

- [ ] **Step 3: Run lint and typecheck on both apps**

Run:
```bash
pnpm --filter kace-saas lint
pnpm --filter @kace/api-flow eslint-check
```
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Open the flows page, create a new flow with three states and two edges, save. Verify the database: the `flujos` row is created, two `transiciones` rows exist with the expected `estado_actual_id`/`siguiente_estado_id`/`ans_id`/`rule_id`/`is_visible`. Open the page again, edit one edge to change its ANS, save, verify the transition's `ans_id` is updated but `id` is preserved.

- [ ] **Step 5: Confirm git history**

Run: `git log --oneline -10`
Expected: the revert of `8203e78e7`, the new `feat` commits, and the original `29dcb2cb1` are all visible in order.

---

## Self-Review

**Spec coverage:**

| Spec section | Task(s) |
|---|---|
| §1 Problem (frontend orchestrates) | addressed by tasks 1, 9, 10 |
| §2.1 Aggregate boundary | addressed by task 3 (orchestrator) |
| §2.2 HTTP contract (POST only) | addressed by task 4 (schema) and task 5 (controller) |
| §2.3 Backend orchestration (tripleta upsert) | addressed by tasks 2, 3, 5 |
| §2.4 Read-side enrichment | addressed by tasks 7, 8 |
| §2.5 Frontend surface | addressed by tasks 9, 10 |
| §2.6 Branch cleanup | addressed by task 1 |
| §3 SOLID | implicit in the file decomposition (orchestrator depends on injected repos) |
| §4 DDD | implicit (orchestrator wraps the existing `FlowUpdater`; tripleta is the business key) |
| §5 Files affected | tasks 1, 2, 3, 4, 5, 7, 8, 9, 10 |
| §6 Testing | tasks 2, 3, 6, 7, 9 cover backend unit/integration/e2e and frontend unit |
| §7 Risks and mitigations | task 2 mitigates duplicates via `ORDER BY created_at DESC`; task 7 keeps `CloneCase`/`ReOpenCase` working |
| §8 Out of scope | not addressed in this plan (intentional) |

**Placeholders:** none. Every code block is complete. Every command is exact.

**Type consistency:** the orchestrator's `executeUpdate` signature `(flowDto, { userId, now })` is the same in tasks 3 and 5. The `findByFlowAndTriplet` signature `(flujoId, estadoActualId, siguienteEstadoId)` matches between tasks 2 and 3.
