import { AutomationSettingsFinder as DomainAutomationSettingsFinder } from '../../domain/AutomationSettingsFinder.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { ValidationFailError } from '../../../shared/index.js';

export class AutomationSettingsUpdater {
    /** @type {KnexAutomationSettingsRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainAutomationSettingsFinder} is initialized in the constructor */
    #automationSettingsFinder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of the `AutomationSettingsUpdater` class.
     *
     * @param {KnexAutomationSettingsRepository} repository - An instance of the repository that manages WS REST endpoints.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#automationSettingsFinder = new DomainAutomationSettingsFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }

    /**
     * Updates a AutomationSettings object in the repository.
     *
     * @param {string} id - The unique identifier of the AutomationSettings object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the AutomationSettings object.
     * @returns {Promise<void>} A promise that resolves when the AutomationSettings object is updated.
     */
    async execute(id, dto) {
        const automationSettings = await this.#automationSettingsFinder.execute(id);

        if (!automationSettings) {
            throw new ValidationFailError(`AutomationSettings with id ${id} does not exist.`, 'id');
        }

        if (dto.description) {
            await this.#uniquenessValidator.validate('description', dto.description, id);
        }

        const originalValues = automationSettings.toJson();
        automationSettings.update(dto);

        await this.#repository.update(automationSettings);
        await this.#repository.saveHistory(automationSettings, originalValues);

        automationSettings.flushChanges();
    }
}
