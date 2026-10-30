import { jest } from '@jest/globals';
import { AutomatedGroupAssignmentService } from '../../src/actions-queue-executions/domain/services/AutomatedGroupAssignmentService.js';
import { ActionTypes } from '../../src/actions/domain/ActionTypes.js';
import { ExternalCodeGroupResolver } from '../../src/actions-queue-executions/domain/services/ExternalCodeGroupResolver.js';
import { Helper } from '../../src/shared/infrastructure/utils/Helper.js';

const makeObserver = () => ({
    recordCapacitySnapshot: jest.fn(),
    recordPrefilterMetrics: jest.fn(),
    recordActionOutcome: jest.fn(),
    recordSkipReason: jest.fn(),
    recordGroupAssignment: jest.fn(),
});

const makeCase = (id, groupId) => ({
    id: { value: id },
    grupo_id: { value: groupId },
    responsable_id: { value: null },
    transicion_id: { value: null },
    cliente_id: { value: null },
    toJson: () => ({ id, grupo_id: groupId }),
});

const makeAction = (id, type, extra = {}) => ({
    id: { value: id },
    description: { value: `action ${id}` },
    action_type: { value: type },
    ...extra,
});

const CAPACITY = [
    {
        grupo_id: 'g1',
        capacidad: 2,
        max_cases_per_user: 5,
        work_queue_sorting_rules: [],
        assignLastResponsibleIgnoreDefault: false,
        users: [{ id: 'u1', remaining: 2 }],
    },
];

function makeService({ observer, cases, capacity = CAPACITY, groupsRepository, caseRepository }) {
    const mocks = {
        groupsRepository: groupsRepository ?? {
            findWorkQueueGroupsWithCapacity: jest.fn().mockResolvedValue(capacity),
        },
        caseRepository: caseRepository ?? {}, // sin .connection → AutomatedAssignmentEventLogger queda deshabilitado
        assignationService: { execute: jest.fn().mockResolvedValue(null) },
        caseFindAllActiveService: { execute: jest.fn().mockResolvedValue(cases) },
        caseUserAssignmentService: { execute: jest.fn().mockResolvedValue() },
    };
    const service = new AutomatedGroupAssignmentService(
        { validate: jest.fn().mockResolvedValue(true), validateWithContext: jest.fn().mockResolvedValue(true) },
        { ...mocks, runObserver: observer }
    );
    return { service, mocks };
}

// Llamadas al servicio de asignación normalizadas a [caseId, userId, groupId] para comparar paridad.
const assignmentCalls = (mocks) =>
    mocks.caseUserAssignmentService.execute.mock.calls.map(([caseEntity, userId, groupId]) => [
        caseEntity.id.value,
        userId,
        groupId,
    ]);

describe('AutomatedGroupAssignmentService observer instrumentation (passive mode)', () => {
    beforeEach(() => ExternalCodeGroupResolver.clearCache());

    it('records capacity snapshot, prefilter metrics and per-action outcome', async () => {
        const observer = makeObserver();
        const cases = [makeCase('c1', 'g1'), makeCase('c2', 'g1'), makeCase('c3', 'g1')];
        const { service } = makeService({ observer, cases });
        const action = makeAction('a1', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value);

        const result = await service.assign({ actions: [action] });

        expect(observer.recordCapacitySnapshot).toHaveBeenCalledWith(CAPACITY);
        expect(observer.recordPrefilterMetrics).toHaveBeenCalledWith(
            expect.objectContaining({ fallback_universe_loaded: true, candidates_distinct: 3 })
        );
        expect(observer.recordActionOutcome).toHaveBeenCalledWith(
            action,
            expect.objectContaining({
                candidates: 3,
                assigned: result.assigned,
                skipped: result.skipped,
                errors: result.errors,
                duration_ms: expect.any(Number),
            })
        );
        // u1 tiene remaining=2 y hay 3 candidatos válidos → 2 asignados vía estrategia
        expect(result.assigned).toBe(2);
        expect(observer.recordGroupAssignment).toHaveBeenCalledWith('g1');
        expect(observer.recordGroupAssignment).toHaveBeenCalledTimes(2);
    });

    it('produces identical assignment result with and without observer', async () => {
        const cases = [makeCase('c1', 'g1'), makeCase('c2', 'g1')];
        const withObserver = makeService({ observer: makeObserver(), cases });
        const withoutObserver = makeService({ observer: undefined, cases });

        const resultWith = await withObserver.service.assign({
            actions: [makeAction('a1', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value)],
        });
        const resultWithout = await withoutObserver.service.assign({
            actions: [makeAction('a1', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value)],
        });

        expect(resultWith).toEqual(resultWithout);
        // Misma secuencia exacta de asignaciones caso→usuario→grupo en ambos runs.
        expect(assignmentCalls(withObserver.mocks)).toEqual(assignmentCalls(withoutObserver.mocks));
        expect(assignmentCalls(withObserver.mocks).length).toBeGreaterThan(0);
    });

    it('produces identical result with and without observer through the prioritized strategy', async () => {
        const capacity = [{ ...CAPACITY[0], assignLastResponsibleIgnoreDefault: true }];
        const cases = [makeCase('c1', 'g1'), makeCase('c2', 'g1')];
        const makePrioritized = (observer) =>
            makeService({
                observer,
                cases,
                capacity,
                // sin .connection → event logger deshabilitado; sólo la estrategia priorizada lo usa
                caseRepository: { getPrioritizedCandidateId: jest.fn().mockResolvedValue(null) },
            });
        const withObserver = makePrioritized(makeObserver());
        const withoutObserver = makePrioritized(undefined);

        const resultWith = await withObserver.service.assign({
            actions: [makeAction('a1', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value)],
        });
        const resultWithout = await withoutObserver.service.assign({
            actions: [makeAction('a1', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value)],
        });

        expect(resultWith).toEqual(resultWithout);
        expect(assignmentCalls(withObserver.mocks)).toEqual(assignmentCalls(withoutObserver.mocks));
        expect(assignmentCalls(withObserver.mocks).length).toBeGreaterThan(0);
    });

    it('produces identical result with and without observer through the external_group_not_found skip path', async () => {
        const cases = [makeCase('c1', 'g1')];
        const makeExternal = (observer) =>
            makeService({
                observer,
                cases,
                groupsRepository: {
                    findWorkQueueGroupsWithCapacity: jest.fn().mockResolvedValue(CAPACITY),
                    search: jest.fn().mockResolvedValue([]), // vacía en ambas búsquedas → external_group_not_found
                    tableName: 'grupos', // requerido por la construcción de Criteria
                },
            });
        const withObserver = makeExternal(makeObserver());
        const withoutObserver = makeExternal(undefined);
        const action = () =>
            makeAction('a1', ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {
                external_group_code: { value: 'X1' },
            });

        const resultWith = await withObserver.service.assign({ actions: [action()] });
        const resultWithout = await withoutObserver.service.assign({ actions: [action()] });

        expect(resultWith).toEqual(resultWithout);
        expect(resultWith).toEqual({ assigned: 0, skipped: 1, errors: 0 });
        expect(assignmentCalls(withObserver.mocks)).toEqual([]);
        expect(assignmentCalls(withoutObserver.mocks)).toEqual([]);
    });

    const CAPACITY_NO_USERS = [
        {
            grupo_id: 'gX',
            capacidad: 0,
            max_cases_per_user: 5,
            work_queue_sorting_rules: [],
            assignLastResponsibleIgnoreDefault: false,
            users: [],
        },
    ];

    const makeDeadActionService = ({ observer, backlogSnapshotsRepository }) => {
        const candidateFinder = { find: jest.fn(), count: jest.fn() };
        const contextLoader = { load: jest.fn().mockResolvedValue(new Map()) };
        const service = new AutomatedGroupAssignmentService(
            { validate: jest.fn(), validateWithContext: jest.fn() },
            {
                groupsRepository: {
                    findWorkQueueGroupsWithCapacity: jest.fn().mockResolvedValue(CAPACITY_NO_USERS),
                    search: jest.fn().mockResolvedValue([{ id: { value: 'gX' } }]),
                    tableName: 'grupos',
                },
                caseFindAllActiveService: { execute: jest.fn().mockResolvedValue([]) },
                caseUserAssignmentService: { execute: jest.fn() },
                assignationService: { execute: jest.fn() },
                caseCandidateFinder: candidateFinder,
                caseContextBatchLoader: contextLoader,
                backlogSnapshotsRepository,
                runObserver: observer,
            }
        );
        return { service, candidateFinder, contextLoader };
    };

    const deadAction = () =>
        makeAction('a1', ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {
            external_group_code: { value: 'X1' },
        });

    it('short-circuits dead external-code actions and takes their backlog from the snapshot (never COUNT)', async () => {
        const observer = makeObserver();
        const backlogSnapshotsRepository = {
            findByActionIds: jest
                .fn()
                .mockResolvedValue(new Map([['a1', { backlog: 8575, computed_at: '2026-10-15T10:02:00.000Z' }]])),
        };
        const { service, candidateFinder, contextLoader } = makeDeadActionService({
            observer,
            backlogSnapshotsRepository,
        });
        const action = deadAction();

        const logInfoSpy = jest.spyOn(Helper, 'logInfo');
        try {
            const result = await service.assign({ actions: [action] });

            expect(result).toEqual({ assigned: 0, skipped: 1, errors: 0 });
            expect(observer.recordSkipReason).toHaveBeenCalledWith('a1', 'group_has_no_users_with_capacity');
            expect(candidateFinder.count).not.toHaveBeenCalled();
            expect(candidateFinder.find).not.toHaveBeenCalled();
            expect(contextLoader.load).not.toHaveBeenCalled();
            expect(backlogSnapshotsRepository.findByActionIds).toHaveBeenCalledTimes(1);
            expect(backlogSnapshotsRepository.findByActionIds).toHaveBeenCalledWith(['a1']);
            expect(observer.recordActionOutcome).toHaveBeenCalledWith(
                action,
                expect.objectContaining({
                    candidates: 0,
                    candidates_backlog: 8575,
                    backlog_computed_at: '2026-10-15T10:02:00.000Z',
                    skipped: 1,
                })
            );
            expect(observer.recordPrefilterMetrics).toHaveBeenCalledWith(
                expect.objectContaining({ actions_total: 1, dead_actions: 1, candidates_backlog_total: 8575 })
            );
            const resourceCall = logInfoSpy.mock.calls.find(
                ([msg]) => msg === 'automated-assignment.metrics.resources'
            );
            expect(resourceCall[1]).toEqual(expect.objectContaining({ candidates_backlog_total: 8575 }));
        } finally {
            logInfoSpy.mockRestore();
        }
    });

    it('reports a null backlog when the dead action has no snapshot yet', async () => {
        const observer = makeObserver();
        const { service } = makeDeadActionService({
            observer,
            backlogSnapshotsRepository: { findByActionIds: jest.fn().mockResolvedValue(new Map()) },
        });
        const action = deadAction();

        await service.assign({ actions: [action] });

        expect(observer.recordActionOutcome).toHaveBeenCalledWith(
            action,
            expect.objectContaining({ candidates_backlog: null, backlog_computed_at: null })
        );
        expect(observer.recordPrefilterMetrics).toHaveBeenCalledWith(
            expect.objectContaining({ candidates_backlog_total: 0 })
        );
    });

    it('keeps the tick alive with null backlogs when the snapshot read fails', async () => {
        const observer = makeObserver();
        const logErrorSpy = jest.spyOn(Helper, 'logError').mockImplementation(() => {});
        const { service, candidateFinder } = makeDeadActionService({
            observer,
            backlogSnapshotsRepository: { findByActionIds: jest.fn().mockRejectedValue(new Error('no table')) },
        });
        const action = deadAction();
        try {
            const result = await service.assign({ actions: [action] });

            expect(result).toEqual({ assigned: 0, skipped: 1, errors: 0 });
            expect(candidateFinder.count).not.toHaveBeenCalled();
            expect(logErrorSpy).toHaveBeenCalled();
            expect(observer.recordActionOutcome).toHaveBeenCalledWith(
                action,
                expect.objectContaining({ candidates_backlog: null, backlog_computed_at: null })
            );
        } finally {
            logErrorSpy.mockRestore();
        }
    });

    it('works without a snapshots repository (null backlog, no throw)', async () => {
        const observer = makeObserver();
        const { service, candidateFinder } = makeDeadActionService({ observer, backlogSnapshotsRepository: undefined });
        const action = deadAction();

        const result = await service.assign({ actions: [action] });

        expect(result).toEqual({ assigned: 0, skipped: 1, errors: 0 });
        expect(candidateFinder.count).not.toHaveBeenCalled();
        expect(observer.recordActionOutcome).toHaveBeenCalledWith(
            action,
            expect.objectContaining({ candidates_backlog: null, backlog_computed_at: null })
        );
    });

    it('records backlog_computed_at null for live actions (their backlog is live)', async () => {
        const observer = makeObserver();
        const cases = [makeCase('c1', 'g1')];
        const { service } = makeService({ observer, cases });
        const action = makeAction('a1', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value);

        await service.assign({ actions: [action] });

        expect(observer.recordActionOutcome).toHaveBeenCalledWith(
            action,
            expect.objectContaining({ backlog_computed_at: null })
        );
    });

    it('caps a large live candidate set before hydration while preserving the pre-cap backlog', async () => {
        const observer = makeObserver();

        // Live external-code action → work-queue group gX WITH users (remaining 2) so it is NOT dead.
        const capacityWithUsers = [
            {
                grupo_id: 'gX',
                capacidad: 2,
                max_cases_per_user: 5,
                work_queue_sorting_rules: [],
                assignLastResponsibleIgnoreDefault: false,
                users: [{ id: 'u1', remaining: 2 }],
            },
        ];

        // Prefilter yields 500 candidates; the cap trims what gets hydrated.
        // remaining 2 → ceil(2*3)=6, clamped up to CANDIDATE_MIN_CAP=50.
        const prefilterIds = new Set(Array.from({ length: 500 }, (_, i) => `c${i}`));
        const topIds = Array.from({ length: 50 }, (_, i) => `c${i}`);
        const hydratedCases = topIds.map((id) => makeCase(id, 'gX'));

        let maxLoaded = 0;
        const contextLoader = {
            load: jest.fn(async (cases) => {
                maxLoaded = Math.max(maxLoaded, cases.length);
                return new Map();
            }),
        };
        const candidateFinder = { find: jest.fn().mockResolvedValue(prefilterIds), count: jest.fn() };
        const executeOrderedIds = jest.fn().mockResolvedValue(topIds);

        const service = new AutomatedGroupAssignmentService(
            { validate: jest.fn().mockResolvedValue(true), validateWithContext: jest.fn().mockResolvedValue(true) },
            {
                groupsRepository: {
                    findWorkQueueGroupsWithCapacity: jest.fn().mockResolvedValue(capacityWithUsers),
                    search: jest.fn().mockResolvedValue([{ id: { value: 'gX' } }]),
                    tableName: 'grupos',
                },
                caseFindAllActiveService: {
                    execute: jest.fn().mockResolvedValue(hydratedCases),
                    executeOrderedIds,
                },
                caseUserAssignmentService: { execute: jest.fn().mockResolvedValue() },
                assignationService: { execute: jest.fn() },
                caseCandidateFinder: candidateFinder,
                caseContextBatchLoader: contextLoader,
                runObserver: observer,
            }
        );

        const action = makeAction('a1', ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {
            external_group_code: { value: 'X1' },
        });

        await service.assign({ actions: [action] });

        // 1) Capping ran with the active-case filter and the capacity-derived limit
        //    (remaining 2 → ceil(2*3)=6, clamped up to MIN_CAP=50).
        expect(executeOrderedIds).toHaveBeenCalledWith(
            { 'cases.fecha_resolucion': null },
            expect.objectContaining({ limit: 50 })
        );
        // 2) The context loader never saw the full 500 — only the capped set (<= 50).
        expect(maxLoaded).toBeLessThanOrEqual(50);
        expect(maxLoaded).toBeGreaterThan(0);

        // 3a) Per-action backlog is the PRE-CAP count (500), while candidates reflects the loaded/capped set.
        expect(observer.recordActionOutcome).toHaveBeenCalledWith(
            action,
            expect.objectContaining({ candidates: 50, candidates_backlog: 500 })
        );
        // 3b) Tick-level backlog preserves pre-cap (500 live + 0 dead), NOT the capped distinct.
        expect(observer.recordPrefilterMetrics).toHaveBeenCalledWith(
            expect.objectContaining({ candidates_backlog_total: 500, candidates_capped: 1, candidates_dropped: 450 })
        );
    });

    it('emits an always-on resource metric with heap and phase durations', async () => {
        const logInfoSpy = jest.spyOn(Helper, 'logInfo');
        try {
            const cases = [makeCase('c1', 'g1')];
            const { service } = makeService({ observer: makeObserver(), cases });
            const action = makeAction('a1', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value);

            await service.assign({ actions: [action] });

            const resourceCall = logInfoSpy.mock.calls.find(
                ([msg]) => msg === 'automated-assignment.metrics.resources'
            );
            expect(resourceCall).toBeDefined();
            expect(resourceCall[1]).toEqual(
                expect.objectContaining({
                    heap_used_mb_before: expect.any(Number),
                    heap_used_mb_after: expect.any(Number),
                    candidates_distinct: expect.any(Number),
                    duration_ms: expect.objectContaining({
                        prefilter: expect.any(Number),
                        bulk_context: expect.any(Number),
                    }),
                })
            );
        } finally {
            logInfoSpy.mockRestore();
        }
    });
});
