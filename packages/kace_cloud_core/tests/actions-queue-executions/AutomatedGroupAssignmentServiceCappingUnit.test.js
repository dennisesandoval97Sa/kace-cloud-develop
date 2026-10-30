import { jest } from '@jest/globals';
import { AutomatedGroupAssignmentService } from '../../src/actions-queue-executions/domain/services/AutomatedGroupAssignmentService.js';
import { ExternalCodeGroupResolver } from '../../src/actions-queue-executions/domain/services/ExternalCodeGroupResolver.js';
import { CapacityTracker } from '../../src/actions-queue-executions/domain/services/strategies/CapacityTracker.js';
import { ActionTypes } from '../../src/actions/domain/ActionTypes.js';

const makeAction = (id, type, extra = {}) => ({
    id: { value: id },
    description: { value: `action ${id}` },
    action_type: { value: type },
    ...extra,
});

describe('AutomatedGroupAssignmentService #capCandidatesByCapacity', () => {
    beforeEach(() => ExternalCodeGroupResolver.clearCache());

    it('caps an external-code action to capacity*factor ordered top-N before hydration', async () => {
        // capacity of group gX = 2 remaining → cap = min(HARD_CAP, max(MIN_CAP, ceil(2*3))) = max(50, 6) = 50
        const orderedIds = jest.fn().mockResolvedValue(Array.from({ length: 50 }, (_, i) => `c${i}`));
        const service = new AutomatedGroupAssignmentService(
            { validate: jest.fn(), validateWithContext: jest.fn() },
            {
                groupsRepository: {
                    findWorkQueueGroupsWithCapacity: jest.fn(),
                    search: jest.fn().mockResolvedValue([{ id: { value: 'gX' } }]),
                    tableName: 'grupos',
                },
                caseFindAllActiveService: { execute: jest.fn(), executeOrderedIds: orderedIds },
                caseUserAssignmentService: { execute: jest.fn() },
            }
        );

        const action = makeAction('a1', ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {
            external_group_code: { value: 'X1' },
        });
        const candidatesByAction = new Map([['a1', new Set(Array.from({ length: 500 }, (_, i) => `c${i}`))]]);
        const capacityByGroup = new Map([
            ['gX', { work_queue_sorting_rules: [{ assign_strategy: 'created_at', order_type: 'ASC' }] }],
        ]);
        const trackerByGroup = new Map([['gX', new CapacityTracker([{ id: 'u1', remaining: 2 }])]]);
        const metrics = { candidates_capped: 0, candidates_dropped: 0 };

        await service._capCandidatesByCapacityForTest([action], candidatesByAction, {
            capacityByGroup,
            trackerByGroup,
            metrics,
        });

        expect(orderedIds).toHaveBeenCalledWith(
            { 'cases.fecha_resolucion': null },
            {
                restrictToIds: expect.any(Array),
                work_queue_sorting_rules: [{ assign_strategy: 'created_at', order_type: 'ASC' }],
                limit: 50,
            }
        );
        expect(candidatesByAction.get('a1').size).toBe(50);
        expect(metrics.candidates_capped).toBe(1);
        expect(metrics.candidates_dropped).toBe(450);
    });

    it('does not cap when the candidate set is already within the cap', async () => {
        const orderedIds = jest.fn();
        const service = new AutomatedGroupAssignmentService(
            { validate: jest.fn(), validateWithContext: jest.fn() },
            {
                groupsRepository: {
                    findWorkQueueGroupsWithCapacity: jest.fn(),
                    search: jest.fn().mockResolvedValue([{ id: { value: 'gX' } }]),
                    tableName: 'grupos',
                },
                caseFindAllActiveService: { execute: jest.fn(), executeOrderedIds: orderedIds },
                caseUserAssignmentService: { execute: jest.fn() },
            }
        );
        const action = makeAction('a1', ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {
            external_group_code: { value: 'X1' },
        });
        const candidatesByAction = new Map([['a1', new Set(['c0', 'c1', 'c2'])]]); // 3 <= MIN_CAP
        const capacityByGroup = new Map([['gX', { work_queue_sorting_rules: [] }]]);
        const trackerByGroup = new Map([['gX', new CapacityTracker([{ id: 'u1', remaining: 1 }])]]);
        const metrics = { candidates_capped: 0, candidates_dropped: 0 };

        await service._capCandidatesByCapacityForTest([action], candidatesByAction, {
            capacityByGroup,
            trackerByGroup,
            metrics,
        });

        expect(orderedIds).not.toHaveBeenCalled();
        expect(candidatesByAction.get('a1').size).toBe(3);
        expect(metrics.candidates_capped).toBe(0);
    });

    it('caps a non-external-code action to the absolute CANDIDATE_HARD_CAP (2000) and leaves smaller sets alone', async () => {
        const orderedIds = jest.fn().mockResolvedValue(Array.from({ length: 2000 }, (_, i) => `c${i}`));
        const service = new AutomatedGroupAssignmentService(
            { validate: jest.fn(), validateWithContext: jest.fn() },
            {
                groupsRepository: {
                    findWorkQueueGroupsWithCapacity: jest.fn(),
                    search: jest.fn(),
                    tableName: 'grupos',
                },
                caseFindAllActiveService: { execute: jest.fn(), executeOrderedIds: orderedIds },
                caseUserAssignmentService: { execute: jest.fn() },
            }
        );

        // No external_group_code → groupId stays null regardless of capacityByGroup/trackerByGroup contents.
        const action = makeAction('a1', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value);
        const candidatesByAction = new Map([['a1', new Set(Array.from({ length: 2500 }, (_, i) => `c${i}`))]]);
        const capacityByGroup = new Map();
        const trackerByGroup = new Map();
        const metrics = { candidates_capped: 0, candidates_dropped: 0 };

        await service._capCandidatesByCapacityForTest([action], candidatesByAction, {
            capacityByGroup,
            trackerByGroup,
            metrics,
        });

        expect(orderedIds).toHaveBeenCalledWith(
            { 'cases.fecha_resolucion': null },
            { restrictToIds: expect.any(Array), work_queue_sorting_rules: [], limit: 2000 }
        );
        expect(candidatesByAction.get('a1').size).toBe(2000);
        expect(metrics.candidates_capped).toBe(1);
        expect(metrics.candidates_dropped).toBe(500);

        // Companion: a set already within the hard cap for the same action type is left untouched.
        orderedIds.mockClear();
        const smallCandidatesByAction = new Map([['a1', new Set(Array.from({ length: 2000 }, (_, i) => `c${i}`))]]);
        const smallMetrics = { candidates_capped: 0, candidates_dropped: 0 };

        await service._capCandidatesByCapacityForTest([action], smallCandidatesByAction, {
            capacityByGroup,
            trackerByGroup,
            metrics: smallMetrics,
        });

        expect(orderedIds).not.toHaveBeenCalled();
        expect(smallCandidatesByAction.get('a1').size).toBe(2000);
        expect(smallMetrics.candidates_capped).toBe(0);
    });

    it('falls back to CANDIDATE_HARD_CAP (not floored to MIN_CAP) when remaining capacity is infinite', async () => {
        const orderedIds = jest.fn().mockResolvedValue(Array.from({ length: 2000 }, (_, i) => `c${i}`));
        const service = new AutomatedGroupAssignmentService(
            { validate: jest.fn(), validateWithContext: jest.fn() },
            {
                groupsRepository: {
                    findWorkQueueGroupsWithCapacity: jest.fn(),
                    search: jest.fn().mockResolvedValue([{ id: { value: 'gX' } }]),
                    tableName: 'grupos',
                },
                caseFindAllActiveService: { execute: jest.fn(), executeOrderedIds: orderedIds },
                caseUserAssignmentService: { execute: jest.fn() },
            }
        );

        const action = makeAction('a1', ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {
            external_group_code: { value: 'X1' },
        });
        const candidatesByAction = new Map([['a1', new Set(Array.from({ length: 2500 }, (_, i) => `c${i}`))]]);
        const capacityByGroup = new Map([['gX', { work_queue_sorting_rules: [] }]]);
        const trackerByGroup = new Map([
            ['gX', new CapacityTracker([{ id: 'u1', remaining: Number.POSITIVE_INFINITY }])],
        ]);
        const metrics = { candidates_capped: 0, candidates_dropped: 0 };

        await service._capCandidatesByCapacityForTest([action], candidatesByAction, {
            capacityByGroup,
            trackerByGroup,
            metrics,
        });

        expect(orderedIds).toHaveBeenCalledWith(
            { 'cases.fecha_resolucion': null },
            { restrictToIds: expect.any(Array), work_queue_sorting_rules: [], limit: 2000 }
        );
        expect(candidatesByAction.get('a1').size).toBe(2000);
        expect(metrics.candidates_capped).toBe(1);
    });

    it('falls back to CANDIDATE_HARD_CAP (not floored to MIN_CAP) when the group has no tracker entry', async () => {
        const orderedIds = jest.fn().mockResolvedValue(Array.from({ length: 2000 }, (_, i) => `c${i}`));
        const service = new AutomatedGroupAssignmentService(
            { validate: jest.fn(), validateWithContext: jest.fn() },
            {
                groupsRepository: {
                    findWorkQueueGroupsWithCapacity: jest.fn(),
                    search: jest.fn().mockResolvedValue([{ id: { value: 'gX' } }]),
                    tableName: 'grupos',
                },
                caseFindAllActiveService: { execute: jest.fn(), executeOrderedIds: orderedIds },
                caseUserAssignmentService: { execute: jest.fn() },
            }
        );

        const action = makeAction('a1', ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {
            external_group_code: { value: 'X1' },
        });
        const candidatesByAction = new Map([['a1', new Set(Array.from({ length: 2500 }, (_, i) => `c${i}`))]]);
        const capacityByGroup = new Map([['gX', { work_queue_sorting_rules: [] }]]);
        // capacityByGroup knows about gX (work-queue group) but trackerByGroup has NO entry for it —
        // must NOT be conflated with remaining=0 (which would floor the cap to CANDIDATE_MIN_CAP).
        const trackerByGroup = new Map();
        const metrics = { candidates_capped: 0, candidates_dropped: 0 };

        await service._capCandidatesByCapacityForTest([action], candidatesByAction, {
            capacityByGroup,
            trackerByGroup,
            metrics,
        });

        expect(orderedIds).toHaveBeenCalledWith(
            { 'cases.fecha_resolucion': null },
            { restrictToIds: expect.any(Array), work_queue_sorting_rules: [], limit: 2000 }
        );
        expect(candidatesByAction.get('a1').size).toBe(2000);
        expect(metrics.candidates_capped).toBe(1);
    });
});
