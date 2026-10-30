import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import { GroupCreator } from '../../src/grupos/application/create/GroupCreator.js';
import { GroupUpdater } from '../../src/grupos/application/update/GroupUpdater.js';
import { Groups } from '../../src/grupos/domain/Groups.js';
import { GroupsMother } from './domain/GroupsMother.js';

/**
 * A group may only point at an existing, non-deleted schedule. The rule is enforced in the
 * use cases (not only in the edit form) so no client can persist a deleted `horario_id`.
 */
describe('Group use cases — schedule availability', () => {
    const scheduleUnavailable = new Error('schedule unavailable');

    const scheduleGuard = (available) => ({
        ensureScheduleAvailable: available
            ? jest.fn().mockResolvedValue(undefined)
            : jest.fn().mockRejectedValue(scheduleUnavailable),
    });

    const trx = { name: 'group-save-trx' };

    /** Records the order of the transaction boundaries and writes, to prove the check runs inside. */
    const groupsRepository = (existingGroup = null, calls = []) => ({
        tableName: 'grupos',
        find: jest.fn().mockResolvedValue(existingGroup),
        search: jest.fn().mockResolvedValue([]),
        withTransaction: jest.fn(async (callback) => {
            calls.push('begin');
            const result = await callback(trx);
            calls.push('commit');
            return result;
        }),
        save: jest.fn(async () => calls.push('save')),
        update: jest.fn(async () => calls.push('update')),
        saveHistory: jest.fn(async () => calls.push('saveHistory')),
    });

    const recordingGuard = (calls) => ({
        ensureScheduleAvailable: jest.fn(async () => calls.push('scheduleCheck')),
    });

    describe('GroupCreator', () => {
        it('creates the group when its schedule is available', async () => {
            const repository = groupsRepository();
            const guard = scheduleGuard(true);
            const dto = GroupsMother.dto();

            await new GroupCreator(repository, null, null, null, guard).execute(dto);

            expect(guard.ensureScheduleAvailable).toHaveBeenCalledWith(dto.horario_id, trx);
            expect(repository.save).toHaveBeenCalledTimes(1);
        });

        it('checks the schedule inside the same transaction that saves the group', async () => {
            const calls = [];
            const repository = groupsRepository(null, calls);

            await new GroupCreator(repository, null, null, null, recordingGuard(calls)).execute(GroupsMother.dto());

            expect(calls).toEqual(['begin', 'scheduleCheck', 'save', 'saveHistory', 'commit']);
        });

        it('does not create the group when its schedule is unavailable', async () => {
            const repository = groupsRepository();

            await expect(
                new GroupCreator(repository, null, null, null, scheduleGuard(false)).execute(GroupsMother.dto())
            ).rejects.toBe(scheduleUnavailable);

            expect(repository.save).not.toHaveBeenCalled();
            expect(repository.saveHistory).not.toHaveBeenCalled();
        });
    });

    describe('GroupUpdater', () => {
        const buildUpdater = (available) => {
            const group = Groups.create(GroupsMother.dto());
            const repository = groupsRepository(group);
            const guard = scheduleGuard(available);
            return { updater: new GroupUpdater(repository, null, undefined, guard), repository, guard, group };
        };

        it('updates the group when the new schedule is available', async () => {
            const { updater, repository, guard, group } = buildUpdater(true);
            const horarioId = uuidv4();

            await updater.execute({ horario_id: horarioId }, group.id.value);

            expect(guard.ensureScheduleAvailable).toHaveBeenCalledWith(horarioId, trx);
            expect(repository.update).toHaveBeenCalledTimes(1);
        });

        it('checks the schedule inside the same transaction that updates the group', async () => {
            const calls = [];
            const group = Groups.create(GroupsMother.dto());
            const repository = groupsRepository(group, calls);

            await new GroupUpdater(repository, null, undefined, recordingGuard(calls)).execute(
                { horario_id: uuidv4() },
                group.id.value
            );

            expect(calls).toEqual(['begin', 'scheduleCheck', 'update', 'saveHistory', 'commit']);
        });

        it('rejects an unavailable schedule before applying the update to the group', async () => {
            const { updater, group } = buildUpdater(false);
            const originalHorarioId = group.horario_id.value;

            await expect(updater.execute({ horario_id: uuidv4() }, group.id.value)).rejects.toBe(scheduleUnavailable);

            expect(group.horario_id.value).toBe(originalHorarioId);
        });

        it('does not update the group when the submitted schedule is unavailable', async () => {
            const { updater, repository, group } = buildUpdater(false);

            await expect(updater.execute({ horario_id: uuidv4() }, group.id.value)).rejects.toBe(scheduleUnavailable);

            expect(repository.update).not.toHaveBeenCalled();
            expect(repository.saveHistory).not.toHaveBeenCalled();
        });

        it('skips the schedule check when the update resends the current horario_id', async () => {
            const { updater, repository, guard, group } = buildUpdater(false);

            await updater.execute(
                { horario_id: group.horario_id.value, descripcion: 'Nueva descripcion' },
                group.id.value
            );

            expect(guard.ensureScheduleAvailable).not.toHaveBeenCalled();
            expect(repository.update).toHaveBeenCalledTimes(1);
        });

        it('checks the schedule when the update clears horario_id', async () => {
            const { updater, guard, group } = buildUpdater(false);

            await expect(updater.execute({ horario_id: null }, group.id.value)).rejects.toBe(scheduleUnavailable);

            expect(guard.ensureScheduleAvailable).toHaveBeenCalledWith(null, trx);
        });

        it('skips the schedule check when the update does not send horario_id', async () => {
            const { updater, repository, guard, group } = buildUpdater(false);

            await updater.execute({ descripcion: 'Nueva descripcion' }, group.id.value);

            expect(guard.ensureScheduleAvailable).not.toHaveBeenCalled();
            expect(repository.update).toHaveBeenCalledTimes(1);
        });
    });
});
