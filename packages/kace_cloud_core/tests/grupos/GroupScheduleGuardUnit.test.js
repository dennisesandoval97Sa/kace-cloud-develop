import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { GROUP_SCHEDULE_UNAVAILABLE } from '@kace/error-codes';
import { GroupScheduleGuard } from '../../src/grupos';
import { ShiftManagement } from '../../src/shift-management';
import { ValidationFailError } from '../../src/shared/index.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';

describe('GroupScheduleGuard', () => {
    const trx = { name: 'group-save-trx' };
    const repositoryFor = (schedule) => ({
        find: jest.fn().mockResolvedValue(schedule),
        findLocked: jest.fn().mockResolvedValue(schedule),
    });
    const guardFor = (schedule) => new GroupScheduleGuard(repositoryFor(schedule));

    const expectUnavailable = async (guard, horarioId) => {
        const error = await guard.ensureScheduleAvailable(horarioId, trx).catch((e) => e);

        expect(error).toBeInstanceOf(ValidationFailError);
        expect(error.statusCode).toBe(400);
        expect(error.field).toBe('horario_id');
        expect(error.publicErrorCode).toBe(GROUP_SCHEDULE_UNAVAILABLE);
    };

    it('accepts an existing, non-deleted schedule', async () => {
        const schedule = ShiftManagement.create(ShiftManagementMother.dto());

        await expect(guardFor(schedule).ensureScheduleAvailable(schedule.id.value, trx)).resolves.toBeUndefined();
    });

    it('checks the schedule with a shared lock on the primary, inside the group save transaction', async () => {
        const schedule = ShiftManagement.create(ShiftManagementMother.dto());
        const repository = repositoryFor(schedule);

        await new GroupScheduleGuard(repository).ensureScheduleAvailable(schedule.id.value, trx);

        expect(repository.findLocked).toHaveBeenCalledTimes(1);
        const [id, usedTrx, options] = repository.findLocked.mock.calls[0];
        expect(id.value).toBe(schedule.id.value);
        expect(usedTrx).toBe(trx);
        expect(options?.forUpdate).toBeFalsy();
        expect(repository.find).not.toHaveBeenCalled();
    });

    it.each([null, undefined, ''])(
        'rejects an empty horario_id (%p) with a 400, not a plain Error',
        async (horarioId) => {
            const repository = repositoryFor(null);

            await expectUnavailable(new GroupScheduleGuard(repository), horarioId);
            expect(repository.findLocked).not.toHaveBeenCalled();
        }
    );

    it('rejects a schedule that does not exist', async () => {
        await expectUnavailable(guardFor(null), uuidv4());
    });

    it('rejects a soft-deleted schedule', async () => {
        const schedule = ShiftManagement.create(ShiftManagementMother.dto());
        schedule.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        await expectUnavailable(guardFor(schedule), schedule.id.value);
    });

    describe('findAvailableSchedule', () => {
        it('returns the schedule when it exists and is not deleted', async () => {
            const schedule = ShiftManagement.create(ShiftManagementMother.dto());

            await expect(guardFor(schedule).findAvailableSchedule(schedule.id.value)).resolves.toBe(schedule);
        });

        it('returns null for a missing or soft-deleted schedule', async () => {
            const deleted = ShiftManagement.create(ShiftManagementMother.dto());
            deleted.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

            await expect(guardFor(null).findAvailableSchedule(uuidv4())).resolves.toBeNull();
            await expect(guardFor(deleted).findAvailableSchedule(deleted.id.value)).resolves.toBeNull();
        });

        it.each([null, undefined, ''])(
            'returns null for an empty horario_id (%p) without querying',
            async (horarioId) => {
                const repository = repositoryFor(null);

                await expect(new GroupScheduleGuard(repository).findAvailableSchedule(horarioId)).resolves.toBeNull();
                expect(repository.find).not.toHaveBeenCalled();
            }
        );
    });
});
