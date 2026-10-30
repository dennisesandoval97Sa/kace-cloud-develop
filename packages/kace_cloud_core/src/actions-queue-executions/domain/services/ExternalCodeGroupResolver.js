import { TenantContext } from '../../../shared/infrastructure/context/TenantContext.js';
import { ActiveGroupFinderByExternalCode } from '../../../grupos/domain/ActiveGroupFinderByExternalCode.js';

const EXTERNAL_CODE_GROUP_CACHE_TTL_MS = 300_000;
const externalCodeGroupCache = new Map();

/**
 * Resolves an ACTIVE group id from an action's external code. The lookup itself
 * (the `codigo_externo = ?` query plus the `codigos_externos` jsonb fallback,
 * both filtered to active, non-deleted groups) lives in
 * ActiveGroupFinderByExternalCode; this class adds caching on top.
 *
 * Results (including null-hits) are cached per tenant+code for 5 minutes to keep
 * the per-minute assignment tick from re-querying near-static configuration.
 * Mirrors the caching pattern of AutomationSettingsFinder. Because the cache is
 * status-sensitive, GroupUpdater clears it whenever a group's status changes.
 */
export class ExternalCodeGroupResolver {
    #activeGroupFinder;

    constructor(groupsRepository) {
        this.#activeGroupFinder = new ActiveGroupFinderByExternalCode(groupsRepository);
    }

    /** Test/ops seam: clears the module-level cache (also used between unit tests). */
    static clearCache() {
        externalCodeGroupCache.clear();
    }

    /**
     * @param {string} externalCode
     * @returns {Promise<string|null>} the resolved group id (String-coerced) or null.
     */
    async resolve(externalCode) {
        const tenantId = TenantContext.getTenant()?.id?.value ?? 'global';
        const cacheKey = `${tenantId}:${externalCode}`;
        const now = Date.now();

        const cached = externalCodeGroupCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.groupId;
        }

        const groupId = await this.#queryGroupId(externalCode);
        externalCodeGroupCache.set(cacheKey, { groupId, expiresAt: now + EXTERNAL_CODE_GROUP_CACHE_TTL_MS });
        return groupId;
    }

    async #queryGroupId(externalCode) {
        const group = await this.#activeGroupFinder.execute(externalCode);

        return group ? String(group.id.value) : null;
    }
}
