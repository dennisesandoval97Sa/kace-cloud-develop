import { GroupFinderDomain } from '../../grupos';
import { GlobalConfigFinder } from './GlobalConfigFinder';
import { User } from '../../users';
import { ErrorCollector } from '../../shared/errors/ErrorCollector.js';
import { FieldValidationRule } from './FieldValidationRule.js';
import { charLimitKey } from './settings/clientFieldCharLimits.js';

export class GlobalValidationService {
    /** @type {GroupFinderDomain} is initialized in the constructor */
    #groupFinder;

    /** @type {GlobalConfigFinder} is initialized in the constructor */
    #configFinder;

    /**
     * Creates an instance of GlobalValidationService.
     * @param {import('../../grupos').KnexGroupsRepository} groupsRepository - Group repository
     * @param {import('../../global-config').KnexGlobalConfigurationRepository} globalConfigurationRepository - Global configuration repository
     */
    constructor(groupsRepository, globalConfigurationRepository) {
        this.#groupFinder = new GroupFinderDomain(groupsRepository);
        this.#configFinder = new GlobalConfigFinder(globalConfigurationRepository);
    }

    /**
     * Validates fields based on global configuration rules.
     * @param {User} user - User with an active group
     * @param {string} role - User role ('agent', 'admin', etc.)
     * @param {string} module - Module to validate ('clients', etc.)
     * @param {object} payload - Data to validate
     * @returns {Promise<ErrorCollector>} - Validation result with collected errors
     */
    async validateFields(user, role, module, payload) {
        const config = await this.#loadValidationConfig(user, role, module);
        const errorCollector = new ErrorCollector();

        if (!config) return errorCollector;

        this.#validateRequiredFields(config, payload, errorCollector);
        this.#validateFieldLengths(config, payload, errorCollector);

        return errorCollector;
    }

    /**
     * Loads the global validation configuration for a user.
     * @private
     * @param {User} user - User with an active group
     * @param {string} role - User role
     * @param {string} module - Module to validate
     * @returns {Promise<object|null>} - Found configuration or null
     */
    async #loadValidationConfig(user, role, module) {
        const group = await this.#groupFinder.execute(user.grupo_activo.value);

        const configuration = await this.#configFinder.execute(group.configuration_id.value);
        return configuration.settings?.layouts?.getConfig(role, module);
    }

    /**
     * Validates required fields based on the configuration.
     * @private
     * @param {object} config - Global configuration
     * @param {object} payload - Data to validate
     * @param {ErrorCollector} errorCollector - Error collector instance
     */
    #validateRequiredFields(config, payload, errorCollector) {
        const requiredFields = this.#extractRequiredFields(config);
        requiredFields.forEach((field) => {
            const rule = new FieldValidationRule(field, { isRequired: true });
            rule.validate(payload[field], errorCollector);
        });
    }

    /**
     * Validates field length constraints based on the configuration.
     * @private
     * @param {object} config - Global configuration
     * @param {object} payload - Data to validate
     * @param {ErrorCollector} errorCollector - Error collector instance
     */
    #validateFieldLengths(config, payload, errorCollector) {
        const fieldsWithLengthRules = this.#extractFieldsWithLengthRules(config, payload);
        fieldsWithLengthRules.forEach(({ field, min, max }) => {
            const rule = new FieldValidationRule(field, {
                isRequired: false,
                minLength: min,
                maxLength: max,
            });
            rule.validate(payload[field], errorCollector);
        });
    }

    /**
     * Extracts the list of fields marked as required in the configuration.
     * @private
     * @param {object} config - Global configuration
     * @returns {string[]} - List of required field names
     */
    #extractRequiredFields(config) {
        return Object.entries(config.fields_required || {})
            .filter(([_, isRequired]) => isRequired)
            .map(([fieldKey]) => fieldKey.replace('field_', '').replace('_required', ''));
    }

    /**
     * Extracts fields with minimum and/or maximum length rules from the configuration.
     * @private
     * @param {object} config - Global configuration
     * @param {object} payload - Data to validate
     * @returns {{ field: string, min: number | undefined, max: number | undefined }[]} - Fields with their length rules
     */
    #extractFieldsWithLengthRules(config, payload) {
        return Object.keys(payload)
            .map((field) => ({
                field,
                min: config.fields_max_min?.[charLimitKey(field, 'min')],
                max: config.fields_max_min?.[charLimitKey(field, 'max')],
            }))
            .filter(({ min, max }) => min || max);
    }
}
