import { GlobalConfigFinder } from './GlobalConfigFinder.js';
import { CustomError } from '../../shared/errors/CustomError.js';
import { ValidationFailError } from '../../shared/errors/ValidationFailError.js';
import { Helper } from '../../shared/index.js';

export class AgentCasesConfigFinder {
    #globalConfigFinder;

    constructor(globalConfigurationRepository) {
        this.#globalConfigFinder = new GlobalConfigFinder(globalConfigurationRepository);
    }

    /**
     * @param {object} grupo
     * @param {{ failOnError?: boolean, unavailableErrorCode?: string }} [options]
     * @returns {Promise<object>}
     */
    async execute(grupo, { failOnError = false, unavailableErrorCode } = {}) {
        if (!grupo?.configuration_id?.value) {
            Helper.logError(`AgentCasesConfigFinder: Group configuration_id is required: ${grupo?.id?.value}`);
            throw new ValidationFailError('Group configuration_id is required', 'configuration_id');
        }

        try {
            const globalConfiguration = await this.#globalConfigFinder.execute(grupo.configuration_id.value);
            return globalConfiguration.settings?.behaviors?.getConfig('agente', 'casos') || {};
        } catch (error) {
            Helper.logError(
                `AgentCasesConfigFinder: unable to load global configuration ${grupo.configuration_id.value}`,
                error
            );
            if (failOnError) {
                throw new CustomError('Global configuration is unavailable', 503, [], unavailableErrorCode);
            }
            return {};
        }
    }
}
