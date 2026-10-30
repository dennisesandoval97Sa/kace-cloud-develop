import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { NOT_FOUND_ERROR, SHIFT_MANAGEMENT_IN_USE_BY_GROUPS } from '@kace/error-codes';
import { ScheduleUsageGuard, ShiftManagement, ShiftManagementDeleter } from '../../src/shift-management';
import { CustomError } from '../../src/shared/index.js';
import ShiftManagementMother from './domain/ShiftManagementMother';

describe('ShiftManagementDeleter', () => {
    const trx = { name: 'delete-trx' };
    const deleteDto = () => ({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

    const buildDeleter = (
        groupsUsingSchedule,
        { schedule = ShiftManagement.create(ShiftManagementMother.dto()) } = {}
    ) => {
        const calls = [];
        const repository = {
            withTransaction: jest.fn(async (callback) => {
                calls.push('begin');
                const result = await callback(trx);
                calls.push('commit');
                return result;
            }),
            findLocked: jest.fn(async () => {
                calls.push('lockSchedule');
                return schedule;
            }),
            update: jest.fn(async () => calls.push('update')),
            saveHistory: jest.fn(async () => calls.push('saveHistory')),
        };
        const groupsRepository = {
            countActiveByHorarioId: jest.fn(async () => {
                calls.push('countGroups');
                return groupsUsingSchedule;
            }),
        };
        const deleter = new ShiftManagementDeleter(repository, new ScheduleUsageGuard(groupsRepository));
        return { deleter, repository, groupsRepository, calls, id: schedule?.id.value ?? uuidv4() };
    };

    it('deletes a schedule that no group uses', async () => {
        const { deleter, repository, id } = buildDeleter(0);

        await deleter.execute(id, deleteDto());

        expect(repository.update).toHaveBeenCalledWith(expect.any(ShiftManagement), trx);
        expect(repository.saveHistory).toHaveBeenCalledWith(expect.any(ShiftManagement), expect.any(Object), trx);
    });

    it('locks the schedule row and counts its groups inside the delete transaction', async () => {
        const { deleter, repository, groupsRepository, calls, id } = buildDeleter(0);

        await deleter.execute(id, deleteDto());

        expect(calls).toEqual(['begin', 'lockSchedule', 'countGroups', 'update', 'saveHistory', 'commit']);
        const [lockedId, lockTrx, options] = repository.findLocked.mock.calls[0];
        expect(lockedId.value).toBe(id);
        expect(lockTrx).toBe(trx);
        expect(options).toEqual({ forUpdate: true });
        expect(groupsRepository.countActiveByHorarioId).toHaveBeenCalledWith(id, trx);
    });

    it('rejects deleting a schedule still used by groups and leaves it untouched', async () => {
        const { deleter, repository, id } = buildDeleter(2);

        const error = await deleter.execute(id, deleteDto()).catch((e) => e);

        expect(error).toBeInstanceOf(CustomError);
        expect(error.statusCode).toBe(400);
        expect(error.publicErrorCode).toBe(SHIFT_MANAGEMENT_IN_USE_BY_GROUPS);
        expect(error.fields).toEqual({ count: 2 });
        expect(repository.update).not.toHaveBeenCalled();
        expect(repository.saveHistory).not.toHaveBeenCalled();
    });

    it('refuses to be built without the usage guard, so an in-use schedule cannot be deleted', () => {
        expect(() => new ShiftManagementDeleter({})).toThrow('usageGuard is required');
    });

    it('treats an already deleted schedule as done, without counting groups or writing history', async () => {
        const schedule = ShiftManagement.create(ShiftManagementMother.dto());
        schedule.delete(deleteDto());
        schedule.flushChanges();
        const { deleter, groupsRepository, repository, id } = buildDeleter(1, { schedule });

        await expect(deleter.execute(id, deleteDto())).resolves.toBeUndefined();

        expect(groupsRepository.countActiveByHorarioId).not.toHaveBeenCalled();
        expect(repository.update).not.toHaveBeenCalled();
        expect(repository.saveHistory).not.toHaveBeenCalled();
    });

    it('fails with a 404 when the schedule does not exist, without counting groups', async () => {
        const { deleter, groupsRepository, repository, id } = buildDeleter(0, { schedule: null });

        const error = await deleter.execute(id, deleteDto()).catch((e) => e);

        expect(error).toBeInstanceOf(CustomError);
        expect(error.statusCode).toBe(404);
        expect(error.publicErrorCode).toBe(NOT_FOUND_ERROR);
        expect(error.message).toBe(`ShiftManagement with ID ${id} does not exist.`);

        expect(groupsRepository.countActiveByHorarioId).not.toHaveBeenCalled();
        expect(repository.update).not.toHaveBeenCalled();
    });
});
