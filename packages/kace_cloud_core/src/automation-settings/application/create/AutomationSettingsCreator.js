import { ValidationFailError } from '../../../shared/index.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { AutomationSettingsFinder as DomainAutomationSettingsFinder } from '../../domain/AutomationSettingsFinder.js';
import { AutomationSettings } from '../../domain/AutomationSettings.js';

export class AutomationSettingsCreator {
    /** @type {KnexAutomationSettingsRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainAutomationSettingsFinder} is initialized in the constructor */
    #automationSettingsFinder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of `AutomationSettingsCreator`.
     *
     * @param {KnexAutomationSettingsRepository} repository - The repository used to save AutomationSettings.
     */
    constructor(repository) {
        this.#repository = repository;
        this.#automationSettingsFinder = new DomainAutomationSettingsFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
    }
    /**
     * Executes the creation of a AutomationSettings object and saves it to the repository.
     *
     * @param {Object} dto - The data transfer object containing the properties for the AutomationSettings object.
     * @returns {Promise<void>} A promise that resolves when the AutomationSettings object is saved.
     */
    async execute(dto) {
        const automation = AutomationSettings.create(dto);

        const result = await this.#automationSettingsFinder.execute(automation.id.value);
        if (result) {
            throw new ValidationFailError(`AutomationSettings with id ${automation.id.value} already exists`, 'id');
        }

        await this.#uniquenessValidator.validate('description', dto.description);
        await this.#repository.save(automation);
        await this.#repository.saveHistory(automation);
    }
}
