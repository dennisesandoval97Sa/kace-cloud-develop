import { v4 as uuidv4 } from 'uuid';
import { GlobalConfigurations, Settings } from '../../../src/global-config';
import { SETTINGS, SETTINGS_WITH_WORK_QUEUE_PARAMS, SETTINGS_WITH_WORK_QUEUE_PARAMS_AUX } from './SettingsMother';
import Chance from 'chance';

const chance = new Chance();

export class GlobalConfigurationsMother {
    static settings = SETTINGS;
    /**
     * Generates a Data Transfer Object (DTO) for the `GlobalConfiguration` entity.
     *
     * @returns {Object} The DTO containing the properties for an `GlobalConfiguration` entity.
     */
    static dto({ id, description, settings } = {}) {
        return {
            id: id ?? uuidv4(),
            description: description ?? chance.word({ length: 10 }),
            settings: new Settings(settings ?? SETTINGS).value,
            is_active: true,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };
    }

    /**
     * Creates an `GlobalConfiguration` instance and saves it to the repository.
     *
     * @param {KnexGlobalConfigurationRepository} repository - The repository to save the `GlobalConfiguration` instance.
     * @returns {Promisea<GlobalConfigurations>} The created `GlobalConfiguration` instance.
     */
    static async createConfiguration(repository, overrides = {}) {
        const config = GlobalConfigurations.create(GlobalConfigurationsMother.dto(overrides));
        await repository.save(config);
        return config;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `GlobalConfiguration` entity.
     *
     * @returns {Object} The DTO containing random properties for a `GlobalConfiguration` entity.
     */
    static randomDto() {
        return {
            id: uuidv4(),
            settings: new Settings(SETTINGS).value,
            description: chance.word({ length: 10 }),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: new Date().toISOString(),
            created_by: uuidv4(),
            updated_by: uuidv4(),
            deleted_by: uuidv4(),
        };
    }

    /**
     * Creates a `GlobalConfiguration` instance with random properties and saves it to the repository.
     *
     * @param {KnexGlobalConfigurationRepository} repository - The repository to save the `GlobalConfiguration` instance.
     * @returns {Promise<GlobalConfigurations>} The created `GlobalConfiguration` instance.
     */
    static async createRandomConfig(repository) {
        const config = GlobalConfigurations.create(GlobalConfigurationsMother.randomDto());
        await repository.save(config);
        return config;
    }

    static async createWorkQueueConfig(repository) {
        const config = GlobalConfigurations.create(
            GlobalConfigurationsMother.dto({ settings: new Settings(SETTINGS_WITH_WORK_QUEUE_PARAMS).value })
        );
        await repository.save(config);
        return config;
    }

    static async createWorkQueueAuxConfig(repository, overrides = {}) {
        const SETTINGS_AUX = { ...SETTINGS_WITH_WORK_QUEUE_PARAMS_AUX, ...overrides };
        const config = GlobalConfigurations.create(
            GlobalConfigurationsMother.dto({ settings: new Settings(SETTINGS_AUX).value })
        );
        await repository.save(config);
        return config;
    }

    static async createWorkQueueAuxConfigWithSubCases(repository) {
        const settings_aux = { ...SETTINGS_WITH_WORK_QUEUE_PARAMS_AUX };
        settings_aux.behaviors.application.agente.casos.allow_close_case_without_subcases = true;
        const config = GlobalConfigurations.create(
            GlobalConfigurationsMother.dto({ settings: new Settings(settings_aux).value })
        );
        await repository.save(config);
        return config;
    }
}
