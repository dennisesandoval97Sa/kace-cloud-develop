export class FolioConfigurationResponse {
    /**
     * @type {FolioConfiguration}
     */
    #configuration;

    /**
     * @param {FolioConfiguration} configuration
     */
    constructor(configuration) {
        this.#configuration = configuration;
    }

    toJson() {
        if (!this.#configuration) return {};

        return {
            data: {
                id: this.#configuration.id.value,
                nombre: this.#configuration.nombre.value,
                descripcion: this.#configuration.descripcion.value,
                segments: this.#configuration.segments.value,
                reset_policy: this.#configuration.reset_policy,
                start_value: this.#configuration.start_value,
                overflow_policy: this.#configuration.overflow_policy,
                status: this.#configuration.status.value,
                created_at: this.#configuration.created_at.value,
                created_by: this.#configuration.created_by.value,
                updated_at: this.#configuration.updated_at.value,
                updated_by: this.#configuration.updated_by.value,
            },
        };
    }
}
