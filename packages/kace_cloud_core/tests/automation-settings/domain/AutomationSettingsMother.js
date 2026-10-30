import { v4 as uuidv4 } from 'uuid';
import { AutomationSettings } from '../../../src/automation-settings/domain/AutomationSettings.js';

export default class AutomationSettingsMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `AutomationSettings` entity.
     *
     * @returns {Object} The DTO containing the properties for a `AutomationSettings` entity.
     */
    static dto({ id, description, frequency, start_date, end_date, created_at, created_by } = {}) {
        const defaultEndDate = new Date();
        defaultEndDate.setDate(defaultEndDate.getDate() + 5);

        return {
            id: id ?? uuidv4(),
            description: description ?? `Default automation description ${uuidv4()}`,
            frequency: frequency ?? '* * * * *',
            start_date: start_date ?? new Date(),
            end_date: end_date ?? defaultEndDate,
            created_at: created_at ?? new Date(),
            created_by: created_by ?? uuidv4(),
        };
    }

    /**
     * Creates a `AutomationSettings` instance and saves it to the repository.
     *
     * @param {KnexAutomationSettingsRepository} repository - The repository to save the `AutomationSettings` instance.
     * @returns {Promise<AutomationSettings>} The created `AutomationSettings` instance.
     */
    static async create(repository, data = {}) {
        const automationSettings = AutomationSettings.create(AutomationSettingsMother.dto(data));
        await repository.save(automationSettings);
        return automationSettings;
    }
}
