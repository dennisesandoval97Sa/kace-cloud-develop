import { AutomationSettingsFinder as DomainAutomationSettingsFinder } from '../../domain/AutomationSettingsFinder.js';
import { AutomationSettingsResponse } from '../../application/AutomationSettingsResponse.js';
import { ValidationFailError } from '../../../shared/index.js';

export class AutomationSettingsFinder {
    /** @type {DomainAutomationSettingsFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `AutomationSettingsFinder` class.
     *
     * @param {KnexAutomationSettingsRepository} repository - An instance of the repository that manages AutomationSettings records.
     */
    constructor(repository) {
        this.#finder = new DomainAutomationSettingsFinder(repository);
    }

    /**
     * Executes the finding of a `AutomationSettings` object by its unique identifier.
     *
     * @param {string} id - The unique identifier of the `AutomationSettings` object to find.
     * @returns {Promise<AutomationSettingsResponse>} A promise that resolves to a `AutomationSettingsResponse` object containing the found AutomationSettings data.
     */
    async execute(id) {
        const automationSettings = await this.#finder.execute(id);
        if (!automationSettings || automationSettings.isDeleted()) {
            throw new ValidationFailError('AutomationSettings not found', 'id');
        }

        return new AutomationSettingsResponse(automationSettings);
    }
}
