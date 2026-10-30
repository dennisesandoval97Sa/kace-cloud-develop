export class GlobalConfigResponse {
    /**
     * @type {GlobalConfigurations}
     * is initialized in the constructor
     */
    #globalConfig;
    constructor(config) {
        this.#globalConfig = config;
    }

    /**
     *
     * @returns {Object} A plain Object contains the global config data
     */
    toJson() {
        if (this.#globalConfig === null) return {};
        return {
            data: {
                id: this.#globalConfig.id.value,
                settings: this.#globalConfig.settings.value,
                description: this.#globalConfig.description.value,
                is_active: this.#globalConfig.is_active.value,
                created_at: this.#globalConfig.created_at.value,
                updated_at: this.#globalConfig.updated_at.value,
                created_by: this.#globalConfig.created_by.value,
                updated_by: this.#globalConfig.updated_by.value,
                deleted_at: this.#globalConfig.deleted_at.value,
                deleted_by: this.#globalConfig.deleted_by.value,
            },
        };
    }
}
