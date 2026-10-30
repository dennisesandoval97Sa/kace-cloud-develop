import { GroupsFinder as GroupFinderDomain } from '../../domain/GroupsFinder.js';
import { DomainConfigFinder } from '../../../global-config/index.js';

export class AssignmentActiveSessionLimitResolver {
    static DEFAULT_MINUTES = 2;

    /** @type {GroupFinderDomain} */
    #groupFinder;
    /** @type {DomainConfigFinder} */
    #configFinder;

    /**
     * @param {Object} deps
     * @param {import('../../infrastructure/persistence/KnexGroupsRepository.js').KnexGroupsRepository} deps.groupsRepository
     * @param {import('../../../global-config/infrastructure/persistence/KnexGlobalConfigurationRepository.js').KnexGlobalConfigurationRepository} deps.globalConfigurationRepository
     */
    constructor({ groupsRepository, globalConfigurationRepository }) {
        this.#groupFinder = new GroupFinderDomain(groupsRepository);
        this.#configFinder = new DomainConfigFinder(globalConfigurationRepository);
    }

    /**
     * @param {string} groupId
     * @returns {Promise<number>} minutes
     */
    async resolveForGroup(groupId) {
        try {
            const group = await this.#groupFinder.execute(groupId);
            if (!group?.configuration_id?.value) {
                return AssignmentActiveSessionLimitResolver.DEFAULT_MINUTES;
            }

            const configuration = await this.#configFinder.execute(group.configuration_id.value);
            const limit = configuration?.settings?.behaviors?.getConfig(
                'agente',
                'casos'
            )?.assignment_active_session_limit;

            return Number.isInteger(limit) && limit > 0 ? limit : AssignmentActiveSessionLimitResolver.DEFAULT_MINUTES;
        } catch {
            return AssignmentActiveSessionLimitResolver.DEFAULT_MINUTES;
        }
    }
}
