import { jest } from '@jest/globals';
import { GROUP_SCHEDULE_UNAVAILABLE, NOT_FOUND_ERROR, SHIFT_MANAGEMENT_IN_USE_BY_GROUPS } from '@kace/error-codes';
import {
    KnexShiftManagementRepository,
    ScheduleLockConflict,
    ScheduleUsageGuard,
    ShiftManagement,
    ShiftManagementCollectionResponse,
    ShiftManagementCounter,
    ShiftManagementCreator,
    ShiftManagementDeleter,
    ShiftManagementFinder,
    ShiftManagementResponse,
    ShiftManagementSearcher,
    ShiftManagementUpdater,
} from '../../src/shift-management/index.js';
import ShiftManagementMother from './domain/ShiftManagementMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { GroupDetailFinder, GroupScheduleGuard, GroupUpdater, KnexGroupsRepository } from '../../src/grupos/index.js';
import { GroupsMother as GroupMother } from '../grupos/domain/GroupsMother.js';
import ShiftManagementFinderByGroup from '../../src/shift-management/application/find/ShiftManagementFinderByGroup.js';
import { CustomError, ValidationFailError } from '../../src/shared/index.js';

describe('ShiftManagement Integration Tests', () => {
    const repository = new KnexShiftManagementRepository(knexConfig);
    const groupRepository = new KnexGroupsRepository(repository.connection);

    it('should create a ShiftManagement', async () => {
        const dto = ShiftManagementMother.dto();
        const shiftManagementCreator = new ShiftManagementCreator(repository);

        await shiftManagementCreator.execute(dto);

        const result = await repository.connection('shift_management').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing ShiftManagement', async () => {
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repository);
        const shiftManagementFinder = new ShiftManagementFinder(repository);

        const shiftManagementResult = await shiftManagementFinder.execute(shiftManagement.id.value);

        expect(shiftManagementResult).not.toBeNull();
        expect(shiftManagementResult).toBeInstanceOf(ShiftManagementResponse);
    });

    it('can update an existing ShiftManagement', async () => {
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repository);
        const shiftManagementUpdater = new ShiftManagementUpdater(repository);

        const newValues = { description: 'Updated description' };
        await shiftManagementUpdater.execute(shiftManagement.id.value, newValues);

        const result = await repository.find(shiftManagement.id);
        expect(result).toBeInstanceOf(ShiftManagement);
        expect(result.description.value).toBe(newValues.description);
    });

    it('can delete an existing ShiftManagement', async () => {
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repository);
        const shiftManagementDeleter = new ShiftManagementDeleter(repository, new ScheduleUsageGuard(groupRepository));

        await shiftManagementDeleter.execute(shiftManagement.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(shiftManagement.id);
        expect(result).toBeInstanceOf(ShiftManagement);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for ShiftManagement instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await ShiftManagementMother.createShiftManagement(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const shiftManagementSearch = new ShiftManagementSearcher(repository);

        const searchResult = await shiftManagementSearch.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(ShiftManagementCollectionResponse);
    });

    it('should return null when trying to find a ShiftManagement with a non-existent ID', async () => {
        const shiftManagementFinder = new ShiftManagementFinder(repository);

        await expect(shiftManagementFinder.execute(uuid())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating a ShiftManagement with invalid data', async () => {
        const dto = ShiftManagementMother.dto();
        delete dto.id;
        const shiftManagementCreator = new ShiftManagementCreator(repository);

        await expect(shiftManagementCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent ShiftManagement', async () => {
        const shiftManagementUpdater = new ShiftManagementUpdater(repository);
        const newValues = { description: 'Updated description' };
        const nonExistentId = uuid();

        await expect(shiftManagementUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `ShiftManagement with ID ${nonExistentId} does not exist.`
        );
    });

    it('should throw a 404 when deleting a non-existent ShiftManagement', async () => {
        const shiftManagementDeleter = new ShiftManagementDeleter(repository, new ScheduleUsageGuard(groupRepository));
        const nonExistentId = uuid();

        const error = await shiftManagementDeleter
            .execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuid() })
            .catch((e) => e);

        expect(error.message).toBe(`ShiftManagement with ID ${nonExistentId} does not exist.`);
        expect(error.statusCode).toBe(404);
        expect(error.publicErrorCode).toBe(NOT_FOUND_ERROR);
    });

    it('should count ShiftManagement instances correctly', async () => {
        // Los seeds dejan grupos apuntando a shift_management; postgres bloquea el
        // borrado del padre mientras la referencia exista. La columna es nullable,
        // asi que se suelta antes de vaciar la tabla.
        await repository.connection('grupos').update({ horario_id: null });
        await repository.connection('shift_management').del();
        for (let i = 0; i < 10; i++) {
            await ShiftManagementMother.createShiftManagement(repository);
        }
        const counter = new ShiftManagementCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });

    it('should throw an error when creating a Shift with a duplicate description', async () => {
        const dto1 = ShiftManagementMother.dto();
        const dto2 = ShiftManagementMother.dto();
        dto2.description = dto1.description;

        const shiftCreator = new ShiftManagementCreator(repository);

        await shiftCreator.execute(dto1);

        await expect(shiftCreator.execute(dto2)).rejects.toThrow(
            `The following value(s) already exist: description '${dto1.description}'`
        );
    });

    it('should throw an error when updating a Shift to have a duplicate description', async () => {
        const shift1 = await ShiftManagementMother.createShiftManagement(repository);
        const shift2 = await ShiftManagementMother.createShiftManagement(repository);

        const shiftUpdater = new ShiftManagementUpdater(repository);

        await expect(shiftUpdater.execute(shift2.id.value, { description: shift1.description.value })).rejects.toThrow(
            `The following value(s) already exist: description '${shift1.description.value}'`
        );
    });

    it('counts only the non-deleted groups that use the schedule', async () => {
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repository);
        await GroupMother.createWithCustomShiftManagement(groupRepository, shiftManagement);
        const deletedGroup = await GroupMother.createWithCustomShiftManagement(groupRepository, shiftManagement);
        await repository
            .connection('grupos')
            .where({ id: deletedGroup.id.value })
            .update({ deleted_at: new Date().toISOString(), deleted_by: uuid() });

        const count = await groupRepository.withTransaction((trx) =>
            groupRepository.countActiveByHorarioId(shiftManagement.id.value, trx)
        );

        expect(count).toBe(1);
    });

    it('does not delete a schedule that a group still uses', async () => {
        const shiftManagement = await ShiftManagementMother.createShiftManagement(repository);
        await GroupMother.createWithCustomShiftManagement(groupRepository, shiftManagement);

        await expect(
            new ShiftManagementDeleter(repository, new ScheduleUsageGuard(groupRepository)).execute(
                shiftManagement.id.value,
                { deleted_at: new Date().toISOString(), deleted_by: uuid() }
            )
        ).rejects.toBeInstanceOf(CustomError);

        const result = await repository.find(shiftManagement.id);
        expect(result.deleted_at.value).toBeNull();
    });

    /**
     * The schedule is soft-deleted with a direct UPDATE (not through ShiftManagementDeleter), so the
     * group keeps pointing at it: this is the state the bug fixed by KTSS-3569 left behind, read back
     * through the real repository hydration of `deleted_at`/`deleted_by`.
     */
    describe('group whose schedule was soft-deleted in the database', () => {
        const softDeleteRow = (schedule) =>
            repository
                .connection('shift_management')
                .where({ id: schedule.id.value })
                .update({ deleted_at: new Date().toISOString(), deleted_by: uuid() });

        const groupWithDeletedSchedule = async () => {
            const schedule = await ShiftManagementMother.createShiftManagement(repository);
            const group = await GroupMother.createWithCustomShiftManagement(groupRepository, schedule);
            await softDeleteRow(schedule);
            return { schedule, group };
        };

        it('returns the group detail with horario_id null and an empty description', async () => {
            const { group } = await groupWithDeletedSchedule();

            const detail = await new GroupDetailFinder(groupRepository, new GroupScheduleGuard(repository)).execute(
                group.id.value
            );

            expect(detail.toJson().data).toMatchObject({
                id: group.id.value,
                horario_id: null,
                horario_description: '',
            });
        });

        it('does not return the deleted schedule as the group schedule (GET /groups/{id}/schedules)', async () => {
            const { group } = await groupWithDeletedSchedule();

            await expect(new ShiftManagementFinderByGroup(repository).execute(group.id.value)).resolves.toBeNull();
        });

        it('rejects saving another group with that schedule', async () => {
            const { schedule } = await groupWithDeletedSchedule();
            const currentSchedule = await ShiftManagementMother.createShiftManagement(repository);
            const otherGroup = await GroupMother.createWithCustomShiftManagement(groupRepository, currentSchedule);

            const error = await new GroupUpdater(groupRepository, null, undefined, new GroupScheduleGuard(repository))
                .execute({ horario_id: schedule.id.value }, otherGroup.id.value)
                .catch((e) => e);

            expect(error).toBeInstanceOf(ValidationFailError);
            expect(error.publicErrorCode).toBe(GROUP_SCHEDULE_UNAVAILABLE);
            const stored = await repository.connection('grupos').where({ id: otherGroup.id.value }).first();
            expect(stored.horario_id).toBe(currentSchedule.id.value);
        });

        it('rejects the null horario_id the detail returns when it is sent back', async () => {
            const { schedule, group } = await groupWithDeletedSchedule();

            const error = await new GroupUpdater(groupRepository, null, undefined, new GroupScheduleGuard(repository))
                .execute({ horario_id: null, descripcion: 'Nueva descripcion' }, group.id.value)
                .catch((e) => e);

            expect(error).toBeInstanceOf(ValidationFailError);
            expect(error.publicErrorCode).toBe(GROUP_SCHEDULE_UNAVAILABLE);
            const stored = await repository.connection('grupos').where({ id: group.id.value }).first();
            expect(stored.horario_id).toBe(schedule.id.value);
        });
    });

    /**
     * Delete (FOR UPDATE on the schedule row) and group save (FOR SHARE on the same row) must
     * serialize, so a group never ends up pointing at a schedule deleted concurrently. Each test
     * parks one side inside its transaction, after it took its lock, and checks the other blocks.
     */
    describe('concurrent schedule delete and group save', () => {
        const BLOCK_WINDOW_MS = 300;
        const deleteDto = () => ({ deleted_at: new Date().toISOString(), deleted_by: uuid() });

        const openGates = [];
        const gate = () => {
            let release;
            let reached;
            const released = new Promise((resolve) => (release = resolve));
            const reachedPromise = new Promise((resolve) => (reached = resolve));
            openGates.push(release);
            return { release, reached, released, reachedPromise };
        };

        const parkInside = (target, method, parking) => {
            const original = target[method].bind(target);
            return jest.spyOn(target, method).mockImplementationOnce(async (...args) => {
                parking.reached();
                await parking.released;
                return original(...args);
            });
        };

        const settleState = (promise) =>
            Promise.race([
                promise.then(
                    () => 'applied',
                    () => 'rejected'
                ),
                new Promise((resolve) => setTimeout(() => resolve('blocked'), BLOCK_WINDOW_MS)),
            ]);

        const groupUpdater = () =>
            new GroupUpdater(groupRepository, null, undefined, new GroupScheduleGuard(repository));
        const scheduleDeleter = () => new ShiftManagementDeleter(repository, new ScheduleUsageGuard(groupRepository));

        // A failed assertion must not leave a transaction parked holding its row lock.
        afterEach(() => {
            openGates.splice(0).forEach((release) => release());
            jest.restoreAllMocks();
        });

        it('a group save waits for an in-flight delete and then rejects the deleted schedule', async () => {
            const currentSchedule = await ShiftManagementMother.createShiftManagement(repository);
            const doomedSchedule = await ShiftManagementMother.createShiftManagement(repository);
            const group = await GroupMother.createWithCustomShiftManagement(groupRepository, currentSchedule);
            const parking = gate();
            parkInside(repository, 'update', parking);

            const deletion = scheduleDeleter().execute(doomedSchedule.id.value, deleteDto());
            await parking.reachedPromise;
            const save = groupUpdater().execute({ horario_id: doomedSchedule.id.value }, group.id.value);

            await expect(settleState(save)).resolves.toBe('blocked');

            parking.release();
            await deletion;
            const error = await save.catch((e) => e);
            expect(error).toBeInstanceOf(ValidationFailError);
            expect(error.publicErrorCode).toBe(GROUP_SCHEDULE_UNAVAILABLE);
            const stored = await repository.connection('grupos').where({ id: group.id.value }).first();
            expect(stored.horario_id).toBe(currentSchedule.id.value);
        });

        it('a delete waits for an in-flight group save and then rejects the schedule as in use', async () => {
            const currentSchedule = await ShiftManagementMother.createShiftManagement(repository);
            const targetSchedule = await ShiftManagementMother.createShiftManagement(repository);
            const group = await GroupMother.createWithCustomShiftManagement(groupRepository, currentSchedule);
            const parking = gate();
            parkInside(groupRepository, 'update', parking);

            const save = groupUpdater().execute({ horario_id: targetSchedule.id.value }, group.id.value);
            await parking.reachedPromise;
            const deletion = scheduleDeleter().execute(targetSchedule.id.value, deleteDto());

            await expect(settleState(deletion)).resolves.toBe('blocked');

            parking.release();
            await save;
            const error = await deletion.catch((e) => e);
            expect(error).toBeInstanceOf(CustomError);
            expect(error.publicErrorCode).toBe(SHIFT_MANAGEMENT_IN_USE_BY_GROUPS);
            const result = await repository.find(targetSchedule.id);
            expect(result.deleted_at.value).toBeNull();
        });
    });

    it('should return the shift management description when fetching a group', async () => {
        const group = await GroupMother.createGroup(groupRepository, repository);

        const finder = new ShiftManagementFinderByGroup(repository);
        const result = await finder.execute(group.id.value);

        expect(result).not.toBeNull();
        expect(result.toJson().data.id).toBe(group.horario_id.value);
    });

    /**
     * A lock held past `lockTimeoutMs` must surface as a 409 instead of waiting until the Lambda
     * times out. The competing lock is held by a separate, still-open transaction.
     */
    describe('schedule lock timeout', () => {
        const LOCK_TIMEOUT_MS = 200;
        const deleteDto = () => ({ deleted_at: new Date().toISOString(), deleted_by: uuid() });
        const quickRepository = new KnexShiftManagementRepository(knexConfig, null, { lockTimeoutMs: LOCK_TIMEOUT_MS });
        let holder;

        afterEach(async () => {
            await holder?.rollback();
            holder = null;
        });

        afterAll(async () => {
            await quickRepository.destroyConnection();
        });

        const holdScheduleLock = async (schedule, { forUpdate }) => {
            holder = await repository.connection.transaction();
            const query = repository.trxTable(holder).where({ id: schedule.id.value }).first();
            await (forUpdate ? query.forUpdate() : query.forShare());
        };

        it('rejects a group save with a 409 while a delete keeps the schedule locked', async () => {
            const currentSchedule = await ShiftManagementMother.createShiftManagement(repository);
            const lockedSchedule = await ShiftManagementMother.createShiftManagement(repository);
            const group = await GroupMother.createWithCustomShiftManagement(groupRepository, currentSchedule);
            await holdScheduleLock(lockedSchedule, { forUpdate: true });

            const save = new GroupUpdater(groupRepository, null, undefined, new GroupScheduleGuard(quickRepository));

            await expect(save.execute({ horario_id: lockedSchedule.id.value }, group.id.value)).rejects.toBeInstanceOf(
                ScheduleLockConflict
            );
            const stored = await repository.connection('grupos').where({ id: group.id.value }).first();
            expect(stored.horario_id).toBe(currentSchedule.id.value);
        });

        it('rejects a delete with a 409 while a group save keeps the schedule locked', async () => {
            const schedule = await ShiftManagementMother.createShiftManagement(repository);
            await holdScheduleLock(schedule, { forUpdate: false });

            const deleter = new ShiftManagementDeleter(quickRepository, new ScheduleUsageGuard(groupRepository));

            const error = await deleter.execute(schedule.id.value, deleteDto()).catch((e) => e);
            expect(error).toBeInstanceOf(ScheduleLockConflict);
            expect(error.statusCode).toBe(409);
            await holder.rollback();
            holder = null;
            const result = await repository.find(schedule.id);
            expect(result.deleted_at.value).toBeNull();
        });

        it('restores the default lock_timeout for the rest of the transaction once the lock is taken', async () => {
            const schedule = await ShiftManagementMother.createShiftManagement(repository);

            const lockTimeout = await quickRepository.withTransaction(async (trx) => {
                await quickRepository.findLocked(schedule.id, trx);
                return (await trx.raw('show lock_timeout')).rows[0].lock_timeout;
            });

            expect(lockTimeout).toBe('0');
        });
    });
});
