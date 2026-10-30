import { NOT_FOUND_ERROR } from '@kace/error-codes';
import { CustomError, ValueObjectUuid } from '../../../shared/index.js';

export class ShiftManagementDeleter {
    /** @type {KnexShiftManagementRepository} is initialized in the constructor */
    #repository;
    /** @type {ScheduleUsageGuard} is initialized in the constructor */
    #usageGuard;

    /**
     * Creates an instance of the `ShiftManagementDeleter` class.
     *
     * @param {KnexShiftManagementRepository} repository - An instance of the repository that manages ShiftManagement records.
     * @param {ScheduleUsageGuard} usageGuard - blocks the delete while groups use the schedule.
     */
    constructor(repository, usageGuard) {
        if (!usageGuard) {
            throw new Error('usageGuard is required to delete a schedule');
        }
        this.#repository = repository;
        this.#usageGuard = usageGuard;
    }

    /**
     * Deletes a `ShiftManagement` object from the repository.
     *
     * The schedule row stays locked from the usage check until the delete commits, so a group
     * save (which takes a shared lock on the same row) cannot assign the schedule in between.
     *
     * @param {string} id - The unique identifier of the ShiftManagement entity to delete.
     * @param {Object} dto - The data transfer object containing the properties for the `ShiftManagement` object (e.g., deleted_by, deleted_at).
     * @returns {Promise<void>} A promise that resolves when the `ShiftManagement` entity is deleted
     *   (or immediately, without writing, when it was already deleted).
     * @throws {CustomError} 404 when the ShiftManagement entity does not exist.
     * @throws {CustomError} 400 when groups still reference the schedule (`horario_id`).
     * @throws {ScheduleLockConflict} 409 when a concurrent group save keeps the schedule locked.
     */
    async execute(id, dto) {
        const scheduleId = new ValueObjectUuid('id', id);

        await this.#repository.withTransaction(async (trx) => {
            const shiftManagement = await this.#repository.findLocked(scheduleId, trx, { forUpdate: true });

            if (!shiftManagement) {
                throw new CustomError(`ShiftManagement with ID ${id} does not exist.`, 404, [], NOT_FOUND_ERROR);
            }
            if (shiftManagement.isDeleted()) {
                return;
            }

            await this.#usageGuard.ensureNotInUse(id, trx);

            const originalValues = shiftManagement.toJson();
            shiftManagement.delete(dto);

            await this.#repository.update(shiftManagement, trx);
            await this.#repository.saveHistory(shiftManagement, originalValues, trx);

            shiftManagement.flushChanges();
        });
    }
}
