import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { SHIFT_MANAGEMENT_IN_USE_BY_GROUPS } from '@kace/error-codes';
import { ScheduleUsageGuard } from '../../src/shift-management';
import { CustomError } from '../../src/shared/index.js';

describe('ScheduleUsageGuard', () => {
    const trx = { name: 'delete-trx' };
    const guardCounting = (count) => {
        const groupsRepository = { countActiveByHorarioId: jest.fn().mockResolvedValue(count) };
        return { guard: new ScheduleUsageGuard(groupsRepository), groupsRepository };
    };

    it('allows the delete when no group uses the schedule, counting inside the given transaction', async () => {
        const { guard, groupsRepository } = guardCounting(0);
        const scheduleId = uuidv4();

        await expect(guard.ensureNotInUse(scheduleId, trx)).resolves.toBeUndefined();
        expect(groupsRepository.countActiveByHorarioId).toHaveBeenCalledWith(scheduleId, trx);
    });

    it('rejects with a 400 carrying the public code and the count when groups use the schedule', async () => {
        const { guard } = guardCounting(3);

        const error = await guard.ensureNotInUse(uuidv4(), trx).catch((e) => e);

        expect(error).toBeInstanceOf(CustomError);
        expect(error.statusCode).toBe(400);
        expect(error.publicErrorCode).toBe(SHIFT_MANAGEMENT_IN_USE_BY_GROUPS);
        expect(error.fields).toEqual({ count: 3 });
    });
});
