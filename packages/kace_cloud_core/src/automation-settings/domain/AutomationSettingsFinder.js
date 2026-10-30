import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid';
import { TenantContext } from '../../shared/infrastructure/context/TenantContext.js';

const AUTOMATION_SETTINGS_CACHE_TTL_MS = 300_000;
const automationSettingsCache = new Map();

export class AutomationSettingsFinder {
    /** @type {KnexAutomationSettingsRepository} is initialized in the constructor */
    #repository;

    /**
     * Creates an instance of the `AutomationSettingsFinder` class.
     *
     * @param {KnexAutomationSettingsRepository} repository - An instance of the repository that manages AutomationSettings records.
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * Finds a AutomationSettings by its ID.
     *
     * Results are cached per tenant+id for 5 minutes (AUTOMATION_SETTINGS_CACHE_TTL_MS)
     * to reduce database load during high-frequency polling (e.g. automation scheduling
     * loops). Edits to an automation_setting take up to that long to be picked up by
     * long-lived workers.
     *
     * @param {string} id - The UUID of the AutomationSettings to find.
     * @return {Promise<AutomationSettings | null>} A promise that resolves to the `AutomationSettings` instance if found, or `null` if not found.
     */
    async execute(id) {
        const tenantId = TenantContext.getTenant()?.id?.value ?? 'global';
        const cacheKey = `${tenantId}:${id}`;
        const now = Date.now();

        const cached = automationSettingsCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
            return cached.row;
        }

        const row = await this.#repository.find(new ValueObjectUuid('id', id));
        if (row) {
            automationSettingsCache.set(cacheKey, { row, expiresAt: now + AUTOMATION_SETTINGS_CACHE_TTL_MS });
        }
        return row;
    }
}
