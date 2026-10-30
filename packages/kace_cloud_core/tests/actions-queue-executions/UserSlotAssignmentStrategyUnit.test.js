import { jest } from '@jest/globals';
import { UserSlotAssignmentStrategy } from '../../src/actions-queue-executions/domain/services/strategies/UserSlotAssignmentStrategy.js';
import { CapacityTracker } from '../../src/actions-queue-executions/domain/services/strategies/CapacityTracker.js';
import { Helper } from '../../src/shared/infrastructure/utils/Helper.js';

const fakeCase = (id) => ({ id: { value: id }, toJson: () => ({ id }) });
const fakeAction = (id) => ({ id: { value: id } });

describe('UserSlotAssignmentStrategy', () => {
    it('uses validateWithContext when contextMap is provided', async () => {
        const validator = {
            validate: jest.fn(),
            validateWithContext: jest.fn().mockResolvedValue(true),
        };
        const assigner = { execute: jest.fn().mockResolvedValue(undefined) };
        const strategy = new UserSlotAssignmentStrategy(validator, assigner);

        const result = { assigned: 0, skipped: 0, errors: 0 };
        const usersInGroup = [{ id: 'u1', remaining: 1 }];
        await strategy.execute({
            action: fakeAction('a1'),
            groupId: 'g1',
            usersInGroup,
            candidateCases: [fakeCase('c1')],
            contextMap: new Map([['c1', { cases: {} }]]),
            evaluationNow: 'now',
            result,
            capacityTracker: new CapacityTracker(usersInGroup),
        });

        expect(validator.validateWithContext).toHaveBeenCalledTimes(1);
        expect(validator.validateWithContext).toHaveBeenCalledWith(
            expect.objectContaining({ id: { value: 'c1' } }),
            expect.anything(),
            { cases: {} },
            { evaluationNow: 'now' }
        );
        expect(validator.validate).not.toHaveBeenCalled();
        expect(result.assigned).toBe(1);
    });

    it('falls back to validate() when contextMap is undefined', async () => {
        const validator = {
            validate: jest.fn().mockResolvedValue(true),
            validateWithContext: jest.fn(),
        };
        const assigner = { execute: jest.fn().mockResolvedValue(undefined) };
        const strategy = new UserSlotAssignmentStrategy(validator, assigner);

        const result = { assigned: 0, skipped: 0, errors: 0 };
        const usersInGroup = [{ id: 'u1', remaining: 1 }];
        await strategy.execute({
            action: fakeAction('a1'),
            groupId: 'g1',
            usersInGroup,
            candidateCases: [fakeCase('c1')],
            result,
            capacityTracker: new CapacityTracker(usersInGroup),
        });

        expect(validator.validate).toHaveBeenCalledTimes(1);
        expect(validator.validateWithContext).not.toHaveBeenCalled();
        expect(result.assigned).toBe(1);
    });

    it('preserves short-circuit: stops validating after slots filled', async () => {
        const validator = {
            validate: jest.fn(),
            validateWithContext: jest.fn().mockResolvedValue(true),
        };
        const assigner = { execute: jest.fn().mockResolvedValue(undefined) };
        const strategy = new UserSlotAssignmentStrategy(validator, assigner);

        const result = { assigned: 0, skipped: 0, errors: 0 };
        const usersInGroup = [{ id: 'u1', remaining: 1 }]; // 1 slot
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

        // Only c1 was validated; c2 and c3 were skipped because slot filled
        expect(validator.validateWithContext).toHaveBeenCalledTimes(1);
        expect(result.assigned).toBe(1);
    });

    it('logs group_capacity_exhausted once when capacity runs out with cases left unassigned', async () => {
        const validator = {
            validate: jest.fn().mockResolvedValue(true),
            validateWithContext: jest.fn(),
        };
        const assigner = { execute: jest.fn().mockResolvedValue(undefined) };
        const strategy = new UserSlotAssignmentStrategy(validator, assigner);

        const result = { assigned: 0, skipped: 0, errors: 0 };
        const usersInGroup = [{ id: 'u1', remaining: 1 }]; // 1 solo cupo, 3 casos candidatos

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
                unassignedCount: 2, // c2 y c3 quedaron sin asignar
            });
            // Se emite UNA sola vez (resumen de grupo, no por caso).
            const matches = spy.mock.calls.filter(([msg]) => msg === 'automated-assignment.no-responsible-assigned');
            expect(matches).toHaveLength(1);
        } finally {
            spy.mockRestore();
        }
    });
});
