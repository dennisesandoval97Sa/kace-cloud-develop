import { GroupFinderDomain } from '../../../grupos/index.js';
import { DomainConfigFinder } from '../../../global-config/index.js';

/**
 * Resolves the context for rule evaluation.
 * Handles computed/derived fields that require external data sources.
 *
 * NOTE:
 * Currently this resolver supports entities that contain `grupo_activo`
 * (e.g. User entities). If used with other entity types, the default
 * active session limit will be applied.
 */
export class EntityRulesContextResolver {
    /** @type {GroupFinderDomain} */
    #groupFinder;
    /** @type {DomainConfigFinder} */
    #configFinder;

    static #DEFAULT_ACTIVE_SESSION_LIMIT = 2;

    /**
     * @param {Object} dependencies
     * @param {KnexGroupsRepository} dependencies.groupsRepository
     * @param {KnexGlobalConfigRepository} dependencies.globalConfigurationRepository
     */
    constructor({ groupsRepository, globalConfigurationRepository }) {
        this.#groupFinder = new GroupFinderDomain(groupsRepository);
        this.#configFinder = new DomainConfigFinder(globalConfigurationRepository);
    }

    /**
     * Returns the entity context ready for rule evaluation.
     * If the entity has toRulesContext(), it is called with the resolved config.
     * Otherwise falls back to toJson().
     *
     * @param {Aggregate} entity
     * @returns {Promise<Object>}
     */
    async resolve(entity) {
        if (typeof entity.toRulesContext === 'function') {
            const activeSessionLimit = await this.#getActiveSessionLimit(entity);
            return entity.toRulesContext(activeSessionLimit);
        }

        return entity.toJson();
    }

    /**
     * Gets the active session limit in minutes from global configuration.
     * Falls back to DEFAULT_ACTIVE_SESSION_LIMIT if configuration is not available.
     * @param {Aggregate} entity
     * @returns {Promise<number>}
     */
    async #getActiveSessionLimit(entity) {
        try {
            const grupoActivoId = entity?.grupo_activo?.value;

            if (!grupoActivoId) {
                return EntityRulesContextResolver.#DEFAULT_ACTIVE_SESSION_LIMIT;
            }

            const group = await this.#groupFinder.execute(grupoActivoId);
            if (!group?.configuration_id?.value) {
                return EntityRulesContextResolver.#DEFAULT_ACTIVE_SESSION_LIMIT;
            }

            const configuration = await this.#configFinder.execute(group.configuration_id.value);
            const activeSessionLimit = configuration?.settings?.behaviors?.getConfig(
                'agente',
                'casos'
            )?.assignment_active_session_limit;

            return Number.isInteger(activeSessionLimit) && activeSessionLimit > 0
                ? activeSessionLimit
                : EntityRulesContextResolver.#DEFAULT_ACTIVE_SESSION_LIMIT;
        } catch {
            return EntityRulesContextResolver.#DEFAULT_ACTIVE_SESSION_LIMIT;
        }
    }
}
