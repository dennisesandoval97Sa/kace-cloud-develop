import { jest } from '@jest/globals';
import { AutomatedGroupAssignmentService } from '../../src/actions-queue-executions/domain/services/AutomatedGroupAssignmentService.js';
import { NO_PREFILTER } from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { CapacityTracker } from '../../src/actions-queue-executions/domain/services/strategies/CapacityTracker.js';
import { Helper } from '../../src/shared/infrastructure/utils/Helper.js';

const stubDeps = () => ({
    groupsRepository: { findWorkQueueGroupsWithCapacity: jest.fn().mockResolvedValue([]) },
    userListsRepository: {},
    caseRepository: {},
    assignationService: {},
    dynamicGroupAssignmentHandler: null,
    caseUserAssignmentService: { execute: jest.fn() },
    caseFindAllActiveService: { execute: jest.fn().mockResolvedValue([]) },
});

describe('AutomatedGroupAssignmentService — constructor', () => {
    it('accepts caseCandidateFinder and caseContextBatchLoader as optional', () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn() };
        const finder = { find: jest.fn() };
        const loader = { load: jest.fn() };

        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseCandidateFinder: finder,
            caseContextBatchLoader: loader,
        });

        expect(svc.caseCandidateFinder).toBe(finder);
        expect(svc.caseContextBatchLoader).toBe(loader);
    });

    it('defaults caseCandidateFinder and caseContextBatchLoader to null when not provided', () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn() };
        const svc = new AutomatedGroupAssignmentService(validator, stubDeps());

        expect(svc.caseCandidateFinder).toBeNull();
        expect(svc.caseContextBatchLoader).toBeNull();
    });
});

describe('AutomatedGroupAssignmentService — #prefilterCandidates passive mode', () => {
    it('populates candidatesByAction AND caseById from the active universe when no SQL collaborators are wired', async () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn() };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c1'), fakeCase('c2')]),
        };
        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
        });

        const actions = [{ id: { value: 'a1' }, conditions: { value: { combinator: 'and', rules: [] } } }];
        const result = await svc._prefilterCandidatesForTest(actions, { evaluationNow: null });

        // Passive mode mitigation: BOTH candidatesByAction and caseById must be populated from the
        // active universe load so downstream ramas (work-queue, current-group, non-work-queue) can
        // resolve `caseById?.get(caseId)` to a real case. Without this, Phase 2 branches see undefined
        // and skip every candidate, yielding result.assigned=0 in the integration suite.
        expect(result.candidatesByAction.get('a1')).toBeInstanceOf(Set);
        expect(result.candidatesByAction.get('a1').size).toBe(2);
        expect(result.caseById.size).toBe(2);
        expect(result.caseById.get('c1')).toBeDefined();
        expect(result.caseById.get('c2')).toBeDefined();
        expect(result.contextMap.size).toBe(0);
        expect(result.metrics.actions_total).toBe(1);
        expect(result.metrics.actions_with_sql_prefilter).toBe(0);
        expect(result.metrics.candidates_distinct).toBe(2);
        expect(result.metrics.fallback_universe_loaded).toBe(true);
    });

    it('passive-mode candidatesByAction entries are independent Sets', async () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn() };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c1'), fakeCase('c2'), fakeCase('c3')]),
        };
        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
        });

        const result = await svc._prefilterCandidatesForTest([fakeAction('a1'), fakeAction('a2')], {
            evaluationNow: null,
        });

        const setA1 = result.candidatesByAction.get('a1');
        const setA2 = result.candidatesByAction.get('a2');
        // Distinct Set instances so a downstream mutation on one does not bleed into the other.
        expect(setA1).not.toBe(setA2);
        expect(setA1.size).toBe(3);
        expect(setA2.size).toBe(3);

        // Mutating setA1 must NOT affect setA2 (the shared-reference hazard).
        const firstId = [...setA1][0];
        setA1.delete(firstId);
        expect(setA1.size).toBe(2);
        expect(setA2.size).toBe(3);
        expect(setA2.has(firstId)).toBe(true);
    });
});

const fakeCase = (id, extra = {}) => ({
    id: { value: id },
    cliente_id: { value: 'cli' },
    clasificacion_id: { value: 'cla' },
    transicion_id: { value: 'tr' },
    grupo_id: { value: extra.grupo_id ?? null },
    responsable_id: { value: extra.responsable_id ?? null },
    toJson: () => ({ id, ...extra }),
});

const fakeAction = (id) => ({
    id: { value: id },
    conditions: { value: { combinator: 'and', rules: [] } },
    entity: { value: 'case' },
});

describe('AutomatedGroupAssignmentService — #prefilterCandidates with SQL collaborators', () => {
    it('builds candidatesByAction from per-action finder calls (all translatable)', async () => {
        const validator = { validateWithContext: jest.fn() };
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(new Set(['c1', 'c2']))
                .mockResolvedValueOnce(new Set(['c2', 'c3'])),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['c1', { cases: { id: 'c1' } }],
                    ['c2', { cases: { id: 'c2' } }],
                    ['c3', { cases: { id: 'c3' } }],
                ])
            ),
        };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c1'), fakeCase('c2'), fakeCase('c3')]),
        };

        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
            caseCandidateFinder: finder,
            caseContextBatchLoader: loader,
        });

        const result = await svc._prefilterCandidatesForTest([fakeAction('a1'), fakeAction('a2')], {
            evaluationNow: null,
        });

        expect(finder.find).toHaveBeenCalledTimes(2);
        expect(result.candidatesByAction.get('a1').size).toBe(2);
        expect(result.candidatesByAction.get('a2').size).toBe(2);
        expect(result.caseById.size).toBe(3);
        expect(result.contextMap.size).toBe(3);
        expect(result.metrics.fallback_universe_loaded).toBe(false);
    });

    it('loads fallback universe when at least one action returns NO_PREFILTER', async () => {
        const validator = { validateWithContext: jest.fn() };
        const finder = {
            find: jest
                .fn()
                .mockResolvedValueOnce(NO_PREFILTER)
                .mockResolvedValueOnce(new Set(['c2'])),
        };
        const loader = {
            load: jest.fn().mockResolvedValue(
                new Map([
                    ['c1', { cases: { id: 'c1' } }],
                    ['c2', { cases: { id: 'c2' } }],
                ])
            ),
        };
        // First execute: fallback universe (no restrictToIds)
        // Second execute: restricted bulk load with restrictToIds
        const findAllActive = {
            execute: jest
                .fn()
                .mockResolvedValueOnce([fakeCase('c1'), fakeCase('c2')])
                .mockResolvedValueOnce([fakeCase('c1'), fakeCase('c2')]),
        };

        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
            caseCandidateFinder: finder,
            caseContextBatchLoader: loader,
        });

        const result = await svc._prefilterCandidatesForTest([fakeAction('a1'), fakeAction('a2')], {
            evaluationNow: null,
        });

        expect(findAllActive.execute).toHaveBeenCalledTimes(2);
        expect(result.metrics.fallback_universe_loaded).toBe(true);
        expect(result.candidatesByAction.get('a1').size).toBe(2);
        expect(result.candidatesByAction.get('a2').size).toBe(1);
        expect(result.caseById.size).toBe(2);
    });

    it('skips bulk context load when allCandidateIds is empty', async () => {
        const validator = { validateWithContext: jest.fn() };
        const finder = { find: jest.fn().mockResolvedValue(new Set()) };
        const loader = { load: jest.fn() };
        const findAllActive = { execute: jest.fn().mockResolvedValue([]) };

        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
            caseCandidateFinder: finder,
            caseContextBatchLoader: loader,
        });

        const result = await svc._prefilterCandidatesForTest([fakeAction('a1')], { evaluationNow: null });

        expect(loader.load).not.toHaveBeenCalled();
        expect(findAllActive.execute).not.toHaveBeenCalled();
        expect(result.caseById.size).toBe(0);
        expect(result.contextMap.size).toBe(0);
    });

    it('splits a large candidate id set into <=1000-id chunks instead of one unbounded WHERE id IN (...)', async () => {
        const ids = Array.from({ length: 2500 }, (_, i) => `c${i}`);
        const validator = { validateWithContext: jest.fn() };
        const finder = { find: jest.fn().mockResolvedValue(new Set(ids)) };
        const loader = { load: jest.fn().mockResolvedValue(new Map(ids.map((id) => [id, { cases: { id } }]))) };
        const findAllActive = {
            execute: jest.fn(async (_filters, options) => options.restrictToIds.map((id) => fakeCase(id))),
        };

        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
            caseCandidateFinder: finder,
            caseContextBatchLoader: loader,
        });

        const result = await svc._prefilterCandidatesForTest([fakeAction('a1')], { evaluationNow: null });

        // ceil(2500 / 1000) = 3 chunk queries, none exceeding the 1000-id bind-parameter-safe size
        expect(findAllActive.execute).toHaveBeenCalledTimes(3);
        const requestedChunks = findAllActive.execute.mock.calls.map((call) => call[1].restrictToIds);
        requestedChunks.forEach((chunk) => expect(chunk.length).toBeLessThanOrEqual(1000));
        expect(requestedChunks.flat().sort()).toEqual([...ids].sort());
        expect(result.caseById.size).toBe(2500);
    });
});

describe('AutomatedGroupAssignmentService — #processAction switch dispatch', () => {
    it('increments result.errors when action_type is unknown', async () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn() };
        const svc = new AutomatedGroupAssignmentService(validator, stubDeps());

        const result = { assigned: 0, skipped: 0, errors: 0 };
        await svc._processActionForTest({
            action: { id: { value: 'a1' }, action_type: { value: 'UNKNOWN_TYPE' } },
            capacityByGroup: new Map(),
            usersByGroup: new Map(),
            contextMap: new Map(),
            evaluationNow: null,
            candidatesByAction: new Map(),
            caseById: new Map(),
            result,
        });

        expect(result.errors).toBe(1);
    });
});

describe('AutomatedGroupAssignmentService — #processNonWorkQueueAssignment with contextMap', () => {
    it('iterates only candidatesByAction.get(action.id), no caseFindAllActiveService call', async () => {
        const validator = { validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = { execute: jest.fn() };
        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
        });

        const action = {
            id: { value: 'a1' },
            action_type: { value: 'asignar_grupo_por_codigo_externo_dinamico' },
        };
        const c1 = fakeCase('c1');
        const c2 = fakeCase('c2');
        const ctx = {
            action,
            capacityByGroup: new Map(),
            usersByGroup: new Map(),
            contextMap: new Map([
                ['c1', { cases: { id: 'c1' } }],
                ['c2', { cases: { id: 'c2' } }],
            ]),
            evaluationNow: null,
            candidatesByAction: new Map([['a1', new Set(['c1', 'c2'])]]),
            caseById: new Map([
                ['c1', c1],
                ['c2', c2],
            ]),
            result: { assigned: 0, skipped: 0, errors: 0 },
        };

        // Inject dynamic handler that accepts and reports success
        svc.dynamicGroupAssignmentHandler = { execute: jest.fn().mockResolvedValue(true) };

        await svc._processActionForTest(ctx);

        expect(findAllActive.execute).not.toHaveBeenCalled();
        expect(validator.validateWithContext).toHaveBeenCalledTimes(2);
        expect(ctx.result.assigned).toBe(2);
    });

    it('falls back to validate() when contextMap is empty for the case id (legacy mode)', async () => {
        const validator = {
            validate: jest.fn().mockResolvedValue(true),
            validateWithContext: jest.fn(),
        };
        const svc = new AutomatedGroupAssignmentService(validator, stubDeps());

        const action = {
            id: { value: 'a1' },
            action_type: { value: 'asignar_grupo_por_codigo_externo_dinamico' },
        };
        const c1 = fakeCase('c1');
        const ctx = {
            action,
            capacityByGroup: new Map(),
            usersByGroup: new Map(),
            contextMap: new Map(), // empty → forces validate() legacy path
            evaluationNow: null,
            candidatesByAction: new Map([['a1', new Set(['c1'])]]),
            caseById: new Map([['c1', c1]]),
            result: { assigned: 0, skipped: 0, errors: 0 },
        };

        svc.dynamicGroupAssignmentHandler = { execute: jest.fn().mockResolvedValue(true) };

        await svc._processActionForTest(ctx);

        expect(validator.validate).toHaveBeenCalledTimes(1);
        expect(validator.validateWithContext).not.toHaveBeenCalled();
    });
});

describe('AutomatedGroupAssignmentService — #processCurrentGroupAssignment partition', () => {
    it('partitions candidates by grupo_id and delegates to #assignToGroupUsers per group', async () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn().mockResolvedValue(true) };
        const svc = new AutomatedGroupAssignmentService(validator, stubDeps());

        const spyDefault = jest.spyOn(svc.defaultStrategy, 'execute').mockResolvedValue(undefined);
        const spyPrior = jest.spyOn(svc.prioritizedStrategy, 'execute').mockResolvedValue(undefined);

        const action = {
            id: { value: 'a1' },
            action_type: { value: 'asignar_grupo_en_curso' },
            description: { value: 'a1-desc' },
        };
        const c1 = fakeCase('c1', { grupo_id: 'g1' });
        const c2 = fakeCase('c2', { grupo_id: 'g1' });
        const c3 = fakeCase('c3', { grupo_id: 'g2' });
        const ctx = {
            action,
            capacityByGroup: new Map([
                ['g1', { grupo_id: 'g1', capacidad: 5, work_queue_sorting_rules: [] }],
                ['g2', { grupo_id: 'g2', capacidad: 5, work_queue_sorting_rules: [] }],
            ]),
            usersByGroup: new Map([
                ['g1', [{ id: 'u1', remaining: 1 }]],
                ['g2', [{ id: 'u2', remaining: 1 }]],
            ]),
            contextMap: new Map(),
            evaluationNow: null,
            candidatesByAction: new Map([['a1', new Set(['c1', 'c2', 'c3'])]]),
            caseById: new Map([
                ['c1', c1],
                ['c2', c2],
                ['c3', c3],
            ]),
            result: { assigned: 0, skipped: 0, errors: 0 },
            trackerByGroup: new Map([
                ['g1', new CapacityTracker([{ id: 'u1', remaining: 1 }])],
                ['g2', new CapacityTracker([{ id: 'u2', remaining: 1 }])],
            ]),
        };

        await svc._processActionForTest(ctx);

        const allCalls = [...spyDefault.mock.calls, ...spyPrior.mock.calls];
        expect(allCalls).toHaveLength(2);

        const callG1 = allCalls.find(([args]) => args.groupId === 'g1');
        const callG2 = allCalls.find(([args]) => args.groupId === 'g2');
        expect(callG1[0].candidateCases.map((c) => c.id.value).sort()).toEqual(['c1', 'c2']);
        expect(callG2[0].candidateCases.map((c) => c.id.value)).toEqual(['c3']);

        spyDefault.mockRestore();
        spyPrior.mockRestore();
    });
});

describe('AutomatedGroupAssignmentService — list/external code propagation', () => {
    it('#handleGroupAssignment passes candidatesForGroup filtered to the resolved group', async () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn().mockResolvedValue(true) };
        const svc = new AutomatedGroupAssignmentService(validator, stubDeps());

        const c1 = fakeCase('c1', { grupo_id: 'gX' });
        const c2 = fakeCase('c2', { grupo_id: 'gX' });
        const spyDefault = jest.spyOn(svc.defaultStrategy, 'execute').mockResolvedValue(undefined);
        const spyPrior = jest.spyOn(svc.prioritizedStrategy, 'execute').mockResolvedValue(undefined);

        const args = {
            action: { id: { value: 'a1' }, action_type: { value: 'asignar_grupo_por_codigo_externo' } },
            groupId: 'gX',
            capacityByGroup: new Map([['gX', { grupo_id: 'gX', work_queue_sorting_rules: [] }]]),
            usersByGroup: new Map([['gX', [{ id: 'u1', remaining: 5 }]]]),
            contextMap: new Map(),
            evaluationNow: null,
            candidatesByAction: new Map([['a1', new Set(['c1', 'c2'])]]),
            caseById: new Map([
                ['c1', c1],
                ['c2', c2],
            ]),
            result: { assigned: 0, skipped: 0, errors: 0 },
            trackerByGroup: new Map([['gX', new CapacityTracker([{ id: 'u1', remaining: 5 }])]]),
        };

        await svc._handleGroupAssignmentForTest(args);

        const allCalls = [...spyDefault.mock.calls, ...spyPrior.mock.calls];
        expect(allCalls).toHaveLength(1);
        const passed = allCalls[0][0];
        expect(passed.groupId).toBe('gX');
        expect(passed.candidateCases.map((c) => c.id.value).sort()).toEqual(['c1', 'c2']);

        spyDefault.mockRestore();
        spyPrior.mockRestore();
    });
});

describe('AutomatedGroupAssignmentService — #assignToGroupUsers reorder', () => {
    it('skips reorder when workQueueSortingRules is empty', async () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = { execute: jest.fn() };
        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
        });

        const c1 = fakeCase('c1');
        const c2 = fakeCase('c2');

        await svc._assignToGroupUsersForTest({
            action: { id: { value: 'a1' } },
            groupId: 'g1',
            usersInGroup: [{ id: 'u1', remaining: 1 }],
            capacityByGroup: new Map([['g1', { work_queue_sorting_rules: [] }]]),
            candidatesForGroup: [c1, c2],
            contextMap: new Map([
                ['c1', { cases: {} }],
                ['c2', { cases: {} }],
            ]),
            evaluationNow: null,
            result: { assigned: 0, skipped: 0, errors: 0 },
            capacityTracker: new CapacityTracker([{ id: 'u1', remaining: 1 }]),
        });

        expect(findAllActive.execute).not.toHaveBeenCalled();
    });

    it('reorders candidatesForGroup via restrictToIds when sorting rules present', async () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn().mockResolvedValue(true) };
        const findAllActive = {
            execute: jest.fn().mockResolvedValue([fakeCase('c2'), fakeCase('c1')]),
        };
        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
        });

        const spyDefault = jest.spyOn(svc.defaultStrategy, 'execute').mockResolvedValue(undefined);

        const c1 = fakeCase('c1');
        const c2 = fakeCase('c2');

        try {
            await svc._assignToGroupUsersForTest({
                action: { id: { value: 'a1' } },
                groupId: 'g1',
                usersInGroup: [{ id: 'u1', remaining: 1 }],
                capacityByGroup: new Map([
                    ['g1', { work_queue_sorting_rules: [{ assign_strategy: 'oldest', order_type: 'asc' }] }],
                ]),
                candidatesForGroup: [c1, c2],
                contextMap: new Map(),
                evaluationNow: null,
                result: { assigned: 0, skipped: 0, errors: 0 },
                capacityTracker: new CapacityTracker([{ id: 'u1', remaining: 1 }]),
            });

            expect(findAllActive.execute).toHaveBeenCalledTimes(1);
            const callArgs = findAllActive.execute.mock.calls[0];
            expect(callArgs[1].restrictToIds.sort()).toEqual(['c1', 'c2']);
            expect(callArgs[1].work_queue_sorting_rules).toBeDefined();

            // Verify reorder propagates to strategy via candidateCases in the new order.
            expect(spyDefault).toHaveBeenCalledTimes(1);
            const strategyArgs = spyDefault.mock.calls[0][0];
            expect(strategyArgs.candidateCases.map((c) => c.id.value)).toEqual(['c2', 'c1']);
        } finally {
            spyDefault.mockRestore();
        }
    });
});

describe('AutomatedGroupAssignmentService — assign() prefilter wiring', () => {
    it('calls #prefilterCandidates once with evaluationNow materialized via dayjs', async () => {
        const validator = { validate: jest.fn().mockResolvedValue(true), validateWithContext: jest.fn() };
        const finder = { find: jest.fn().mockResolvedValue(new Set()) };
        const loader = { load: jest.fn().mockResolvedValue(new Map()) };
        const findAllActive = { execute: jest.fn().mockResolvedValue([]) };

        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
            caseCandidateFinder: finder,
            caseContextBatchLoader: loader,
        });

        await svc.assign({ actions: [fakeAction('a1')] });

        // finder.find called with { evaluationNow: <dayjs object> }
        expect(finder.find).toHaveBeenCalledTimes(1);
        const [actionArg, optsArg] = finder.find.mock.calls[0];
        expect(actionArg.id.value).toBe('a1');
        expect(optsArg.evaluationNow).toBeDefined();
        expect(typeof optsArg.evaluationNow.format).toBe('function'); // dayjs instance
    });

    it('emits automated-assignment.metrics with object payload (not stringified)', async () => {
        const validator = { validate: jest.fn().mockResolvedValue(true), validateWithContext: jest.fn() };
        const finder = { find: jest.fn().mockResolvedValue(new Set()) };
        const loader = { load: jest.fn().mockResolvedValue(new Map()) };
        const findAllActive = { execute: jest.fn().mockResolvedValue([]) };

        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            caseFindAllActiveService: findAllActive,
            caseCandidateFinder: finder,
            caseContextBatchLoader: loader,
        });

        const spy = jest.spyOn(Helper, 'logInfo');
        const debugSpy = jest.spyOn(Helper, 'logDebug');
        try {
            await svc.assign({ actions: [fakeAction('a1')] });

            const metricsCall = spy.mock.calls.find(([msg]) => msg === 'automated-assignment.metrics');
            expect(metricsCall).toBeDefined();
            expect(typeof metricsCall[1]).toBe('object');
            expect(metricsCall[1]).not.toBeNull();
            // Object payload (NOT a string) — guards against #legacyFallback dropping the JSON
            expect(typeof metricsCall[1]).not.toBe('string');
            expect(metricsCall[1].result).toBeDefined();

            // Prefilter detail moved to the debug entry: { prefilterMetrics, result }
            const prefilterCall = debugSpy.mock.calls.find(([msg]) => msg === 'automated-assignment.metrics.prefilter');
            expect(prefilterCall).toBeDefined();
            expect(prefilterCall[1].prefilterMetrics.actions_total).toBeDefined();
            expect(prefilterCall[1].result).toBeDefined();
        } finally {
            spy.mockRestore();
            debugSpy.mockRestore();
        }
    });
});

describe('AutomatedGroupAssignmentService — no-responsible log (Path B)', () => {
    it('emits automated-assignment.no-responsible-assigned when the group has no available users', async () => {
        const validator = { validate: jest.fn().mockResolvedValue(true), validateWithContext: jest.fn() };
        const svc = new AutomatedGroupAssignmentService(validator, {
            ...stubDeps(),
            assignationService: { execute: jest.fn().mockResolvedValue(null) }, // grupo sin responsable
        });
        // Aísla el evento de dominio: sólo nos interesa el log.
        svc.eventLogger = { logEvent: jest.fn().mockResolvedValue(undefined) };

        const spy = jest.spyOn(Helper, 'logInfo');
        try {
            const c1 = fakeCase('c1');
            await svc._handleGroupAssignmentForTest({
                action: { id: { value: 'a1' }, action_type: { value: 'asignar_grupo' } },
                groupId: 'g1',
                capacityByGroup: new Map(), // vacío → rama non-work-queue
                usersByGroup: new Map(),
                contextMap: new Map(), // fuerza validate()
                evaluationNow: null,
                candidatesByAction: new Map([['a1', new Set(['c1'])]]),
                caseById: new Map([['c1', c1]]),
                result: { assigned: 0, skipped: 0, errors: 0 },
                trackerByGroup: new Map(),
            });

            const call = spy.mock.calls.find(([msg]) => msg === 'automated-assignment.no-responsible-assigned');
            expect(call).toBeDefined();
            expect(call[1]).toMatchObject({
                reason: 'group_has_no_available_users',
                caseId: 'c1',
                groupId: 'g1',
                actionId: 'a1',
            });
        } finally {
            spy.mockRestore();
        }
    });
});

describe('AutomatedGroupAssignmentService — no-users log (Path A, grupo vacío)', () => {
    it('emits automated-assignment.no-responsible-assigned when the work-queue group has no users with capacity', async () => {
        const validator = { validate: jest.fn(), validateWithContext: jest.fn() };
        const svc = new AutomatedGroupAssignmentService(validator, stubDeps());

        const spy = jest.spyOn(Helper, 'logInfo');
        try {
            const result = { assigned: 0, skipped: 0, errors: 0 };
            await svc._assignToGroupUsersForTest({
                action: { id: { value: 'a1' } },
                groupId: 'g1',
                usersInGroup: [], // sin usuarios con capacidad
                capacityByGroup: new Map([['g1', { work_queue_sorting_rules: [] }]]),
                candidatesForGroup: [],
                contextMap: new Map(),
                evaluationNow: null,
                result,
                capacityTracker: new CapacityTracker([]),
            });

            const call = spy.mock.calls.find(([msg]) => msg === 'automated-assignment.no-responsible-assigned');
            expect(call).toBeDefined();
            expect(call[1]).toMatchObject({
                reason: 'group_has_no_users_with_capacity',
                groupId: 'g1',
                actionId: 'a1',
            });
            expect(result.skipped).toBe(1);
        } finally {
            spy.mockRestore();
        }
    });
});
