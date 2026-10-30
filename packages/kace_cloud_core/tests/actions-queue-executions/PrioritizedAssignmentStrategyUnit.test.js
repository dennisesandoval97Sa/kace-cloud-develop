import { jest } from '@jest/globals';
import { PrioritizedAssignmentStrategy } from '../../src/actions-queue-executions/domain/services/strategies/PrioritizedAssignmentStrategy.js';
import { Helper } from '../../src/shared/infrastructure/utils/Helper.js';
import { CapacityTracker } from '../../src/actions-queue-executions/domain/services/strategies/CapacityTracker.js';

const fakeCase = (id) => ({ id: { value: id }, toJson: () => ({ id }) });
const fakeAction = (id) => ({ id: { value: id } });

describe('PrioritizedAssignmentStrategy', () => {
    it('uses validateWithContext when contextMap is provided', async () => {
        const validator = {
            validate: jest.fn(),
            validateWithContext: jest.fn().mockResolvedValue(true),
        };
        const assigner = { execute: jest.fn().mockResolvedValue(undefined) };
        const repo = { getPrioritizedCandidateId: jest.fn().mockResolvedValue(null) };
        const strategy = new PrioritizedAssignmentStrategy(validator, assigner, null, repo);

        const result = { assigned: 0, skipped: 0, errors: 0 };
        const usersInGroup = [{ id: 'u1', remaining: 2 }];
        await strategy.execute({
            action: fakeAction('a1'),
            groupId: 'g1',
            usersInGroup,
            candidateCases: [fakeCase('c1'), fakeCase('c2')],
            contextMap: new Map([
                ['c1', { cases: {} }],
                ['c2', { cases: {} }],
            ]),
            evaluationNow: 'now',
            result,
            capacityTracker: new CapacityTracker(usersInGroup),
        });

        expect(validator.validateWithContext).toHaveBeenCalledTimes(2);
        expect(validator.validate).not.toHaveBeenCalled();
        expect(result.assigned).toBe(2);
    });

    it('falls back to validate() when contextMap is undefined', async () => {
        const validator = {
            validate: jest.fn().mockResolvedValue(true),
            validateWithContext: jest.fn(),
        };
        const assigner = { execute: jest.fn().mockResolvedValue(undefined) };
        const repo = { getPrioritizedCandidateId: jest.fn().mockResolvedValue(null) };
        const strategy = new PrioritizedAssignmentStrategy(validator, assigner, null, repo);

        const result = { assigned: 0, skipped: 0, errors: 0 };
        const usersInGroup = [{ id: 'u1', remaining: 2 }];
        await strategy.execute({
            action: fakeAction('a1'),
            groupId: 'g1',
            usersInGroup,
            candidateCases: [fakeCase('c1'), fakeCase('c2')],
            result,
            capacityTracker: new CapacityTracker(usersInGroup),
        });

        expect(validator.validate).toHaveBeenCalledTimes(2);
        expect(validator.validateWithContext).not.toHaveBeenCalled();
    });

    it('preserves short-circuit when tracker.totalRemaining drops to 0', async () => {
        const validator = {
            validate: jest.fn(),
            validateWithContext: jest.fn().mockResolvedValue(true),
        };
        const assigner = { execute: jest.fn().mockResolvedValue(undefined) };
        const repo = { getPrioritizedCandidateId: jest.fn().mockResolvedValue(null) };
        const strategy = new PrioritizedAssignmentStrategy(validator, assigner, null, repo);

        const result = { assigned: 0, skipped: 0, errors: 0 };
        const usersInGroup = [{ id: 'u1', remaining: 1 }]; // 1 cupo total
        await strategy.execute({
            action: fakeAction('a1'),
            groupId: 'g1',
            usersInGroup,
            candidateCases: [fakeCase('c1'), fakeCase('c2'), fakeCase('c3')],
            contextMap: new Map([
                ['c1', { cases: {} }],
                ['c2', { cases: {} }],
                ['c3', { cases: {} }],
            ]),
            evaluationNow: null,
            result,
            capacityTracker: new CapacityTracker(usersInGroup),
        });

        // Solo c1 fue validado; c2, c3 fueron saltados por el break del totalRemaining <= 0
        expect(validator.validateWithContext).toHaveBeenCalledTimes(1);
        expect(result.assigned).toBe(1);
    });

    it('logs group_capacity_exhausted once when capacity runs out with cases left unassigned', async () => {
        const validator = {
            validate: jest.fn().mockResolvedValue(true),
            validateWithContext: jest.fn(),
        };
        const assigner = { execute: jest.fn().mockResolvedValue(undefined) };
        const repo = { getPrioritizedCandidateId: jest.fn().mockResolvedValue(null) };
        // 4th ctor arg is caseRepository; 3rd is eventLogger (null is fine — used via optional chaining).
        const strategy = new PrioritizedAssignmentStrategy(validator, assigner, null, repo);

        const result = { assigned: 0, skipped: 0, errors: 0 };
        const usersInGroup = [{ id: 'u1', remaining: 1 }]; // 1 cupo, 3 casos

        const spy = jest.spyOn(Helper, 'logInfo');
        try {
            await strategy.execute({
                action: fakeAction('a1'),
                groupId: 'g1',
                usersInGroup,
                candidateCases: [fakeCase('c1'), fakeCase('c2'), fakeCase('c3')],
                result,
                capacityTracker: new CapacityTracker(usersInGroup),
            });

            expect(result.assigned).toBe(1); // sólo c1 se asignó
            const call = spy.mock.calls.find(([msg]) => msg === 'automated-assignment.no-responsible-assigned');
            expect(call).toBeDefined();
            expect(call[1]).toMatchObject({
                reason: 'group_capacity_exhausted',
                groupId: 'g1',
                actionId: 'a1',
                unassignedCount: 2, // c2 y c3 sin asignar
            });
            const matches = spy.mock.calls.filter(([msg]) => msg === 'automated-assignment.no-responsible-assigned');
            expect(matches).toHaveLength(1); // una sola vez (resumen de grupo)
        } finally {
            spy.mockRestore();
        }
    });
});
