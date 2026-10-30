import { CustomError } from '../../../shared/errors/CustomError';
import { DomainConfigFinder } from '../../index';
import { GlobalConfigResponse } from '../GlobalConfigResponse';

export class GlobalConfigFinder {
    /** @type {DomainConfigFinder} is initialized in the constructor */
    #finder;

    /**
     *
     * @param {KnexGlobalConfigurationRepository} repository
     */
    constructor(repository) {
        this.#finder = new DomainConfigFinder(repository);
    }

    /**
     *
     * @param {String} id
     * @returns {Promise<GlobalConfigResponse>}
     */
    async execute(id) {
        const config = await this.#finder.execute(id);

        if (!config) {
            return null;
        }
        return new GlobalConfigResponse(config);
    }

    /**
     *
     * @param {String} id
     * @returns {Promise<GlobalConfigResponse>}
     */
    async getConfiguration(id, type, application, module) {
        if (!id || !type || !application || !module) {
            throw new Error('id, type, application, and module are required');
        }

        const config = await this.#finder.execute(id);
        if (!config) {
            throw new CustomError(`Configuration with id ${id} does not exist.`, 404);
        }

        const settingsType = config.settings[type];
        if (!settingsType) {
            throw new CustomError(`Settings type "${type}" not found`, 404);
        }

        const result = settingsType.getConfig(application, module);

        if (!result) {
            throw new CustomError(`Settings ${type} in ${application} with module "${module}" not found`, 404);
        }
        return result;
    }
}
