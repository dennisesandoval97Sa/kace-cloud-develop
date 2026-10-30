import { Helper } from '../../../shared/infrastructure/utils/Helper.js';

const DEFAULT_ACTIVE_SESSION_LIMIT = 2;

export class UserContextBatchLoader {
    /**
     * @param {Object} deps
     * @param {{ findByIds: (ids: string[]) => Promise<Array<{ id: { value: string }, configuration_id: { value: string|null } }>> }} deps.groupsRepository
     * @param {{ findByIds: (ids: string[]) => Promise<Array<{ id: { value: string }, settings: any }>> }} deps.globalConfigurationRepository
     * @param {number} [deps.defaultActiveSessionLimit=2]
     */
    constructor({
        groupsRepository,
        globalConfigurationRepository,
        defaultActiveSessionLimit = DEFAULT_ACTIVE_SESSION_LIMIT,
    }) {
        this.groupsRepository = groupsRepository;
        this.globalConfigurationRepository = globalConfigurationRepository;
        this.defaultActiveSessionLimit = defaultActiveSessionLimit;
    }

    /**
     * @param {Array<{ id: { value: string }, grupo_activo: { value: string|null } }>} users
     * @returns {Promise<Map<string, { activeSessionLimit: number }>>}
     */
    async load(users) {
        const result = new Map();
        try {
            const grupoActivoIds = [...new Set(users.map((u) => u.grupo_activo?.value).filter(Boolean))];
            if (grupoActivoIds.length === 0) return result;

            const groups = await this.groupsRepository.findByIds(grupoActivoIds);
            const configIds = [...new Set(groups.map((g) => g.configuration_id?.value).filter(Boolean))];
            const configs = configIds.length ? await this.globalConfigurationRepository.findByIds(configIds) : [];

            const configById = new Map(configs.map((c) => [c.id.value, c]));
            const limitByGroupId = new Map();
            for (const group of groups) {
                const configId = group.configuration_id?.value;
                const config = configId ? configById.get(configId) : null;
                const rawLimit = config?.settings?.behaviors?.getConfig?.(
                    'agente',
                    'casos'
                )?.assignment_active_session_limit;
                const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : this.defaultActiveSessionLimit;
                limitByGroupId.set(group.id.value, limit);
            }

            for (const user of users) {
                const grupoActivoId = user.grupo_activo?.value;
                const limit = grupoActivoId
                    ? (limitByGroupId.get(grupoActivoId) ?? this.defaultActiveSessionLimit)
                    : this.defaultActiveSessionLimit;
                result.set(user.id.value, { activeSessionLimit: limit });
            }
        } catch (error) {
            Helper.logError('UserContextBatchLoader.load failed', error);
            return new Map();
        }
        return result;
    }
}
