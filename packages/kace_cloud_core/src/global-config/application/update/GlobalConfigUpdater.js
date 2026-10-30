import { CustomError } from '../../../shared/errors/CustomError';
import { DomainConfigFinder } from '../../index';

export class GlobalConfigUpdater {
    /**
     * @type {KnexGlobalConfigurationRepository}
     * @private
     * is initialized in the constructor
     */
    #repository;

    /**
     * @type {DomainConfigFinder}
     * @private
     * is initialized in the constructor
     */
    #globalConfigFinder;

    /**
     *
     * @param {KnexGlobalConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
        this.#globalConfigFinder = new DomainConfigFinder(repository);
    }

    /**
     *
     * @param {Object} dtoUpdater
     * @param {String} id
     */
    async execute(dtoUpdater, id) {
        const globalConfig = await this.#globalConfigFinder.execute(id);

        if (globalConfig === null) {
            throw new CustomError('The global config you are trying update does not exist', 404);
        }

        const originalValues = globalConfig.toJson();
        globalConfig.update(dtoUpdater);

        if (!globalConfig.hasMeaningfulChanges()) {
            globalConfig.flushChanges();
            return;
        }

        await this.#repository.update(globalConfig);
        await this.#repository.saveHistory(globalConfig, originalValues);

        globalConfig.flushChanges();
    }

    async setConfiguration(id, type, application, module, data) {
        if (!type || !application || !module) {
            throw new Error('type, application, and module are required');
        }

        const config = await this.#globalConfigFinder.execute(id);
        if (!config) {
            throw new CustomError(`The global config with id ${id} does not exist.`, 404);
        }

        const settings = config.settings;
        const settingsType = settings[type];
        if (!settingsType) {
            throw new CustomError(`Settings type "${type}" not found`, 404);
        }

        const originalValues = config.toJson();

        settingsType.setConfig(application, module, data);
        config.settings = settings.value;
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        config.updated_at = new Date(); //TODO: actualizar tambien el usuario cuando se implemente el login

        // No audit-only no-op guard here: setConfiguration always reassigns `settings`, which the
        // setter unconditionally marks as changed, so this path never produces an audit-only write.
        // The repository-layer guard in KnexGlobalConfigurationRepository.update is the uniform safety net.
        await this.#repository.update(config);
        await this.#repository.saveHistory(config, originalValues);

        config.flushChanges();
    }
}
