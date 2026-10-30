import { CustomError } from '../../../shared/index.js';
import { GROUP_HAS_ACTIVE_USERS } from '@kace/error-codes';

export class GroupUsageGuard {
    /** @type {import('../../../users/infrastructure/KnexUsersRepository.js').KnexUsersRepository} */
    #usersRepository;
    /** @type {{ resolveForGroup: (groupId: string) => Promise<number> }} */
    #activeSessionLimitResolver;

    /**
     * @param {import('../../../users/infrastructure/KnexUsersRepository.js').KnexUsersRepository} usersRepository
     * @param {{ resolveForGroup: (groupId: string) => Promise<number> }} activeSessionLimitResolver
     */
    constructor(usersRepository, activeSessionLimitResolver) {
        this.#usersRepository = usersRepository;
        this.#activeSessionLimitResolver = activeSessionLimitResolver;
    }

    /**
     * Throws a 400 CustomError when at least one non-deleted user has the given
     * group as `grupo_activo` and was seen within the configured session window.
     *
     * @param {string} groupId
     */
    async ensureNoActiveAssignments(groupId) {
        const minutes = await this.#activeSessionLimitResolver.resolveForGroup(groupId);
        const count = await this.#usersRepository.countByActiveGroup(groupId, minutes);
        if (count === 0) {
            return;
        }

        const users = await this.#usersRepository.listByActiveGroup(groupId, minutes);
        const listedCount = users.length;

        throw new CustomError(
            `Cannot proceed: ${listedCount} user(s) still have this group as their active group`,
            400,
            { count: listedCount, users },
            GROUP_HAS_ACTIVE_USERS
        );
    }
}
