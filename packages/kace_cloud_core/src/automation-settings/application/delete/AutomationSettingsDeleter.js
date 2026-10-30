import { AutomationSettingsFinder as DomainAutomationSettingsFinder } from '../../domain/AutomationSettingsFinder.js';
import { ValidationFailError } from '../../../shared/index.js';

export class AutomationSettingsDeleter {
    /** @type {KnexAutomationSettingsRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainAutomationSettingsFinder} is initialized in the constructor */
    #finder;

    /**
     * Creates an instance of the `AutomationSettingsDeleter` class.
     *
     * @param {KnexAutomationSettingsRepository} repository - An instance of the repository that manages AutomationSettings.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#finder = new DomainAutomationSettingsFinder(repository);
    }

    /**
     * Deletes a AutomationSettings object from the repository.
     *
     * @param {string} id - The unique identifier of the AutomationSettings object to delete.
     * @param {Object} dto - The data transfer object containing the properties for the deletion process.
     * @returns {Promise<void>} A promise that resolves when the AutomationSettings object is deleted.
     */
    async execute(id, dto) {
        const automationSettings = await this.#finder.execute(id);

        if (!automationSettings) {
            throw new ValidationFailError(`AutomationSettings with id ${id} does not exist.`, 'id');
        }

        automationSettings.delete(dto);

        await this.#repository.update(automationSettings);

        automationSettings.flushChanges();
    }
}
