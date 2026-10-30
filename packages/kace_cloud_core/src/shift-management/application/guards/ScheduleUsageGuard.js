import { SHIFT_MANAGEMENT_IN_USE_BY_GROUPS } from '@kace/error-codes';
import { CustomError } from '../../../shared/index.js';

export class ScheduleUsageGuard {
    /** @type {import('../../../grupos/infrastructure/persistence/KnexGroupsRepository.js').KnexGroupsRepository} */
    #groupsRepository;

    /**
     * @param {import('../../../grupos/infrastructure/persistence/KnexGroupsRepository.js').KnexGroupsRepository} groupsRepository
     */
    constructor(groupsRepository) {
        this.#groupsRepository = groupsRepository;
    }

    /**
     * Throws a 400 CustomError when at least one non-deleted group uses the schedule.
     *
     * @param {string} scheduleId
     * @param {import('knex').Knex.Transaction} trx the delete transaction, holding the schedule row lock
     */
    async ensureNotInUse(scheduleId, trx) {
        const count = await this.#groupsRepository.countActiveByHorarioId(scheduleId, trx);
        if (count === 0) {
            return;
        }

        throw new CustomError(
            `Cannot delete: ${count} group(s) still use this schedule`,
            400,
            { count },
            SHIFT_MANAGEMENT_IN_USE_BY_GROUPS
        );
    }
}
