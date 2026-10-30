import { GROUP_SCHEDULE_UNAVAILABLE } from '@kace/error-codes';
import { ValidationFailError, ValueObjectUuid } from '../../../shared/index.js';
import { DomainShiftManagementFinder as ShiftManagementFinder } from '../../../shift-management/index.js';

export class GroupScheduleGuard {
    /** @type {import('../../../shift-management/infrastructure/KnexShiftManagementRepository.js').KnexShiftManagementRepository} */
    #shiftManagementRepository;
    /** @type {ShiftManagementFinder} */
    #scheduleFinder;

    /**
     * @param {import('../../../shift-management/infrastructure/KnexShiftManagementRepository.js').KnexShiftManagementRepository} shiftManagementRepository
     */
    constructor(shiftManagementRepository) {
        this.#shiftManagementRepository = shiftManagementRepository;
        this.#scheduleFinder = new ShiftManagementFinder(shiftManagementRepository);
    }

    /**
     * Read-only lookup for responses, through the repository's read path (the replica when the
     * repository is built with a reader config). Never use it to gate a write; use `ensureScheduleAvailable`.
     *
     * @param {string|null|undefined} horarioId
     * @returns {Promise<import('../../../shift-management/domain/ShiftManagement.js').ShiftManagement|null>}
     *   the schedule, or `null` when it is empty, does not exist or was deleted
     */
    async findAvailableSchedule(horarioId) {
        if (!horarioId) {
            return null;
        }
        const schedule = await this.#scheduleFinder.execute(horarioId);
        return schedule && !schedule.isDeleted() ? schedule : null;
    }

    /**
     * Throws a 400 ValidationFailError when `horarioId` is not an existing, non-deleted schedule.
     * Reads the primary inside the group save transaction and keeps the schedule row share-locked
     * until it commits, so a concurrent schedule delete cannot slip in between.
     *
     * @param {string|null|undefined} horarioId
     * @param {import('knex').Knex.Transaction} trx
     */
    async ensureScheduleAvailable(horarioId, trx) {
        const schedule = horarioId
            ? await this.#shiftManagementRepository.findLocked(new ValueObjectUuid('id', horarioId), trx)
            : null;
        if (schedule && !schedule.isDeleted()) {
            return;
        }

        throw new ValidationFailError(
            'The selected schedule does not exist or was deleted',
            'horario_id',
            [],
            GROUP_SCHEDULE_UNAVAILABLE
        );
    }
}
