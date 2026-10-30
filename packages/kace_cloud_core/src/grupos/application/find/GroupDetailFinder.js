import { GroupDetailResponse } from '../GroupDetailResponse.js';
import { GroupFinder } from './GroupFinder.js';

export class GroupDetailFinder {
    /** @type {GroupFinder} is initialized in the constructor */
    #groupFinder;
    /** @type {import('../guards/GroupScheduleGuard.js').GroupScheduleGuard} is initialized in the constructor */
    #scheduleGuard;

    /**
     * @param {import('../../infrastructure/persistence/KnexGroupsRepository.js').KnexGroupsRepository} repository
     * @param {import('../guards/GroupScheduleGuard.js').GroupScheduleGuard} scheduleGuard
     */
    constructor(repository, scheduleGuard) {
        this.#groupFinder = new GroupFinder(repository);
        this.#scheduleGuard = scheduleGuard;
    }

    /**
     * @param {string} id
     * @returns {Promise<GroupDetailResponse>}
     * @throws {CustomError} 404 when the group does not exist or was deleted
     */
    async execute(id) {
        const { data } = (await this.#groupFinder.execute(id)).toJson();
        const schedule = await this.#scheduleGuard.findAvailableSchedule(data.horario_id);
        return new GroupDetailResponse(data, schedule);
    }
}
