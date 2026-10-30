import { GlobalConfigurations } from '../../index';

export class GlobalConfigCreator {
    /** @type {KnexGlobalConfigurationRepository} is initialized in the constructor*/
    #repository;

    /**
     * @param {KnexGlobalConfigurationRepository} repository
     */
    constructor(repository) {
        this.#repository = repository;
    }

    /**
     * @param {GlobalConfigurations} dto
     */
    async execute(dto) {
        if (dto === null || dto === undefined) throw new Error('dto cannot be null or undefined');
        const creator = GlobalConfigurations.create(dto);
        await this.#repository.save(creator);
        await this.#repository.saveHistory(creator);
    }
}
